import { z } from "zod";
import type { Channel, Message, Workspace } from "../../shared/types.js";

export type ProviderEvent =
  | {
      kind: "message";
      channel: Channel;
      from: string;
      text: string;
      eventId: string;
      timestamp?: string;
      replyToProviderId?: string;
      subject?: string;
    }
  | {
      kind: "receipt";
      providerId: string;
      status: Message["status"];
      error?: string;
      suppress?: boolean;
      correlationId?: string;
    }
  | { kind: "email"; notification: Record<string, any> };
const string = z.string().min(1).max(8000);
const sms = z.object({
  originationNumber: z.string().regex(/^\+[1-9]\d{7,14}$/),
  messageBody: string,
  inboundMessageId: z.string().min(1).max(256),
});
export function parseProviderEvent(value: unknown): ProviderEvent[] {
  if (!value || typeof value !== "object")
    throw new Error("Provider event must be a JSON object.");
  const data = value as Record<string, any>;
  const parsedSms = sms.safeParse(data);
  if (parsedSms.success)
    return [
      {
        kind: "message",
        channel: "sms",
        from: parsedSms.data.originationNumber,
        text: parsedSms.data.messageBody,
        eventId: `sms:${parsedSms.data.inboundMessageId}`,
      },
    ];
  if (data.whatsAppWebhookEntry) {
    const entry =
      typeof data.whatsAppWebhookEntry === "string"
        ? JSON.parse(data.whatsAppWebhookEntry)
        : data.whatsAppWebhookEntry;
    const events: ProviderEvent[] = [];
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const body =
          message.type === "text"
            ? message.text?.body
            : message.type === "interactive"
              ? (message.interactive?.button_reply?.title ??
                message.interactive?.list_reply?.title)
              : message.type === "button"
                ? message.button?.text
                : undefined;
        if (
          typeof body === "string" &&
          /^\d{8,15}$/.test(message.from) &&
          typeof message.id === "string"
        ) {
          events.push({
            kind: "message",
            channel: "whatsapp",
            from: `+${message.from}`,
            text: string.parse(body),
            eventId: `whatsapp:${message.id}`,
            replyToProviderId:
              typeof message.context?.id === "string"
                ? message.context.id
                : undefined,
            timestamp: message.timestamp
              ? new Date(Number(message.timestamp) * 1000).toISOString()
              : undefined,
          });
        }
      }
      for (const receipt of change.value?.statuses ?? []) {
        const statuses: Record<string, Message["status"]> = {
          sent: "sent",
          delivered: "delivered",
          read: "delivered",
          failed: "failed",
        };
        const status = statuses[receipt.status];
        if (status && typeof receipt.id === "string")
          events.push({
            kind: "receipt",
            providerId: receipt.id,
            status,
            correlationId:
              typeof receipt.biz_opaque_callback_data === "string"
                ? receipt.biz_opaque_callback_data
                : undefined,
            error:
              status === "failed"
                ? "WhatsApp reported delivery failure."
                : undefined,
          });
      }
    }
    return events;
  }
  const eventType = data.eventType ?? data.notificationType;
  if (eventType === "Received" && data.receipt && data.mail)
    return [{ kind: "email", notification: data }];
  if (
    data.mail?.messageId &&
    [
      "Delivery",
      "Bounce",
      "Complaint",
      "Reject",
      "Rendering Failure",
      "Send",
    ].includes(eventType)
  ) {
    const status =
      eventType === "Delivery"
        ? "delivered"
        : eventType === "Send"
          ? "sent"
          : "failed";
    return [
      {
        kind: "receipt",
        providerId: data.mail.messageId,
        status,
        correlationId: data.mail.tags?.["secondcrate-reference"]?.[0],
        error:
          status === "failed"
            ? `SES reported ${eventType.toLowerCase()}.`
            : undefined,
        suppress:
          eventType === "Complaint" ||
          (eventType === "Bounce" && data.bounce?.bounceType === "Permanent"),
      },
    ];
  }
  if (data.messageId && typeof eventType === "string") {
    if (eventType === "TEXT_DELIVERED")
      return [
        {
          kind: "receipt",
          providerId: data.messageId,
          correlationId: data.context?.secondcrateReference,
          status: "delivered",
        },
      ];
    if (["TEXT_SUCCESSFUL", "TEXT_SENT"].includes(eventType))
      return [
        {
          kind: "receipt",
          providerId: data.messageId,
          correlationId: data.context?.secondcrateReference,
          status: "sent",
        },
      ];
    if (
      [
        "TEXT_INVALID",
        "TEXT_INVALID_MESSAGE",
        "TEXT_UNREACHABLE",
        "TEXT_CARRIER_UNREACHABLE",
        "TEXT_BLOCKED",
        "TEXT_CARRIER_BLOCKED",
        "TEXT_SPAM",
        "TEXT_UNKNOWN",
        "TEXT_TTL_EXPIRED",
        "TEXT_PROTECT_BLOCKED",
      ].includes(eventType)
    )
      return [
        {
          kind: "receipt",
          providerId: data.messageId,
          correlationId: data.context?.secondcrateReference,
          status: "failed",
          error: `SMS reported ${eventType}.`,
        },
      ];
  }
  return []; // Non-message provider events (e.g. account updates) are acknowledged.
}

export function resolveBuyerConversation(
  workspace: Workspace,
  event: Extract<ProviderEvent, { kind: "message" }>,
): { buyerId: string; lotId: string } | undefined {
  const buyers = workspace.buyers.filter((buyer) =>
    event.channel === "email"
      ? buyer.email.toLowerCase() === event.from.toLowerCase()
      : buyer.phone === event.from,
  );
  if (buyers.length !== 1) return undefined;
  const buyer = buyers[0];
  const offers = workspace.offers.filter(
    (offer) =>
      offer.buyerId === buyer.id &&
      !["declined", "expired"].includes(offer.status),
  );
  const lots = [...new Set(offers.map((offer) => offer.lotId))]
    .map((id) => workspace.lots.find((lot) => lot.id === id))
    .filter((lot) => lot !== undefined);
  if (event.replyToProviderId) {
    const message = workspace.messages.find(
      (message) =>
        message.buyerId === buyer.id &&
        message.channel === event.channel &&
        message.direction === "outbound" &&
        message.providerId === event.replyToProviderId,
    );
    return message?.lotId && lots.some((lot) => lot.id === message.lotId)
      ? { buyerId: buyer.id, lotId: message.lotId }
      : undefined;
  }
  const referenceText = `${event.subject ?? ""} ${event.text}`.toUpperCase();
  const references: string[] = referenceText.match(/\b(?:SC|LL|NS)-\d+\b/g) ?? [];
  const byReference = lots.filter((lot) =>
    references.includes(lot.reference.toUpperCase()),
  );
  if (references.length && byReference.length !== 1) return undefined;
  const active = lots.filter((lot) => lot.status === "recovering");
  const lot =
    byReference.length === 1
      ? byReference[0]
      : active.length === 1
        ? active[0]
        : undefined;
  return lot ? { buyerId: buyer.id, lotId: lot.id } : undefined;
}
