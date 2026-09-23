# AWS account activation support draft

Updated on 23 September 2026 following the scheduled check after the 24-hour activation window. **Prepared for review, not sent.** Submit through the signed-in account's support console so AWS can identify the account privately. Do not include credentials, payment details or identity documents in this repository.

## Subject

Service access still blocked more than 24 hours after verified signup and Paid upgrade

## Message

Hello AWS Account Support,

Please help complete activation of my existing AWS account. More than 24 hours after the successful Paid-plan upgrade, opening Amazon SES in us-east-1 still redirects to the "Complete your account setup" page.

Timeline:

- On 22 September 2026, customer verification was marked Verified and payment verification was completed. Billing showed a saved default payment method.
- At approximately 10:05 UTC on 22 September, I authorised the Paid-plan upgrade. The console confirmed "You upgraded your account successfully". A subsequent API check reported PAID, NOT_STARTED and USD 100 remaining credits.
- On 22 September, authenticated read-only checks returned OptInRequired for CloudFormation DescribeStacks and SubscriptionRequiredException for Lambda GetAccountSettings, DynamoDB DescribeLimits and SES v2 GetAccount.
- The "Complete your AWS registration" link returned to Console Home without an outstanding form during those checks.
- On 23 September at approximately 10:31 UTC, a fresh request for the SES account page from the signed-in browser still redirected to account setup. The page says services can take up to 24 hours to activate and recommends contacting support after that period.

The historical API errors above are from 22 September. The CLI currently cannot refresh its credentials, so those API results were not repeated successfully on 23 September. A fresh AWS CLI remote sign-in URL also returned HTTP 400 earlier on 23 September, while ordinary console sign-in succeeded. This is a separate sign-in issue; the service-access problem is independently visible in the console.

Please identify any outstanding account verification or service-enrollment step and explain how to restore service access. The Paid-plan upgrade already succeeded. Please do not add a paid support subscription or other products.

Thank you,
Shivam Gupta

## Review and submission

Use **Account and billing support**, then **Account activation** or the closest current category. Send only after the owner explicitly authorises this message. Record the actual case ID after submission; none has been created yet.

The request contains the activation timeline and service errors. The signed-in support console identifies the account; no credentials, payment data or identity documents are included in the text.

## Evidence and references

- [Scheduled check on 23 September](evidence/aws-followup-20260923.json) separates browser evidence from credential failures.
- [Historical post-upgrade checks](evidence/aws-after-upgrade-services.json) contain the last successful authenticated API results.
- [AWS account activation guidance](https://docs.aws.amazon.com/accounts/latest/reference/getting-started.html).
- [AWS account-creation troubleshooting](https://docs.aws.amazon.com/accounts/latest/reference/troubleshooting_create-account.html).

The completed plan upgrade and unresolved service activation are separate facts. The available evidence does not establish the underlying cause.
