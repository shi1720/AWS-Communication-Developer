# SecondCrate

**Turn cancelled produce orders into confirmed sales before the truck leaves.**

Created by **Shivam Gupta** for the AWS Communication Developer Services Agentic AI Partner Hackathon.

The seven sections below are the Project Story. Submission links, testing instructions and outstanding entrant fields are in [DEVPOST_FIELDS.md](DEVPOST_FIELDS.md). The public rehearsal is live at [secondcrate.web.app](https://secondcrate.web.app). Its Firebase hosting is separate from the intended AWS deployment.

## Inspiration

A restaurant cancels forty crates of tomatoes. The produce is already at the depot. The delivery truck leaves soon. Someone now has to find another buyer, agree a price and make sure the depot can keep its promise.

The work happens in the replies: “I can take twelve, if you can deliver before two.” Recovering the order means understanding that condition and acting on it correctly.

SecondCrate gives cancelled orders a second destination through a distributor's existing buyer relationships, with one clear outcome: book suitable replacement orders before dispatch closes.

## What it does

An operator reviews a cancellation, releases the stock, and sets the quantity, offer price, minimum price and delivery window. SecondCrate checks buyer preferences, contact permission, capacity and delivery constraints before preparing offers.

Buyers respond conversationally across the implemented WhatsApp, SMS and email paths. Language interpretation proposes an action; application rules decide whether it is allowed. Below-floor prices and impossible delivery conditions are rejected. Two buyers cannot both receive the final crates.

Conversations, inventory, orders and audit events stay connected. The operator can edit buyers, record dispatch and export orders. Rehearsal messages are labelled simulated; provider acceptance and delivery are separate states.

Our fictional Northstar Produce scenario turns forty crates into three orders worth **£708 in booked sales**, with **£228 above book cost** before handling, delivery and software. These are reproducible demonstration figures, not customer results, collected cash or measured food waste prevented.

## How we built it

We built a TypeScript application with React, Fastify and authenticated workspaces. Shivam Gupta set the product direction, commercial requirements and presentation goals. Development used AI coding assistance for implementation, research and testing.

The AWS implementation uses Amazon Bedrock for buyer-intent proposals, Amazon SES for email, AWS End User Messaging Social for WhatsApp and AWS End User Messaging for SMS. AWS CDK defines CloudFront, private S3 hosting, API Gateway, Lambda, DynamoDB, queues and monitoring.

Conditional storage updates protect inventory. Incoming events are deduplicated. Uncertain sends stay visible for reconciliation. Authentication and transaction checks run on the server. Cancellation extraction uses operator-reviewed local rules.

**Current evidence:** the application passed 127 automated tests and its production build. The public rehearsal at [secondcrate.web.app](https://secondcrate.web.app) runs on Firebase Hosting, Cloud Run and a dedicated Firestore database. Nine HTTP recovery checks passed, including concurrent stock claims, persistence and logout; separate hosted checks verified session security and tenant isolation. All outbound messaging remains simulated. AWS account restrictions still block the separate AWS deployment and live Bedrock/CDS verification.

## Challenges we ran into

The hardest problem was deciding what the agent may commit. We tested simultaneous claims, duplicate replies, stale negotiations, expired deadlines and ambiguous provider outcomes to prevent oversells, unauthorised discounts and promises the depot cannot keep.

We also separated booked sales, spread above book cost and dispatched stock. Those distinctions make the financial picture more useful to a depot manager.

## Accomplishments that we're proud of

- A complete recovery workflow with editable buyers, authenticated workspaces, order export and an inspectable audit trail.
- A working stock-lock demonstration that sends two simultaneous requests for the final eight crates and confirms exactly one order.
- A clear division between AI interpretation and the rules that authorise a transaction.
- A reproducible build, meaningful failure-case tests and a commercial model that can be challenged with real pilot data.

## What we learned

The value of an agent is the reliable action it can complete: a correctly priced order, against available stock, within a feasible delivery window.

An existing buyer network also offers a focused starting point. The wholesaler already has relationships, preferences and routes. SecondCrate helps that network handle an exception.

## What's next for your project

First, resolve AWS service access and verify the AWS deployment, model and messaging operations. Then run paid pilots with regional produce wholesalers, measuring incremental contribution, coordinator effort, opt-outs and fulfilment outcomes against their existing process.

Our pricing hypothesis is **£299 per depot per month**. At an assumed £5 contribution per additional crate, sixty additional crates cover the subscription. That is a break-even calculation to test, not claimed traction.

Pilot results will determine the first ERP integrations, retention controls and storage changes needed beyond the current bounded single-depot release. The long-term goal is simple: make recovering a cancelled order as dependable as taking the original one.
