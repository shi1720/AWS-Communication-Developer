import { describe, expect, it, vi } from "vitest";
import {
  BedrockReasoningAdapter,
  decisionSchema,
} from "../src/server/adapters/reasoning.js";
import { createWorkspace } from "../src/server/seed.js";
import type { Message } from "../src/shared/types.js";

function fixture() {
  const workspace = createWorkspace("Synthetic context check", true);
  const buyer = workspace.buyers[0],
    lot = workspace.lots[0];
  buyer.email = "private-contact@example.com";
  buyer.phone = "+447700900123";
  buyer.contact = "Do not serialize this contact";
  workspace.offers = [
    {
      id: "initial",
      lotId: lot.id,
      buyerId: buyer.id,
      quantity: 16,
      unitPrice: 18,
      status: "expired",
      createdAt: "2026-09-22T07:00:00Z",
    },
    {
      id: "pending",
      lotId: lot.id,
      buyerId: buyer.id,
      quantity: 8,
      unitPrice: 17,
      status: "negotiating",
      createdAt: "2026-09-22T07:01:00Z",
    },
    {
      id: "other-buyer",
      lotId: lot.id,
      buyerId: workspace.buyers[1].id,
      quantity: 99,
      unitPrice: 99,
      status: "negotiating",
      createdAt: "2026-09-22T07:03:00Z",
    },
  ];
  workspace.orders = [
    {
      id: "existing",
      lotId: lot.id,
      buyerId: buyer.id,
      quantity: 3,
      unitPrice: 18,
      total: 54,
      createdAt: "2026-09-22T06:55:00Z",
      status: "confirmed",
      confirmationCode: "PRIVATE_ORDER_CODE",
    },
    {
      id: "unrelated-order",
      lotId: lot.id,
      buyerId: workspace.buyers[1].id,
      quantity: 999,
      unitPrice: 18,
      total: 17982,
      createdAt: "2026-09-22T06:55:00Z",
      status: "confirmed",
      confirmationCode: "UNRELATED_ORDER_CODE",
    },
  ];
  workspace.messages = Array.from({ length: 9 }, (_, index): Message => ({
    id: `message-${index}`,
    lotId: lot.id,
    buyerId: buyer.id,
    channel: index % 2 ? "email" : "whatsapp",
    direction: index % 2 ? "inbound" : "outbound",
    text:
      index === 8
        ? "Yes: 8 crates at £17 each. Reply YES to confirm."
        : `history-${index} ${"x".repeat(600)}`,
    createdAt: `2026-09-22T07:0${index}:00Z`,
    status: index % 2 ? "received" : "sent",
  }));
  workspace.messages.push({
    ...workspace.messages[0],
    id: "unrelated-message",
    buyerId: workspace.buyers[1].id,
    text: "SECRET_OTHER_BUYER_MESSAGE",
    createdAt: "2026-09-22T09:00:00Z",
  });
  workspace.messages.push({
    ...workspace.messages[0],
    id: "another-lot",
    lotId: "different-lot",
    text: "SECRET_OTHER_LOT_MESSAGE",
    createdAt: "2026-09-22T09:01:00Z",
  });
  return { workspace, buyer, lot, text: "YES" };
}
function modelReply() {
  return {
    output: {
      message: {
        content: [
          {
            toolUse: {
              name: "record_buyer_intent",
              input: { intent: "accept", quantity: 8, unitPrice: 17 },
            },
          },
        ],
      },
    },
  };
}

