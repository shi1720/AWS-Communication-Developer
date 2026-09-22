# SecondCrate release status

Checkpoint: 22 September 2026. Try the hosted application at **https://secondcrate.web.app** and choose **Explore the interactive demo**. This is an isolated rehearsal with synthetic businesses and simulated messaging.

| Area | Verified state |
| --- | --- |
| Hosting | Firebase Hosting, Cloud Run API and a dedicated transactional Firestore database; secure session cookie and persistent workspace |
| Product | Cancellation intake, buyer matching, conditional offers, price boundaries, atomic allocation, order ledger, impact calculator, exports and private signup/login |
| Tests | 128 automated tests, TypeScript and production build passed; the latest regression distinguishes Paid-account activation errors from Free-plan guidance |
| Hosted workflow | Nine HTTP checks passed, plus signup/login/logout, tenant isolation, forged-session and cross-origin checks |
| Browser workflow | Actual Safari run created lot SC-1045, rejected a £14 request, confirmed 12 crates at £17 and 20 at £18, then raced two claims for the final eight. One succeeded. A browser refresh retained three orders and £708 booked sales |
| Confirmed-order follow-up | Hosted browser test returned the buyer’s recorded order and full delivery date after acceptance, with unchanged stock and order totals after refresh |
| Financial display | £708 booked sales, £480 book cost, £228 product spread before fulfilment/software, 200 kg allocated; all synthetic |
| Visual checks | Hosted login, intake dialog, buyer network, conversations, stock-lock result, ledger, impact and settings inspected. Browser viewports at 320, 390 and 1440 px verified. Fixed intake fields clipping on narrow screens; mobile order confirmation and refresh persistence passed. Physical mobile-device testing remains unperformed |
| Security/build | Both dependency audits report zero vulnerabilities. CDK synthesis passes. Password verification and recovery require SES, which is not connected in the public preview |
| AWS account | Sign-in and identity verification succeed; the owner completed payment verification and the console confirms a saved default payment method. The registration-resume link returns to Console Home. The owner explicitly authorised the permanent Paid-plan upgrade and AWS confirmed success. At 10:10 UTC the API reports PAID / NOT_STARTED and USD 100 in credits, with service activation still unavailable |
| AWS runtime | CloudFormation returns OptInRequired; Lambda, DynamoDB and SES return SubscriptionRequiredException. Bedrock/CDS runtime success and AWS deployment are not verified |
| Video | 2:46 narrated product walkthrough, actual hosted application captures, burned captions and matching SRT/VTT. It explicitly identifies the rehearsal and pending AWS verification |
| Other deliverables | Editable eight-slide pitch, pitch PDF, technical brief, printable script, teleprompter, AWS architecture and actual preview architecture, story and YouTube publishing copy |
| Submission | Devpost overview, story, technology tags, app/source/testing links, cover and four captioned gallery images saved as SecondCrate. The private code-access field, AWS architecture attachment and current WhatsApp disclosure are saved. Captioned video is public on [YouTube](https://youtu.be/Ox6BG9KwP7w) and [the direct viewing page](https://secondcrate.web.app/demo.html). YouTube description, uploaded English captions, AI disclosure, 1080p playback and anonymous oEmbed access are verified. The entrant confirms AWS Partner eligibility; required entrant details, existing Partner Central access and a genuine ACE opportunity remain unresolved |

This preview is functional and reviewable. It is not a verified AWS hackathon deployment or a claim of production readiness. See [FINAL_REVIEW.md](FINAL_REVIEW.md) for the evidence-based rubric assessment and operational limitations.

## Remaining AWS and entrant requirements

1. Allow AWS activation to complete after identity/payment verification and the authorised Paid upgrade on 22 September. The console confirmed the upgrade succeeded. Its registration-resume link still returns to Console Home without another form; the 10:10 UTC SES check returned a missing-service-subscription error. AWS says activation can take up to 24 hours. If access remains blocked after that period, use the account-activation support path; [AWS_SUPPORT_DRAFT.md](AWS_SUPPORT_DRAFT.md) contains a prepared message, not a submitted case. The account is already Paid; another upgrade is not an activation repair.
2. The entrant confirms existing AWS Partner membership but does not have its sign-in credentials. An authorised administrator of that organisation must grant access or create the ACE record using [the prepared draft](ACE_OPPORTUNITY_DRAFT.md). Read-only checks returned an empty partner list for this account and previously rejected ACE listing with INCOMPATIBLE_BENEFIT_AWS_PARTNER_STATE. These results do not establish whether the entrant belongs to a partner through a different organisation/account. Do not create a duplicate partner registration.
3. After service access is restored, run `scripts/aws-preflight.mjs` with an explicit profile and region, deploy through [AWS_DEPLOYMENT.md](AWS_DEPLOYMENT.md), and run the same HTTP/security workflow against AWS.
4. Verify a real Bedrock invocation and qualifying CDS operation. Keep provider acceptance distinct from confirmed delivery. WhatsApp-prize claims require a real EUM Social inbound/outbound flow.
5. Supply a genuine ACE opportunity with campaign `AWS CDS Agentic AI Hackathon -Sept. 2026`. The fictional Northstar scenario is not a customer opportunity.
6. Replace only claims supported by new evidence, record an AWS-verified demo and complete the final eligibility fields.

Current evidence: [Firebase deployment](evidence/firebase-deployment.json), [hosted workflow](evidence/firebase-http-smoke.json), [hosted security](evidence/firebase-security-smoke.json), [historical post-verification AWS status](evidence/aws-post-verification.json), [post-upgrade service checks](evidence/aws-after-upgrade-services.json), [responsive browser checks](evidence/responsive-browser.json) and [order follow-up regression](evidence/hosted-order-followup.json). The 127-test application release passed [Linux CI](https://github.com/shi1720/AWS-Communication-Developer/actions/runs/35712481012) on commit `a590746`, including infrastructure synthesis, compiled HTTP smoke and the dependency audit.
