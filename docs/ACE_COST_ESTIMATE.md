# SecondCrate: preliminary ACE AWS consumption estimate

Prepared 22 September 2026 for an early-stage hackathon opportunity. **USD 15 monthly, or USD 180 annualised, is a planning forecast before credits and tax. It is not measured spend, a customer commitment, a quote or a billing cap.** The proposed software subscription of GBP 299/month is separate revenue and must not be entered as AWS consumption.

## Workload assumption

One prospective depot, 25 released lots/month, up to 30 initial recipients per lot, and an email-first pilot. Assume 1,500 outbound emails, 750 received emails, up to 750 model interpretations, 5,000 workspace mutations and 50,000 full workspace reads including background work. Assume the stored workspace averages 256 KiB. These are sizing assumptions, not observed traffic or a committed customer deployment. The application has a 1.5 MB ordinary-write boundary and a 2 MB hard workspace limit. Archiving/partitioning and actual measurements must precede any workload that reaches those boundaries.

## Monthly allocation

| Component | USD/month | Basis |
| --- | ---: | --- |
| SES email | 0.50 | Essentials outbound at USD 0.16/1,000 is USD 0.24 for 1,500 messages. Classic receipt pricing and message chunks add cost; the allowance covers the stated small-message volume. No dedicated IP, Pro, Enterprise or Mail Manager endpoint. |
| Bedrock | 1.00 | Planning allowance for 750 short text interpretations using an economical on-demand model. The adapter caps output at 600 tokens. Exact model, regional rate and measured input tokens must be confirmed before live use. This is not a published model quote. |
| Lambda and HTTP API | 1.50 | Planning allowance including approximately 43,200 monthly scheduled maintenance invocations and application requests. No provisioned concurrency. |
| DynamoDB | 4.00 | Approximate transaction write amplification: 5,000 mutations x 256 KiB x four write units per KiB = 5.12 million units, about USD 3.20 at USD 0.625/million. 50,000 strongly consistent full reads x 64 units is about USD 0.40 at USD 0.125/million. Remaining allowance covers small metadata, storage and recovery overhead. |
| Secrets Manager | 0.40 | One stored origin-verification secret at the published illustrative USD 0.40/secret/month. Small API-call charges are covered by contingency. |
| S3 and CloudFront | 2.00 | Planning allowance for a lightly used application and assets; excludes public video streaming on AWS. |
| Logs, alarms, events and queues | 2.00 | Planning allowance for bounded traffic and retention. |
| Contingency | 3.60 | Small request, storage, message-data and estimation differences. |
| **Total AWS forecast** | **15.00** | **USD 180 annualised at the same workload.** |

The repository's transactional snapshot adapter writes a new generation and marks the previous generation for expiry, so cost grows with both snapshot size and mutation count. At a 1 MiB average workspace, the same write assumption alone becomes roughly USD 12.80, exceeding this line item. Failed conditional transactions, retries, receipts and metadata add traffic. Replace this forecast with measured pilot billing; do not extrapolate it as a fixed cost per customer.

No Free Tier discounts or promotional credits are subtracted because ACE estimates should describe the prospective workload. SMS, RCS, WhatsApp, paid support, domains, third-party services, taxes and the separate Firebase preview are excluded. Add channel-specific estimates before expanding the pilot.

## Pricing and process sources

- [SES pricing](https://aws.amazon.com/ses/pricing/): new eligible accounts default to Essentials from 21 July 2026. The published outbound price is USD 0.16/1,000; a la carte outbound is USD 0.10/1,000. Inspect the actual plan before sending.
- [DynamoDB pricing](https://aws.amazon.com/dynamodb/pricing/): published US East examples use USD 0.625/million writes and USD 0.125/million reads; transactional writes consume twice the standard write units.
- [Lambda pricing](https://aws.amazon.com/lambda/pricing/) and [HTTP API pricing](https://aws.amazon.com/api-gateway/pricing/).
- [Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/).
- [Bedrock pricing](https://aws.amazon.com/bedrock/pricing/): select the actual supported model and region when service access is available.
- [Hackathon FAQ](https://aws-cds-partner.devpost.com/details/faq): a created ACE opportunity may use the most accurate available industry, geography and expected revenue information before a customer deal exists.
