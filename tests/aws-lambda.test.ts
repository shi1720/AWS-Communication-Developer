import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import type { APIGatewayProxyEventV2, Context, SQSEvent } from "aws-lambda";
const mocks = vi.hoisted(() => ({
  inbound: vi.fn(),
  receipt: vi.fn(),
  optout: vi.fn(),
  storeGet: vi.fn(),
  flush: vi.fn(),
  unmatched: vi.fn(),
}));
vi.mock("../src/server/runtime.js", () => ({
  createRuntime: () => ({
    store: { get: mocks.storeGet },
    service: {
      processInbound: mocks.inbound,
      recordDelivery: mocks.receipt,
      optOutBuyer: mocks.optout,
      flush: mocks.flush,
      recordUnmatchedInbound: mocks.unmatched,
    },
  }),
}));
vi.mock("../src/server/app.js", () => ({ createApp: async () => Fastify() }));
import { handler } from "../src/server/lambda.js";
const context = {} as Context;
const record = (data: unknown, topic = "arn:aws:sns:eu-west-2:123:trusted") =>
  ({
    Records: [
      {
        messageId: "queue-1",
        eventSource: "aws:sqs",
        body: JSON.stringify({
          Type: "Notification",
          TopicArn: topic,
          Message: JSON.stringify(data),
        }),
      },
    ],
  }) as SQSEvent;
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("AWS Lambda transport boundary", () => {
  it("rejects bypassing the CloudFront origin before initializing the application", async () => {
    vi.stubEnv("ORIGIN_VERIFY_SECRET", "private-origin");
    expect(
      await handler(
        {
          headers: { "x-secondcrate-origin": "incorrect" },
        } as unknown as APIGatewayProxyEventV2,
        context,
      ),
    ).toMatchObject({ statusCode: 403 });
    expect(mocks.inbound).not.toHaveBeenCalled();
  });
  it("returns partial batch failure for untrusted topic rather than dispatching", async () => {
    vi.stubEnv("TRUSTED_SNS_TOPIC_ARN", "arn:aws:sns:eu-west-2:123:trusted");
    vi.stubEnv("SINGLE_LIVE_WORKSPACE_ID", "live");
    expect(await handler(record({}, "arn:untrusted"), context)).toEqual({
      batchItemFailures: [{ itemIdentifier: "queue-1" }],
    });
    expect(mocks.inbound).not.toHaveBeenCalled();
  });
  it("routes unsubscribe even without an active offer", async () => {
    vi.stubEnv("TRUSTED_SNS_TOPIC_ARN", "arn:aws:sns:eu-west-2:123:trusted");
    vi.stubEnv("SINGLE_LIVE_WORKSPACE_ID", "live");
    mocks.storeGet.mockResolvedValue({
      settings: { mode: "live" },
      buyers: [{ id: "buyer-1", phone: "+447700900123" }],
      offers: [],
      lots: [],
    });
    expect(
      await handler(
        record({
          originationNumber: "+447700900123",
          messageBody: "STOP",
          inboundMessageId: "stop-1",
        }),
        context,
      ),
    ).toEqual({ batchItemFailures: [] });
    expect(mocks.optout).toHaveBeenCalledWith("live", "buyer-1", "sms:stop-1");
    expect(mocks.inbound).not.toHaveBeenCalled();
  });
  it("dispatches trusted delivery receipts independently of the buyer conversation", async () => {
    vi.stubEnv("TRUSTED_SNS_TOPIC_ARN", "arn:aws:sns:eu-west-2:123:trusted");
    vi.stubEnv("SINGLE_LIVE_WORKSPACE_ID", "live");
    expect(
      await handler(
        record({ eventType: "Delivery", mail: { messageId: "ses-1" } }),
        context,
      ),
    ).toEqual({ batchItemFailures: [] });
    expect(mocks.receipt).toHaveBeenCalledWith(
      "live",
      "ses-1",
      "delivered",
      undefined,
      undefined,
    );
  });
});

describe("Outbox recovery and operator review", () => {
  it("only drains the configured live outbox when live sends are enabled", async () => {
    vi.stubEnv("SINGLE_LIVE_WORKSPACE_ID", "live");
    vi.stubEnv("LIVE_SENDS_ENABLED", "false");
    expect(
      await handler(
        { source: "secondcrate.maintenance", action: "flush_outbox" },
        context,
      ),
    ).toEqual({ skipped: true });
    expect(mocks.flush).not.toHaveBeenCalled();
    vi.stubEnv("LIVE_SENDS_ENABLED", "true");
    expect(
      await handler(
        { source: "secondcrate.maintenance", action: "flush_outbox" },
        context,
      ),
    ).toEqual({ ok: true });
    expect(mocks.flush).toHaveBeenCalledWith("live");
  });
  it("retains unresolved messages for operator review rather than silently discarding them", async () => {
    vi.stubEnv("TRUSTED_SNS_TOPIC_ARN", "arn:aws:sns:eu-west-2:123:trusted");
    vi.stubEnv("SINGLE_LIVE_WORKSPACE_ID", "live");
    mocks.storeGet.mockResolvedValue({
      settings: { mode: "live" },
      buyers: [{ id: "buyer-1", phone: "+447700900123" }],
      offers: [],
      lots: [],
      messages: [],
    });
    await handler(
      record({
        originationNumber: "+447700900123",
        messageBody: "Take 8",
        inboundMessageId: "unmatched-1",
      }),
      context,
    );
    expect(mocks.unmatched).toHaveBeenCalledWith(
      "live",
      expect.objectContaining({
        buyerId: "buyer-1",
        text: "Take 8",
        eventId: "sms:unmatched-1",
      }),
    );
    expect(mocks.inbound).not.toHaveBeenCalled();
  });
});
