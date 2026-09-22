import Fastify, { LogController, type FastifyReply } from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type {
  Buyer,
  MessagingAdapter,
  ReasoningAdapter,
  RuntimeStatus,
  SessionUser,
  WorkspaceStore,
} from "../shared/types.js";
import { AuthService, digest, type AuthStore } from "./auth.js";
import { AppError } from "./errors.js";
import { RecoveryService } from "./service.js";
import { createRuntime } from "./runtime.js";

const short = z.string().trim().min(1).max(180);
const email = z
  .email()
  .max(254)
  .transform((x) => x.toLowerCase().trim());
const password = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128)
  .regex(/[a-zA-Z]/, "Include a letter.")
  .regex(/\d/, "Include a number.");
const amount = z
  .number()
  .finite()
  .positive()
  .max(100_000)
  .refine(
    (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6,
    "Use at most two decimal places.",
  );
const timestamp = z.iso.datetime({ offset: true });
const phone = z
  .string()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Use an international phone number, for example +447700900123.",
  )
  .or(z.literal(""));
const buyerSchema = z
  .object({
    name: short,
    contact: short,
    email: email.or(z.literal("")),
    phone,
    channel: z.enum(["email", "sms", "whatsapp"]),
    consent: z.boolean(),
    consentAt: timestamp.optional(),
    consentSource: z.string().trim().max(500).optional(),
    optedOut: z.boolean().optional(),
    categories: z.array(short).min(1).max(20),
    maxCrates: z.number().int().min(1).max(100_000),
    distanceKm: z.number().min(0).max(500),
    deliveryBefore: z
      .string()
      .regex(
        /^(?:[01]\d|2[0-3]):[0-5]\d$/,
        "Use a 24-hour London delivery time (HH:mm).",
      ),
  })
  .strict();
const lotSchema = z
  .object({
    product: short,
    category: short,
    description: z.string().max(2000).default(""),
    quantity: z.number().int().min(1).max(100_000),
    unitKg: z.number().positive().max(1000),
    originalPrice: amount,
    floorPrice: amount,
    offerPrice: amount,
    costPrice: amount,
    dispatchBy: timestamp,
    deliveryBy: timestamp,
    sourceText: z.string().max(10_000).default(""),
    safetyAttested: z.boolean(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!(
      data.originalPrice >= data.offerPrice &&
      data.offerPrice >= data.floorPrice &&
      data.floorPrice >= data.costPrice
    ))
      ctx.addIssue({
        code: "custom",
        message: "Prices must satisfy original ≥ offer ≥ floor ≥ book cost.",
        path: ["floorPrice"],
      });
    if (Date.parse(data.dispatchBy) <= Date.now())
      ctx.addIssue({
        code: "custom",
        message: "Dispatch cutoff must be in the future.",
        path: ["dispatchBy"],
      });
    if (Date.parse(data.deliveryBy) < Date.parse(data.dispatchBy))
      ctx.addIssue({
        code: "custom",
        message: "Delivery must be at or after the dispatch cutoff.",
        path: ["deliveryBy"],
      });
  });
