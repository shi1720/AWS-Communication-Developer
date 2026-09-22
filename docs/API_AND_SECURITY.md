# API and operational boundaries

SecondCrate uses a same-origin JSON API at `/api`. Sessions are opaque random tokens in an HttpOnly, SameSite=Lax cookie, marked Secure in the deployed production environment. The default cookie is `secondcrate_session`; Firebase Hosting uses `__session` because that is the cookie it forwards to Cloud Run. The server stores only a SHA-256 digest of each token. Mutating browser requests reject a mismatched Origin or cross-site Fetch Metadata. CloudFront forwarding is trusted only when its origin secret matches.

## Start and authenticate

- `POST /auth/demo` creates a distinct demonstration workspace with synthetic contacts, an unlaunched 40-crate lot and no orders. Demo sends are always simulated, even if AWS credentials are present.
- `POST /auth/register` takes `{name,email,password}`. Passwords require 12–128 characters, a letter and a number. Registration can be disabled with `ALLOW_REGISTRATION=false`.
- `POST /auth/login` takes `{email,password}`. Passwords use a random salt and scrypt with N=32768, r=8, p=3. Password reset invalidates previously issued sessions.
- `POST /auth/logout` revokes the current session. `GET /session` returns `{user}` or `{user:null}`.
- `POST /auth/send-verification` emails the signed-in account a one-use verification link. `POST /auth/verify` consumes `{token}`.
- `POST /auth/forgot-password` takes `{email}`; `POST /auth/reset-password` takes `{token,password}`. Email workflows require configured Amazon SES and `APP_ORIGIN`. Reset/verification tokens expire after one hour.

Demo sessions expire after 24 hours, real-account sessions after seven days. Authentication and rehearsal inbound endpoints have persisted rate limits. Password hashes, sessions and reset tokens are never included in workspace responses or exports.

The current public preview has no configured SES sender. Private registration and password login are verified, while verification and forgotten-password requests return the explicit `EMAIL_NOT_CONFIGURED` limitation. Judge testing should use the isolated demo, which does not need email access.

## Core endpoints

| Method | Endpoint                  | Purpose                                                                                       |
| ------ | ------------------------- | --------------------------------------------------------------------------------------------- |
| GET    | `/dashboard`              | Current tenant's workspace, runtime configuration and `emailVerified`                         |
| POST   | `/lots`                   | Validate a warehouse release and create an unlaunched draft                                   |
| POST   | `/lots/extract`           | Conservative local draft extraction from `{text}`; always review                              |
| POST   | `/lots/:id/launch`        | Check consent, category, capacity, route, delivery and price authority; queue offers          |
| POST   | `/lots/:id/close`         | Stop further allocation; preserve existing orders                                             |
| POST   | `/inbound`                | Rehearsal buyer input only; takes `{buyerId,lotId,channel,text,eventId}`                      |
| POST   | `/orders/:id/dispatch`    | Operator records dispatch before the operational cutoff                                       |
| POST   | `/buyers`                 | Add buyer and documented marketing consent                                                    |
| PATCH  | `/buyers/:id`             | Update preferences or suppress outreach                                                       |
| PATCH  | `/settings`               | Company/operator name, discount authority and send enablement                                 |
| POST   | `/messages/:id/reconcile` | Record an operator-reported outcome for an unknown outbound live send, with external evidence |
| POST   | `/outbox/flush`           | Process queued messages; never automatically resend uncertain outcomes                        |
| GET    | `/export`                 | Formula-safe CSV of recorded orders                                                           |
| GET    | `/export/archive`         | Complete JSON workspace archive, including messages and audit events                          |
| POST   | `/demo/reset`             | Reset only the authenticated user's synthetic sandbox                                         |

Lot dates are ISO-8601 timestamps with timezone offsets. Buyer `deliveryBefore` is `HH:mm` in **Europe/London**; this pilot assumes a single London depot and a configured 25 km delivery radius. Monetary API fields are pounds with at most two decimals. Policy arithmetic and order totals use integer pence.

All tenant IDs come from the authenticated session or a server-configured trusted provider route. Browser input cannot select a workspace. Unknown JSON fields are rejected on writes. Real inbound messages are accepted only by the trusted Lambda/SNS adapter, never by the browser rehearsal endpoint.

## Transaction and delivery semantics

The model produces a typed proposal; it never directly mutates stock, prices, consent or orders. Deterministic tools validate its output against the current persisted state. Workspace updates use optimistic compare-and-swap. Concurrent requests retry against current state, so two requests for the last eight crates cannot both win. Incoming provider event IDs prevent duplicate orders and duplicate queued responses. Trusted provider timestamps also block stale or equal-timestamp negotiation, acceptance and decline messages from replacing newer recorded terms; those messages remain in the audit. Opt-outs always apply. This conservative rule cannot reconstruct missing provider chronology; an ambiguous buyer must reconfirm current terms.

