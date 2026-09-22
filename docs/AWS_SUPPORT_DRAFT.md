# AWS account activation support draft

Prepared on 22 September 2026. This message has **not** been sent. Use it only if service access remains unavailable after AWS's stated activation period, or if AWS requests additional action. Submit through the signed-in account's support console so the account is identified privately. No account number, payment details, identity document or credentials belong in this repository.

## Subject

Paid account remains NOT_STARTED after verified signup and successful upgrade

## Message

Hello AWS Account Support,

I would like to complete activation of my existing AWS account.

Customer verification is marked Verified. On 22 September 2026 I completed payment verification; Billing now confirms a saved default payment method. The "Complete your AWS registration" link resumes sign-in and returns to Console Home without showing an outstanding form.

At approximately 10:05 UTC on 22 September 2026, I authorised a Paid-plan upgrade. The console confirmed "You upgraded your account successfully". GetAccountPlanState reports PAID, NOT_STARTED and USD 100 remaining credits.

Authentication succeeds, but these read-only checks in us-east-1 still fail:

- CloudFormation DescribeStacks: OptInRequired.
- Lambda GetAccountSettings: SubscriptionRequiredException.
- DynamoDB DescribeLimits: SubscriptionRequiredException.
- SES v2 GetAccount: SubscriptionRequiredException.

The service message says the access key needs a subscription for the service. The account-management status is ACTIVE, but required service access is not active. The most recent SES check at 10:10 UTC still returned SubscriptionRequiredException.

Please identify any outstanding activation step or correct the service enrollment status. The account is already on the Paid plan; please do not add a paid support subscription or other products.

Thank you.

## References

- [AWS account activation guidance](https://docs.aws.amazon.com/accounts/latest/reference/getting-started.html) says activation can take up to 24 hours.
- [AWS account-creation troubleshooting](https://docs.aws.amazon.com/accounts/latest/reference/troubleshooting_create-account.html) identifies the support path when activation remains incomplete.
- [Sanitized post-upgrade checks](evidence/aws-after-upgrade-services.json) record the actual API results, without private account details.

The successful plan change and the unresolved service activation are separate facts. The current errors establish missing service subscriptions, not their cause.
