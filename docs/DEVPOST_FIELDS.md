# SecondCrate: Devpost field pack

Prepared for **Shivam Gupta**. Use the values below in the actual form fields. Text in double brackets is an unresolved release value, not submission content. Do not publish unresolved placeholders.

Submission editor: https://devpost.com/submit-to/31052-aws-communication-developer-services-cds-agentic-ai-partner-hackathon/manage/submissions/1192846/project-overview

## Project name

SecondCrate

## Elevator pitch

Turn cancelled wholesale food orders into confirmed sales. Reach opted-in buyers through WhatsApp, SMS and email, negotiate within clear limits, and allocate every crate only once.

## About the project

Paste the seven requested sections from [SUBMISSION.md](SUBMISSION.md), beginning with **Inspiration** and ending with **What's next for your project**. Omit the file title, creator line and editorial introduction. Preserve the Markdown headings.

The current story accurately states that AWS deployment and live service verification are pending. Once verified, replace the Current evidence paragraph with the exact observed release facts. Do not remove that disclosure merely because the website is hosted.

## Built with

Implemented technologies: TypeScript, React, Node.js, Fastify, Firebase Hosting, Google Cloud Run, Firestore, AWS SDK for JavaScript, AWS CDK, Amazon Bedrock, Amazon Simple Email Service, AWS End User Messaging Social, AWS End User Messaging SMS, AWS Lambda, Amazon DynamoDB, Amazon API Gateway, Amazon S3, Amazon CloudFront, Amazon SQS, Amazon SNS, Amazon EventBridge and Vitest.

Use the site's matching technology tags where offered. The narrative must continue to distinguish implemented integrations from services verified at runtime. Do not add AgentCore, RCS, a payment processor or ERP integration unless that implementation is completed and verified.

## Links and attachments

| Field                       | Value                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Code repository             | https://github.com/shi1720/AWS-Communication-Developer                                       |
| Deployed application        | https://secondcrate.web.app                                                                  |
| Video                       | https://youtu.be/Ox6BG9KwP7w (uploaded draft; public verification pending)                                                                 |
| Architecture diagram        | `docs/assets/architecture.svg`, or a readable export of that same final diagram              |
| Public preview architecture | `docs/assets/preview-architecture.svg`, the verified Firebase/Cloud Run/Firestore deployment |
| Supporting pitch            | `deliverables/SecondCrate-Pitch.pdf`                                                         |
| Creator                     | Shivam Gupta                                                                                 |

The repository is public and includes an MIT license. The public preview diagram matches the hosted rehearsal. The separate AWS diagram describes the implemented deployment design that remains blocked. Firebase Hosting does not replace the hackathon's AWS deployment and qualifying CDS runtime requirements.

## Testing instructions for application

Paste the following testing instructions. The public deployment passed the nine-check HTTP recovery scenario. Browser review checks the same controls and their layout separately.

> Open https://secondcrate.web.app and choose **Explore the interactive demo**. No account, payment or API key is required for this isolated demonstration workspace. It contains fictional buyer data. Demo delivery is simulated and is labelled in the interface.
>
> 1. Open **Conversations** and select the cherry-tomato recovery. If its status is Draft, choose **Launch recovery**. The lot starts with 40 crates at £18 each and a £16 minimum price.
> 2. Select Maya / Olive & Rye. Send **I can take 12 crates at £14 each.** Inspect the visible rejection and confirm that stock has not changed.
> 3. Send **I can take 12 crates at £17 each.** The order should total £204 and leave 28 crates. Open the agent activity panel to inspect the decision and checks.
> 4. Select Ben / The Sunday Table. Send **Confirm 20 crates at £18 each.** The order should total £360 and leave eight crates.
> 5. Choose **Test stock lock**, then **Send both requests simultaneously**. Two buyers request the final eight crates. Exactly one order should succeed; the winner can vary.
> 6. Check the selected lot: three orders, 40 crates allocated, zero remaining and £708 in booked sales. The book cost is £480, leaving £228 before handling, delivery and software. Open **Impact & value** to review the assumptions. In **Recovery desk**, choose **Export CSV** under **Confirmed orders** to download the ledger.
> 7. Open **Buyer network** to inspect editable buyer preferences, capacities and contact permission. Open **Settings** to inspect the actual runtime and channel status. Use **Reset demo** to repeat with clean data.
>
> This public demo tests application behavior without contacting real buyers. The Settings screen identifies the actual runtime; AWS deployment and live provider verification are tracked separately in the release evidence. Message acceptance, delivery and simulation are displayed distinctly. The demo does not collect payment or determine food safety.