function validateBuyer(buyer: Buyer | Omit<Buyer, "id">) {
  if (buyer.consent && !buyer.consentSource?.trim())
    throw new AppError(400, "Record the source of marketing consent.");
  if (buyer.channel === "email" ? !buyer.email : !buyer.phone)
    throw new AppError(400, "Provide a contact for the preferred channel.");
  if (buyer.optedOut && buyer.consent)
    throw new AppError(400, "An opted-out buyer cannot have active consent.");
}
export interface AppOptions {
  store?: WorkspaceStore;
  messaging?: MessagingAdapter;
  reasoning?: ReasoningAdapter;
  authStore?: AuthStore;
  runtime?: Partial<RuntimeStatus>;
  service?: RecoveryService;
  logger?: boolean;
  serveStatic?: boolean;
}
export async function createApp(options: AppOptions = {}) {
  const defaults = createRuntime();
  const store = options.store || defaults.store;
  const messaging = options.messaging || defaults.messaging;
  const reasoning = options.reasoning || defaults.reasoning;
  const auth = new AuthService(options.authStore || defaults.authStore, store);
  const service =
    options.service || new RecoveryService(store, messaging, reasoning);
  const runtime = { ...defaults.runtime, ...options.runtime };
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 32_768,
    logController: new LogController({ disableRequestLogging: true }),
  });
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
  });
  app.decorateRequest("user", null);
  app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
      if (req.headers["sec-fetch-site"] === "cross-site")
        throw new AppError(
          403,
          "Cross-site requests are not allowed.",
          "ORIGIN_REJECTED",
        );
      const origin = req.headers.origin;
      const forwardedHost =
        process.env.ORIGIN_VERIFY_SECRET &&
        req.headers["x-secondcrate-origin"] === process.env.ORIGIN_VERIFY_SECRET
          ? req.headers["x-forwarded-host"]
          : undefined;
      const host = forwardedHost || req.headers.host;
      if (origin) {
        let allowed = false;
        try {
          allowed = process.env.APP_ORIGIN
            ? new URL(origin).origin === new URL(process.env.APP_ORIGIN).origin
            : new URL(origin).host === host;
        } catch {}
        if (!allowed)
          throw new AppError(
            403,
            "Request origin does not match this application.",
            "ORIGIN_REJECTED",
          );
      }
    }
    if (
      req.url.startsWith("/api/") &&
      !req.url.startsWith("/api/auth/") &&
      !req.url.startsWith("/api/session") &&
      !req.url.startsWith("/api/health")
    ) {
      const user = await auth.getSession(req.cookies.secondcrate_session);
      if (!user)
        throw new AppError(401, "Sign in to continue.", "UNAUTHENTICATED");
      (req as typeof req & { user: SessionUser }).user = user;
    }
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof z.ZodError)
      return reply.status(400).send({
        error: error.issues
          .map(
            (i) =>
              `${i.path.join(".") ? `${i.path.join(".")}: ` : ""}${i.message}`,
          )
          .join(" "),
        code: "VALIDATION_ERROR",
      });
    if (error instanceof AppError)
      return reply
        .status(error.statusCode)
        .send({ error: error.message, code: error.code });
    const code = (error as { statusCode?: number }).statusCode;
    if (code && code >= 400 && code < 500)
      return reply
        .status(code)
        .send({ error: "Invalid request.", code: "INVALID_REQUEST" });
    req.log.error({ err: error }, "Request failed");
    return reply.status(500).send({
      error: "The request could not be completed. Please try again.",
      code: "INTERNAL_ERROR",
    });
  });
  const getUser = (req: unknown) => (req as { user: SessionUser }).user;
  const setSession = (reply: FastifyReply, token: string) =>
    reply.setCookie("secondcrate_session", token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 3600,
    });
  const sensitiveLimit = async (ip: string, key: string, limit = 10) => {
    await auth.rateLimit(`ip:${ip}`, 40);
    await auth.rateLimit(key, limit);
  };
  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/session", async (req) => ({
    user: await auth.getSession(req.cookies.secondcrate_session),
  }));
  app.post("/api/auth/demo", async (req, reply) => {
    await sensitiveLimit(req.ip, `demo:${req.ip}`, 20);
    const result = await auth.demo();
    setSession(reply, result.token);
    return { user: result.user };
  });
  app.post("/api/auth/register", async (req, reply) => {
    if (process.env.ALLOW_REGISTRATION === "false")
      throw new AppError(
        403,
        "Registration is restricted on this deployment. Ask the operator to create access.",
        "REGISTRATION_DISABLED",
      );
    const data = z
      .object({ name: short, email, password })
      .strict()
      .parse(req.body);
    await sensitiveLimit(req.ip, `register:${data.email}`);
    const result = await auth.register(data.name, data.email, data.password);
    setSession(reply, result.token);
    return { user: result.user };
  });
  app.post("/api/auth/login", async (req, reply) => {
    const data = z
      .object({ email, password: z.string().min(1).max(128) })
      .strict()
      .parse(req.body);
    await sensitiveLimit(req.ip, `login:${data.email}`);
    const result = await auth.login(data.email, data.password);
    setSession(reply, result.token);
    return { user: result.user };
  });
  app.post("/api/auth/logout", async (req, reply) => {
    await auth.logout(req.cookies.secondcrate_session);
    reply.clearCookie("secondcrate_session", { path: "/" });
    return { ok: true };
  });
  app.post("/api/auth/send-verification", async (req) => {
    const user = await auth.getSession(req.cookies.secondcrate_session);
    if (!user || user.isDemo)
      throw new AppError(
        401,
        "Sign in with a real account to verify your email.",
      );
    await sensitiveLimit(req.ip, `verify:${user.email}`, 3);
    if (!runtime.channels.email || !process.env.APP_ORIGIN)
      throw new AppError(
        503,
        "Email verification requires SES_FROM_EMAIL and APP_ORIGIN to be configured.",
        "EMAIL_NOT_CONFIGURED",
      );
    const token = await auth.issueToken(user.email, "verify");
    const result = await messaging.send({
      channel: "email",
      to: user.email,
      subject: "Verify your SecondCrate email",
      text: `Verify your SecondCrate account: ${process.env.APP_ORIGIN}/?verify=${token}\nThis link expires in one hour.`,
      idempotencyKey: `verify-${token}`,
    });
    if (!["sent", "delivered"].includes(result.status))
      throw new AppError(
        503,
        "Verification email could not be sent. Ask the operator to check SES delivery.",
        "EMAIL_SEND_FAILED",
      );
    return { ok: true };
  });
  app.post("/api/auth/verify", async (req) => {
    const { token } = z
      .object({ token: z.string().min(20).max(100) })
      .parse(req.body);
    await auth.useToken(token, "verify");
    return { ok: true };
  });
  app.post("/api/auth/forgot-password", async (req) => {
    const data = z.object({ email }).parse(req.body);
    await sensitiveLimit(req.ip, `reset:${data.email}`, 3);
    if (!runtime.channels.email || !process.env.APP_ORIGIN)
      throw new AppError(
        503,
        "Password recovery requires a configured SES sender and APP_ORIGIN. Contact the deployment operator.",
        "EMAIL_NOT_CONFIGURED",
      );
    const token = await auth.issueToken(data.email, "reset");
    if (token)
      await messaging.send({
        channel: "email",
        to: data.email,
        subject: "Reset your SecondCrate password",
        text: `Reset your password: ${process.env.APP_ORIGIN}/?reset=${token}\nThis link expires in one hour.`,
        idempotencyKey: `reset-${token}`,
      });
    return {
      ok: true,
      message:
        "If that account exists, password reset instructions have been requested.",
    };
  });
  app.post("/api/auth/reset-password", async (req) => {
    const data = z
      .object({ token: z.string().min(20).max(100), password })
      .parse(req.body);
    await auth.useToken(data.token, "reset", data.password);
    return { ok: true };
  });
  app.get("/api/dashboard", async (req) => {
    const user = getUser(req);
    const workspace = await service.get(user.workspaceId);
    return {
      workspace,
      runtime: { ...runtime, mode: workspace.settings.mode },
      user,
      emailVerified: await auth.isVerified(user),
    };
  });
  app.post("/api/lots", async (req) =>
    service.addLot(getUser(req).workspaceId, lotSchema.parse(req.body)),
  );
  app.post("/api/lots/extract", async (req) => {
    const { text } = z
      .object({ text: z.string().min(10).max(10_000) })
      .parse(req.body);
    const quantity = text.match(/(\d+)\s*crates?/i);
    const weight = text.match(/(\d+(?:\.\d+)?)\s*kg/i);
    const original = text.match(/(?:original|price)\s*[:£ ]+([\d.]+)/i);
    const offer = text.match(/offer\s*[:£ ]+([\d.]+)/i);
    const floor = text.match(/floor\s*[:£ ]+([\d.]+)/i);
    const product = text
      .match(/crates?\s+(?:of\s+)?([^,.;\n]+)/i)?.[1]
      ?.replace(/\s*\d+(?:\.\d+)?\s*kg.*$/i, "")
      .trim();
    return {
      draft: {
        product: product || "",
        category: "produce",
        quantity: quantity ? Number(quantity[1]) : undefined,
        unitKg: weight ? Number(weight[1]) : undefined,
        originalPrice: original ? Number(original[1]) : undefined,
        offerPrice: offer ? Number(offer[1]) : undefined,
        floorPrice: floor ? Number(floor[1]) : undefined,
        sourceText: text,
        safetyAttested: false,
      },
      model: "Assisted extraction / local rules — operator review required",
    };
  });
  app.post("/api/lots/:id/launch", async (req) => {
    const user = getUser(req);
    return service.launch(
      user.workspaceId,
      z.object({ id: short }).parse(req.params).id,
    );
  });
  app.post("/api/lots/:id/close", async (req) => {
    const { workspace } = await service.close(
      getUser(req).workspaceId,
      z.object({ id: short }).parse(req.params).id,
    );
    return { workspace };
  });
  app.post("/api/orders/:id/dispatch", async (req) => {
    const { workspace } = await service.dispatch(
      getUser(req).workspaceId,
      z.object({ id: short }).parse(req.params).id,
    );
    return { workspace };
  });
  app.post("/api/inbound", async (req) => {
    await auth.rateLimit(`inbound:${getUser(req).workspaceId}`, 60);
    await auth.rateLimit(`inbound-ip:${req.ip}`, 120);
    const input = z
      .object({
        buyerId: short,
        lotId: short,
        channel: z.enum(["email", "sms", "whatsapp"]),
        text: z.string().trim().min(1).max(4000),
        eventId: z
          .string()
          .min(8)
          .max(150)
          .regex(/^[a-zA-Z0-9:_-]+$/),
      })
      .strict()
      .parse(req.body);
    return service.processInbound(getUser(req).workspaceId, input);
  });
  app.post("/api/buyers", async (req) => {
    const buyer = buyerSchema.parse(req.body);
    validateBuyer(buyer);
    return service.addBuyer(getUser(req).workspaceId, buyer);
  });
  app.patch("/api/buyers/:id", async (req) => {
    const input = buyerSchema.partial().parse(req.body);
    const id = z.object({ id: short }).parse(req.params).id;
    const workspace = await service.get(getUser(req).workspaceId);
    const buyer = workspace.buyers.find((b) => b.id === id);
    if (!buyer) throw new AppError(404, "Buyer not found.");
    validateBuyer({ ...buyer, ...input });
    return service.updateBuyer(workspace.id, id, input);
  });
  app.patch("/api/settings", async (req) => {
    const input = z
      .object({
        companyName: short.optional(),
        operatorName: short.optional(),
        autoSend: z.boolean().optional(),
        maxDiscountPercent: z.number().min(0).max(80).optional(),
      })
      .strict()
      .parse(req.body);
    const user = getUser(req);
    if (input.autoSend && !user.isDemo) {
      if (process.env.LIVE_SENDS_ENABLED !== "true")
        throw new AppError(
          403,
          "The deployment operator has not enabled live sending.",
          "LIVE_SENDS_DISABLED",
        );
      if (
        process.env.SINGLE_LIVE_WORKSPACE_ID &&
        process.env.SINGLE_LIVE_WORKSPACE_ID !== user.workspaceId
      )
        throw new AppError(
          403,
          "This workspace is not provisioned for live sending.",
          "WORKSPACE_NOT_PROVISIONED",
        );
      if (!(await auth.isVerified(user)))
        throw new AppError(
          403,
          "Verify your email before enabling live sends.",
          "EMAIL_VERIFICATION_REQUIRED",
        );
      if (!Object.values(runtime.channels).some(Boolean))
        throw new AppError(
          409,
          "Configure an AWS communications channel first.",
          "CHANNEL_NOT_CONFIGURED",
        );
      if (runtime.ai !== "bedrock")
        throw new AppError(
          409,
          "Configure Amazon Bedrock before enabling live recovery.",
          "AI_NOT_CONFIGURED",
        );
    }
    return service.settings(user.workspaceId, input);
  });
  app.post("/api/demo/reset", async (req) =>
    service.reset(getUser(req).workspaceId),
  );
  app.post("/api/messages/:id/reconcile", async (req) => {
    const input = z
      .object({
        outcome: z.enum(["sent", "failed"]),
        providerId: z.string().trim().min(1).max(256).optional(),
        evidence: z.string().trim().min(20).max(2000),
      })
      .strict()
      .parse(req.body);
    const { id } = z.object({ id: short }).parse(req.params);
    const user = getUser(req);
    return service.reconcileMessage(user.workspaceId, id, input, user.id);
  });
  app.post("/api/outbox/flush", async (req) => ({
    workspace: await service.flush(getUser(req).workspaceId),
  }));
  app.get("/api/export/archive", async (req, reply) => {
    const workspace = await service.get(getUser(req).workspaceId);
    reply
      .type("application/json; charset=utf-8")
      .header(
        "Content-Disposition",
        'attachment; filename="secondcrate-workspace-archive.json"',
      );
    return {
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
      integrity: {
        algorithm: "sha256",
        workspaceHash: digest(JSON.stringify(workspace)),
      },
      workspace,
    };
  });
  app.get("/api/export", async (req, reply) => {
    const workspace = await service.get(getUser(req).workspaceId);
    const cell = (value: unknown) => {
      let text = String(value ?? "");
      if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [
      [
        "Confirmation",
        "Buyer",
        "Product",
        "Crates",
        "Unit price GBP",
        "Total GBP",
        "Status",
        "Created at",
      ],
      ...workspace.orders.map((order) => [
        order.confirmationCode,
        workspace.buyers.find((b) => b.id === order.buyerId)?.name,
        workspace.lots.find((l) => l.id === order.lotId)?.product,
        order.quantity,
        order.unitPrice.toFixed(2),
        order.total.toFixed(2),
        order.status,
        order.createdAt,
      ]),
    ];
    reply
      .type("text/csv; charset=utf-8")
      .header(
        "Content-Disposition",
        'attachment; filename="secondcrate-orders.csv"',
      );
    return rows.map((row) => row.map(cell).join(",")).join("\r\n");
  });
  if (options.serveStatic !== false && existsSync(resolve("dist/index.html"))) {
    await app.register(fastifyStatic, { root: resolve("dist"), prefix: "/" });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.status(404).send({ error: "Endpoint not found." })
        : reply.sendFile("index.html"),
    );
  }
  await app.ready();
  return app;
}
