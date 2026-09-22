import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOfferMessage,
  formatLondonOfferDate,
  renderOfferTemplate,
  WHATSAPP_OFFER_TEMPLATE_BODY,
} from "../src/server/offer-message.js";
import { RecoveryService } from "../src/server/service.js";
import { MemoryWorkspaceStore } from "../src/server/store.js";
import { createWorkspace } from "../src/server/seed.js";
import { RehearsalReasoningAdapter } from "../src/server/rehearsal.js";
import type { MessagingAdapter } from "../src/shared/types.js";

const input = {
  contact: "Maya Chen",
  companyName: "Northstar Produce",
  product: "Cherry tomatoes",
  unitKg: 5,
  quantity: 16,
  unitPrice: 18,
  deliveryBy: "2026-09-22T13:30:00Z",
  dispatchBy: "2026-09-22T13:00:00Z",
  reference: "NS-1042",
};
afterEach(() => vi.unstubAllEnvs());
describe("canonical WhatsApp marketing offer", () => {
  it("renders the exact nine approved body parameters with explicit London dates", () => {
    const result = buildOfferMessage(input);
    expect(result.parameters).toEqual([
      "Maya Chen",
      "Northstar Produce",
      "Cherry tomatoes",
      "5",
      "16",
      "£18.00",
      "22 Sept 2026 14:30 London time",
      "22 Sept 2026 14:00 London time",
      "NS-1042",
    ]);
    expect(result.text).toBe(
      "Hi Maya Chen, Northstar Produce has Cherry tomatoes available: 5 kg per crate. Up to 16 crates at £18.00 each on your existing route.\nDelivery: 22 Sept 2026 14:30 London time. Confirm before: 22 Sept 2026 14:00 London time.\nReference: NS-1042. Reply with the reference and quantity to order. Stock is allocated only after confirmation and is subject to availability. Reply STOP to opt out.",
    );
    expect(renderOfferTemplate(result.parameters)).toBe(result.text);
    expect(WHATSAPP_OFFER_TEMPLATE_BODY.match(/\{\{\d\}\}/g)).toHaveLength(9);
  });
  it("makes next-day delivery and UK seasonal clock changes unambiguous", () => {
    expect(formatLondonOfferDate("2026-06-22T23:30:00Z")).toBe(
      "23 Jun 2026 00:30 London time",
    );
    expect(formatLondonOfferDate("2026-12-22T23:30:00Z")).toBe(
      "22 Dec 2026 23:30 London time",
    );
  });
  it("sends the exact text persisted in the workspace through nine WhatsApp parameters", async () => {
    vi.stubEnv("LIVE_SENDS_ENABLED", "true");
    vi.stubEnv("WHATSAPP_OFFER_TEMPLATE", "secondcrate_surplus_v1");
    vi.stubEnv("WHATSAPP_TEMPLATE_LANGUAGE", "en_GB");
    const store = new MemoryWorkspaceStore();
    const workspace = createWorkspace("Operator", true);
    workspace.settings.mode = "live";
    workspace.settings.autoSend = true;
    await store.create(workspace);
    const send = vi
      .fn<MessagingAdapter["send"]>()
      .mockResolvedValue({ status: "sent", providerId: "provider-reference" });
    const service = new RecoveryService(
      store,
      { send },
      new RehearsalReasoningAdapter(),
    );
    const result = await service.launch(workspace.id, "lot_tomatoes");
    const whatsapp = send.mock.calls
      .map((call) => call[0])
      .filter((payload) => payload.channel === "whatsapp");
    expect(whatsapp).toHaveLength(2);
    for (const payload of whatsapp) {
      expect(payload.template?.name).toBe("secondcrate_surplus_v1");
      expect(payload.template?.parameters).toHaveLength(9);
      const message = result.workspace.messages.find(
        (m) => m.id === payload.idempotencyKey,
      )!;
      expect(payload.text).toBe(message.text);
      expect(
        renderOfferTemplate(
          payload.template!.parameters as ReturnType<
            typeof buildOfferMessage
          >["parameters"],
        ),
      ).toBe(message.text);
      expect(payload.template!.parameters[8]).toBe("NS-1042");
      expect(payload.template!.parameters[1]).toBe("Northstar Produce");
      expect(payload.text).toContain("Reply STOP to opt out.");
    }
  });
  it("refreshes a queued offer quantity before sending and persists the same revised text", async () => {
    vi.stubEnv("LIVE_SENDS_ENABLED", "true");
    vi.stubEnv("WHATSAPP_OFFER_TEMPLATE", "secondcrate_surplus_v1");
    const store = new MemoryWorkspaceStore();
    const workspace = createWorkspace("Operator", true);
    await store.create(workspace);
    const send = vi
      .fn<MessagingAdapter["send"]>()
      .mockResolvedValue({ status: "sent", providerId: "provider-updated" });
    const service = new RecoveryService(
      store,
      { send },
      new RehearsalReasoningAdapter(),
    );
    await service.launch(workspace.id, "lot_tomatoes");
    await service.processInbound(workspace.id, {
      buyerId: "buyer_maya",
      lotId: "lot_tomatoes",
      channel: "whatsapp",
      text: "I will take 12 crates at £17",
      eventId: "allocate-first",
    });
    await service.processInbound(workspace.id, {
      buyerId: "buyer_table",
      lotId: "lot_tomatoes",
      channel: "sms",
      text: "I will take 20 crates at £18",
      eventId: "allocate-second",
    });
    const before = await service.get(workspace.id);
    const pending = before.messages.find(
      (m) => m.buyerId === "buyer_common" && m.purpose === "offer",
    )!;
    pending.status = "queued";
    before.settings.mode = "live";
    before.settings.autoSend = true;
    before.version++;
    await store.save(before, before.version - 1);
    const after = await service.flush(workspace.id);
    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.template?.parameters[4]).toBe("8");
    expect(after.messages.find((m) => m.id === pending.id)?.text).toBe(
      payload.text,
    );
    expect(payload.text).toContain("Up to 8 crates");
    expect(
      after.offers.find((o) => o.buyerId === "buyer_common")?.quantity,
    ).toBe(8);
  });
});
