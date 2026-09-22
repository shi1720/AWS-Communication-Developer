# SecondCrate: research and decision record

Research checked **22 September 2026**. Project creator: **Shivam Gupta**. Northstar Produce and all demonstration buyers, orders and results are fictional. This document distinguishes published evidence from product hypotheses.

## Why this problem

A cancelled wholesale order creates a coordination problem: the stock exists, the route may already be planned, and suitable buyers are busy. SecondCrate tests whether a distributor can recover the order by offering it selectively to existing buyers, interpreting their conditions, and committing only orders that satisfy stock, price and delivery constraints.

The initial wedge is a **single regional produce depot with an existing opted-in restaurant network**. This avoids needing to recruit both sides of a new marketplace. Cancellation frequency, recoverable margin, willingness to pay and usable contact permission still require customer discovery.

## Evidence and limits

| Primary source | What it supports | What it does not establish |
|---|---|---|
| [WRAP: surplus food redistribution](https://www.wrap.ngo/taking-action/food-drink/actions/surplus-food-waste-redistribution) | WRAP reports approximately 191,000 tonnes received by UK redistribution organisations in **2023**, valued at around £764 million. Surplus can arise through over-ordering and over-supply. | This is historical redistribution data, not SecondCrate's addressable revenue, cancelled-order volume, or a prediction of our impact. |
| [UK government: food and drink waste hierarchy](https://www.gov.uk/government/publications/food-and-drink-waste-hierarchy-deal-with-surplus-and-waste/food-and-drink-waste-hierarchy-deal-with-surplus-and-waste) | Prevention is preferred, with redistribution ahead of disposal. Guidance distinguishes date labels and continued food-business responsibilities. | Software cannot certify food safety, extend a use-by date, or replace a distributor's handling controls. |
| [ReFED: From Port to Plate, 10 March 2026](https://foodwastepact.refed.org/resources/from-port-to-plate-a-scalable-model-for-surplus-recovery/) | Fyffes and Sharing Excess report more than 11 million pounds of produce and $12.5 million in food recovered since 2023. Recovery coordination can have material value. | This US charitable partnership is not evidence of SecondCrate customers, UK demand, commercial resale margins, or equivalent results. |
| [ReFED: product-management interventions](https://refed.org/articles/dynamic-pricing-and-other-product-management-solutions-to-cut-food-waste/) | Finding secondary outlets for surplus is an identified intervention alongside prevention and inventory improvement. | It does not prove autonomous negotiation is the best intervention for every distributor. |

No unsupported industry-wide cancellation rate, avoided-emissions estimate, customer testimonial or market-size headline is used in the demo.

## Competition: a focused opening, not an empty market

**Choco** already captures email, WhatsApp and voicemail orders and turns them into reviewable orders. Its broader platform also covers sales and customer relationships. SecondCrate must therefore demonstrate a specific exception workflow: release one cancelled lot, select eligible recipients, handle conditional replies, and reconcile scarce inventory. Treat Choco as a potential competitor or integration partner, not a product lacking AI. [Choco Order Agent documentation, 8 July 2026](https://help.choco.com/en/articles/15821057-order-agent-whatsapp-and-email-forwarding)

**Too Good To Go Parcels** already helps manufacturers and wholesalers sell surplus to consumers. SecondCrate's proposed difference is B2B recovery through the distributor's existing restaurant relationships and operational constraints. This is a positioning hypothesis, not proof that another product cannot do it. [Too Good To Go manufacturer offering](https://www.toogoodtogo.com/en-gb/surplus-food-parcels)

The most immediate alternative is a coordinator's telephone, spreadsheet and WhatsApp list. It has low software cost, existing trust and considerable practical judgment. SecondCrate must beat it on coordinator effort and recovered contribution without damaging those relationships.

Two alternatives were considered: recall-remedy coordination and service-visit preparation. Both address real problems, but [Sedgwick](https://www.sedgwick.com/en-gb/product-recall/solutions/communications/) already offers sophisticated recall communications and verification, while [Property Meld](https://connect.propertymeld.com/en/) and [ServiceTitan](https://help.servicetitan.com/docs/set-up-use-auto-job-confirmations) already automate important scheduling and confirmation steps. Cancelled-lot recovery provides a clearer bounded transaction and a simpler financial outcome for this build.

## Messaging and cost evidence

- [AWS EUM pricing](https://aws.amazon.com/end-user-messaging/pricing/): WhatsApp has AWS fees plus Meta fees. The listed AWS rate is $0.005 outbound and $0.001 inbound; certain India utility/authentication rates differ. These are USD service prices, not our GBP unit-cost assumptions.
- [AWS SES pricing](https://aws.amazon.com/ses/pricing/): base outbound email is $0.10 per 1,000 emails, with other charges where applicable.
- [AWS WhatsApp billing categories](https://docs.aws.amazon.com/social-messaging/latest/userguide/billing.html): targeted offers are marketing; order updates may be utility. Opt-in alone does not convert an offer to utility.
- [AWS conversation limits](https://docs.aws.amazon.com/social-messaging/latest/userguide/increase-message-limit.html): a customer message opens a 24-hour service window; business-initiated conversations use templates.
- [AWS onboarding](https://docs.aws.amazon.com/social-messaging/latest/userguide/getting-started-whatsapp.html): WhatsApp requires a linked business account, a usable phone number and event publishing to receive messages.

The demonstration uses London and GBP. Country, template category, approved recipient permissions and actual provider delivery must be checked before sending real messages. A simulated channel is never presented as a delivered message.

## Product decisions supported by this research

1. Start with existing buyer relationships and small targeted offers; measure the benefit before adding a marketplace.
2. Use AI for language interpretation and candidate proposals. Deterministic code decides whether a transaction is permitted.
3. Treat the clock as a dispatch cutoff supplied by the operator. Require a human stock-release attestation; do not infer safety from text or images.
4. Separate orders booked, goods dispatched, sales collected and verified avoided waste. They are different outcomes.
5. Prioritise event replay, concurrent claims, tenant isolation and provider failure handling over additional conversational features.

See [BUSINESS_CASE.md](BUSINESS_CASE.md) for assumptions and pilot thresholds, and [REQUIREMENTS.md](REQUIREMENTS.md) for submission evidence.
