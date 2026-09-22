# SecondCrate: ACE opportunity preparation

**Draft only. No opportunity has been created and no customer deal is claimed.** Prepared for Shivam Gupta on 22 September 2026. Northstar Produce is fictional and must not be entered as a real customer.

The [hackathon FAQ](https://aws-cds-partner.devpost.com/details/faq) allows entrants without a customer deal to use the most accurate available industry, geography and expected revenue information. It still requires an actual ACE record. Update that record when a real customer is identified. A Created opportunity is sufficient; it need not be Launched.

## Proposed content

| Field or prompt | Draft value |
|---|---|
| Opportunity/project title | SecondCrate - conversational recovery of cancelled wholesale produce orders |
| Partner organisation | Shivam confirms existing AWS Partner membership. Select the organisation from his authenticated Partner Central session; its legal name remains unverified locally. |
| Authorised opportunity owner | **Required: actual partner user; Shivam Gupta only if authorised** |
| Customer | **No customer identified. Use the accurate early-stage/no-customer route permitted by the hackathon guidance and current form. Do not invent a legal entity.** |
| Target industry | Food wholesale / distribution |
| Target geography | United Kingdom; initial regional produce depot use case |
| Business problem | Cancelled wholesale orders require rapid buyer outreach and coordination before dispatch. Manual recovery can consume staff time and leave saleable stock unallocated. Frequency and financial impact require pilot validation. |
| Proposed solution | An authenticated application that releases operator-approved surplus lots, communicates with opted-in buyers, interprets conditional requests and checks price, stock and delivery constraints before confirming replacement orders. |
| Stage/context | Newly developed hackathon solution; discovery and prospective paid pilots; no committed customer or purchase order |
| Project owner | Shivam Gupta, project creator |
| Proposed customer subscription | £299/depot/month; pricing hypothesis, not a contracted sale |
| Expected software revenue | £3,588 annualised per paid depot at the proposed price, assuming twelve paid months. **Not AWS consumption ARR and not booked revenue.** |
| AWS consumption estimate | Planning estimate: **USD 15 monthly / USD 180 annual AWS consumption** for an initial bounded, email-first pilot. See [ACE_COST_ESTIMATE.md](ACE_COST_ESTIMATE.md). This is an unmeasured forecast before credits, not booked revenue or an authorised spend. |
| Estimated launch/close date | **15 December 2026**, an internal pilot-planning target selected for this draft. No customer commitment or closed deal is claimed. Revise when a real pilot is agreed. |
| Assistance requested | Technical validation of CDS setup; introductions to relevant food-distribution customers; feedback on packaging for a future AWS Marketplace offering |
| Marketing campaign | **AWS CDS Agentic AI Hackathon -Sept. 2026** |
| Solution/repository | https://github.com/shi1720/AWS-Communication-Developer |

## Accurate AWS product selection

Select only the services actually included in the opportunity: Amazon Simple Email Service (SES), AWS End User Messaging Social for WhatsApp, and AWS End User Messaging for SMS/RCS where applicable. Identify Bedrock and deployment services according to the actual design. An optional adapter is not a deployed customer workload.

In the current hackathon instructions, the campaign is entered under project marketing details. After creation, find the opportunity ID in Partner Central's Opportunities table and copy the returned value into the Devpost submission. Do not fabricate an `O…` identifier.

## Evidence to save after creation

- Actual opportunity ID and creation date.
- Confirmation that the required marketing campaign is selected.
- Actual organisation and authorised owner.
- The assumptions supporting any entered AWS revenue estimate.

Keep customer contact details and the partner account out of the public repository. The [BUSINESS_CASE.md](BUSINESS_CASE.md) pricing model provides context; it does not substitute for a real customer's forecast.

## Access checkpoint: 22 September 2026

Shivam has confirmed that he is already an AWS Partner and has authorised creating this opportunity. The locally configured AWS account is not yet linked to his existing partner membership. Its read-only service preflight at 09:56 UTC reports valid credentials, FREE / NOT_STARTED and SES SubscriptionRequiredException. The existing Partner Central sign-in page is open in Safari; authentication is still required. Do not create a replacement partner registration or migrate an organisation without reviewing its existing account.

The current [AWS registration FAQ](https://docs.aws.amazon.com/partner-central/latest/getting-started/registration-faq.html) says existing legacy partners should preserve their account through the migration path, and that new Partner Central registration requires a Paid AWS account. [AWS Free Tier guidance](https://aws.amazon.com/free/free-tier-faqs/) distinguishes a zero upgrade fee from usage charges after credits. The instruction allowing a free plan change does not authorise uncapped pay-as-you-go billing. No plan change or ACE creation has occurred.

After sign-in, use **Sell > Opportunities > Create opportunity**. Record the actual generated opportunity ID in the private Devpost field. The wizard may require an associated solution in Limited or Public status; inspect the existing organisation's solutions first. If mandatory customer fields cannot represent the hackathon's no-customer case honestly, obtain the organiser's prescribed entry format rather than inventing a company or contact.
