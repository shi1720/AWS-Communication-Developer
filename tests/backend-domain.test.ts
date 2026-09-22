import { createHash } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RecoveryService } from "../src/server/service.js";
import {
  MemoryWorkspaceStore,
  LocalWorkspaceStore,
} from "../src/server/store.js";
import { createWorkspace } from "../src/server/seed.js";
import { RehearsalReasoningAdapter } from "../src/server/rehearsal.js";
import { ConflictError } from "../src/server/errors.js";
import type {
  AgentDecision,
  MessagingAdapter,
  ReasoningAdapter,
} from "../src/shared/types.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function setup(decision?: AgentDecision) {
  const store = new MemoryWorkspaceStore();
  const w = createWorkspace("Shivam", true);
  await store.create(w);
  const send = vi
    .fn<MessagingAdapter["send"]>()
    .mockResolvedValue({ status: "sent", providerId: "provider-123" });
  const reasoning: ReasoningAdapter = decision
    ? { decide: async () => ({ decision, model: "adversarial-test-model" }) }
    : new RehearsalReasoningAdapter();
  const service = new RecoveryService(store, { send }, reasoning);
  return { service, store, w, send };
}
const input = (
  buyerId = "buyer_maya",
  text = "I'll take 12 at £17",
  eventId = "event-0001",
) => ({
  buyerId,
  lotId: "lot_tomatoes",
  channel: "whatsapp" as const,
  text,
  eventId,
});

