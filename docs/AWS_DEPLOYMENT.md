# Deploy SecondCrate on AWS

SecondCrate runs as a single-tenant pilot deployment: CloudFront serves the private S3 web application and forwards `/api/*` to HTTP API → Lambda. DynamoDB persists accounts, sessions and workspace state. SNS → SQS → Lambda handles provider events with a dead-letter queue. The app uses Amazon Bedrock Converse for constrained intent extraction and calls AWS CDS directly for outbound messages.

The deployment is reproducible; channel provisioning is account-specific. An AWS-hosted rehearsal does not, by itself, demonstrate a live CDS send. Capture real provider acceptance and receipt evidence before claiming live functionality in a submission.

## Prerequisites

- Node.js 22+, npm, AWS CLI v2 and an AWS account with permission to deploy CDK resources.
- An authenticated AWS profile. Prefer IAM Identity Center / short-lived credentials; never paste keys in source files or commit `.env`.
- A Region supporting your chosen Bedrock model, SES, EUM Social and EUM SMS. The infrastructure defaults to `eu-west-2`; check [current service endpoints](https://docs.aws.amazon.com/general/latest/gr/end-user-messaging.html) before provisioning channels.
- For live email, a verified SES identity. While SES is in sandbox, use verified destinations or the [SES mailbox simulator](https://docs.aws.amazon.com/ses/latest/dg/send-email-simulator.html).
- For real WhatsApp, a linked WhatsApp Business Account and an approved marketing template. For SMS, a registered origination identity and two-way capable number.

## First deployment: hosted rehearsal

```bash
npm ci
npm run check
aws sts get-caller-identity
export AWS_REGION=eu-west-2
npx cdk bootstrap --app 'npx tsx infra/app.ts'
npm run infra:synth
npm run deploy
```

CDK prints `ProjectUrl`. Open that HTTPS URL and choose the demo. Each demo session has isolated state and simulated sends. Registration defaults to disabled in the hosted pilot. The HTTP API URL is intentionally blocked without the CloudFront origin secret.

`cdk bootstrap` creates AWS deployment support resources. The stack creates no paid phone numbers, WABA registrations, domain registrations or public email identities. S3, DynamoDB, Lambda, CloudFront, Secrets Manager and message/model usage can incur charges; there is no NAT gateway, container or always-on database.

Set `OPS_EMAIL` during deployment to add a US$25 monthly AWS Budget (80% actual-spend notification) and operational alarm subscription. Confirm the AWS SNS email subscription. Budgets notify; they do not stop spending.

## Enable a live pilot

Configure only resources you own:

| Variable | Purpose |
| --- | --- |
| `AWS_REGION` | Region of deployed APIs and messaging resources |
| `BEDROCK_MODEL_ID` | Converse model or inference profile with tool use support |
| `SES_FROM_EMAIL` | Verified sender email address |
| `SES_REPLY_TO_EMAIL` | Address receiving buyer replies through SES |
| `SES_CONFIGURATION_SET` | Optional SES event configuration set publishing receipts to the stack topic |
| `WHATSAPP_PHONE_NUMBER_ID` | AWS phone-number ID, not the Meta numeric ID |
| `WHATSAPP_META_API_VERSION` | API version supported by AWS EUM Social in your Region |
| `WHATSAPP_OFFER_TEMPLATE` | Approved marketing template name for initial surplus offers |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Approved template language, e.g. `en_GB` |
| `SMS_ORIGINATION_IDENTITY` | EUM SMS phone/pool identity or full ARN |
| `SMS_ORIGINATION_ARN` | Full ARN for narrowly scoped send permission when the identity is not already an ARN |
| `SMS_CONFIGURATION_SET` | EUM SMS set publishing delivery events to the stack topic |
| `SMS_PROTECT_CONFIGURATION_ID` | Optional EUM SMS protection configuration |
| `ALLOW_REGISTRATION` | `true` temporarily permits operator account creation |
| `LIVE_SENDS_ENABLED` | `true` permits real provider sends after operator launch approval |
| `SINGLE_LIVE_WORKSPACE_ID` | Existing live workspace to receive provider events |
| `SES_INBOUND_RECIPIENT` | Optional receiving address; creates a receipt rule set, not DNS |
| `SES_OPERATOR_SENDERS` | Comma-separated authenticated sender allowlist for cancellation intake |
| `APP_ORIGIN` | Optional explicit HTTPS origin when using a custom domain |
| `OPS_EMAIL` | Optional budget and alarm destination |

Export the configured variables locally, build, and run `npm run deploy`. CDK passes the nonsecret resource identifiers to Lambda; the app uses its IAM role, not embedded AWS keys. The generated origin secret stays in AWS. Session cookies are opaque random tokens; only their hashes are stored. Do not print the Lambda environment or retrieve the origin secret as part of a public demo.

Create an operator account, capture its workspace ID from the authenticated dashboard response, disable registration, set `SINGLE_LIVE_WORKSPACE_ID` and redeploy. Populate only real opted-in buyers with dated consent evidence. Demo seed contacts are fictional and must never be copied into a live workspace.

Bedrock receives the current proposal status, quantity and GBP price; this buyer’s already committed quantity; and the latest six messages for that buyer and lot across channels (at most 400 characters each). It receives no other buyers or explicit contact fields. Delivery times are interpreted in `Europe/London`. A bare YES can confirm an explicit pending negotiation; an initial YES without a quantity requires clarification. Deterministic server checks remain authoritative.

## WhatsApp setup and conversation policy

1. In AWS End User Messaging Social, link the organization's WhatsApp Business Account. Complete Meta business/number verification as required.
2. Copy the AWS `phone-number-id-…` identifier and configure its WABA event destination to `InboundTopicArn`. The stack grants same-account service publishing; the queue accepts only its subscribed topic.
3. Submit the exact template expected by `RecoveryService.launch` for Meta approval under **MARKETING**. Surplus inventory offers are promotional even if the product has an operational use case. The configured template language and body parameter order must match the service. Use the exact nine-variable body and parameter order in [WHATSAPP_TEMPLATE.md](WHATSAPP_TEMPLATE.md). The tests verify that the stored message matches the template parameters.
4. Set the template name and API version, then redeploy.
5. Send a live offer to your own documented opted-in test buyer. Reply with a quantity or counteroffer. Preserve the provider message ID, audit result and receipt; redact personal contact details before publishing.

Initial offers always require the approved template. After a buyer replies, free-form agent responses are allowed only within the 24-hour customer service window. The adapter rejects expired or future-dated windows. Outside that window, use an approved template. Read [AWS sending guidance](https://docs.aws.amazon.com/social-messaging/latest/userguide/whatsapp-send-message.html) and [event format](https://docs.aws.amazon.com/social-messaging/latest/userguide/managing-event-destination-dlrs.html).

The application does not bypass Meta template approval, category rules, per-user limits, business verification, opt-outs or unsupported destination markets. API acceptance is displayed as **sent**; delivered status requires a receipt.

## SMS setup

Request/register a two-way number appropriate for the destination country. Configure its two-way destination to `InboundTopicArn`. Create a configuration set with delivery events to the same topic. Enable destination-country protection rules and the account spending limit before live use. Inbound messages follow the [AWS two-way payload](https://docs.aws.amazon.com/sms-voice/latest/userguide/two-way-sms-payload.html).

The adapter uses `SendTextMessage` and a one-hour provider TTL. Confirm carrier rules and current account/country limits. Explicit order replies/confirmations use transactional classification; initial offers use promotional classification. A `TEXT_SUCCESSFUL` event means carrier acceptance, not proof of device delivery; only `TEXT_DELIVERED` promotes the application state to delivered. See [event definitions](https://docs.aws.amazon.com/sms-voice/latest/userguide/configuration-sets-event-types.html).

## SES email, receipts and cancellation intake

Verify the sender address or domain and configure DKIM. For live receipts, create an SES configuration set with send/delivery/bounce/complaint/reject events delivered to `InboundTopicArn`, then set `SES_CONFIGURATION_SET`. Test first with `success@simulator.amazonses.com` and `bounce@simulator.amazonses.com`. Mailbox-simulator tests do not represent communication with a real buyer.

For inbound email, set `SES_INBOUND_RECIPIENT`, deploy the optional rule set, then configure the domain MX record for the receiving Region. Review existing receipt rules before explicitly activating the generated rule set:

```bash
aws ses set-active-receipt-rule-set --rule-set-name YOUR_STACK_RULE_SET --region YOUR_REGION
```

The rule saves raw MIME to private S3 under `incoming/`, publishes the receipt notification, and requires TLS. Lambda only reads the configured bucket/prefix, rejects objects over 256 KB, parses MIME with `mailparser`, requires SES spam/virus/DMARC PASS, and requires the MIME sender to match the envelope sender. Attachments are not acted on. Raw inbound email expires after 30 days.

Known buyers' emails resolve to their existing conversation. Emails from `SES_OPERATOR_SENDERS` create a **review-required cancellation source** in the audit trail. They never invent commercial terms, auto-create a released lot, or auto-launch a campaign. The operator reviews the source, enters the lot and attests release. [SES notification format](https://docs.aws.amazon.com/ses/latest/dg/receiving-email-notifications-contents.html).

## Reliability, capacity and recovery

- Orders and inventory commit together in a DynamoDB conditional workspace write. Concurrent updates retry at the service layer. Inbound provider event IDs deduplicate order actions.
- EventBridge drains queued messages once per minute for the configured live workspace, recovering a crash after committing an outbox entry. It never retries unknown outcomes.
- Outbound claims persist before the provider call. SDK send retries are disabled because a lost response may still mean a delivered message. Unknown outcomes are visible and must be reconciled before manual resending; there is no promise of distributed exactly-once delivery.
- SNS envelopes are checked against the configured topic; IAM restricts the queue producer. Inbound routing resolves existing buyer contact details and a unique active offer/reference. Quoted WhatsApp replies correlate to the original provider message; email subject references and explicit lot references disambiguate offers. Unrecognized or ambiguous conversations are retained as review-required audit events and do not allocate stock. Exact opt-outs suppress every matched recipient record even without an active offer.
- SQS uses partial batch failures, five receives and a 14-day DLQ. Inspect failure metrics and sanitized application codes, fix the cause, then redrive. Never replay from an untrusted HTTP endpoint.
- A workspace is a bounded pilot aggregate stored as immutable 190 KB binary chunks behind an atomic manifest. Consistent reads pin one generation and verify its SHA-256 digest; manifest replacement, new chunks and expiry of old chunks commit in one DynamoDB transaction. Current live chunks never expire. Superseded generations expire after seven days. The hard workspace limit is 2,000,000 UTF-8 bytes; ordinary mutations stop at 1.5 MB, retaining headroom for receipts and opt-outs. Legacy single-item records migrate on their next write. Export and arrange a reviewed archive/migration before capacity. High-volume rollout still requires partitioning by lot/order/message; the current snapshot design rewrites the aggregate and is not an unlimited event store.
- State table and buckets are retained on stack deletion. Point-in-time recovery is enabled. Session/application expiries are validated in code; DynamoDB TTL cleanup is asynchronous. Demo workspaces expire after seven days.
- Lambda logs are retained for 30 days and avoid message text, contact details and model prompts. CloudWatch alarms cover Lambda errors and nonempty DLQ; subscribe `OperationsTopicArn` before relying on notifications.

## Validation before a customer pilot

Run `npm run check` and `npm run infra:synth`. Confirm HTTPS/login/logout and tenant isolation. Test a real accepted email, a bounce, a WhatsApp template/reply/receipt and an SMS reply/receipt using controlled contacts. Exercise duplicate inbound IDs, competing allocations, an expired lot, no consent, below-floor price, unknown provider outcome and an unsubscribe. Restore a copy from DynamoDB PITR and document the recovery time. Conduct deployment-specific privacy, consent and operational review with the customer before importing their buyer list.

Current boundaries: one routed live workspace per deployment, text-only inbound negotiation, no ERP/payment integration, no route optimization, no automatic food-quality judgment, no production SLA. These are explicit pilot boundaries rather than hidden simulated integrations.

## Repeatable preflight and live evidence commands

The utilities below use the installed AWS SDK and the same messaging/reasoning adapters as the application. An optional Free Tier plan diagnostic uses the installed AWS CLI. They never print access keys, session tokens, account IDs, sender addresses or raw SDK/CLI error messages. Configuration flags describe the current process environment; a false flag does not mean the AWS account has no such resource.

Set the authenticated profile and deployment Region. `AWS_DEFAULT_REGION` also reaches any configured `credential_process` child command:

```bash
export AWS_PROFILE=your-authenticated-profile
export AWS_REGION=eu-west-2
export AWS_DEFAULT_REGION=eu-west-2
node --import tsx scripts/aws-preflight.mjs --region eu-west-2
```

Preflight is read-only: STS `GetCallerIdentity`, SESv2 `GetAccount`, and, if `SES_FROM_EMAIL` is configured, `GetEmailIdentity` for the address and its domain. It reports credential validity, Region, SES sandbox/sending status, sender verification and channel/model configuration flags. Bedrock is **not invoked**. The caller needs the corresponding SES read permissions; a denied read is reported as unknown/unavailable rather than proof of an unverified resource. [SES identity status](https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_GetEmailIdentity.html), [SES account status](https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_GetAccount.html).

**Exit code compatibility:** exit `0` means STS credentials are valid, even when SES is unavailable. It does not mean deployment is ready. Inspect `readiness.status`, `ses.errorCode` and `diagnostics`. The readiness report explicitly records that CloudFormation, Lambda and DynamoDB were not checked. `simulatorSendReady` requires an accessible sending-enabled SES account and a verified configured sender; it does not send anything.

For an account that signs in but returns `SubscriptionRequiredException` or `OptInRequired`, optionally include Free Tier state:

```bash
node --import tsx scripts/aws-preflight.mjs --region us-east-1 --account-plan
```

`SECONDCRATE_PREFLIGHT_ACCOUNT_PLAN=true` is equivalent. This adds only the read-only `GetAccountPlanState` call through the AWS CLI and requires `freetier:GetAccountPlanState`. The CLI is bounded by a timeout and receives the same profile and Region environment. The report whitelists plan type, state and remaining credit amount; it omits the account ID and other provider metadata. An unavailable CLI, denied permission or invalid plan response is nonfatal and does not invalidate successful STS/SES checks. Without the option or environment switch, no plan call runs. [Free Tier state API](https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_freetier_GetAccountPlanState.html).

`FREE / NOT_STARTED` or `PAID / NOT_STARTED` plus a service-subscription error indicates unresolved activation or service enrollment, not expired sign-in credentials. Diagnostics preserve the observed plan: Paid plan status alone does not establish service activation, while an unavailable plan check makes no assumption about plan type. Check any remaining signup completion, payment verification and customer verification steps in the console. If verification has just completed, allow AWS activation to finish; if the console loops or the restriction persists, request AWS account support diagnosis. This command never calls `UpgradeAccountPlan`, modifies billing or signs up for APN. Joining APN or AWS Organizations can automatically upgrade a Free account, so preserve the operator's plan choice. [AWS activation instructions](https://docs.aws.amazon.com/accounts/latest/reference/getting-started.html), [Free plan constraints](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html).

The recorded [22 September read-only result](evidence/aws-preflight-2026-09-22.json) confirms valid credentials but `SubscriptionRequiredException` from SES in `eu-west-2`. Account/service activation must be resolved before deployment or send verification. This file contains no live send or model evidence.

After activation, select an enabled tool-capable `BEDROCK_MODEL_ID` and configure a verified `SES_FROM_EMAIL`. This explicit command performs one synthetic Bedrock interpretation and exactly one email to AWS's fixed success mailbox simulator:

```bash
node --import tsx scripts/verify-aws.mjs --region eu-west-2 \
  --bedrock --send-simulator --confirm-sender
```

`--confirm-sender` confirms that the configured sender belongs to the operator and is appropriate for this controlled test. The script additionally verifies the sender address or domain through SES before sending. There is no recipient argument: the only destination is `success@simulator.amazonses.com`. A Bedrock-only check uses `--bedrock`; a simulator-only check uses both send flags. With no action flags, verification performs only preflight.

Equivalent environment switches are `SECONDCRATE_VERIFY_BEDROCK=true` and, for sending, **both** `SECONDCRATE_VERIFY_SEND_SIMULATOR=true` and `SECONDCRATE_VERIFY_CONFIRM_SENDER=true`. Keep them unset for normal preflight. Model inference and simulator email can incur AWS charges.

The resulting JSON includes timestamps, Region, a redacted model identifier, token counts, constrained decision fields, provider message ID and action outcomes. Save it with shell redirection to an evidence file when ready. A sent provider ID establishes **API acceptance only**; it is not an SES delivery receipt, a real buyer interaction, proof of WhatsApp/SMS operation or a deployed end-to-end workflow. Collect those separately. If a send reports unknown, investigate its receipts before intentionally rerunning; the utility never automatically retries an ambiguous send.

### Renew an expired local sign-in

Run `AWS_REGION=us-east-1 AWS_DEFAULT_REGION=us-east-1 aws login --profile kitproof-bootstrap --region us-east-1` and use the exact URL printed by the CLI. Keep all encoded characters intact; the client ARN contains three colons after `signin`. Select the existing intended console session and let the local callback complete. An invalid copied URL is not evidence of an AWS account activation fault. A credentials-export command without a configured region can also report `NoRegion`; use an explicit region when diagnosing sign-in. Never print the output of `aws configure export-credentials`, because it contains credentials.
