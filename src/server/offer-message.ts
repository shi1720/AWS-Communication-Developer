/** Keep this body identical to the approved Meta MARKETING template.
 * The UI's persisted message and provider parameters are rendered together.
 * See docs/WHATSAPP_TEMPLATE.md for the exact deployment contract. */
export const WHATSAPP_OFFER_TEMPLATE_BODY =
  "Hi {{1}}, {{2}} has {{3}} available: {{4}} kg per crate. Up to {{5}} crates at {{6}} each on your existing route.\n" +
  "Delivery: {{7}}. Confirm before: {{8}}.\n" +
  "Reference: {{9}}. Reply with the reference and quantity to order. Stock is allocated only after confirmation and is subject to availability. Reply STOP to opt out.";

export interface OfferMessageInput {
  contact: string;
  companyName: string;
  product: string;
  unitKg: number;
  quantity: number;
  unitPrice: number;
  deliveryBy: string;
  dispatchBy: string;
  reference: string;
}
export type OfferTemplateParameters = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

export function formatLondonOfferDate(timestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const value = (kind: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === kind)!.value;
  return `${value("day")} ${value("month")} ${value("year")} ${value("hour")}:${value("minute")} London time`;
}

export function renderOfferTemplate(
  parameters: OfferTemplateParameters,
): string {
  return WHATSAPP_OFFER_TEMPLATE_BODY.replace(
    /\{\{([1-9])\}\}/g,
    (_, index: string) => parameters[Number(index) - 1],
  );
}

export function buildOfferMessage(input: OfferMessageInput): {
  text: string;
  parameters: OfferTemplateParameters;
} {
  const parameters: OfferTemplateParameters = [
    input.contact,
    input.companyName,
    input.product,
    String(input.unitKg),
    String(input.quantity),
    `£${input.unitPrice.toFixed(2)}`,
    formatLondonOfferDate(input.deliveryBy),
    formatLondonOfferDate(input.dispatchBy),
    input.reference,
  ];
  return { parameters, text: renderOfferTemplate(parameters) };
}
