# SecondCrate: a commercial case that can be tested

**Proposed offer: £299 per depot per month.** SecondCrate helps a regional food wholesaler recover cancelled orders through existing buyer relationships. It earns its place only if incremental contribution and coordinator time saved exceed its cost. Figures below are hypotheses, excluding VAT, and are not customer results or quotations from AWS.

## Customer and purchase decision

The first customer profile is a produce wholesaler operating one depot, serving roughly 50–300 restaurant accounts, with recurring cancelled or unallocated lots and permission to contact buyers. The depot manager owns the workflow; the owner or operations director controls the budget. An existing sales coordinator can operate SecondCrate without asking every buyer to install an application.

Start with an operator releasing known stock and adding and editing buyers. CRM/ERP ingestion, route optimisation and accounting write-back follow demonstrated demand. The first product handles order recovery; it does not promise payment collection, stock inspection, transport execution, or food-safety certification.

The value proposition is specific: **reach suitable buyers, understand conditions, and book permitted replacement orders before dispatch closes**.

## What the 40-crate story means financially

Northstar Produce is a fictional London distributor. Its example lot contains 40 crates of cherry tomatoes, 5 kg each. Original price is £24/crate, proposed recovery price £18, minimum permitted price £16, and book cost £12.

| Illustrative outcome | Calculation | Result |
|---|---|---:|
| Original order value | 40 × £24 | £960 |
| Recovered sales if all sell at £18 | 40 × £18 | £720 |
| Book cost of those goods | 40 × £12 | £480 |
| Spread before fulfillment and software | £720 − £480 | £240 |
| Illustrative extra handling/delivery | 40 × £1 | £40 |
| Subscription allocated across 25 workflows | £299 ÷ 25 | £11.96 |
| Contribution after those costs | £240 − £40 − £11.96 | £188.04 |

The £720 is sales booked, not profit or cash collected. The 200 kg is allocated stock, not verified avoided waste. The £188.04 is not automatically incremental: a coordinator might have sold some stock anyway, an alternate buyer might pay more, and unsold goods may have salvage value.

If 12 crates sell at £17 and the remaining 28 at £18, booked sales become **£708** and spread above book cost becomes **£228**. The application should calculate totals from orders, not use a fixed headline.

## Buyer return: the baseline matters

Use a conservative contribution calculation that includes book cost. If the comparison is disposal, the inventory cost is already sunk; also report incremental cash recovery separately, with its baseline clearly stated. Never add both together as a benefit.

For a monthly subscription to break even solely from additional crates sold, assume an incremental selling price of £18, £12 book cost and £1 additional fulfillment per crate. At £5 contribution per additional crate, the £299 subscription requires **60 additional crates/month**, approximately 3 per workflow at 25 workflows. Messaging within the proposed plan limits is included; do not add SecondCrate's underlying technology cost a second time to the customer's bill. This excludes any value assigned to saved staff time.

Sensitivity for 25 workflows/month:

| Contribution per additional crate, before subscription | Additional crates needed to cover £299 | Approximate additional crates/workflow |
|---:|---:|---:|
| £2 | 150 | 6 |
| £5 | 60 | 3 |
| £8 | 38 | 2 |

These are arithmetic thresholds, not expected outcomes. Low-volume depots, expensive extra delivery legs and buyers waiting for discounts can make SecondCrate uneconomic. Qualification should exclude those cases until the product changes.

## Our unit economics

Test a £299 plan with 25 released lots/month, a maximum of 30 initial recipients per lot, and explicit messaging limits. Offer no unlimited bulk messaging. Quote excess usage separately once measured; do not disguise provider fees. The product should expose cost and failure telemetry to the operator. This is a proposed commercial plan; subscription billing, metered pricing and per-plan quota enforcement are not implemented.

The table uses **all-in technology cost per lot**—model inference, application requests and messaging—plus shared infrastructure and variable support. These GBP ranges are planning assumptions, not current provider prices or a currency conversion.