beforeEach(() => {
  vi.stubEnv("LIVE_SENDS_ENABLED", "true");
  vi.stubEnv("WHATSAPP_OFFER_TEMPLATE", "approved_template");
});
afterEach(() => {
  vi.unstubAllEnvs();
});
describe("recovery policy and transactional allocation", () => {
  it("requires a new consent record to resume an opted-out buyer", async () => {
    const { service, w } = await setup();
    const original = w.buyers[0];
    await service.updateBuyer(w.id, original.id, {
      consent: false,
      optedOut: true,
    });
    await expect(
      service.updateBuyer(w.id, original.id, {
        consent: true,
        optedOut: false,
      }),
    ).rejects.toThrow("fresh consent");
    await expect(
      service.updateBuyer(w.id, original.id, {
        consent: true,
        optedOut: false,
        consentSource: original.consentSource,
        consentAt: original.consentAt,
      }),
    ).rejects.toThrow("fresh consent");
    const result = await service.updateBuyer(w.id, original.id, {
      consent: true,
      optedOut: false,
      consentSource:
        "Buyer requested new offers through the account preference form today.",
      consentAt: new Date().toISOString(),
    });
    expect(result.buyer.consent).toBe(true);
    expect(result.buyer.optedOut).toBe(false);
  });
  it("validates the final buyer record inside the transaction", async () => {
    const { service, w } = await setup();
    await expect(
      service.updateBuyer(w.id, w.buyers[0].id, {
        phone: "",
        consent: false,
        optedOut: true,
      }),
    ).rejects.toThrow("Provide a contact for the preferred channel.");
    const latest = await service.get(w.id);
    expect(latest.buyers[0].phone).toBe(w.buyers[0].phone);
    expect(latest.buyers[0].consent).toBe(true);
  });
  it("starts with genuinely empty recovery; matches four eligible buyers without allocating stock", async () => {
    const { service, w, send } = await setup();
    expect(w.lots[0].status).toBe("draft");
    expect(w.orders).toHaveLength(0);
    const r = await service.launch(w.id, "lot_tomatoes");
    expect(r.workspace.offers).toHaveLength(4);
    expect(r.workspace.lots[0].available).toBe(40);
    expect(r.steps.filter((s) => s.status === "blocked")).toHaveLength(2);
    expect(r.workspace.messages.every((m) => m.status === "simulated")).toBe(
      true,
    );
    expect(send).not.toHaveBeenCalled();
  });
  it("completes £708 / 200 kg demonstration with a real contest for the final 8 crates", async () => {
    const { service, w } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    await service.processInbound(w.id, input());
    await service.processInbound(
      w.id,
      input("buyer_table", "I'll take 20 at £18", "event-0002"),
    );
    const results = await Promise.all([
      service.processInbound(
        w.id,
        input("buyer_union", "I'll take 8 at £18", "event-race1"),
      ),
      service.processInbound(
        w.id,
        input("buyer_common", "I'll take 8 at £18", "event-race2"),
      ),
    ]);
    const latest = await service.get(w.id);
    expect(latest.orders).toHaveLength(3);
    expect(latest.orders.reduce((n, o) => n + o.total, 0)).toBe(708);
    expect(latest.orders.reduce((n, o) => n + o.quantity, 0)).toBe(40);
    expect(latest.lots[0].available).toBe(0);
    expect(latest.lots[0].status).toBe("recovered");
    expect(
      results.filter((r) =>
        r.result.steps.some(
          (s) => s.tool === "allocate_stock" && s.status === "success",
        ),
      ),
    ).toHaveLength(1);
  });
  it("deduplicates concurrently replayed event IDs, including outbound confirmations", async () => {
    const { service, w } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    await Promise.all([
      service.processInbound(w.id, input()),
      service.processInbound(w.id, input()),
      service.processInbound(w.id, input()),
    ]);
    const result = await service.processInbound(w.id, input());
    expect(result.workspace.orders).toHaveLength(1);
    expect(result.workspace.lots[0].available).toBe(28);
    expect(
      result.workspace.messages.filter((m) => m.direction === "inbound"),
    ).toHaveLength(1);
    expect(result.workspace.processedEvents).toEqual(["event-0001"]);
  });
  it("counteroffers below-floor requests, then confirms explicit acceptance at the authorised price", async () => {
    const { service, w } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    const first = await service.processInbound(
      w.id,
      input("buyer_maya", "I'll take 12 at £15"),
    );
    expect(first.workspace.orders).toHaveLength(0);
    expect(first.result.reply).toContain("£16.00");
    const second = await service.processInbound(
      w.id,
      input("buyer_maya", "YES", "event-0002"),
    );
    expect(second.workspace.orders[0]).toMatchObject({
      quantity: 12,
      unitPrice: 16,
      total: 192,
    });
  });
  it("never allocates on a negotiatory question", async () => {
    const { service, w } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    const result = await service.processInbound(
      w.id,
      input("buyer_maya", "Can you do 12 crates at £17?"),
    );
    expect(result.workspace.orders).toHaveLength(0);
    expect(result.result.reply).toContain("Reply YES");
  });
  it.each([
    "Are 12 crates available at £17?",
    "I would take 12 if they are organic",
    "I will take 10 kg",
    "Yes but I have not decided",
    "YES",
    "Could I have a price for 12 crates?",
  ])("does not turn an ambiguous request into an order: %s", async (text) => {
    const { service, w } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    const result = await service.processInbound(
      w.id,
      input("buyer_maya", text),
    );
    expect(result.workspace.orders).toHaveLength(0);
  });
  it.each([
    { intent: "accept", quantity: -3, unitPrice: 18 },
    { intent: "accept", quantity: 2.5, unitPrice: 18 },
    { intent: "accept", quantity: 12, unitPrice: 17.999 },
    { intent: "accept", quantity: 12, unitPrice: Number.NaN },
    { intent: "accept", quantity: 100000, unitPrice: 18 },
    { intent: "accept", quantity: 12, unitPrice: 25 },
  ] as AgentDecision[])(
    "rejects invalid model-supplied terms: %j",
    async (decision) => {
      const { service, w } = await setup(decision);
      await service.launch(w.id, "lot_tomatoes");
      const result = await service.processInbound(w.id, input());
      expect(result.workspace.orders).toHaveLength(0);
      expect(result.workspace.lots[0].available).toBe(40);
      expect(result.result.steps.some((s) => s.status === "blocked")).toBe(
        true,
      );
    },
  );
  it("enforces the operator maximum discount above the lot floor", async () => {
    const { service, w } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    await service.settings(w.id, { maxDiscountPercent: 20 });
    const result = await service.processInbound(w.id, input());
    expect(result.workspace.orders).toHaveLength(0);
    expect(result.result.reply).toContain("£19.20");
  });
  it("honours exact opt-outs without asking the model and suppresses future orders", async () => {
    const { service, w, send } = await setup({
      intent: "accept",
      quantity: 12,
      unitPrice: 18,
    });
    await service.launch(w.id, "lot_tomatoes");
    await service.processInbound(w.id, input("buyer_maya", "STOP"));
    const result = await service.processInbound(
      w.id,
      input("buyer_maya", "take 12", "event-0002"),
    );
    expect(result.workspace.buyers[0]).toMatchObject({
      optedOut: true,
      consent: false,
    });
    expect(result.workspace.orders).toHaveLength(0);
    expect(send).not.toHaveBeenCalled();
  });
  it("rejects late requests and refuses launch after the operational cutoff", async () => {
    const { service, w, store } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    const state = await service.get(w.id);
    state.lots[0].dispatchBy = new Date(Date.now() - 1000).toISOString();
    state.version++;
    await store.save(state, state.version - 1);
    const result = await service.processInbound(w.id, input());
    expect(result.workspace.orders).toHaveLength(0);
    expect(result.result.reply).toContain("no longer open");
    await service.reset(w.id);
    const expired = await service.get(w.id);
    expired.lots[0].dispatchBy = new Date(Date.now() - 1000).toISOString();
    expired.version++;
    await store.save(expired, expired.version - 1);
    await expect(service.launch(w.id, "lot_tomatoes")).rejects.toThrow(
      "cutoff",
    );
  });
  it("enforces delivery constraints independent of model confidence", async () => {
    const { service, w } = await setup({
      intent: "accept",
      quantity: 12,
      unitPrice: 18,
      deliveryBefore: "00:00",
    });
    await service.launch(w.id, "lot_tomatoes");
    const result = await service.processInbound(w.id, input());
    expect(result.workspace.orders).toHaveLength(0);
    expect(
      result.result.steps.some(
        (s) => s.tool === "check_delivery" && s.status === "blocked",
      ),
    ).toBe(true);
  });
  it("rejects cross-tenant buyer identifiers", async () => {
    const { service, w, store } = await setup();
    const foreign = createWorkspace("Other", false);
    await store.create(foreign);
    await expect(
      service.processInbound(foreign.id, input(), { trusted: true }),
    ).rejects.toThrow("Buyer not found");
    expect((await service.get(w.id)).orders).toHaveLength(0);
  });
  it("blocks untrusted live inbound and never fabricates provider success", async () => {
    const { service, w, store, send } = await setup();
    const state = await service.get(w.id);
    state.settings.mode = "live";
    state.settings.autoSend = true;
    state.version++;
    await store.save(state, state.version - 1);
    send.mockRejectedValue(new Error("network timeout"));
    const launch = await service.launch(w.id, "lot_tomatoes");
    expect(launch.workspace.messages.every((m) => m.status === "unknown")).toBe(
      true,
    );
    const count = send.mock.calls.length;
    await service.flush(w.id);
    expect(send).toHaveBeenCalledTimes(count);
    await expect(service.processInbound(w.id, input())).rejects.toThrow(
      "authenticated provider",
    );
  });
  it("claims each live queued send once across concurrent flush calls", async () => {
    const { service, w, store, send } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    const state = await service.get(w.id);
    state.settings.mode = "live";
    state.settings.autoSend = true;
    state.messages.forEach((m) => (m.status = "queued"));
    state.version++;
    await store.save(state, state.version - 1);
    await Promise.all([service.flush(w.id), service.flush(w.id)]);
    expect(send).toHaveBeenCalledTimes(4);
  });
  it("records trusted cancellation source once without inventing a released lot", async () => {
    const { service, w } = await setup();
    const message = {
      eventId: "email-in-01",
      text: "Cancelled order unknown price",
      subject: "Cancellation",
    };
    await service.recordCancellation(w.id, message);
    await service.recordCancellation(w.id, message);
    const state = await service.get(w.id);
    expect(
      state.events.filter((e) => e.type === "cancellation_received"),
    ).toHaveLength(1);
    expect(state.lots).toHaveLength(1);
  });
  it("persists atomic local state, detects stale writers, and survives a new store instance", async () => {
    const folder = await mkdtemp(join(tmpdir(), "secondcrate-store-"));
    try {
      const store = new LocalWorkspaceStore(folder);
      const w = createWorkspace("Test", false);
      await store.create(w);
      const next = { ...w, version: 1 };
      await store.save(next, 0);
      await expect(
        store.save({ ...next, version: 2 }, 0),
      ).rejects.toBeInstanceOf(ConflictError);
      expect((await new LocalWorkspaceStore(folder).get(w.id))?.version).toBe(
        1,
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
  it("drains durable confirmations on an idempotent replay without another model call", async () => {
    const { service, w } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    const decide = vi.spyOn(service.reasoning, "decide");
    const originalFlush = service.flush.bind(service);
    vi.spyOn(service, "flush").mockRejectedValueOnce(
      new Error("process crashed after commit"),
    );
    await expect(service.processInbound(w.id, input())).rejects.toThrow(
      "crashed",
    );
    expect(
      (await service.get(w.id)).messages.filter((m) => m.status === "queued"),
    ).toHaveLength(2);
    service.flush = originalFlush;
    const replay = await service.processInbound(w.id, input());
    expect(decide).toHaveBeenCalledTimes(1);
    expect(replay.workspace.orders).toHaveLength(1);
    expect(replay.workspace.messages.some((m) => m.status === "queued")).toBe(
      false,
    );
  });
  it("correlates a fast delivery receipt before provider ID persistence and never downgrades it", async () => {
    const { service, w, store, send } = await setup();
    const state = await service.get(w.id);
    state.settings.mode = "live";
    state.settings.autoSend = true;
    state.version++;
    await store.save(state, state.version - 1);
    send.mockImplementation(async (payload) => {
      const correlationId = createHash("sha256")
        .update(payload.idempotencyKey)
        .digest("hex")
        .slice(0, 32);
      await service.recordDelivery(
        w.id,
        `provider-${payload.idempotencyKey}`,
        "delivered",
        undefined,
        correlationId,
      );
      return {
        status: "sent",
        providerId: `provider-${payload.idempotencyKey}`,
      };
    });
    const launch = await service.launch(w.id, "lot_tomatoes");
    expect(
      launch.workspace.messages.every((m) => m.status === "delivered"),
    ).toBe(true);
    const receipt = launch.workspace.messages[0];
    const count = launch.workspace.events.length;
    await service.recordDelivery(w.id, receipt.providerId!, "delivered");
    await service.recordDelivery(w.id, receipt.providerId!, "sent");
    expect((await service.get(w.id)).events).toHaveLength(count);
  });
  it("reserves capacity for suppression after ordinary workspace writes are full", async () => {
    const { service, w, store } = await setup();
    const state = await service.get(w.id);
    state.events.push({
      id: "large-history",
      at: new Date().toISOString(),
      type: "archive",
      title: "Historical audit",
      detail: "a".repeat(1_600_000),
      actor: "system",
    });
    state.version++;
    await store.save(state, state.version - 1);
    await expect(
      service.settings(w.id, { companyName: "Test" }),
    ).rejects.toThrow("storage limit");
    const suppressed = await service.optOutBuyer(
      w.id,
      "buyer_maya",
      "stop-near-capacity",
    );
    expect(suppressed.buyers[0].optedOut).toBe(true);
    expect(suppressed.buyers[0].consent).toBe(false);
  });
  it("rejects ambiguous live contacts while allowing an existing buyer to update preferences", async () => {
    const { service, w, store } = await setup();
    const state = await service.get(w.id);
    state.settings.mode = "live";
    state.version++;
    await store.save(state, state.version - 1);
    const { id: unused, ...buyer } = state.buyers[0];
    await expect(
      service.addBuyer(w.id, { ...buyer, name: "Duplicate account" }),
    ).rejects.toThrow("already uses");
    await expect(
      service.updateBuyer(w.id, state.buyers[1].id, { phone: buyer.phone }),
    ).rejects.toThrow("already uses");
    await expect(
      service.updateBuyer(w.id, state.buyers[0].id, { distanceKm: 6 }),
    ).resolves.toMatchObject({ buyer: { distanceKm: 6 } });
    await expect(
      service.updateBuyer(w.id, state.buyers[0].id, { channel: "email" }),
    ).rejects.toThrow("fresh consent");
  });
  it("blocks stale negotiation and acceptance while applying stale opt-outs", async () => {
    const { service, w, store } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    const state = await service.get(w.id);
    state.offers.forEach(
      (o) => (o.createdAt = new Date(Date.now() - 120_000).toISOString()),
    );
    state.version++;
    await store.save(state, state.version - 1);
    const newer = new Date(Date.now() - 30_000).toISOString();
    const older = new Date(Date.now() - 60_000).toISOString();
    await service.processInbound(
      w.id,
      input("buyer_maya", "Can you do 12 crates at £17?", "terms-newer"),
      { receivedAt: newer },
    );
    const stale = await service.processInbound(
      w.id,
      input("buyer_maya", "Can you do 8 crates at £16?", "terms-older"),
      { receivedAt: older },
    );
    expect(stale.workspace.offers[0]).toMatchObject({
      quantity: 12,
      unitPrice: 17,
    });
    expect(
      stale.result.steps.some(
        (s) => s.tool === "check_message_order" && s.status === "blocked",
      ),
    ).toBe(true);
    const yes = await service.processInbound(
      w.id,
      input("buyer_maya", "YES", "accept-older"),
      { receivedAt: older },
    );
    expect(yes.workspace.orders).toHaveLength(0);
    const stop = await service.processInbound(
      w.id,
      input("buyer_maya", "STOP", "stop-older"),
      { receivedAt: older },
    );
    expect(stop.workspace.buyers[0].optedOut).toBe(true);
  });
  it("reconciles only one concurrent operator outcome and sends no retries", async () => {
    const { service, w, store, send } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    const state = await service.get(w.id);
    state.settings.mode = "live";
    state.messages[0].status = "unknown";
    state.offers[0].status = "unknown";
    state.version++;
    await store.save(state, state.version - 1);
    const evidence =
      "AWS support case 123 checked this exact destination and send timestamp.";
    const results = await Promise.allSettled([
      service.reconcileMessage(
        w.id,
        state.messages[0].id,
        { outcome: "failed", evidence },
        "operator-a",
      ),
      service.reconcileMessage(
        w.id,
        state.messages[0].id,
        { outcome: "sent", providerId: "known-id", evidence },
        "operator-b",
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      (await service.get(w.id)).events.filter(
        (e) => e.type === "operator_reconciliation",
      ),
    ).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
    await service.flush(w.id);
    expect(send).not.toHaveBeenCalled();
  });
  it("never upgrades a simulation or downgrades delivered provider evidence by reconciliation", async () => {
    const { service, w, store } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    const state = await service.get(w.id);
    const evidence =
      "External provider console shows a verifiable message record.";
    await expect(
      service.reconcileMessage(
        w.id,
        state.messages[0].id,
        { outcome: "sent", providerId: "some-id", evidence },
        "operator",
      ),
    ).rejects.toThrow("Simulated");
    state.settings.mode = "live";
    state.messages[0].status = "delivered";
    state.version++;
    await store.save(state, state.version - 1);
    await expect(
      service.reconcileMessage(
        w.id,
        state.messages[0].id,
        { outcome: "failed", evidence },
        "operator",
      ),
    ).rejects.toThrow("Only an unknown");
    expect((await service.get(w.id)).messages[0].status).toBe("delivered");
  });
  it("accepts typographic apostrophes used by the suggested buyer replies", async () => {
    const { service, w } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    await service.processInbound(
      w.id,
      input("buyer_maya", "I can take 12 crates at £17 each.", "smart-first"),
    );
    const result = await service.processInbound(
      w.id,
      input("buyer_table", "I’ll take 20 crates at £18 each.", "smart-second"),
    );
    expect(result.workspace.lots[0].available).toBe(8);
    expect(result.workspace.orders).toHaveLength(2);
  });
  it("requires new documented consent when changing a recipient destination", async () => {
    const { service, w } = await setup();
    const original = w.buyers[0];
    await expect(
      service.updateBuyer(w.id, original.id, { phone: "+447700900999" }),
    ).rejects.toThrow("fresh consent");
    await expect(
      service.updateBuyer(w.id, original.id, {
        phone: "+447700900999",
        consent: true,
        consentSource: original.consentSource,
        consentAt: original.consentAt,
      }),
    ).rejects.toThrow("fresh consent");
    const updated = await service.updateBuyer(w.id, original.id, {
      phone: "+447700900999",
      consent: true,
      consentSource:
        "Buyer opted in from their new phone, recorded by operator",
      consentAt: new Date().toISOString(),
    });
    expect(updated.buyer.phone).toBe("+447700900999");
    expect(updated.buyer.consent).toBe(true);
  });
  it("does not apply an implicit YES to counteroffer terms changed during inference", async () => {
    const { service, w, store } = await setup();
    await service.launch(w.id, "lot_tomatoes");
    await service.processInbound(
      w.id,
      input("buyer_maya", "Can you do 12 crates at £17?", "proposal-first"),
    );
    let resolveDecision!: (value: {
      decision: AgentDecision;
      model: string;
    }) => void;
    let started!: (value?: unknown) => void;
    const began = new Promise((resolve) => {
      started = resolve;
    });
    service.reasoning = {
      decide: () => {
        started();
        return new Promise((resolve) => {
          resolveDecision = resolve;
        });
      },
    };
    const pending = service.processInbound(
      w.id,
      input("buyer_maya", "YES", "proposal-accept"),
    );
    await began;
    const state = await service.get(w.id);
    state.offers[0].quantity = 8;
    state.offers[0].unitPrice = 16;
    state.version++;
    await store.save(state, state.version - 1);
    resolveDecision({
      decision: { intent: "accept" },
      model: "delayed-interpretation",
    });
    const result = await pending;
    expect(result.workspace.orders).toHaveLength(0);
    expect(
      result.result.steps.some(
        (step) =>
          step.tool === "verify_offer_terms" && step.status === "blocked",
      ),
    ).toBe(true);
    expect(result.workspace.offers[0]).toMatchObject({
      quantity: 8,
      unitPrice: 16,
    });
  });
});
