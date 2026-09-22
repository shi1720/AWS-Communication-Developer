# AWS account activation support draft

Prepared on 22 September 2026. This message has **not** been sent. Use it only if service access remains unavailable after AWS's stated activation period, or if AWS requests additional action. Submit through the signed-in account's support console so the account is identified privately. No account number, payment details, identity document or credentials belong in this repository.

## Subject

Free account remains NOT_STARTED after identity and payment verification

## Message

Hello AWS Account Support,

I would like to complete activation of my existing AWS Free account while keeping the Free plan.

Customer verification is marked Verified. On 22 September 2026 I completed payment verification; Billing now confirms a saved default payment method. The "Complete your AWS registration" link resumes sign-in and returns to Console Home without showing an outstanding form.

Authentication succeeds, but these read-only checks in us-east-1 still fail:

- CloudFormation DescribeStacks: OptInRequired.
- Lambda GetAccountSettings: SubscriptionRequiredException.
- DynamoDB DescribeLimits: SubscriptionRequiredException.
- SES v2 GetAccount: SubscriptionRequiredException.

The service message says the access key needs a subscription for the service. GetAccountPlanState reports FREE and NOT_STARTED. The account's credits are still present. The account-management status is ACTIVE, but required service access is not active.

Please identify any outstanding activation step or correct the service enrollment status. Please preserve the Free account plan and do not upgrade it to Paid.

Thank you.

## References

- [AWS account activation guidance](https://docs.aws.amazon.com/accounts/latest/reference/getting-started.html) says activation can take up to 24 hours.
- [AWS account-creation troubleshooting](https://docs.aws.amazon.com/accounts/latest/reference/troubleshooting_create-account.html) identifies the support path when activation remains incomplete.
- [Sanitized checks](evidence/aws-post-verification.json) record the actual API results, without private account details.

This draft does not assert that paid service access is required. The current errors establish missing service subscriptions, not the cause.
