# SecondCrate release status

Checkpoint: 22 September 2026. Try the hosted application at **https://secondcrate.web.app** and choose **Explore the interactive demo**. This is an isolated rehearsal with synthetic businesses and simulated messaging.

| Area | Verified state |
| --- | --- |
| Hosting | Firebase Hosting, Cloud Run API and a dedicated transactional Firestore database; secure session cookie and persistent workspace |
| Product | Cancellation intake, buyer matching, conditional offers, price boundaries, atomic allocation, order ledger, impact calculator, exports and private signup/login |
| Tests | 115 automated tests, TypeScript and production build passed |
| Hosted workflow | Nine HTTP checks passed, plus signup/login/logout, tenant isolation, forged-session and cross-origin checks |
| Browser workflow | Actual Safari run created lot SC-1045, rejected a £14 request, confirmed 12 crates at £17 and 20 at £18, then raced two claims for the final eight. One succeeded. A browser refresh retained three orders and £708 booked sales |
| Financial display | £708 booked sales, £480 book cost, £228 product spread before fulfilment/software, 200 kg allocated; all synthetic |
| Visual checks | Hosted login, intake dialog, buyer network, conversations, stock-lock result, ledger, impact and settings inspected. Narrow layout and navigation exercised with Safari zoom. Physical mobile-device testing remains unperformed |
| Security/build | Both dependency audits report zero vulnerabilities. CDK synthesis passes. Password verification and recovery require SES, which is not connected in the public preview |
| AWS account | Sign-in and identity verification succeed; Account Management reports ACTIVE. Free plan reports NOT_STARTED with deployment services unavailable. The user's Free plan is unchanged |
| AWS runtime | CloudFormation returns OptInRequired; Lambda, DynamoDB and SES return SubscriptionRequiredException. Bedrock/CDS runtime success and AWS deployment are not verified |
| Video | 2:46 narrated product walkthrough, actual hosted application captures, burned captions and matching SRT/VTT. It explicitly identifies the rehearsal and pending AWS verification |
| Other deliverables | Editable eight-slide pitch, pitch PDF, technical brief, printable script, teleprompter, AWS architecture and actual preview architecture, story and YouTube publishing copy |
| Submission | Devpost overview, story, technology tags, app/source links and cover saved as SecondCrate. Captioned video is published at [the direct viewing page](https://secondcrate.web.app/demo.html). YouTube upload is saved as a private draft; public publication is in progress. Entrant eligibility and a genuine ACE opportunity remain unresolved |

This preview is functional and reviewable. It is not a verified AWS hackathon deployment or a claim of production readiness. See [FINAL_REVIEW.md](FINAL_REVIEW.md) for the evidence-based rubric assessment and operational limitations.

## Remaining AWS and entrant requirements

1. Resolve AWS service enrollment through the account's official setup/support process. Identity verification is already marked Verified; repeating it is not established as necessary. The registration resubscribe page currently errors. Billing shows no payment method on file; the card-verification page is prepared for the owner to complete. Service access must be rechecked afterward. Do not upgrade the plan without the account owner's approval.
2. Confirm the entrant's existing AWS Partner organization and corporate-email eligibility. AWS documents automatic Paid-plan conversion when a Free account joins APN, so do not enroll this account while its owner requires Free.
3. After service access is restored, run `scripts/aws-preflight.mjs` with an explicit profile and region, deploy through [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md), and run the same HTTP/security workflow against AWS.
4. Verify a real Bedrock invocation and qualifying CDS operation. Keep provider acceptance distinct from confirmed delivery. WhatsApp-prize claims require a real EUM Social inbound/outbound flow.
5. Supply a genuine ACE opportunity with campaign `AWS CDS Agentic AI Hackathon -Sept. 2026`. The fictional Northstar scenario is not a customer opportunity.
6. Replace only claims supported by new evidence, record an AWS-verified demo and complete the final eligibility fields.

Current evidence: [Firebase deployment](evidence/firebase-deployment.json), [hosted workflow](evidence/firebase-http-smoke.json), [hosted security](evidence/firebase-security-smoke.json), [AWS status](evidence/aws-activation-status.json). The earlier Linux CI run passed the original 100-test release; the expanded release will be checked after its commit is pushed.