describe("Bedrock negotiation continuity and context bounds", () => {
  it("supplies current negotiated terms and cross-channel history without unrelated buyers or contact fields", async () => {
    const send = vi.fn().mockResolvedValue(modelReply());
    await new BedrockReasoningAdapter({
      region: "eu-west-2",
      modelId: "model",
      client: { send },
    }).decide(fixture());
    const command = send.mock.calls[0][0],
      payload = JSON.parse(command.input.messages[0].content[0].text);
    expect(payload.currentOffer).toEqual({
      status: "negotiating",
      quantity: 8,
      unitPriceGBP: 17,
    });
    expect(payload.offer.openingPriceGBP).toBe(18);
    expect(payload.buyerLimits.alreadyCommittedCrates).toBe(3);
    expect(payload.timezone).toBe("Europe/London");
    const clockPattern = new RegExp(
      command.input.toolConfig.tools[0].toolSpec.inputSchema.json.properties
        .deliveryBefore.pattern,
    );
    expect(clockPattern.test("23:59")).toBe(true);
    expect(clockPattern.test("24:00")).toBe(false);
    expect(
      payload.recentConversation.map((message: Message) => message.channel),
    ).toContain("email");
    expect(
      payload.recentConversation.map((message: Message) => message.channel),
    ).toContain("whatsapp");
    const serialized = JSON.stringify(command.input);
    for (const secret of [
      "private-contact@example.com",
      "+447700900123",
      "Do not serialize this contact",
      "PRIVATE_ORDER_CODE",
      "UNRELATED_ORDER_CODE",
      "SECRET_OTHER_BUYER_MESSAGE",
      "SECRET_OTHER_LOT_MESSAGE",
    ])
      expect(serialized).not.toContain(secret);
    expect(command.input.system[0].text).toContain("A bare YES");
    expect(command.input.system[0].text).toContain(
      "initial sent/queued/unknown offer",
    );
  });
  it("keeps the latest six chronological messages and truncates each to 400 characters", async () => {
    const context = fixture();
    context.workspace.messages.reverse();
    const send = vi.fn().mockResolvedValue(modelReply());
    await new BedrockReasoningAdapter({
      region: "eu-west-2",
      modelId: "model",
      client: { send },
    }).decide(context);
    const history = JSON.parse(
      send.mock.calls[0][0].input.messages[0].content[0].text,
    ).recentConversation;
    expect(history).toHaveLength(6);
    expect(history[0].text).toMatch(/^history-3 /);
    expect(history.at(-1).text).toContain("8 crates at £17");
    expect(
      history.every((message: { text: string }) => message.text.length <= 400),
    ).toBe(true);
    expect(context.workspace.messages[0].id).toBe("another-lot"); // Building context does not mutate the stored order.
  });
  it("makes absent/current-completed proposals explicit rather than reusing historic terms", async () => {
    const context = fixture();
    context.workspace.offers = [];
    const send = vi.fn().mockResolvedValue(modelReply());
    const adapter = new BedrockReasoningAdapter({
      region: "eu-west-2",
      modelId: "model",
      client: { send },
    });
    await adapter.decide(context);
    expect(
      JSON.parse(send.mock.calls[0][0].input.messages[0].content[0].text)
        .currentOffer,
    ).toBeNull();
    context.workspace.offers = [
      {
        id: "finished",
        lotId: context.lot.id,
        buyerId: context.buyer.id,
        status: "accepted",
        quantity: 8,
        unitPrice: 17,
        createdAt: "2026-09-22T07:09:00Z",
      },
    ];
    await adapter.decide(context);
    expect(
      JSON.parse(send.mock.calls[1][0].input.messages[0].content[0].text)
        .currentOffer.status,
    ).toBe("accepted");
  });
  it("accepts only valid 24-hour delivery times in the returned decision schema", () => {
    for (const deliveryBefore of ["00:00", "09:30", "23:59"])
      expect(
        decisionSchema.safeParse({ intent: "question", deliveryBefore })
          .success,
      ).toBe(true);
    for (const deliveryBefore of [
      "24:00",
      "12:60",
      "99:99",
      "1:00",
      "00:00Z",
      "tomorrow",
    ])
      expect(
        decisionSchema.safeParse({ intent: "accept", deliveryBefore }).success,
      ).toBe(false);
  });
});
