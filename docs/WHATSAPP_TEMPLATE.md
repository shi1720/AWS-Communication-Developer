# WhatsApp surplus-offer template

SecondCrate's initial surplus offers use an approved **Meta MARKETING** template through AWS End User Messaging Social. The template must use the body and nine positional variables below. The application's canonical source is [`src/server/offer-message.ts`](../src/server/offer-message.ts); launch, outbox delivery and the operator's displayed message all render that same body.

- Recommended template name: `secondcrate_surplus_v1`
- Language: English (UK), `en_GB`
- Category: **MARKETING**
Components: body only; no header, footer or buttons.

Copy this body exactly, preserving the line breaks:

```text
Hi {{1}}, {{2}} has {{3}} available: {{4}} kg per crate. Up to {{5}} crates at {{6}} each on your existing route.
Delivery: {{7}}. Confirm before: {{8}}.
Reference: {{9}}. Reply with the reference and quantity to order. Stock is allocated only after confirmation and is subject to availability. Reply STOP to opt out.
```

| Variable | Meaning | Example for Meta approval |
|---|---|---|
| `{{1}}` | Buyer contact name | Maya Chen |
| `{{2}}` | Wholesaler name | Northstar Produce |
| `{{3}}` | Product | Cherry tomatoes |
| `{{4}}` | Kilograms per crate | 5 |
| `{{5}}` | Available quantity offered to this buyer | 16 |
| `{{6}}` | Price per crate in GBP | £18.00 |
| `{{7}}` | Scheduled delivery, date and London time | 22 Sept 2026 14:30 London time |
| `{{8}}` | Dispatch/confirmation cutoff, date and London time | 22 Sept 2026 14:00 London time |
| `{{9}}` | Lot reference used for inbound routing | NS-1042 |

The resulting buyer message is:

```text
Hi Maya Chen, Northstar Produce has Cherry tomatoes available: 5 kg per crate. Up to 16 crates at £18.00 each on your existing route.
Delivery: 22 Sept 2026 14:30 London time. Confirm before: 22 Sept 2026 14:00 London time.
Reference: NS-1042. Reply with the reference and quantity to order. Stock is allocated only after confirmation and is subject to availability. Reply STOP to opt out.
```

A buyer can reply `NS-1042: I'll take 12 crates.` The reference makes multiple simultaneous offers distinguishable. A WhatsApp reply-to context can also identify the original message. The backend still rechecks consent, stock, delivery, buyer capacity, price authority and cutoff before confirming an order.

## Configure and verify

1. Connect an eligible WhatsApp Business Account and phone number to AWS End User Messaging Social as described in the [AWS deployment guide](AWS_DEPLOYMENT.md).
2. In the account's WhatsApp Manager, create a Marketing message template with the recommended name, English (UK) language, exact body and all nine example values above. Submit it for approval.
3. After the template is approved and active, set `WHATSAPP_OFFER_TEMPLATE=secondcrate_surplus_v1` and `WHATSAPP_TEMPLATE_LANGUAGE=en_GB`, together with the account's `WHATSAPP_PHONE_NUMBER_ID` and supported `WHATSAPP_META_API_VERSION`. A different template name is acceptable only if its approved body and variable order match this contract.
4. Complete the live workspace and consent prerequisites in the deployment guide. Send one controlled offer to a consenting test recipient. Compare the actual WhatsApp message with the persisted operator message, capture the provider message ID and verify the receipt.
5. If the body or variable order changes, create a new template version and update the helper, this document and tests together before changing the configured template name.

The send claim recalculates the quantity against current stock and buyer capacity and persists the exact revised message before provider I/O. Dates always include the day, month, year and London time, including daylight-saving changes. Other channels reuse the same substantive offer text; SMS may therefore span multiple billable segments.

The supplied template body and environment settings do not establish Meta approval, AWS account permissions or real delivery. Until those external checks pass, use the clearly labeled rehearsal workspace. Tests verify body/parameter equivalence and provider command construction without claiming a live WhatsApp send.
