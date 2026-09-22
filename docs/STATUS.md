# SecondCrate release status

Checkpoint: 22 September 2026. This file separates reproducible local evidence from required cloud and entrant actions.

| Area | Verified state |
| --- | --- |
| Product | Complete local recovery workflow, isolated demo and private-account flows implemented |
| Tests | 100 automated tests passed, TypeScript passed, production build passed |
| Independent CI | GitHub Actions passed on Linux, including all 100 tests, the compiled-server HTTP workflow, CDK synthesis and a dependency audit with zero vulnerabilities ([initial run](https://github.com/shi1720/AWS-Communication-Developer/actions/runs/35702122265)) |
| HTTP end to end | Nine checks passed against both the development proxy and compiled server: 40 crates, three orders, £708, duplicate replay, concurrent final-stock requests and revoked logout |
| Infrastructure | Production frontend and CDK CloudFormation synthesis passed; actual stack not created |
| AWS authentication | Repaired using a fresh Safari AWS session and CLI callback |
| AWS account | `FREE / NOT_STARTED`; CloudFormation `OptInRequired`, SES `SubscriptionRequiredException` |
| Bedrock | Actual controlled invocation attempted; `AccessDeniedException`, no output received |
| External messaging | No messages sent. Adapter behavior is tested with mocks; live acceptance/receipts remain unverified |
| Presentation | Eight-slide editable PPTX, pitch PDF, two-page technical brief, printable script, architecture SVG, offline teleprompter and recording guide |
| Visual QA | Login and overview inspected in native Safari before rename; all final twelve PDF pages and final SVG reviewed. Full post-rename UI/teleprompter browser review remains pending because computer-use control timed out |
| Human evidence | APN/corporate-email eligibility, ACE opportunity ID and final narrated video still needed |

The account activation page is `https://signup.aws.amazon.com/billing/signup?type=resubscribe#/urp`. AWS's own page identifies payment/identity verification and account activation as possible remaining steps and notes that activation can take up to 24 hours. Do not treat a successful login or the availability of model-listing APIs as proof that deployment services are active.

## Resume after account activation

1. Run `scripts/aws-preflight.mjs` with the authenticated profile and an explicit region. Confirm CloudFormation access as well as the SES account state.
2. Choose a supported Bedrock model and verify an owned SES sender. No buyer data is needed for the mailbox-simulator check.
3. Build, bootstrap the selected AWS region and deploy `SecondCrate` using `docs/AWS_DEPLOYMENT.md`. Do not modify resources belonging to other projects.
4. Run the actual app's HTTP smoke test against the CloudFront URL and verify secure session behavior.
5. Run the controlled real Bedrock/SES checks. Configure SES receipts and retain redacted runtime evidence. If pursuing the WhatsApp prize, complete the approved marketing-template/reply/receipt flow through AWS EUM Social.
6. Create the real operator account, verify its email, lock registration and route the single live workspace. Test live provider input before recording.
7. Re-run the independent review, remove only evidence gaps actually resolved, and regenerate the artifacts with honest final status.
8. Record the final demo, enter the accurate ACE opportunity and submit the complete Devpost entry before the deadline.

Evidence: `docs/evidence/release-verification.json`, `docs/evidence/compiled-http-smoke.json`, `docs/evidence/http-smoke.json`, `docs/evidence/aws-preflight-2026-09-22.json`, `docs/evidence/aws-verification-attempt-2026-09-22.json`. Internal review: `docs/REVIEW.md`.
