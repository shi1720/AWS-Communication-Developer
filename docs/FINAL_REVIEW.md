# SecondCrate: final implementation and submission review

Reviewed 22 September 2026 against the supplied hackathon rubric. This is an independent internal assessment of the current code, release evidence and commercial case. It is not a penetration test, customer validation or a prediction of the judges' decision.

## Decision

SecondCrate is a working hosted rehearsal with a focused commercial use case and meaningful transaction safeguards. It is **not yet an eligible completed AWS submission**: the public deployment runs on Google Cloud, reasoning and messaging are simulated, and successful AWS model/CDS operations remain unverified. The owner subsequently authorised the permanent Paid-plan upgrade. AWS confirmed the upgrade, but service activation remains blocked. Paid plan status alone does not verify deployment.

## Evidence reviewed

- [Deployment record](evidence/firebase-deployment.json): the 127-test application release, production and cloud builds, Firebase Hosting, Cloud Run and the named Firestore database. The repository now passes 128 tests after adding a regression for Paid accounts with unresolved service activation; no application bundle changed.
- [Hosted recovery test](evidence/firebase-http-smoke.json): nine checks, including duplicate replay, simultaneous final-stock claims, persisted 40 crates/three orders/£708 and logout revocation. Zero external messages.
- [Hosted security test](evidence/firebase-security-smoke.json): isolated workspaces, rejected cross-origin writes and forged sessions, durable private login, and blocked unconfigured live sending.
- [Finished demonstration](https://secondcrate.web.app/demo.html): a 2:46 edited walkthrough of actual hosted-application captures, with disclosed OpenAI cedar narration and 45 burned-in caption cues. The [video verification record](../deliverables/SecondCrate-Video-Verification.json) records the full decode, source checksums and visual/audio review results. The hosted watch page is reachable. The video is now also [public on YouTube](https://youtu.be/Ox6BG9KwP7w), with verified description, uploaded English captions, 1080p playback and anonymous oEmbed access.
- [Responsive browser checks](evidence/responsive-browser.json): 320, 390 and 1440 px layouts, with the clipped intake form corrected. [Confirmed-order follow-up](evidence/hosted-order-followup.json) now returns recorded order details without changing stock, including verified persistence after reload.
- Read-only inspection of the current server, client, Firestore adapter, deployment configuration and tests. No new critical isolation or oversell defect was identified in this bounded review. That finding is not a security guarantee.
- Public GitHub repository, MIT license and README local links. Frozen narration and video-generation code were not changed by this review.

## Rubric assessment

Scores assess evidence available now. Missing mandatory eligibility requirements override the numerical total.

| Criterion                |    Score | Assessment                                                                                                                                                                                            |
| ------------------------ | -------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Potential value / impact |  15 / 20 | Clear depot buyer and urgent workflow. The financial calculation reconciles, but no customer interview, baseline or willingness-to-pay evidence exists.                                               |
| Creativity               |   8 / 10 | The cancelled-order exception, conditional replies and shared inventory form a memorable story. The defensible advantage would come from workflow adoption and integrations, not a novel model.       |
| Technical execution      |  25 / 40 | Server authority, transactional persistence, retries, sessions and deployment are implemented and tested. Required AWS runtime evidence is still absent.                                              |
| Functionality            |   7 / 10 | The public recovery and security paths work. Actual provider delivery, Bedrock interpretation and email account recovery remain unverified or unavailable.                                            |
| Demo presentation        |  18 / 20 | Finished 2:46 narrated, captioned walkthrough with readable transaction evidence, a public hosted watch page and public YouTube video. It accurately identifies the rehearsal and pending AWS runtime. |
| Total                    | 73 / 100 | An evidence-limited prioritisation aid. No award or submission acceptance is implied.                                                                                                                 |

## Material remaining concerns

1. **Submission blockers:** successful AWS deployment and qualifying CDS runtime use, real AI execution, verified APN/corporate-email eligibility and the actual ACE opportunity ID. Use the exact campaign `AWS CDS Agentic AI Hackathon -Sept. 2026`. A Firebase URL cannot replace these requirements.
2. **Account recovery:** private registration and login work, but email verification and password reset return `EMAIL_NOT_CONFIGURED`. The complete judge path must remain the no-key isolated demo until SES works.
3. **Public availability and cost:** the shared 100-demo-per-hour budget can be exhausted by one visitor. Workspace write limits do not throttle every authenticated read, and maximum Cloud Run instances are not a hard spending cap. A trusted edge, bot control and measured cost limits are needed before broader public promotion.
4. **Operational scale:** the two MB aggregate and 100-lot/100-buyer caps are explicit pilot boundaries. No automatic archive import, production recovery drill, sustained load test, ERP integration or payment flow has been demonstrated.

## Commercial judgment

The strongest starting point is one regional depot with existing opted-in buyers and suitable delivery routes. At the proposed £299 monthly price and an assumed £5 contribution per additional crate, 60 additional crates cover the subscription. This only creates value if those sales are incremental to the coordinator's normal recovery and do not add costly delivery legs or teach buyers to wait for discounts.

A paid pilot should compare consecutive eligible cancellations with the current process, include failures and opt-outs, and measure contribution plus coordinator time. Renewal is stronger evidence than enthusiastic feedback. The current product merits that test; neither a validated market nor a production-ready business is claimed.