A committed order decreases available inventory in the same transaction that records the order, confirmation and audit result. A below-floor proposal creates a counteroffer without reserving stock. Acceptance of a counteroffer still rechecks stock. An initial “yes” without a quantity does not buy the maximum offered quantity.

Outbound delivery uses a persisted outbox. A sender atomically changes `queued` to `unknown` before contacting a provider. The resulting provider ID and acceptance/failure are then persisted. This closes the common double-send race between concurrent workers. A crash or network timeout after claiming remains visibly **unknown** and is not automatically retried: the underlying send APIs do not give a universal exactly-once guarantee. An operator must reconcile provider receipts before any manual resend. The reconciliation endpoint takes `{outcome:"sent"|"failed",providerId?,evidence}`. It accepts only currently unknown outbound live messages, requires a provider message ID for `sent`, and requires 20–2000 characters of external evidence or support reference. The audit records the authenticated operator and labels this as **operator-reported**, not verification performed by SecondCrate. It cannot turn a simulation into a real send, downgrade delivered evidence, or resend anything. Conflicting concurrent reconciliation attempts cannot both commit.

Provider acceptance is labeled `sent`, not delivered. Receipt events can update a message to delivered or failed. Initial WhatsApp surplus offers always require the configured approved marketing template. Free-form WhatsApp replies require an actual WhatsApp inbound timestamp within the customer service window; an email or SMS reply never opens that window. Exact opt-outs bypass model inference, and complaint/permanent-bounce events suppress the buyer.

## Enable real sending

A real workspace starts with sending disabled. Live sending requires all of the following:

1. The deployment has `LIVE_SENDS_ENABLED=true`.
2. The signed-in operator has verified their email address.
3. Amazon Bedrock and at least one AWS communications channel are configured.
4. Workspace `autoSend` is enabled by the operator.
5. If `SINGLE_LIVE_WORKSPACE_ID` is set, it matches the authenticated workspace.
6. Real buyer contacts and documented consent are entered; WhatsApp template and channel prerequisites are satisfied.

“Configured” means runtime configuration is present. It does not establish that AWS sandbox restrictions, account approvals, origination identities, recipient verification or template approval have been completed. Run the deployment guide's real-channel checks before recording submission evidence.

## Explicit pilot limits

The Firebase preview uses the named Firestore database `secondcrate`. Reads and writes transact over a manifest and bounded 500 KB snapshot chunks, retaining the same two MB aggregate limit and inventory version checks. Direct browser database access is denied. Demo expiry is checked by application reads before asynchronous TTL cleanup. See [Firebase deployment details](../infra/firebase/README.md) for scoped service-account access and quotas. The named database is billable.

The public preview uses a shared budget of 100 new demo workspaces per fixed hour, plus 180 writes and 60 inbound messages per workspace per 15 minutes. Cloud Run permits at most three instances. These controls bound some activity but do not provide a bot challenge, a per-user edge limit or a hard spending ceiling. Authenticated reads still access Firestore. Review abuse controls and costs before expanding the audience.

Local persistence uses atomic file replacement and is intended for one Node process. AWS persistence stores immutable 190 KB binary snapshot chunks and changes their manifest atomically with a DynamoDB transaction. A reader follows one consistent manifest; a failed concurrent write cannot expose partial state. Replaced snapshots and demonstration workspaces expire after seven days; current live snapshots do not expire. Ordinary domain writes stop at 1.5 MB, leaving headroom for delivery receipts (1.8 MB) and essential opt-outs/send suppression (1.99 MB) within the 2 MB storage cap. Audit history is never silently truncated. The interface allows at most 100 buyers and 100 lots per workspace. Export the full archive before reaching capacity. The versioned JSON export contains the complete workspace (lots, buyers, offers, messages, orders, processed event IDs and audit evidence), plus a SHA-256 workspace checksum for accidental-corruption detection. It excludes credentials and session data. The checksum is not a digital signature, and this release does not offer automatic archive import, deletion, compaction or restore; retain the export securely and use the deployment backup/runbook for restoration. This pilot still rewrites a bounded aggregate per transaction. Splitting inventory, inbox, outbox and audit into independently partitioned records is a planned migration for high-throughput, long-running multi-depot use.

This release records a wholesaler's confirmed commitments and operator dispatch actions. It does not collect payments, create tax invoices, integrate an ERP, inspect food condition, calculate food safety or assert food-waste/carbon savings. An external security review, retention policy and business-specific fulfilment integration remain rollout requirements. Those are deployment boundaries, not evidence that an untested integration works.
