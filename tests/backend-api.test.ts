import { beforeEach, afterEach, describe, it, expect } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/server/app.js";
import { MemoryWorkspaceStore } from "../src/server/store.js";
import { AuthService, MemoryAuthStore } from "../src/server/auth.js";
import { createWorkspace } from "../src/server/seed.js";
import { RehearsalReasoningAdapter } from "../src/server/rehearsal.js";
let app: FastifyInstance;
let store: MemoryWorkspaceStore;
let authStore: MemoryAuthStore;
async function demo() {
  const response = await app.inject({ method: "POST", url: "/api/auth/demo" });
  expect(response.statusCode).toBe(200);
  return { cookie: response.cookies[0].value, user: response.json().user };
}
const headers = (cookie: string) => ({
  cookie: `secondcrate_session=${cookie}`,
});
beforeEach(async () => {
  store = new MemoryWorkspaceStore();
  authStore = new MemoryAuthStore();
  app = await createApp({
    store,
    authStore,
    reasoning: new RehearsalReasoningAdapter(),
    messaging: {
      send: async () => ({ status: "failed", error: "not configured" }),
    },
    serveStatic: false,
  });
});
afterEach(async () => {
  await app.close();
});
describe("session isolation, request validation and safe exports", () => {
  it("requires authentication for workspace endpoints", async () => {
    expect((await app.inject("/api/dashboard")).statusCode).toBe(401);
    expect((await app.inject("/api/session")).json()).toEqual({ user: null });
  });
  it("issues HttpOnly, SameSite cookies and creates independent rehearsal workspaces", async () => {
    const one = await demo();
    const two = await demo();
    expect(one.user.workspaceId).not.toBe(two.user.workspaceId);
    await app.inject({
      method: "POST",
      url: "/api/lots/lot_tomatoes/launch",
      headers: headers(one.cookie),
    });
    const untouched = await app.inject({
      url: "/api/dashboard",
      headers: headers(two.cookie),
    });
    expect(untouched.json().workspace.lots[0].status).toBe("draft");
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/demo",
    });
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Lax");
  });
  it("supports real account registration, password validation, logout and persistent login", async () => {
    const weak = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Test", email: "test@example.com", password: "short" },
    });
    expect(weak.statusCode).toBe(400);
    const data = {
      name: "Shivam Gupta",
      email: "test@example.com",
      password: "Good-password-123",
    };
    const created = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: data,
    });
    expect(created.statusCode).toBe(200);
    const secret = created.cookies[0].value;
    const dashboard = await app.inject({
      url: "/api/dashboard",
      headers: headers(secret),
    });
    expect(dashboard.json().workspace.lots).toHaveLength(0);
    expect(dashboard.json().runtime.mode).toBe("live");
    expect(dashboard.body).not.toContain("passwordHash");
    await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: headers(secret),
    });
    expect(
      (await app.inject({ url: "/api/dashboard", headers: headers(secret) }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: data.email, password: "wrong" },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: data.email, password: data.password },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: data,
        })
      ).statusCode,
    ).toBe(409);
  });
  it("blocks CSRF origins and client mode escalation", async () => {
    const { cookie } = await demo();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/demo/reset",
          headers: { ...headers(cookie), origin: "https://evil.example" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/settings",
          headers: headers(cookie),
          payload: { mode: "live" },
        })
      ).statusCode,
    ).toBe(400);
  });
  it("does not allow enabling live outreach without email verification", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: {
        name: "Test",
        email: "test@example.com",
        password: "Good-password-123",
      },
    });
    const response = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: headers(created.cookies[0].value),
      payload: { autoSend: true },
    });
    expect(response.statusCode).toBe(403);
    expect(["EMAIL_VERIFICATION_REQUIRED", "LIVE_SENDS_DISABLED"]).toContain(
      response.json().code,
    );
  });
  it("validates release, pricing, stock and delivery fields", async () => {
    const { cookie } = await demo();
    const valid = {
      product: "Carrots",
      category: "Produce",
      description: "Cancelled order",
      quantity: 10,
      unitKg: 5,
      originalPrice: 24,
      offerPrice: 18,
      floorPrice: 16,
      costPrice: 12,
      dispatchBy: new Date(Date.now() + 3600_000).toISOString(),
      deliveryBy: new Date(Date.now() + 7200_000).toISOString(),
      sourceText: "Released 10 crates",
      safetyAttested: true,
    };
    for (const change of [
      { quantity: -1 },
      { offerPrice: 10 },
      { floorPrice: 10 },
      { dispatchBy: "bad" },
      { originalPrice: 1.005 },
      { unitKg: 0 },
    ]) {
      const r = await app.inject({
        method: "POST",
        url: "/api/lots",
        headers: headers(cookie),
        payload: { ...valid, ...change },
      });
      expect(r.statusCode).toBe(400);
    }
    const result = await app.inject({
      method: "POST",
      url: "/api/lots",
      headers: headers(cookie),
      payload: valid,
    });
    expect(result.statusCode).toBe(200);
    expect(result.json().lot.status).toBe("draft");
  });
  it("prevents forged buyer IDs and requires documented consent", async () => {
    const { cookie } = await demo();
    const buyer = {
      name: "Buyer",
      contact: "Person",
      email: "b@example.com",
      phone: "",
      channel: "email",
      consent: true,
      categories: ["Produce"],
      maxCrates: 5,
      distanceKm: 2,
      deliveryBefore: "19:00",
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/buyers",
          headers: headers(cookie),
          payload: buyer,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/buyers",
          headers: headers(cookie),
          payload: {
            ...buyer,
            consentSource: "Signed account opt-in",
            id: "forced",
          },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/buyers",
          headers: headers(cookie),
          payload: { ...buyer, consentSource: "Signed account opt-in" },
        })
      ).statusCode,
    ).toBe(200);
  });
  it("exports recorded orders with spreadsheet formula injection neutralized", async () => {
    const { cookie } = await demo();
    await app.inject({
      method: "PATCH",
      url: "/api/buyers/buyer_maya",
      headers: headers(cookie),
      payload: { name: '=HYPERLINK("https://evil.example")' },
    });
    await app.inject({
      method: "POST",
      url: "/api/lots/lot_tomatoes/launch",
      headers: headers(cookie),
    });
    const order = await app.inject({
      method: "POST",
      url: "/api/inbound",
      headers: headers(cookie),
      payload: {
        buyerId: "buyer_maya",
        lotId: "lot_tomatoes",
        channel: "whatsapp",
        text: "I'll take 12 at £17",
        eventId: "api-event-1",
      },
    });
    expect(order.statusCode).toBe(200);
    const response = await app.inject({
      url: "/api/export",
      headers: headers(cookie),
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.body).toContain("'=HYPERLINK");
    expect(response.body).toContain("204.00");
  });
  it("revokes old sessions on password reset and consumes reset tokens once", async () => {
    const auth = new AuthService(authStore, store);
    const { token } = await auth.register(
      "Test",
      "test@example.com",
      "Password-12345",
    );
    const reset = await auth.issueToken("test@example.com", "reset");
    await auth.useToken(reset!, "reset", "New-password-67890");
    expect(await auth.getSession(token)).toBeNull();
    await expect(
      auth.useToken(reset!, "reset", "Third-password-123"),
    ).rejects.toThrow("expired");
    await expect(
      auth.login("test@example.com", "Password-12345"),
    ).rejects.toThrow("incorrect");
    expect(
      (await auth.login("test@example.com", "New-password-67890")).user.name,
    ).toBe("Test");
  });
  it("preserves password version across concurrent verification and two reset tokens", async () => {
    const auth = new AuthService(authStore, store);
    const original = await auth.register(
      "Race",
      "race@example.com",
      "Original-password-123",
    );
    const [first, second, verification] = await Promise.all([
      auth.issueToken("race@example.com", "reset"),
      auth.issueToken("race@example.com", "reset"),
      auth.issueToken("race@example.com", "verify"),
    ]);
    await Promise.all([
      auth.useToken(first!, "reset", "Replacement-one-123"),
      auth.useToken(second!, "reset", "Replacement-two-123"),
      auth.useToken(verification!, "verify"),
    ]);
    const record = (await authStore.get("user:race@example.com"))?.record as {
      authVersion: number;
      verified: boolean;
    };
    expect(record).toMatchObject({ authVersion: 2, verified: true });
    expect(await auth.getSession(original.token)).toBeNull();
    await expect(
      auth.login("race@example.com", "Original-password-123"),
    ).rejects.toThrow("incorrect");
    const logins = await Promise.allSettled([
      auth.login("race@example.com", "Replacement-one-123"),
      auth.login("race@example.com", "Replacement-two-123"),
    ]);
    expect(logins.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("repairs interrupted registration without deleting the protected account", async () => {
    class InterruptedStore extends MemoryWorkspaceStore {
      fail = true;
      override async create(
        workspace: Parameters<MemoryWorkspaceStore["create"]>[0],
      ) {
        if (this.fail) {
          this.fail = false;
          throw new Error("database temporarily unavailable");
        }
        return super.create(workspace);
      }
    }
    const interrupted = new InterruptedStore();
    const auth = new AuthService(authStore, interrupted);
    await expect(
      auth.register("Operator", "recover@example.com", "Strong-password-123"),
    ).rejects.toThrow("workspace setup was interrupted");
    expect(await authStore.get("user:recover@example.com")).toBeDefined();
    const result = await auth.login(
      "recover@example.com",
      "Strong-password-123",
    );
    expect(
      (await interrupted.get(result.user.workspaceId))?.settings.mode,
    ).toBe("live");
  });
  it("requires authenticated, explicit operator evidence for unknown-send reconciliation", async () => {
    const auth = new AuthService(authStore, store);
    const login = await auth.register(
      "Operator",
      "operator@example.com",
      "Strong-password-123",
    );
    const workspace = createWorkspace("Operator", true, login.user.workspaceId);
    workspace.settings.mode = "live";
    workspace.version = 1;
    workspace.messages.push({
      id: "unknown-send",
      buyerId: workspace.buyers[0].id,
      lotId: workspace.lots[0].id,
      purpose: "offer",
      channel: "whatsapp",
      direction: "outbound",
      text: "An offer with uncertain provider outcome",
      status: "unknown",
      createdAt: new Date().toISOString(),
    });
    workspace.offers.push({
      id: "offer-test",
      lotId: workspace.lots[0].id,
      buyerId: workspace.buyers[0].id,
      quantity: 16,
      unitPrice: 18,
      status: "unknown",
      createdAt: new Date().toISOString(),
    });
    await store.save(workspace, 0);
    const payload = {
      outcome: "sent",
      providerId: "provider-confirmed-001",
      evidence:
        "Provider support ticket REF-123 confirms this exact message was accepted.",
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/messages/unknown-send/reconcile",
          payload,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/messages/unknown-send/reconcile",
          headers: headers(login.token),
          payload: { outcome: "sent", evidence: payload.evidence },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/messages/unknown-send/reconcile",
          headers: headers(login.token),
          payload: { ...payload, evidence: "trust me" },
        })
      ).statusCode,
    ).toBe(400);
    const result = await app.inject({
      method: "POST",
      url: "/api/messages/unknown-send/reconcile",
      headers: headers(login.token),
      payload,
    });
    expect(result.statusCode).toBe(200);
    const state = result.json().workspace;
    expect(state.messages[0]).toMatchObject({
      status: "sent",
      providerId: payload.providerId,
    });
    expect(state.offers[0].status).toBe("sent");
    expect(state.events[0]).toMatchObject({
      actor: "operator",
      type: "operator_reconciliation",
      metadata: {
        operatorId: login.user.id,
        verificationSource: "operator",
        evidence: payload.evidence,
      },
    });
    expect(state.events[0].detail).toContain("not independently verified");
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/messages/unknown-send/reconcile",
          headers: headers(login.token),
          payload: { ...payload, outcome: "failed" },
        })
      ).statusCode,
    ).toBe(409);
    const other = await auth.register(
      "Other",
      "other@example.com",
      "Strong-password-123",
    );
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/messages/unknown-send/reconcile",
          headers: headers(other.token),
          payload,
        })
      ).statusCode,
    ).toBe(404);
  });
  it("preserves the full archive, including reconciliation evidence, without exporting credentials", async () => {
    const { cookie, user } = await demo();
    const response = await app.inject({
      url: "/api/export/archive",
      headers: headers(cookie),
    });
    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.workspace.id).toBe(user.workspaceId);
    expect(data.formatVersion).toBe(1);
    expect(data.integrity.workspaceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(data.workspace).toHaveProperty("events");
    expect(data.workspace).toHaveProperty("messages");
    expect(response.body).not.toContain("passwordHash");
    expect(response.body).not.toContain("session:");
  });
});
