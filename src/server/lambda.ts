import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import awsLambdaFastify from "@fastify/aws-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { simpleParser } from "mailparser";
import type {
  APIGatewayProxyEventV2,
  Context,
  SQSEvent,
  SQSBatchResponse,
} from "aws-lambda";
import { createApp } from "./app.js";
import { createRuntime } from "./runtime.js";
import {
  parseProviderEvent,
  resolveBuyerConversation,
  type ProviderEvent,
} from "./adapters/inbound.js";

let initialized:
  | Promise<{
      runtime: Awaited<ReturnType<typeof createRuntime>>;
      proxy: (
        event: APIGatewayProxyEventV2,
        context: Context,
      ) => Promise<unknown>;
    }>
  | undefined;
function bootstrap() {
  initialized ??= (async () => {
    const runtime = await createRuntime();
    const app = await createApp(runtime);
    const proxy = awsLambdaFastify(app);
    await app.ready();
    return { runtime, proxy };
  })();
  return initialized;
}
function secureEqual(actual: string, expected: string) {
  const left = Buffer.from(actual),
    right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
const structuredLog = (code: string) =>
  console.info(JSON.stringify({ service: "secondcrate", code }));

async function receiveEmail(
  notification: Record<string, any>,
  runtime: Awaited<ReturnType<typeof createRuntime>>,
  workspaceId: string,
): Promise<void> {
  const receipt = notification.receipt;
  // Verified SNS delivery proves the transport, not the original email sender.
  if (
    receipt.spamVerdict?.status !== "PASS" ||
    receipt.virusVerdict?.status !== "PASS" ||
    receipt.dmarcVerdict?.status !== "PASS"
  ) {
    structuredLog("EMAIL_AUTHENTICATION_OR_CONTENT_REJECTED");
    return;
  }
  let raw: string;
  if (receipt.action?.type === "S3") {
    if (
      receipt.action.bucketName !== process.env.INBOUND_MAIL_BUCKET ||
      !receipt.action.objectKey?.startsWith("incoming/")
    )
      throw new Error("Untrusted inbound email object location.");
    const object = await new S3Client({}).send(
      new GetObjectCommand({
        Bucket: receipt.action.bucketName,
        Key: receipt.action.objectKey,
      }),
    );
    if ((object.ContentLength ?? Infinity) > 256_000) {
      structuredLog("EMAIL_EXCEEDS_SIZE_LIMIT");
      return;
    }
    raw = await object.Body!.transformToString();
  } else {
    if (
      typeof notification.content !== "string" ||
      Buffer.byteLength(notification.content) > 256_000
    ) {
      structuredLog("EMAIL_CONTENT_UNAVAILABLE");
      return;
    }
    raw = notification.content;
  }
  const parsed = await simpleParser(raw, {
    skipHtmlToText: false,
    skipTextToHtml: true,
    maxHtmlLengthToParse: 256_000,
  });
  const from = parsed.from?.value;
  if (
    from?.length !== 1 ||
    !from[0].address ||
    from[0].address.toLowerCase() !==
      String(notification.mail.source).toLowerCase()
  ) {
    structuredLog("EMAIL_SENDER_MISMATCH");
    return;
  }
  const sender = from[0].address.toLowerCase();
  const text = (parsed.text ?? "").trim().slice(0, 8000);
  if (!text) {
    structuredLog("EMAIL_NO_TEXT");
    return;
  }
  const eventId = `ses:${notification.mail.messageId}`;
  const operators = (process.env.SES_OPERATOR_SENDERS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (operators.includes(sender)) {
    await runtime.service.recordCancellation(workspaceId, {
      eventId,
      text,
      subject: parsed.subject ?? "Cancellation received by email",
    });
  } else {
    await processEvent(
      {
        kind: "message",
        channel: "email",
        from: sender,
        text,
        subject: parsed.subject,
        timestamp: notification.mail.timestamp,
        eventId,
      },
      runtime,
      workspaceId,
    );
  }
}
async function processEvent(
  event: ProviderEvent,
  runtime: Awaited<ReturnType<typeof createRuntime>>,
  workspaceId: string,
): Promise<void> {
  if (event.kind === "receipt") {
    await runtime.service.recordDelivery(
      workspaceId,
      event.providerId,
      event.status,
      event.error,
      event.correlationId,
    );
    if (event.suppress) {
      const workspace = await runtime.store.get(workspaceId);
      const buyerId = workspace?.messages.find(
        (message) => message.providerId === event.providerId,
      )?.buyerId;
      if (buyerId)
        await runtime.service.optOutBuyer(
          workspaceId,
          buyerId,
          `suppression:${event.providerId}`,
        );
    }
    return;
  }
  if (event.kind === "email") {
    await receiveEmail(event.notification, runtime, workspaceId);
    return;
  }
  const workspace = await runtime.store.get(workspaceId);
  if (!workspace || workspace.settings.mode !== "live")
    throw new Error("Inbound routing requires an existing live workspace.");
  if (
    /^(stop|unsubscribe|quit|end|cancel|opt[ -]?out)$/i.test(event.text.trim())
  ) {
    const buyers = workspace.buyers.filter((buyer) =>
      event.channel === "email"
        ? buyer.email.toLowerCase() === event.from.toLowerCase()
        : buyer.phone === event.from,
    );
    if (buyers.length)
      for (const buyer of buyers)
        await runtime.service.optOutBuyer(
          workspaceId,
          buyer.id,
          buyers.length === 1 ? event.eventId : `${event.eventId}:${buyer.id}`,
        );
    else structuredLog("INBOUND_OPT_OUT_SENDER_UNRESOLVED");
    return;
  }
  const conversation = resolveBuyerConversation(workspace, event);
  if (!conversation) {
    const buyers = workspace.buyers.filter((buyer) =>
      event.channel === "email"
        ? buyer.email.toLowerCase() === event.from.toLowerCase()
        : buyer.phone === event.from,
    );
    await runtime.service.recordUnmatchedInbound(workspaceId, {
      eventId: event.eventId,
      channel: event.channel,
      buyerId: buyers.length === 1 ? buyers[0].id : undefined,
      text: event.text,
      reason:
        buyers.length === 1
          ? "More than one lot or no matching offer. Operator review is required; no order was placed."
          : "Sender could not be uniquely matched to an existing buyer. No order was placed.",
    });
    structuredLog("INBOUND_BUYER_OR_CONVERSATION_UNRESOLVED");
    return;
  }
  await runtime.service.processInbound(
    workspaceId,
    {
      ...conversation,
      channel: event.channel,
      text: event.text,
      eventId: event.eventId,
    },
    { trusted: true, receivedAt: event.timestamp },
  );
}
export async function handler(
  event:
    | APIGatewayProxyEventV2
    | SQSEvent
    | { source: "secondcrate.maintenance"; action: "flush_outbox" },
  context: Context,
): Promise<unknown> {
  if ("source" in event) {
    if (
      event.source !== "secondcrate.maintenance" ||
      event.action !== "flush_outbox"
    )
      throw new Error("Unknown maintenance event.");
    if (
      !process.env.SINGLE_LIVE_WORKSPACE_ID ||
      process.env.LIVE_SENDS_ENABLED !== "true"
    )
      return { skipped: true };
    const { runtime } = await bootstrap();
    await runtime.service.flush(process.env.SINGLE_LIVE_WORKSPACE_ID);
    return { ok: true };
  }
  if ("Records" in event) {
    const { runtime } = await bootstrap();
    const response: SQSBatchResponse = { batchItemFailures: [] };
    for (const record of event.Records) {
      try {
        if (record.eventSource !== "aws:sqs")
          throw new Error("Unsupported event source.");
        const envelope = JSON.parse(record.body);
        if (
          !process.env.TRUSTED_SNS_TOPIC_ARN ||
          envelope.Type !== "Notification" ||
          envelope.TopicArn !== process.env.TRUSTED_SNS_TOPIC_ARN
        )
          throw new Error("Unexpected SNS source.");
        if (!process.env.SINGLE_LIVE_WORKSPACE_ID)
          throw new Error("No live workspace configured for provider events.");
        const events = parseProviderEvent(JSON.parse(envelope.Message));
        for (const normalized of events) {
          // SMS has no customer timestamp in the two-way payload; the trusted
          // SNS publication time gives a stable replay/ordering boundary.
          if (
            normalized.kind === "message" &&
            normalized.channel === "sms" &&
            typeof envelope.Timestamp === "string"
          )
            normalized.timestamp = envelope.Timestamp;
          await processEvent(
            normalized,
            runtime,
            process.env.SINGLE_LIVE_WORKSPACE_ID,
          );
        }
      } catch {
        structuredLog("INBOUND_PROCESSING_FAILED");
        response.batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
    return response;
  }
  if (
    process.env.ORIGIN_VERIFY_SECRET &&
    !secureEqual(
      event.headers?.["x-secondcrate-origin"] ?? "",
      process.env.ORIGIN_VERIFY_SECRET,
    )
  ) {
    return {
      statusCode: 403,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: "Use the project URL.",
        code: "ORIGIN_REQUIRED",
      }),
    };
  }
  // CloudFront overwrites this header; only trust it after origin verification.
  // API Gateway otherwise exposes the shared CDN edge IP to rate limiting.
  const viewerIp = event.headers?.["x-secondcrate-client-ip"];
  if (
    process.env.ORIGIN_VERIFY_SECRET &&
    viewerIp &&
    isIP(viewerIp) &&
    event.requestContext?.http
  )
    event.requestContext.http.sourceIp = viewerIp;
  const { proxy } = await bootstrap();
  return proxy(event, context);
}