| Monthly sensitivity, 25 lots | Efficient | Base | Expensive |
|---|---:|---:|---:|
| Technology per lot | £0.50 | £2.00 | £5.00 |
| Lot technology total | £12.50 | £50.00 | £125.00 |
| Shared infrastructure allocation | £10.00 | £10.00 | £15.00 |
| Support, valued at £35/hour | 0.5 h / £17.50 | 1 h / £35.00 | 2 h / £70.00 |
| Revenue less these direct costs | £259.00 | £204.00 | £89.00 |
| Direct contribution margin | 86.6% | 68.2% | 29.8% |

Engineering, sales, founder time beyond support, legal work, tax and acquisition costs are excluded. This is not net profit. Under the base case, a £600 acquisition cost takes roughly three months of direct contribution to recover, before churn. Four hours of onboarding valued at £35/hour adds £140; charge for complex integrations or simplify onboarding before scaling.

The current DynamoDB implementation rewrites a bounded workspace snapshot for each transaction and retains replaced snapshots for seven days. Write and storage cost therefore grow with workspace size and activity, even if each model call is small. Measure this explicitly; the £0.50 case is not an observed cost. The proposed plan also exceeds the current 100-buyer active pilot limit for larger customers, so an archive lifecycle and partitioned storage are rollout gates rather than assumptions hidden in the margin table.

Use actual [AWS EUM](https://aws.amazon.com/end-user-messaging/pricing/) and [SES](https://aws.amazon.com/ses/pricing/) bills during a pilot. Enforce per-tenant caps, bounded recipient counts and model token limits; avoid repeated full-history prompts. No claim is made that the $50 hackathon credit funds an indefinite production service.

## Fair competitive positioning

| Alternative | Why a customer might choose it | What SecondCrate must prove |
|---|---|---|
| Coordinator using phone/WhatsApp/spreadsheet | Trusted relationships, nuanced judgment, no new subscription | Less manual effort and better incremental outcomes without over-contacting buyers |
| Choco | Established multichannel order capture, ERP integrations and sales tools | A useful cancelled-lot exception workflow, or a complementary integration rather than a replacement |
| Too Good To Go Parcels | Existing consumer distribution for manufacturer/wholesaler surplus | Value from established B2B buyers, existing routes and exact operational constraints |
| Existing ERP/CRM automation | Inventory already lives there | Faster deployment and safe write-back; no divergent stock ledger |

Sources and boundaries are in [RESEARCH.md](RESEARCH.md). No competitor's inability to build a similar feature is assumed.

## Discovery and paid-pilot plan

No prospective customer has been contacted and no pilot is booked. The following is a plan, not traction.

**Discovery: 10 distributors, 5 coordinators, 10 restaurant buyers.** Ask participants to reconstruct their last three cancellations: quantity, reason, time remaining, resale attempts, actual net recovery, handling cost and minutes spent. Ask to see redacted logs with permission. Ask buyers when an offer is useful, when it is intrusive, and what makes them trust an order confirmation. Ask owners who approves a £299 invoice and what measured result would make them renew. Do not lead with a product demo or substitute compliments for purchase intent.

**Two-week baseline:** record the current process on consecutive eligible lots, including failures. Define eligibility before observing the outcome. Capture stock, price, deadlines, recipients, resale result, handling expense and coordinator time. Keep no more personal data than required.

**Four-week paid pilot:** seek three depots, each paying the stated monthly price, with explicit stock-release responsibility and messaging permissions. Start with one route and one produce category. Compare suitable alternating or matched shifts with the baseline while allowing staff to use their normal fallback process. Avoid claiming causal proof from a small uncontrolled trial.

**Continue only if:** at least two depots renew at £299; median incremental benefit exceeds £598/month; coordinator effort falls at least 30%; no oversells, below-floor orders or unwanted sends occur; and support approaches one hour/depot/month. These are proposed decision thresholds, not achieved metrics. Capture opt-outs, cancellations, failed deliveries and complaints alongside successes.

## Route to a durable business

First sell directly to depot owners and through a qualified AWS partner. Next build the two ERP integrations demanded by paying customers. A later AWS Marketplace listing can package tenant deployment, onboarding and support; no listing currently exists. Expansion into other perishables comes only after handling and operational requirements are understood.

Potential defensibility comes from reliable inventory reconciliation, distribution-system integrations and consented knowledge of buyer constraints. The LLM is replaceable. The hard asset is a workflow customers trust enough to let it commit inventory.
