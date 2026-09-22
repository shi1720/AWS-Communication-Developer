# SecondCrate — submission copy

Prepared for **Shivam Gupta**, project creator. Last editorial review: **22 September 2026**.

This is a release draft. Resolve the status fields below against the running application and its test report before submitting. A working local rehearsal is not evidence of AWS deployment or live message delivery. Keep the verification block out of the public project narrative once it has been completed.

## Required links and evidence

| Field | Release value |
|---|---|
| Project name | SecondCrate |
| Tagline | A second destination for cancelled wholesale orders. |
| Creator | Shivam Gupta |
| Repository | https://github.com/shi1720/AWS-Communication-Developer |
| Deployed application | **PENDING: insert verified HTTPS URL** |
| Architecture | [Source diagram](assets/architecture.svg); deployable architecture, cloud validation pending |
| Public demonstration video | **PENDING: YouTube or Vimeo URL** |
| Judge access | **PENDING: tested access instructions; provide restricted judge credentials privately if needed** |
| AWS Partner organisation | **PENDING: actual registered organisation** |
| ACE opportunity ID | **PENDING: actual ID returned by Partner Central** |
| Implementation checkpoint and tests | Git tag `implementation-checkpoint-2026-09-22`; [100 passing tests, build, synthesis and HTTP evidence](evidence/release-verification.json). Final cloud release remains pending. |
| Live AWS CDS evidence | **PENDING: successful SES/EUM operation and redacted provider receipt** |
| AI runtime evidence | **PENDING: actual model/region and successful inference trace** |
| WhatsApp award eligibility | **PENDING: verify real EUM Social usage before selecting this category** |

## Inspiration

A restaurant cancels an order. The produce is already at the depot, the delivery cutoff is approaching, and the coordinator starts calling around. A notification tells someone there is a problem. Recovering the order means finding a buyer, understanding their conditions and making a promise the depot can keep.

SecondCrate focuses on that moment. It gives cancelled wholesale stock a second destination through buyers the distributor already knows. The demonstration follows fictional London wholesaler Northstar Produce and forty crates of cherry tomatoes.

## What it does

An operator creates a recovery lot from a cancellation, verifies the stock, sets the offer and minimum price, and confirms the dispatch and delivery limits. SecondCrate checks buyer preferences, consent and capacity before preparing offers.

A buyer can answer naturally: “Twelve crates at seventeen pounds, if you can deliver before two.” The agent interprets the request. Application rules then check the quantity, minimum price, delivery constraint and remaining stock before confirming an order. Rejected conditions remain visible, and the operator can inspect what happened.

Inventory is shared across channels. Two people claiming the final eight crates cannot both receive a valid confirmation. Orders, conversations and audit events stay connected, and the operator can record dispatch and export the order ledger or a workspace archive. Buyer records include an editable contact-permission source. Incoming cancellation sources require operator review; unknown send outcomes require a recorded provider check before reconciliation. Reconciliation records the operator’s report and never resends the message.

The demonstration uses synthetic data. Its dispatch clock is an operational deadline; SecondCrate does not determine food safety or certify stock condition. Booked sales and allocated kilograms are displayed as such, without claiming cash collected or verified waste prevented.

## How it is built

SecondCrate uses a TypeScript web application and a server API with authenticated workspaces. The design separates language interpretation from the code that authorises a transaction. AI output is a proposal: it cannot override price, inventory, buyer or delivery checks.

Cancellation field extraction currently uses local rules with operator review. The AWS integration path uses Amazon Bedrock for interpretation and qualifying AWS Communication Developer Services for messaging. Amazon SES handles email through its SDK; AWS End User Messaging Social and SMS adapters provide the additional channel paths. Runtime configuration distinguishes rehearsal from live integrations, and provider errors remain visible.

**Replace this paragraph with verified deployment details:** The submitted release runs at **[URL]** in **[AWS region]**, using **[actual infrastructure and model]**. We verified **[specific CDS channels]** with **[redacted evidence]**. **[Any remaining simulated channels]** are explicitly marked simulated. **Do not publish this paragraph with blanks or claim AgentCore unless it is actually integrated.**

## Challenges

The important challenge is deciding what the agent is allowed to commit. A plausible reply is not a confirmed order. SecondCrate needs to handle retries, ambiguous requests, simultaneous claims, late replies and failed messages without selling nonexistent stock or silently pretending a message arrived.

Another challenge is honest measurement. Recovered revenue must reconcile to actual orders, and a reservation must not be counted as completed delivery. That distinction also makes the product more useful to a depot manager.

## What makes the approach useful

SecondCrate combines a narrow commercial problem with a transaction that can be inspected end to end. It connects unstructured buyer requests to deterministic business rules, then exposes the resulting inventory and communication state to an operator.

Existing products already handle wholesale ordering and surplus redistribution. SecondCrate's proposed wedge is a focused cancelled-order recovery workflow within an established B2B network, with no new buyer application required for connected messaging channels. It is not a claim that conversational ordering or surplus recovery is new.

## Commercial model and next steps

The proposed price is £299 per depot per month. With an illustrative £5 contribution per additional crate, sixty additional crates sold in a month would cover that subscription. This is a break-even model, not a forecast or customer result. The business case includes messaging, model, infrastructure and support sensitivity.

There are no claimed customers or measured field outcomes. Next is a paid pilot with regional wholesalers: establish their current recovery baseline, measure incremental contribution and coordinator effort, and test renewal at the proposed price. ERP integration priorities will follow those customers' actual systems.

## Built with

**Confirm against the final release:** TypeScript, React, Node.js, Fastify, AWS SDK for JavaScript, Amazon Bedrock, Amazon SES, AWS End User Messaging Social, AWS End User Messaging SMS, AWS Lambda, Amazon DynamoDB, AWS CDK, Vitest.

List only deployed or implemented tools. AgentCore, RCS, a payment processor, route optimisation and marketplace listings must not be listed as implemented unless the release provides evidence.

## Creator and development disclosure

SecondCrate was created for this hackathon by **Shivam Gupta**, who initiated the project and directed its product and commercial goals. Development used AI coding assistance for research, implementation, tests and documentation. The repository identifies its open-source dependencies; no pre-existing SecondCrate product or customer deployment is claimed. Add any other pre-existing work or third-party assets actually incorporated before submission.

## WhatsApp prize description — use only after live verification

**Conditional release copy:** SecondCrate uses AWS End User Messaging Social to send approved offers and receive buyer replies on WhatsApp. The Social Messaging SDK calls `SendWhatsAppMessage`; inbound events are authenticated before they reach the order workflow. A reply can propose quantity, price and a delivery condition, while deterministic rules control the transaction. Order state remains shared with the other connected channels. The video shows **[actual verified send and reply]** and distinguishes provider acceptance from delivery.

If live WhatsApp has not been verified, replace the paragraph with: **“A WhatsApp adapter is included but live WhatsApp setup and validation remain pending. The rehearsal uses explicitly simulated messages.”** Do not select the WhatsApp prize on the strength of a simulated conversation.
