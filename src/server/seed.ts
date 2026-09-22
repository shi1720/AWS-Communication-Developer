import { randomUUID } from "node:crypto";
import type { Buyer, Workspace } from "../shared/types.js";
export const uid = (prefix: string) =>
  `${prefix}_${randomUUID().replaceAll("-", "")}`;
export const now = () => new Date().toISOString();
export function createWorkspace(
  name: string,
  demo: boolean,
  id = uid("ws"),
): Workspace {
  const createdAt = now();
  const date = new Date();
  date.setHours(date.getHours() + 3);
  const dispatchBy = date.toISOString();
  date.setMinutes(date.getMinutes() + 30);
  const deliveryBy = date.toISOString();
  const buyer = (
    data: Partial<Buyer> &
      Pick<Buyer, "id" | "name" | "channel" | "maxCrates" | "distanceKm">,
  ): Buyer => ({
    contact: "Purchasing team",
    email: `${data.id}@example.com`,
    phone: `+447700900${String(data.id === "buyer_maya" ? 101 : data.id === "buyer_table" ? 102 : data.id === "buyer_union" ? 103 : data.id === "buyer_common" ? 104 : data.id === "buyer_harbour" ? 105 : 106)}`,
    consent: true,
    consentAt: createdAt,
    consentSource: "Fictional demo opt-in; no real messages",
    categories: ["Produce"],
    deliveryBefore: "23:59",
    ...data,
  });
  return {
    id,
    version: 0,
    lots: demo
      ? [
          {
            id: "lot_tomatoes",
            reference: "NS-1042",
            product: "Cherry tomatoes",
            category: "Produce",
            description:
              "40 cancelled crates, 5 kg per crate. Released by the warehouse operator for the existing London route.",
            quantity: 40,
            available: 40,
            unit: "crates",
            unitKg: 5,
            originalPrice: 24,
            floorPrice: 16,
            offerPrice: 18,
            costPrice: 12,
            dispatchBy,
            deliveryBy,
            source: "Cancelled standing order",
            sourceText:
              "Order NS-1042 cancelled. 40 crates cherry tomatoes, 5 kg each. Original £24/crate; released offer £18; floor £16. Existing London route.",
            status: "draft",
            createdAt,
            safetyAttested: true,
          },
        ]
      : [],
    buyers: demo
      ? [
          buyer({
            id: "buyer_maya",
            name: "Olive & Rye",
            contact: "Maya Chen",
            channel: "whatsapp",
            maxCrates: 16,
            distanceKm: 3.2,
          }),
          buyer({
            id: "buyer_table",
            name: "The Sunday Table",
            contact: "Ben Carter",
            channel: "sms",
            maxCrates: 24,
            distanceKm: 5.1,
          }),
          buyer({
            id: "buyer_union",
            name: "Ember Kitchen",
            contact: "Leila Haddad",
            channel: "email",
            maxCrates: 12,
            distanceKm: 6.4,
          }),
          buyer({
            id: "buyer_common",
            name: "Common Ground",
            contact: "Priya Shah",
            channel: "whatsapp",
            maxCrates: 12,
            distanceKm: 4.8,
          }),
          buyer({
            id: "buyer_harbour",
            name: "Harbour Coffee",
            channel: "whatsapp",
            maxCrates: 6,
            distanceKm: 2,
            consent: false,
            consentAt: undefined,
            consentSource: undefined,
          }),
          buyer({
            id: "buyer_bakery",
            name: "Flour & Field",
            channel: "email",
            maxCrates: 10,
            distanceKm: 4,
            categories: ["Bakery"],
          }),
        ]
      : [],
    offers: [],
    messages: [],
    orders: [],
    events: [],
    settings: {
      companyName: demo ? "Northstar Produce" : `${name}’s workspace`,
      operatorName: name,
      autoSend: false,
      maxDiscountPercent: 40,
      mode: demo ? "demo" : "live",
    },
    processedEvents: [],
  };
}
