import { describe, expect, it, vi } from "vitest";
import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { SendWhatsAppMessageCommand } from "@aws-sdk/client-socialmessaging";
import { SendTextMessageCommand } from "@aws-sdk/client-pinpoint-sms-voice-v2";
import { ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { AWSMessagingAdapter } from "../src/server/adapters/messaging.js";
import { BedrockReasoningAdapter } from "../src/server/adapters/reasoning.js";
import {
  DynamoWorkspaceStore,
  WorkspaceCapacityError,
} from "../src/server/adapters/store.js";
import {
  parseProviderEvent,
  resolveBuyerConversation,
} from "../src/server/adapters/inbound.js";
import { ConflictError } from "../src/server/errors.js";
import type { AgentContext, Workspace } from "../src/shared/types.js";

const workspace = (): Workspace => ({
  id: "test",
  version: 1,
  lots: [],
  buyers: [],
  offers: [],
  messages: [],
  orders: [],
  events: [],
  settings: {
    mode: "live",
    autoSend: false,
    companyName: "Test",
    operatorName: "Test",
    maxDiscountPercent: 25,
  },
  processedEvents: [],
});
const payload = {
  channel: "email" as const,
  to: "buyer@example.com",
  text: "Order confirmed.",
  idempotencyKey: "event-1",
};

describe("AWS CDS sends", () => {
  it("calls SES SendEmail and records provider acceptance without claiming delivery", async () => {
    const send = vi.fn().mockResolvedValue({ MessageId: "ses-1" });
    const adapter = new AWSMessagingAdapter({
      region: "eu-west-2",
      sesFromEmail: "seller@example.com",
      clients: { ses: { send } },
    });
    expect(await adapter.send(payload)).toEqual({
      status: "sent",
      providerId: "ses-1",
    });
    expect(send.mock.calls[0][0]).toBeInstanceOf(SendEmailCommand);
    expect(send.mock.calls[0][0].input.Destination.ToAddresses).toEqual([
      "buyer@example.com",
    ]);
  });
  it("sends approved WhatsApp template through AWS Social and blocks expired freeform", async () => {
    const send = vi.fn().mockResolvedValue({ messageId: "wa-1" });
    const adapter = new AWSMessagingAdapter({
      region: "eu-west-2",
      whatsappPhoneNumberId: "phone-number-id-example",
      whatsappMetaApiVersion: "v23.0",
      clients: { whatsapp: { send } },
    });
    const message = {
      ...payload,
      channel: "whatsapp" as const,
      to: "+447700900123",
    };
    expect((await adapter.send(message)).status).toBe("failed");
    expect(send).not.toHaveBeenCalled();
    expect(
      (
        await adapter.send({
          ...message,
          template: {
            name: "secondcrate_surplus",
            language: "en_GB",
            parameters: ["Cherry tomatoes", "18.00"],
          },
        })
      ).status,
    ).toBe("sent");
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(SendWhatsAppMessageCommand);
    expect(
      JSON.parse(Buffer.from(command.input.message).toString()).template.name,
    ).toBe("secondcrate_surplus");
    expect(command.input.originationPhoneNumberId).toBe(
      "phone-number-id-example",
    );
  });
  it("uses promotional SMS classification and a bounded TTL", async () => {
    const send = vi.fn().mockResolvedValue({ MessageId: "sms-1" });
    const adapter = new AWSMessagingAdapter({
      region: "eu-west-2",
      smsOriginationIdentity: "number-id",
      clients: { sms: { send } },
    });
    await adapter.send({ ...payload, channel: "sms", to: "+447700900123" });
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(SendTextMessageCommand);
    expect(command.input).toMatchObject({
      MessageType: "PROMOTIONAL",
      TimeToLive: 3600,
    });
  });
  it("does not fake configuration success or leak provider errors containing PII", async () => {
    const adapter = new AWSMessagingAdapter({ region: "eu-west-2" });
    expect((await adapter.send(payload)).status).toBe("failed");
    const send = vi
      .fn()
      .mockRejectedValue(new Error("ECONNRESET buyer@example.com secret"));
    const configured = new AWSMessagingAdapter({
      region: "eu-west-2",
      sesFromEmail: "seller@example.com",
      clients: { ses: { send } },
    });
    const result = await configured.send(payload);
    expect(result.status).toBe("unknown");
    expect(result.error).not.toContain("buyer@");
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("Bedrock intent boundary", () => {
  const context = {
    workspace: workspace(),
    text: "Take 8 crates at £17",
    lot: {
      id: "lot-one",
      product: "Cherry tomatoes",
      unit: "crate",
      unitKg: 5,
      available: 40,
      offerPrice: 18,
      deliveryBy: "14:00",
    },
    buyer: { id: "buyer-one", maxCrates: 20, deliveryBefore: "14:00" },
  } as AgentContext;
  it("calls Converse with forced constrained tool and excludes buyer contact data", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({
        output: {
          message: {
            content: [
              {
                toolUse: {
                  name: "record_buyer_intent",
                  input: { intent: "negotiate", quantity: 8, unitPrice: 17 },
                },
              },
            ],
          },
        },
        usage: { inputTokens: 500, outputTokens: 30 },
      });
    const adapter = new BedrockReasoningAdapter({
      region: "eu-west-2",
      modelId: "model",
      client: { send },
    });
    const result = await adapter.decide(context);
    expect(result.decision).toEqual({
      intent: "negotiate",
      quantity: 8,
      unitPrice: 17,
    });
    expect(send.mock.calls[0][0]).toBeInstanceOf(ConverseCommand);
    expect(send.mock.calls[0][0].input.toolConfig.toolChoice.tool.name).toBe(
      "record_buyer_intent",
    );
    expect(result.inputTokens).toBe(500);
  });
  it("rejects malformed model tools rather than using prose as an order instruction", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({
        output: {
          message: {
            content: [
              {
                toolUse: {
                  name: "record_buyer_intent",
                  input: { intent: "accept", quantity: -20, execute: "delete" },
                },
              },
            ],
          },
        },
      });
    await expect(
      new BedrockReasoningAdapter({
        region: "eu-west-2",
        modelId: "model",
        client: { send },
      }).decide(context),
    ).rejects.toThrow();
  });
});

describe("Durable state concurrency", () => {
  it("uses consistent reads and conditional writes to prevent overselling", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ Item: { version: 1, workspace: workspace() } });
    const store = new DynamoWorkspaceStore({
      region: "eu-west-2",
      tableName: "state",
      client: { send },
    });
    await store.get("test");
    expect(send.mock.calls[0][0].input.ConsistentRead).toBe(true);
    await store.save({ ...workspace(), version: 2 }, 1);
    expect(
      send.mock.calls[2][0].input.TransactItems.find(
        (item: any) => item.Put?.Item.sk === "STATE",
      ).Put,
    ).toMatchObject({
      ConditionExpression: "#version = :expected",
      ExpressionAttributeValues: { ":expected": 1 },
    });
    send
      .mockResolvedValueOnce({ Item: { version: 1, workspace: workspace() } })
      .mockRejectedValueOnce(
        Object.assign(new Error("race"), {
          name: "ConditionalCheckFailedException",
        }),
      );
    await expect(
      store.save({ ...workspace(), version: 2 }, 1),
    ).rejects.toBeInstanceOf(ConflictError);
  });
  it("fails before 400 KB Dynamo limit without truncating audit evidence", async () => {
    const send = vi.fn();
    const state = workspace();
    state.processedEvents = ["x".repeat(2000001)];
    await expect(
      new DynamoWorkspaceStore({
        region: "eu-west-2",
        tableName: "state",
        client: { send },
      }).create(state),
    ).rejects.toBeInstanceOf(WorkspaceCapacityError);
    expect(send).not.toHaveBeenCalled();
  });
});