The basic judge path deliberately avoids a fixed “before 2 pm” condition. The starter lot uses relative dispatch times, which keeps this test valid throughout judging. The longer recording fixture in [RECORDING_GUIDE.md](RECORDING_GUIDE.md) uses an explicitly dated next-day delivery to demonstrate conditional replies.

Private account creation, logout, incorrect-password rejection and fresh password login passed against the hosted build. Email verification and password recovery are unavailable until SES and AWS service access are configured; the application reports that limitation explicitly. Use the isolated demo for the complete judge walkthrough. Never put a password or API key in this public field.

## AWS evidence release fields

Resolve each field from an actual runtime result before final submission:

| Evidence                | Required value                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AWS deployment          | Pending. Account restrictions block the intended AWS stack. The public preview uses Google Cloud.                                                                                                                                                 |
| AI invocation           | Pending. The hosted preview uses rehearsal interpretation; no successful Bedrock invocation is claimed.                                                                                                                                           |
| Qualifying CDS call     | Pending. All hosted preview messages are simulated; no successful live CDS send is claimed.                                                                                                                                                       |
| Delivery claim, if made | No external messages were sent in the hosted smoke test.                                                                                                                                                                                          |
| Test record             | 115 automated tests and production build passed. Hosted recovery and security evidence: `docs/evidence/firebase-deployment.json`, `docs/evidence/firebase-http-smoke.json` and `docs/evidence/firebase-security-smoke.json`. Zero external sends. |
| Judge availability      | Confirm the hosted test path will remain available through 13 November 2026, 06:30 IST, subject to any updated official judging dates                                                                                                             |

Current checkpoint: https://secondcrate.web.app is a verified public rehearsal served by Firebase Hosting, backed by Cloud Run and the named Firestore database `secondcrate` in `europe-west1`. The AWS account remains on its Free plan, with required service access blocked. No paid-plan upgrade was authorised. There is no successful AWS deployment, real message send or Bedrock inference to cite yet.

## Partner and ACE fields requiring real entrant information

These are factual eligibility fields. Do not fill them with a fictional demo customer or an invented identifier.

- The actual APN-registered partner organisation's legal name and Shivam's authority to represent it.
- The actual corporate email associated with that organisation's partner registration, entered in the appropriate private account field.
- Any requested confirmation of age, country and professional/postgraduate eligibility, based on the entrant's real facts.
- The real net-new ACE opportunity ID returned by AWS Partner Central. The record must satisfy the hackathon's creation-date requirement and contain the exact campaign **AWS CDS Agentic AI Hackathon -Sept. 2026**.
- Accurate opportunity ownership, early-stage customer status and any required consumption estimate. Northstar Produce is fictional and must not be submitted as a customer.

Use [ACE_OPPORTUNITY_DRAFT.md](ACE_OPPORTUNITY_DRAFT.md) as preparation. A completed draft is not an ACE opportunity. Do not mark eligibility, opportunity creation or final submission complete without confirmation from the actual service.

## WhatsApp prize description

**Current accurate text:**

> SecondCrate includes an AWS End User Messaging Social adapter and an approved-template-compatible offer format. Its demonstration uses explicitly simulated WhatsApp messages. Live Social setup, outbound sending and inbound reply verification remain pending.

**Replace only after the complete live path is verified:**

> SecondCrate uses AWS End User Messaging Social to send approved recovery offers and receive buyer replies on WhatsApp. A reply can include quantity, price and a delivery condition. Amazon Bedrock interprets the request, then application rules check permission, price, stock and delivery before committing an order. Inventory and order state remain shared with the other connected channels. The demonstration shows the actual outbound result, inbound event and corresponding order, with each provider status displayed accurately.

Do not select the WhatsApp prize using only the simulated channel or a standalone Meta API call.

## Final form check

Confirm the saved story, real application URL, public video, architecture, source link, testing instructions and actual ACE ID in the submission preview. Remove unresolved double-bracket values. Test the published links from a signed-out browser. Keep private identity, billing and partner information out of the public story, source repository and video.
