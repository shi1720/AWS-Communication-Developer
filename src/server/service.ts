import { createHash } from "node:crypto";
import type {
  AgentDecision,
  AgentResult,
  AgentStep,
  Buyer,
  DeliveryResult,
  InboundInput,
  Lot,
  Message,
  MessagingAdapter,
  ReasoningAdapter,
  Settings,
  Workspace,
  WorkspaceStore,
} from "../shared/types.js";
import { AppError, ConflictError } from "./errors.js";
import { buildOfferMessage, formatLondonOfferDate } from "./offer-message.js";
import { createWorkspace, now, uid } from "./seed.js";

const pence = (amount: number) => Math.round(amount * 100);
const money = (amount: number) => `£${amount.toFixed(2)}`;
const hasPassed = (timestamp: string) => Date.parse(timestamp) <= Date.now();
const londonMinutes = (timestamp: string) => {
  const [hours, minutes] = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(timestamp))
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
};
function deliveryFits(lot: Lot, before: string) {
  if (!before) return true;
  if (/^\d{2}:\d{2}$/.test(before)) {
    const [h, m] = before.split(":").map(Number);
    return h <= 23 && m <= 59 && londonMinutes(lot.deliveryBy) <= h * 60 + m;
  }
  return (
    Number.isFinite(Date.parse(before)) &&
    Date.parse(lot.deliveryBy) <= Date.parse(before)
  );
}
function event(
  workspace: Workspace,
  type: string,
  title: string,
  detail: string,
  actor: "agent" | "operator" | "system" | "buyer",
  extras: Record<string, unknown> = {},
) {
  workspace.events.unshift({
    id: uid("evt"),
    at: now(),
    type,
    title,
    detail,
    actor,
    ...extras,
  });
}
function findLot(workspace: Workspace, id: string) {
  const lot = workspace.lots.find((x) => x.id === id);
  if (!lot) throw new AppError(404, "Lot not found.", "NOT_FOUND");
  return lot;
}
function findBuyer(workspace: Workspace, id: string) {
  const buyer = workspace.buyers.find((x) => x.id === id);
  if (!buyer) throw new AppError(404, "Buyer not found.", "NOT_FOUND");
  return buyer;
}
function capacity(workspace: Workspace, lot: Lot, buyer: Buyer) {
  return Math.max(
    0,
    buyer.maxCrates -
      workspace.orders
        .filter((o) => o.lotId === lot.id && o.buyerId === buyer.id)
        .reduce((n, o) => n + o.quantity, 0),
  );
}
function eligible(workspace: Workspace, lot: Lot, buyer: Buyer) {
  if (!buyer.consent || buyer.optedOut) return "No current marketing consent";
  if (
    !buyer.categories.some(
      (c) => c.toLowerCase() === lot.category.toLowerCase(),
    )
  )
    return "Category mismatch";
  if (buyer.distanceKm > 25) return "Outside the configured 25 km route";
  if (!deliveryFits(lot, buyer.deliveryBefore))
    return "Delivery does not meet buyer cutoff";
  if (capacity(workspace, lot, buyer) < 1) return "Buyer capacity exhausted";
  if (buyer.channel === "email" ? !buyer.email : !buyer.phone)
    return "Channel contact missing";
  return null;
}
function checkUniqueContact(
  workspace: Workspace,
  buyer: Omit<Buyer, "id">,
  excludeId?: string,
) {
  if (workspace.settings.mode !== "live") return;
  const duplicate = workspace.buyers.some(
    (existing) =>
      existing.id !== excludeId &&
      ((buyer.email &&
        existing.email.toLowerCase() === buyer.email.toLowerCase()) ||
        (buyer.phone && existing.phone === buyer.phone)),
  );
  if (duplicate)
    throw new AppError(
      409,
      "A buyer already uses this email address or phone number. Update that buyer to keep inbound routing unambiguous.",
      "CONTACT_EXISTS",
    );
}
function validateBuyer(buyer: Buyer | Omit<Buyer, "id">) {
  if (buyer.consent && !buyer.consentSource?.trim())
    throw new AppError(400, "Record the source of marketing consent.");
  if (buyer.channel === "email" ? !buyer.email : !buyer.phone)
    throw new AppError(400, "Provide a contact for the preferred channel.");
  if (buyer.optedOut && buyer.consent)
    throw new AppError(400, "An opted-out buyer cannot have active consent.");
}
function queue(
  workspace: Workspace,
  buyer: Buyer,
  lot: Lot,
  text: string,
  channel = buyer.channel,
  purpose: Message["purpose"] = "reply",
) {
  const message: Message = {
    id: uid("msg"),
    buyerId: buyer.id,
    lotId: lot.id,
    channel,
    direction: "outbound",
    purpose,
    text,
    createdAt: now(),
    status: "queued",
  };
  workspace.messages.push(message);
  return message;
}
export class RecoveryService {
  constructor(
    public store: WorkspaceStore,
    public messaging: MessagingAdapter,
    public reasoning: ReasoningAdapter,
  ) {}
  async get(id: string) {
    const workspace = await this.store.get(id);
    if (!workspace)
      throw new AppError(404, "Workspace not found.", "NOT_FOUND");
    return workspace;
  }
  async transact<T>(
    id: string,
    mutate: (workspace: Workspace) => T,
    options: { system?: boolean; essential?: boolean } = {},
  ): Promise<{ workspace: Workspace; value: T }> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const workspace = await this.get(id);
      const previous = workspace.version;
      const value = mutate(workspace);
      workspace.version = previous + 1;
      // Reserve 300 KB beyond the normal write budget for delivery receipts and compliance.
      if (
        Buffer.byteLength(JSON.stringify(workspace)) >
        (options.essential ? 1_990_000 : options.system ? 1_800_000 : 1_500_000)
      )
        throw new AppError(
          409,
          "Workspace storage limit reached. Export your records and contact the operator before adding more activity.",
          "WORKSPACE_LIMIT",
        );
      try {
        await this.store.save(workspace, previous);
        return { workspace, value };
      } catch (error) {
        if (
          !(error instanceof ConflictError) &&
          (error as { name?: string }).name !==
            "ConditionalCheckFailedException"
        )
          throw error;
      }
    }
    throw new ConflictError(
      "Workspace is busy. Please retry with the same event ID.",
    );
  }
  /** Persist intent before I/O. Unknown outcomes are never automatically resent. */
  async flush(workspaceId: string) {
    const workspace = await this.get(workspaceId);
    for (const candidate of workspace.messages.filter(
      (m) => m.status === "queued" && m.direction === "outbound",
    )) {
      const claim = await this.transact(
        workspaceId,
        (w) => {
          const message = w.messages.find((m) => m.id === candidate.id);
          if (!message || message.status !== "queued") return undefined;
          const buyer = findBuyer(w, message.buyerId);
          const lot = message.lotId ? findLot(w, message.lotId) : undefined;
          const initialOffer =
            message.purpose === "offer" ||
            (!message.purpose &&
              w.messages.find(
                (m) =>
                  m.direction === "outbound" &&
                  m.buyerId === buyer.id &&
                  m.lotId === lot?.id,
              )?.id === message.id);
          const offer = initialOffer
            ? w.offers.find(
                (o) => o.buyerId === buyer.id && o.lotId === lot?.id,
              )
            : undefined;
          const fail = (reason: string) => {
            message.status = "failed";
            message.error = reason;
            if (
              offer &&
              !["accepted", "declined", "expired"].includes(offer.status)
            )
              offer.status = "failed";
          };
          if (buyer.optedOut || !buyer.consent) {
            fail("Buyer is suppressed; message was not sent.");
            return undefined;
          }
          if (
            initialOffer &&
            lot &&
            (lot.status !== "recovering" || hasPassed(lot.dispatchBy))
          ) {
            fail("Offer is no longer open; message was not sent.");
            if (offer) offer.status = "expired";
            return undefined;
          }
          let templateParameters:
            ReturnType<typeof buildOfferMessage>["parameters"] | undefined;
          if (initialOffer && lot && offer) {
            offer.quantity = Math.min(
              offer.quantity,
              lot.available,
              capacity(w, lot, buyer),
            );
            if (offer.quantity < 1) {
              fail(
                "No eligible stock remains for this buyer; the offer was not sent.",
              );
              offer.status = "expired";
              return undefined;
            }
            const rendered = buildOfferMessage({
              contact: buyer.contact,
              companyName: w.settings.companyName,
              product: lot.product,
              unitKg: lot.unitKg,
              quantity: offer.quantity,
              unitPrice: offer.unitPrice,
              deliveryBy: lot.deliveryBy,
              dispatchBy: lot.dispatchBy,
              reference: lot.reference,
            });
            message.text = rendered.text;
            templateParameters = rendered.parameters;
          }
          if (w.settings.mode === "demo") {
            message.status = "simulated";
            if (offer) offer.status = "sent";
            return undefined;
          }
          if (
            process.env.LIVE_SENDS_ENABLED !== "true" ||
            (process.env.SINGLE_LIVE_WORKSPACE_ID &&
              process.env.SINGLE_LIVE_WORKSPACE_ID !== w.id)
          ) {
            fail("This deployment or workspace is not enabled for live sends.");
            return undefined;
          }
          if (!w.settings.autoSend) {
            fail("Live sending is disabled by the operator.");
            return undefined;
          }
          if (
            initialOffer &&
            message.channel === "whatsapp" &&
            !process.env.WHATSAPP_OFFER_TEMPLATE
          ) {
            fail(
              "An approved marketing template is required for a WhatsApp offer.",
            );
            return undefined;
          }
          message.status = "unknown";
          message.error =
            "Send claimed; delivery not yet confirmed. Do not automatically retry.";
          if (offer) offer.status = "unknown";
          return {
            message: structuredClone(message),
            buyer: structuredClone(buyer),
            lot: lot ? structuredClone(lot) : undefined,
            initialOffer,
            templateParameters,
            offer: offer ? structuredClone(offer) : undefined,
          };
        },
        { system: true },
      );
      if (!claim.value) continue;
      const { message, buyer, lot, initialOffer, offer, templateParameters } =
        claim.value;
      let result: DeliveryResult;
      try {
        result = await this.messaging.send({
          channel: message.channel,
          purpose: message.purpose,
          to: message.channel === "email" ? buyer.email : buyer.phone,
          subject: lot
            ? `${claim.workspace.settings.companyName} · ${lot.reference}`
            : "SecondCrate update",
          text: message.text,
          idempotencyKey: message.id,
          lastInboundAt: buyer.lastInboundAt,
          template:
            message.channel === "whatsapp" &&
            initialOffer &&
            templateParameters &&
            process.env.WHATSAPP_OFFER_TEMPLATE
              ? {
                  name: process.env.WHATSAPP_OFFER_TEMPLATE,
                  language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_GB",
                  parameters: templateParameters,
                }
              : undefined,
        });
      } catch {
        result = {
          status: "unknown",
          error:
            "Provider outcome is uncertain. Reconcile delivery receipts before retrying.",
        };
      }
      await this.transact(
        workspaceId,
        (w) => {
          const current = w.messages.find((m) => m.id === message.id);
          if (current) {
            if (!["delivered", "failed"].includes(current.status)) {
              current.status = result.status;
              current.error = result.error;
            }
            current.providerId = current.providerId || result.providerId;
          }
          const currentOffer = offer
            ? w.offers.find((o) => o.id === offer.id)
            : undefined;
          if (
            currentOffer &&
            ["queued", "unknown"].includes(currentOffer.status)
          )
            currentOffer.status =
              result.status === "sent" || result.status === "delivered"
                ? "sent"
                : result.status === "failed"
                  ? "failed"
                  : "unknown";
          event(
            w,
            "delivery",
            result.status === "sent"
              ? "Message accepted by provider"
              : "Message delivery updated",
            `${message.channel}: ${result.status}${result.error ? `. ${result.error}` : ""}`,
            "system",
            { lotId: message.lotId, buyerId: message.buyerId },
          );
        },
        { system: true },
      );
    }
    return this.get(workspaceId);
  }
  async launch(workspaceId: string, lotId: string) {
    const { value: steps } = await this.transact(workspaceId, (workspace) => {
      const lot = findLot(workspace, lotId);
      if (
        workspace.settings.mode === "live" &&
        (!workspace.settings.autoSend ||
          process.env.LIVE_SENDS_ENABLED !== "true")
      )
        throw new AppError(
          409,
          "Enable authorised live sending before launching this lot.",
          "LIVE_SENDS_DISABLED",
        );
      if (lot.status !== "draft")
        throw new AppError(
          409,
          "Only draft lots can be launched.",
          "ALREADY_LAUNCHED",
        );
      const minimum = Math.max(
        pence(lot.floorPrice),
        Math.ceil(
          pence(lot.originalPrice) *
            (1 - workspace.settings.maxDiscountPercent / 100),
        ),
      );
      if (pence(lot.offerPrice) < minimum)
        throw new AppError(
          409,
          `The offer price is below the current authorised minimum ${money(minimum / 100)}. Update the discount policy before launch.`,
          "PRICE_AUTHORITY",
        );
      if (!lot.safetyAttested)
        throw new AppError(
          409,
          "Warehouse release must be attested before outreach.",
          "RELEASE_REQUIRED",
        );
      if (hasPassed(lot.dispatchBy))
        throw new AppError(409, "Dispatch cutoff has passed.", "EXPIRED");
      const steps: AgentStep[] = [];
      const matches = workspace.buyers.map((buyer) => ({
        buyer,
        reason: eligible(workspace, lot, buyer),
      }));
      for (const { buyer, reason } of matches)
        steps.push({
          tool: "match_buyer",
          status: reason ? "blocked" : "success",
          summary: `${buyer.name}: ${reason || "consent, category, route, capacity and delivery verified"}`,
          output: { buyerId: buyer.id, eligible: !reason },
        });
      if (!matches.some((m) => !m.reason))
        throw new AppError(
          409,
          "No eligible buyers. Add an opted-in buyer on the route who can accept this delivery.",
          "NO_MATCHES",
        );
      lot.status = "recovering";
      for (const { buyer, reason } of matches)
        if (!reason) {
          const quantity = Math.min(
            lot.available,
            capacity(workspace, lot, buyer),
          );
          workspace.offers.push({
            id: uid("offer"),
            lotId,
            buyerId: buyer.id,
            quantity,
            unitPrice: lot.offerPrice,
            status: "queued",
            createdAt: now(),
          });
          queue(
            workspace,
            buyer,
            lot,
            buildOfferMessage({
              contact: buyer.contact,
              companyName: workspace.settings.companyName,
              product: lot.product,
              unitKg: lot.unitKg,
              quantity,
              unitPrice: lot.offerPrice,
              deliveryBy: lot.deliveryBy,
              dispatchBy: lot.dispatchBy,
              reference: lot.reference,
            }).text,
            buyer.channel,
            "offer",
          );
        }
      steps.push({
        tool: "publish_offers",
        status: "success",
        summary: `${matches.filter((m) => !m.reason).length} offers queued; no inventory allocated until a buyer confirms.`,
      });
      event(
        workspace,
        "launch",
        "Recovery launched",
        `${lot.quantity} crates released; ${matches.filter((m) => !m.reason).length} eligible buyers.`,
        "operator",
        { lotId, metadata: { steps } },
      );
      return steps;
    });
    return { workspace: await this.flush(workspaceId), steps };
  }
  async processInbound(
    workspaceId: string,
    input: InboundInput,
    options: { trusted?: boolean; receivedAt?: string } = {},
  ) {
    const snapshot = await this.get(workspaceId);
    if (snapshot.settings.mode !== "demo" && !options.trusted)
      throw new AppError(
        403,
        "Live inbound messages must arrive through an authenticated provider webhook.",
        "TRUSTED_CHANNEL_REQUIRED",
      );
    const buyer = findBuyer(snapshot, input.buyerId);
    const lot = findLot(snapshot, input.lotId);
    const receivedAt =
      options.receivedAt &&
      Number.isFinite(Date.parse(options.receivedAt)) &&
      Date.parse(options.receivedAt) <= Date.now() + 300_000
        ? options.receivedAt
        : undefined;
    if (options.receivedAt && !receivedAt)
      throw new AppError(
        400,
        "Provider timestamp is invalid.",
        "INVALID_TIMESTAMP",
      );
    const replay = snapshot.events.find(
      (e) => e.type === "agent_result" && e.metadata?.eventId === input.eventId,
    );
    if (replay)
      return {
        workspace: await this.flush(workspaceId),
        result: replay.metadata?.result as unknown as AgentResult,
      };
    const observedOffer = [...snapshot.offers]
      .reverse()
      .find(
        (o) =>
          o.lotId === lot.id &&
          o.buyerId === buyer.id &&
          ["queued", "unknown", "sent", "negotiating"].includes(o.status),
      );
    // Identity, price and inventory authority never come from the model.
    let inference: Awaited<ReturnType<ReasoningAdapter["decide"]>>;
    if (
      /^(stop|unsubscribe|quit|end|cancel|opt[ -]?out)$/i.test(
        input.text.trim(),
      )
    )
      inference = {
        decision: { intent: "opt_out" },
        model: "compliance / exact opt-out",
      };
    else
      inference = await this.reasoning.decide({
        workspace: snapshot,
        buyer,
        lot,
        text: input.text,
      });
    const { value: result } = await this.transact(
      workspaceId,
      (workspace) => {
        const existing = workspace.events.find(
          (e) =>
            e.type === "agent_result" && e.metadata?.eventId === input.eventId,
        );
        if (existing)
          return existing.metadata?.result as unknown as AgentResult;
        if (workspace.processedEvents.includes(input.eventId))
          throw new AppError(
            409,
            "Event already processed.",
            "DUPLICATE_EVENT",
          );
        const buyer = findBuyer(workspace, input.buyerId);
        const lot = findLot(workspace, input.lotId);
        const decision = inference.decision;
        const latestInboundAt = workspace.messages
          .filter(
            (m) =>
              m.direction === "inbound" &&
              m.buyerId === buyer.id &&
              m.lotId === lot.id,
          )
          .reduce((latest, m) => Math.max(latest, Date.parse(m.createdAt)), 0);
        const staleTerms =
          receivedAt && Date.parse(receivedAt) <= latestInboundAt;
        workspace.messages.push({
          id: uid("msg"),
          buyerId: buyer.id,
          lotId: lot.id,
          channel: input.channel,
          direction: "inbound",
          text: input.text,
          createdAt: receivedAt || now(),
          status: "received",
        });
        if (
          input.channel === "whatsapp" &&
          (workspace.settings.mode === "demo" || receivedAt)
        ) {
          const inboundAt = receivedAt || now();
          if (
            !buyer.lastInboundAt ||
            Date.parse(inboundAt) > Date.parse(buyer.lastInboundAt)
          )
            buyer.lastInboundAt = inboundAt;
        }
        const steps: AgentStep[] = [
          {
            tool: "interpret_intent",
            status: "success",
            summary: `Structured intent: ${decision.intent}.`,
            output: {
              intent: decision.intent,
              quantity: decision.quantity,
              unitPrice: decision.unitPrice,
            },
          },
        ];
        let reply =
          "Please tell me how many crates you would like. An operator can help with anything outside this offer.";
        const offer = [...workspace.offers]
          .reverse()
          .find(
            (o) =>
              o.lotId === lot.id &&
              o.buyerId === buyer.id &&
              ["queued", "unknown", "sent", "negotiating"].includes(o.status),
          );
        const buyerOrders = workspace.orders.filter(
          (order) => order.buyerId === buyer.id && order.lotId === lot.id,
        );
        const block = (tool: string, summary: string) =>
          steps.push({ tool, status: "blocked", summary });
        if (decision.intent === "opt_out") {
          buyer.optedOut = true;
          buyer.consent = false;
          workspace.offers
            .filter(
              (o) =>
                o.buyerId === buyer.id &&
                ["queued", "unknown", "sent", "negotiating"].includes(o.status),
            )
            .forEach((o) => (o.status = "declined"));
          reply = "You are opted out. We will not send you further offers.";
          steps.push({
            tool: "suppress_buyer",
            status: "success",
            summary: "Marketing consent revoked and open offers withdrawn.",
          });
        } else if (buyer.optedOut || !buyer.consent) {
          reply =
            "Your account is not opted in to these offers. Please contact your wholesaler to update consent.";
          block("verify_consent", "No current consent; no order created.");
        } else if (decision.intent === "question" && buyerOrders.length > 0) {
          const facts = buyerOrders
            .map(
              (order) =>
                `${order.confirmationCode}: ${order.quantity} crates, ${money(order.total)} total; ${order.status === "dispatched" ? "recorded as dispatched by the operator" : "confirmed"}.`,
            )
            .join("\n");
          reply = `Your recorded ${buyerOrders.length === 1 ? "order" : "orders"} for ${lot.product} (${lot.reference}):\n${facts}\nRecorded scheduled delivery: ${formatLondonOfferDate(lot.deliveryBy)}. For a current fulfilment update or product questions, contact ${workspace.settings.companyName}.`;
          steps.push({
            tool: "read_order_facts",
            status: "success",
            summary: `Read ${buyerOrders.length} order${buyerOrders.length === 1 ? "" : "s"} belonging to this buyer and lot. No orders, stock or offer terms changed.`,
            output: { orderIds: buyerOrders.map((order) => order.id) },
          });
        } else if (
          staleTerms &&
          ["accept", "negotiate", "decline"].includes(decision.intent)
        ) {
          reply =
            "A newer message or a message with the same timestamp is already on record. Please confirm the current quantity and price again; no order or terms were changed.";
          block(
            "check_message_order",
            "Out-of-order or ambiguous-timestamp message retained for audit without changing current terms.",
          );
        } else if (decision.intent === "decline") {
          if (offer) offer.status = "declined";
          reply =
            "No problem. This offer has been declined; no order was placed.";
          steps.push({
            tool: "decline_offer",
            status: "success",
            summary: "Offer declined without changing stock.",
          });
        } else if (lot.status !== "recovering" || hasPassed(lot.dispatchBy)) {
          reply =
            lot.available === 0
              ? "This lot is fully allocated. No additional order has been placed."
              : "This offer is no longer open. No order has been placed.";
          block(
            "verify_cutoff",
            "Offer is closed, not launched, or dispatch cutoff has passed.",
          );
          if (hasPassed(lot.dispatchBy) && offer) offer.status = "expired";
        } else if (!offer) {
          reply =
            "There is no active offer for your account on this lot. Please ask the operator for assistance.";
          block("verify_offer", "An active offer is required.");
        } else if (
          decision.intent === "accept" ||
          decision.intent === "negotiate"
        ) {
          const quantity = decision.quantity ?? offer.quantity;
          const unitPrice = decision.unitPrice ?? offer.unitPrice;
          const minimum = Math.max(
            pence(lot.floorPrice),
            Math.ceil(
              pence(lot.originalPrice) *
                (1 - workspace.settings.maxDiscountPercent / 100),
            ),
          );
          const reason = eligible(workspace, lot, buyer);
          const implicitTermsChanged =
            decision.intent === "accept" &&
            ((decision.quantity === undefined &&
              (observedOffer?.id !== offer.id ||
                observedOffer.quantity !== offer.quantity)) ||
              (decision.unitPrice === undefined &&
                (observedOffer?.id !== offer.id ||
                  observedOffer.unitPrice !== offer.unitPrice)));
          if (implicitTermsChanged) {
            reply =
              "The proposed terms changed while this reply was being processed. Please confirm the current quantity and price again; no order was placed.";
            block(
              "verify_offer_terms",
              "Implicit acceptance cannot use terms that changed after the message was read.",
            );
          } else if (
            decision.intent === "accept" &&
            decision.quantity === undefined &&
            offer.status !== "negotiating"
          ) {
            reply =
              "Please confirm how many crates you would like. The initial offer is an upper limit, not a reserved quantity.";
            block(
              "confirm_quantity",
              "A quantity is required before accepting the initial offer.",
            );
          } else if (
            receivedAt &&
            Date.parse(receivedAt) < Date.parse(offer.createdAt) - 1000
          ) {
            reply =
              "This message predates the current offer. Please confirm the current quantity and price.";
            block(
              "check_message_order",
              "A delayed message cannot accept a newer offer.",
            );
          } else if (
            !Number.isInteger(quantity) ||
            quantity < 1 ||
            quantity > 100_000 ||
            !Number.isFinite(unitPrice) ||
            unitPrice <= 0 ||
            Math.abs(unitPrice * 100 - pence(unitPrice)) > 1e-6
          ) {
            reply =
              "Please send a whole number of crates and a price with at most two decimal places.";
            block("validate_terms", "Malformed quantity or price rejected.");
          } else if (reason) {
            reply = `I cannot confirm this order: ${reason.toLowerCase()}. An operator can help.`;
            block("check_buyer_constraints", reason);
          } else if (
            decision.deliveryBefore &&
            !deliveryFits(lot, decision.deliveryBefore)
          ) {
            reply = `I cannot promise that delivery time. The scheduled arrival is ${new Date(lot.deliveryBy).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })} London time. No order has been placed.`;
            block(
              "check_delivery",
              "Requested delivery is earlier than the scheduled route.",
            );
          } else if (quantity > capacity(workspace, lot, buyer)) {
            reply = `Your current capacity for this lot is ${capacity(workspace, lot, buyer)} crates. Please confirm a quantity within that limit.`;
            block("check_capacity", "Buyer capacity would be exceeded.");
          } else if (quantity > lot.available) {
            reply = `Only ${lot.available} crates remain. Please confirm a quantity up to ${lot.available}; I have not placed a partial order.`;
            block(
              "allocate_stock",
              "Requested quantity exceeds remaining inventory.",
            );
          } else if (pence(unitPrice) < minimum) {
            offer.status = "negotiating";
            offer.quantity = quantity;
            offer.unitPrice = minimum / 100;
            reply = `I can offer ${quantity} crates at ${money(minimum / 100)} each (${money((quantity * minimum) / 100)} total). Reply YES to confirm. Stock is not reserved until confirmation.`;
            block(
              "check_price_authority",
              `Requested price below authorised minimum ${money(minimum / 100)}. A counteroffer was proposed.`,
            );
          } else if (pence(unitPrice) > pence(lot.originalPrice)) {
            reply = `The original price is ${money(lot.originalPrice)} per crate. Please confirm the intended unit price; no order has been placed.`;
            block(
              "check_price_authority",
              "Price above original price rejected to catch amount ambiguity.",
            );
          } else if (decision.intent === "negotiate") {
            offer.status = "negotiating";
            offer.quantity = quantity;
            offer.unitPrice = unitPrice;
            reply = `Yes: ${quantity} crates at ${money(unitPrice)} each, ${money((quantity * pence(unitPrice)) / 100)} total. Reply YES to confirm. Stock is allocated only when confirmed.`;
            steps.push({
              tool: "propose_terms",
              status: "success",
              summary: "Valid counteroffer prepared; stock unchanged.",
            });
          } else {
            const confirmationCode = `SC-${uid("").slice(-10).toUpperCase()}`;
            const total = (quantity * pence(unitPrice)) / 100;
            const order = {
              id: uid("order"),
              lotId: lot.id,
              buyerId: buyer.id,
              quantity,
              unitPrice: pence(unitPrice) / 100,
              total,
              createdAt: now(),
              status: "confirmed" as const,
              confirmationCode,
            };
            workspace.orders.push(order);
            lot.available -= quantity;
            offer.status = "accepted";
            if (lot.available === 0) {
              lot.status = "recovered";
              workspace.offers
                .filter(
                  (o) =>
                    o.lotId === lot.id &&
                    ["queued", "unknown", "sent", "negotiating"].includes(
                      o.status,
                    ),
                )
                .forEach((o) => (o.status = "expired"));
            }
            reply = `Confirmed ${confirmationCode}: ${quantity} crates of ${lot.product} at ${money(unitPrice)} each, total ${money(total)}. Delivery ${new Date(lot.deliveryBy).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })} London time on your existing route. Your wholesaler will fulfil this order.`;
            steps.push(
              {
                tool: "check_price_authority",
                status: "success",
                summary: `${money(unitPrice)} meets the authorised minimum ${money(minimum / 100)}.`,
              },
              {
                tool: "allocate_stock",
                status: "success",
                summary: `Atomically allocated ${quantity} crates. ${lot.available} remain.`,
                output: {
                  orderId: order.id,
                  quantity,
                  remaining: lot.available,
                },
              },
              {
                tool: "confirm_order",
                status: "success",
                summary: `Order ${confirmationCode} recorded at ${money(total)}.`,
              },
            );
            event(
              workspace,
              "order_confirmed",
              "Order confirmed",
              `${buyer.name}: ${quantity} crates × ${money(unitPrice)} = ${money(total)}.`,
              "agent",
              {
                lotId: lot.id,
                buyerId: buyer.id,
                metadata: { orderId: order.id },
              },
            );
            if (input.channel !== "email" && buyer.email)
              queue(workspace, buyer, lot, reply, "email", "confirmation");
          }
        } else if (decision.intent === "question") {
          reply = `${lot.product}: ${lot.unitKg} kg per crate, ${lot.available} crates available at ${money(offer?.unitPrice ?? lot.offerPrice)} each. Delivery ${new Date(lot.deliveryBy).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" })} London time. For quality, allergen or handling questions, please contact the warehouse operator. Tell me a quantity to order.`;
          steps.push({
            tool: "read_lot_facts",
            status: "success",
            summary: "Replied using verified lot facts; no stock mutation.",
          });
        }
        // Opt-outs are recorded locally without sending further marketing to suppressed contacts.
        if (decision.intent !== "opt_out" && buyer.consent && !buyer.optedOut)
          queue(workspace, buyer, lot, reply, input.channel);
        else if (workspace.settings.mode === "demo")
          workspace.messages.push({
            id: uid("msg"),
            buyerId: buyer.id,
            lotId: lot.id,
            channel: input.channel,
            direction: "outbound",
            text: reply,
            createdAt: now(),
            status: "simulated",
          });
        const result: AgentResult = {
          reply,
          steps,
          model: inference.model,
          inputTokens: inference.inputTokens,
          outputTokens: inference.outputTokens,
        };
        workspace.processedEvents.push(input.eventId);
        event(
          workspace,
          "agent_result",
          "Buyer message handled",
          `${buyer.name}: ${decision.intent}. ${steps.filter((s) => s.status === "blocked").length ? "A policy check blocked execution." : "Validated tools completed."}`,
          "agent",
          {
            lotId: lot.id,
            buyerId: buyer.id,
            metadata: { eventId: input.eventId, result },
          },
        );
        return result;
      },
      { essential: inference.decision.intent === "opt_out" },
    );
    return { workspace: await this.flush(workspaceId), result };
  }
  async addLot(
    workspaceId: string,
    input: Omit<
      Lot,
      | "id"
      | "reference"
      | "available"
      | "createdAt"
      | "status"
      | "unit"
      | "source"
    >,
  ) {
    const { value: lot } = await this.transact(workspaceId, (w) => {
      if (w.lots.length >= 100)
        throw new AppError(
          409,
          "Workspace lot limit reached.",
          "WORKSPACE_LIMIT",
        );
      const lot: Lot = {
        ...input,
        id: uid("lot"),
        reference: `SC-${String(w.lots.length + 1043)}`,
        available: input.quantity,
        createdAt: now(),
        status: "draft",
        unit: "crates",
        source: "Operator release",
      };
      w.lots.unshift(lot);
      event(
        w,
        "lot_created",
        "Lot prepared",
        `${lot.quantity} crates of ${lot.product}; pending launch.`,
        "operator",
        { lotId: lot.id },
      );
      return lot;
    });
    return { lot };
  }
  async close(workspaceId: string, lotId: string) {
    return this.transact(workspaceId, (w) => {
      const lot = findLot(w, lotId);
      lot.status = "closed";
      w.offers
        .filter(
          (o) =>
            o.lotId === lotId &&
            ["queued", "unknown", "sent", "negotiating"].includes(o.status),
        )
        .forEach((o) => (o.status = "expired"));
      event(
        w,
        "lot_closed",
        "Recovery closed",
        `${lot.available} unallocated crates remain. Existing confirmed orders are unchanged.`,
        "operator",
        { lotId },
      );
    });
  }
  async dispatch(workspaceId: string, orderId: string) {
    return this.transact(workspaceId, (w) => {
      const order = w.orders.find((o) => o.id === orderId);
      if (!order) throw new AppError(404, "Order not found.", "NOT_FOUND");
      if (order.status === "dispatched") return;
      if (hasPassed(findLot(w, order.lotId).dispatchBy))
        throw new AppError(
          409,
          "Dispatch cutoff passed. Resolve the delivery with the buyer before dispatching.",
          "EXPIRED",
        );
      order.status = "dispatched";
      event(
        w,
        "order_dispatched",
        "Dispatch recorded",
        `${order.confirmationCode} marked dispatched by the operator.`,
        "operator",
        { lotId: order.lotId, buyerId: order.buyerId },
      );
    });
  }
  async addBuyer(workspaceId: string, input: Omit<Buyer, "id">) {
    const { value: buyer } = await this.transact(workspaceId, (w) => {
      validateBuyer(input);
      if (w.buyers.length >= 100)
        throw new AppError(
          409,
          "Workspace buyer limit reached.",
          "WORKSPACE_LIMIT",
        );
      checkUniqueContact(w, input);
      const buyer = {
        ...input,
        id: uid("buyer"),
        consentAt: input.consent ? input.consentAt || now() : undefined,
      };
      w.buyers.push(buyer);
      event(
        w,
        "buyer_added",
        "Buyer added",
        `${buyer.name}; consent ${buyer.consent ? "recorded" : "not provided"}.`,
        "operator",
      );
      return buyer;
    });
    return { buyer };
  }
  async updateBuyer(workspaceId: string, id: string, input: Partial<Buyer>) {
    const { value: buyer } = await this.transact(
      workspaceId,
      (w) => {
        const buyer = findBuyer(w, id);
        validateBuyer({ ...buyer, ...input });
        checkUniqueContact(w, { ...buyer, ...input }, id);
        const destinationChanged =
          (input.channel !== undefined && input.channel !== buyer.channel) ||
          (input.email !== undefined &&
            input.email.toLowerCase() !== buyer.email.toLowerCase()) ||
          (input.phone !== undefined && input.phone !== buyer.phone);
        if (
          (destinationChanged ||
            ((!buyer.consent || buyer.optedOut) && input.consent === true)) &&
          (input.consent ?? buyer.consent) &&
          (input.consent !== true ||
            !input.consentSource?.trim() ||
            (input.consentSource === buyer.consentSource &&
              (!input.consentAt || input.consentAt === buyer.consentAt)))
        )
          throw new AppError(
            400,
            "Record fresh consent before restoring outreach or changing the channel or contact details.",
            "CONSENT_REQUIRED",
          );
        Object.assign(buyer, input);
        if (input.consent === true) {
          buyer.optedOut = false;
          buyer.consentAt = input.consentAt || now();
        }
        if (input.consent === false || input.optedOut === true) {
          buyer.consent = false;
          w.offers
            .filter(
              (o) =>
                o.buyerId === id &&
                ["queued", "unknown", "sent", "negotiating"].includes(o.status),
            )
            .forEach((o) => (o.status = "declined"));
        }
        event(
          w,
          "buyer_updated",
          "Buyer updated",
          `${buyer.name} preferences updated.`,
          "operator",
          { buyerId: id },
        );
        return buyer;
      },
      { essential: input.consent === false || input.optedOut === true },
    );
    return { buyer };
  }
  async settings(workspaceId: string, input: Partial<Settings>) {
    const { value: settings } = await this.transact(
      workspaceId,
      (w) => {
        Object.assign(w.settings, input);
        event(
          w,
          "settings",
          "Workspace settings updated",
          "Operator configuration updated.",
          "operator",
        );
        return w.settings;
      },
      { essential: input.autoSend === false },
    );
    return { settings };
  }
  async reset(workspaceId: string) {
    const { workspace } = await this.transact(workspaceId, (w) => {
      if (w.settings.mode !== "demo")
        throw new AppError(
          403,
          "Reset is available only in demonstration workspaces.",
          "DEMO_ONLY",
        );
      const fresh = createWorkspace(w.settings.operatorName, true, w.id);
      Object.assign(w, fresh, { version: w.version });
    });
    return { workspace };
  }
  async optOutBuyer(workspaceId: string, buyerId: string, eventId: string) {
    const { workspace } = await this.transact(
      workspaceId,
      (w) => {
        if (w.processedEvents.includes(eventId)) return;
        const buyer = findBuyer(w, buyerId);
        if (buyer.optedOut && !buyer.consent) return;
        buyer.consent = false;
        buyer.optedOut = true;
        w.offers
          .filter(
            (o) =>
              o.buyerId === buyerId &&
              ["queued", "unknown", "sent", "negotiating"].includes(o.status),
          )
          .forEach((o) => (o.status = "declined"));
        w.processedEvents.push(eventId);
        event(
          w,
          "buyer_suppressed",
          "Buyer suppressed",
          "Inbound opt-out or provider complaint revoked marketing consent.",
          "system",
          { buyerId, metadata: { eventId } },
        );
      },
      { essential: true },
    );
    return workspace;
  }
  async recordCancellation(
    workspaceId: string,
    input: { eventId: string; text: string; subject: string },
  ) {
    const { workspace } = await this.transact(workspaceId, (w) => {
      if (w.processedEvents.includes(input.eventId)) return;
      w.processedEvents.push(input.eventId);
      event(
        w,
        "cancellation_received",
        "Cancellation email received",
        input.subject.slice(0, 180),
        "system",
        {
          metadata: {
            eventId: input.eventId,
            sourceText: input.text.slice(0, 10000),
            reviewRequired: true,
          },
        },
      );
    });
    return workspace;
  }
  async recordUnmatchedInbound(
    workspaceId: string,
    input: {
      eventId: string;
      channel: Message["channel"];
      buyerId?: string;
      text: string;
      reason: string;
    },
  ) {
    const { workspace } = await this.transact(
      workspaceId,
      (w) => {
        if (w.processedEvents.includes(input.eventId)) return;
        w.processedEvents.push(input.eventId);
        event(
          w,
          "unmatched_inbound",
          "Buyer message needs review",
          input.reason.slice(0, 500),
          "system",
          {
            buyerId: input.buyerId,
            metadata: {
              eventId: input.eventId,
              channel: input.channel,
              sourceText: input.text.slice(0, 4000),
              reviewRequired: true,
            },
          },
        );
      },
      { system: true },
    );
    return workspace;
  }
  async reconcileMessage(
    workspaceId: string,
    messageId: string,
    input: {
      outcome: "sent" | "failed";
      providerId?: string;
      evidence: string;
    },
    operatorId: string,
  ) {
    const { workspace } = await this.transact(
      workspaceId,
      (w) => {
        if (w.settings.mode !== "live")
          throw new AppError(
            403,
            "Simulated messages cannot be reconciled into real provider outcomes.",
            "DEMO_ONLY",
          );
        const message = w.messages.find((m) => m.id === messageId);
        if (!message)
          throw new AppError(404, "Message not found.", "NOT_FOUND");
        if (message.direction !== "outbound" || message.status !== "unknown")
          throw new AppError(
            409,
            "Only an unknown outbound send can be reconciled. Existing delivery evidence is preserved.",
            "RECONCILIATION_NOT_ALLOWED",
          );
        if (input.evidence.trim().length < 20 || input.evidence.length > 2000)
          throw new AppError(
            400,
            "Record 20–2000 characters of external evidence or a provider support reference.",
            "EVIDENCE_REQUIRED",
          );
        if (input.outcome === "sent" && !input.providerId)
          throw new AppError(
            400,
            "A provider message ID is required to record acceptance.",
            "PROVIDER_ID_REQUIRED",
          );
        if (
          input.providerId &&
          (input.providerId.length > 256 ||
            !/^[A-Za-z0-9_.:/+=-]+$/.test(input.providerId))
        )
          throw new AppError(
            400,
            "Provider message ID is invalid.",
            "INVALID_PROVIDER_ID",
          );
        if (
          input.providerId &&
          ((message.providerId && message.providerId !== input.providerId) ||
            w.messages.some(
              (m) => m.id !== message.id && m.providerId === input.providerId,
            ))
        )
          throw new AppError(
            409,
            "This provider message ID conflicts with an existing message record.",
            "PROVIDER_ID_CONFLICT",
          );
        message.status = input.outcome;
        if (input.providerId) message.providerId = input.providerId;
        message.error =
          input.outcome === "failed"
            ? "Operator recorded non-acceptance; see the reconciliation audit. No retry was sent."
            : undefined;
        const offer =
          message.purpose === "offer"
            ? w.offers.find(
                (o) =>
                  o.lotId === message.lotId && o.buyerId === message.buyerId,
              )
            : undefined;
        if (offer && ["queued", "unknown"].includes(offer.status))
          offer.status = input.outcome;
        event(
          w,
          "operator_reconciliation",
          "Operator recorded a send outcome",
          "Externally checked outcome reported by the operator. SecondCrate has not independently verified the evidence; no retry was sent.",
          "operator",
          {
            lotId: message.lotId,
            buyerId: message.buyerId,
            metadata: {
              messageId: message.id,
              operatorId,
              previousStatus: "unknown",
              outcome: input.outcome,
              providerId: message.providerId,
              evidence: input.evidence.trim(),
              verificationSource: "operator",
            },
          },
        );
      },
      { system: true },
    );
    return { workspace };
  }
  async recordDelivery(
    workspaceId: string,
    providerId: string,
    status: Message["status"],
    error?: string,
    correlationId?: string,
  ) {
    const { workspace } = await this.transact(
      workspaceId,
      (w) => {
        const message = w.messages.find(
          (m) =>
            m.providerId === providerId ||
            (correlationId &&
              createHash("sha256").update(m.id).digest("hex").slice(0, 32) ===
                correlationId),
        );
        if (!message) return;
        if (!message.providerId) message.providerId = providerId;
        if (message.status === status && message.error === error) return;
        if (
          ["delivered", "failed"].includes(message.status) &&
          status === "sent"
        )
          return;
        message.status = status;
        message.error = error;
        const offer =
          message.purpose === "offer"
            ? w.offers.find(
                (o) =>
                  o.lotId === message.lotId && o.buyerId === message.buyerId,
              )
            : undefined;
        if (
          offer &&
          ["queued", "unknown", "sent", "failed"].includes(offer.status)
        )
          offer.status =
            status === "delivered" || status === "sent"
              ? "sent"
              : status === "failed"
                ? "failed"
                : offer.status;
        event(
          w,
          "receipt",
          "Provider delivery receipt",
          `${message.channel}: ${status}`,
          "system",
          { lotId: message.lotId, buyerId: message.buyerId },
        );
      },
      { system: true },
    );
    return workspace;
  }
}