describe("Provider webhook normalization", () => {
  it("normalizes real AWS wrapped WhatsApp text and receipts", () => {
    expect(
      parseProviderEvent({
        whatsAppWebhookEntry: JSON.stringify({
          changes: [
            {
              value: {
                messages: [
                  {
                    from: "447700900123",
                    id: "wamid.1",
                    type: "text",
                    text: { body: "Take 8" },
                  },
                ],
                statuses: [{ id: "wamid.2", status: "delivered" }],
              },
            },
          ],
        }),
      }),
    ).toEqual([
      {
        kind: "message",
        channel: "whatsapp",
        from: "+447700900123",
        text: "Take 8",
        eventId: "whatsapp:wamid.1",
        timestamp: undefined,
      },
      {
        kind: "receipt",
        providerId: "wamid.2",
        status: "delivered",
        error: undefined,
      },
    ]);
  });
  it("normalizes SMS and rejects unknown buyer routing", () => {
    const events = parseProviderEvent({
      originationNumber: "+447700900123",
      messageBody: "STOP",
      inboundMessageId: "id",
    });
    expect(events[0]).toMatchObject({ channel: "sms", text: "STOP" });
    expect(
      resolveBuyerConversation(workspace(), events[0] as any),
    ).toBeUndefined();
  });
});

