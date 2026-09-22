# SecondCrate: submission requirements and evidence register

Reviewed **22 September 2026** against the [official rules](https://aws-cds-partner.devpost.com/rules), the user-supplied copy of those rules and the [official FAQ](https://aws-cds-partner.devpost.com/details/faq). Recheck the live rules before submission. This register is intentionally conservative: a planned feature is not a passed requirement.

## Dates

| Milestone | Official time | India time |
|---|---|---|
| Submission closes | 28 October 2026, 1:00 pm Pacific Daylight Time | **29 October 2026, 1:30 am IST** |
| Judging begins | 6 November 2026, 9:00 am Pacific Standard Time | 6 November 2026, 10:30 pm IST |
| Judging ends | 12 November 2026, 5:00 pm Pacific Standard Time | **13 November 2026, 6:30 am IST** |
| Winners expected | On or around 19 November 2026, 6:00 pm Pacific Standard Time | On or around 20 November 2026, 7:30 am IST |

Keep judge access and required AWS services available through the end of judging. Set an internal final-recording and submission target at least 48 hours before the deadline.

## Mandatory gates

| Requirement | Evidence needed | Current register status |
|---|---|---|
| Eligible representative | Shivam's age/residency eligibility and actual authority to represent an APN-registered organisation | **Unverified; personal/organisation confirmation required** |
| Correct registration | Hackathon registration with the organisation's APN-associated corporate email and partner name | **Unverified** |
| New work within submission period | Repository history and disclosure of any incorporated prior work | **Build began 22 September 2026; release history pending** |
| AI solution deployed on AWS | Working AWS URL, deployment record and successful model invocation | **Pending live evidence** |
| At least one qualifying CDS service | SDK call at runtime, permissions and a successful provider result | **Pending live evidence; SES is the minimum intended path** |
| Reproducible working application | Fresh setup using README plus meaningful passing tests | **Pending final release check** |
| Source repository and assets | Reachable GitHub/GitLab URL with all required source and setup instructions | **Repository supplied; contents/access require final verification** |
| Appropriate repository access | Public repository with detectable open-source licence; or private access for both judging addresses | **Pending verification** |
| Architecture diagram | Diagram matching actual release components and data flow | **Created: [architecture.svg](assets/architecture.svg); source reviewed, cloud validation pending** |
| English project description | Final, evidence-aligned [SUBMISSION.md](SUBMISSION.md) text | **Draft prepared** |
| Approximately three-minute video | Real product footage; public YouTube/Vimeo link; no unlicensed media | **Script, teleprompter and recording guide prepared; recording/upload pending** |
| Deployed project and judge access | Reachable URL and usable free access/testing instructions | **Pending live check** |
| Net-new ACE opportunity | Actual opportunity ID, created on/after 14 September 2026, campaign code present | **Draft prepared; creation pending** |
| Ownership/disclosures | Contributor rights, licences and truthful AI/prior-work disclosure | **Final dependency/asset audit pending** |

Private repository judging addresses: `testing@devpost.com` and `aws-cds-partner@amazon.com`. Supplying an address here does not mean an invitation has been sent.

ACE campaign value: **AWS CDS Agentic AI Hackathon -Sept. 2026.** Use the matching campaign selection in Partner Central. The FAQ permits participation before a real customer deal exists; use accurate prospect information rather than the fictional demo company. See [ACE_OPPORTUNITY_DRAFT.md](ACE_OPPORTUNITY_DRAFT.md).

## Qualifying technology

- **SES:** AWS SDK `ses` or `sesv2`; JavaScript `@aws-sdk/client-sesv2` is implemented; live verification is pending. SES SMTP also qualifies under the rules.
- **WhatsApp:** AWS Social Messaging client, calling `SendWhatsAppMessage`. Meta's standalone API alone is not evidence of AWS EUM Social usage.
- **SMS/RCS:** AWS Pinpoint SMS and Voice **v2** client, such as `@aws-sdk/client-pinpoint-sms-voice-v2`, with a qualifying runtime operation.
- **Excluded:** AWS EUM Push, legacy `pinpoint`/`pinpoint-email`, and obsolete SMS/voice v1 clients.
- **Recommended, optional:** Amazon Bedrock AgentCore. A custom agent deployed on AWS can qualify; do not invent AgentCore integration.

Only runtime calls count. A package import, diagram label or configuration switch without an exercised service path is inadequate evidence for SecondCrate's own release gate.

## Rubric translated into evidence

| Criterion | Weight | What SecondCrate should show | Proof to retain |
|---|---:|---|---|
| Potential value/impact | 20% | One buyer, one concrete cancellation, transparent recovered-sales and contribution arithmetic | Order export, assumption table, honest pilot plan |
| Creativity | 10% | Recovery of a disrupted B2B transaction, with buyer conditions and operational constraints | Fair competitor comparison and complete scenario |
| Technical execution | 40% | Real CDS usage; authenticated workspaces; constrained model proposals; concurrent stock protection; reproducible deployment | Tests, architecture, code paths and redacted provider evidence |
| Functionality | 10% | End-to-end state transitions and visible failure/retry behavior | Fresh-workspace run, replay/concurrency checks, actual service result |
| Demo presentation | 20% | Clear three-minute story; readable UI; real evidence; no unsupported impact claim | Final video plus [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md) |

## Release claim checks

Before recording, reconcile every spoken claim with the release:

1. Confirm the browser's runtime badge matches the actual model and channel adapters.
2. Repeat the last-stock claim test with two concurrent requests; inspect persisted orders.
3. Confirm the order ledger sums to the displayed revenue, quantity and book margin.
4. Distinguish simulated, queued, provider-accepted, delivered, failed and unknown message states.
5. Make sure the video does not imply delivery, payment, food-safety certification or measured avoided waste from an order confirmation.
6. Record external delivery and AI inference evidence without revealing credentials or unrelated personal information.
7. Resolve every `PENDING` release field in the submission copy; keep unverified optional capabilities explicitly pending.

The WhatsApp prize requires an explanation of actual EUM Social use. A project can receive only one prize. The demonstration tenant, synthetic buyers and unsigned commercial hypotheses are not customer traction.