describe("Campaign and receipt correlation safeguards", () => {
  it("rejects free-form initial WhatsApp offers even during an open service window", async () => {
    const send = vi.fn();
    const adapter = new AWSMessagingAdapter({
      region: "eu-west-2",
      whatsappPhoneNumberId: "phone-number-id-example",
      whatsappMetaApiVersion: "v23.0",
      clients: { whatsapp: { send } },
    });
    const result = await adapter.send({
      ...payload,
      channel: "whatsapp",
      to: "+447700900123",
      purpose: "offer",
      lastInboundAt: new Date().toISOString(),
    });
    expect(result.status).toBe("failed");
    expect(send).not.toHaveBeenCalled();
  });
  it("normalizes correlation data so early receipts can resolve an unsaved provider ID", () => {
    expect(
      parseProviderEvent({
        eventType: "Delivery",
        mail: {
          messageId: "ses-1",
          tags: { "secondcrate-reference": ["correlation"] },
        },
      })[0],
    ).toMatchObject({ correlationId: "correlation" });
    expect(
      parseProviderEvent({
        eventType: "TEXT_DELIVERED",
        messageId: "sms-1",
        context: { secondcrateReference: "correlation" },
      })[0],
    ).toMatchObject({ correlationId: "correlation" });
    expect(
      parseProviderEvent({
        whatsAppWebhookEntry: JSON.stringify({
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: "wa-1",
                    status: "delivered",
                    biz_opaque_callback_data: "correlation",
                  },
                ],
              },
            },
          ],
        }),
      })[0],
    ).toMatchObject({ correlationId: "correlation" });
  });
  it("resolves a quoted reply to the correct lot when two offers are active", () => {
    const state = workspace();
    state.buyers = [{ id: "buyer", phone: "+447700900123" } as any];
    state.lots = [
      { id: "one", reference: "SC-1043", status: "recovering" },
      { id: "two", reference: "SC-10430", status: "recovering" },
    ] as any;
    state.offers = [
      { buyerId: "buyer", lotId: "one", status: "sent" },
      { buyerId: "buyer", lotId: "two", status: "sent" },
    ] as any;
    state.messages = [
      {
        buyerId: "buyer",
        lotId: "one",
        channel: "whatsapp",
        direction: "outbound",
        providerId: "wa-offer",
      },
    ] as any;
    const event = {
      kind: "message" as const,
      channel: "whatsapp" as const,
      from: "+447700900123",
      text: "Take 8",
      eventId: "inbound",
    };
    expect(resolveBuyerConversation(state, event)).toBeUndefined();
    expect(
      resolveBuyerConversation(state, {
        ...event,
        replyToProviderId: "wa-offer",
      }),
    ).toEqual({ buyerId: "buyer", lotId: "one" });
    expect(
      resolveBuyerConversation(state, { ...event, text: "SC-10430 take 8" }),
    ).toEqual({ buyerId: "buyer", lotId: "two" });
  });
});
