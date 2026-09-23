# AWS account activation support draft

Updated on 23 September 2026 after restoring CLI sign-in and inspecting billing, support and customer verification directly. **Prepared for review, not sent.** No private account identifiers, contact details, payment information or identity documents are included.

## Subject

Paid AWS India account: service subscriptions unavailable and no saved payment method

## Message

Hello AWS Account Support,

Please help identify the remaining activation requirement for my AWS India account.

Current evidence from 23 September 2026:

- Customer verification is marked Verified and Basic Support is selected.
- The Paid-plan upgrade completed on 22 September. A fresh authenticated check at 10:38 UTC on 23 September reports PAID, NOT_STARTED and USD 100 remaining credits.
- Payment Preferences currently displays Payment methods (0), Manual bill payments, and no payment methods on file. I previously completed a verification flow, but the current page has no saved method. Please confirm whether signup payment verification is recorded successfully and whether another payment step is required.
- Fresh authenticated checks in us-east-1 return OptInRequired for CloudFormation DescribeStacks and SubscriptionRequiredException for Lambda GetAccountSettings, DynamoDB DescribeLimits and SES v2 GetAccount.
- Lambda, SES and CloudFormation have the same failures in ap-south-1. Both regions are ENABLED_BY_DEFAULT, so this is not an opt-in-region setting.
- Opening SES in the console redirects to Complete your account setup. The Complete your AWS registration link returns to Console Home without an outstanding form.

CLI authentication has been restored. An earlier HTTP 400 during CLI sign-in was caused by an incorrectly copied authorization URL and has been corrected; it is not evidence of an AWS service fault.

Please confirm the precise missing payment, verification or service-enrollment step. The Paid-plan upgrade already succeeded. Please do not add a paid support subscription or other products.

Thank you,
Shivam Gupta

## Review and next action

The payment page is available in Safari. It offers a refundable INR 2 verification transaction when adding a payment method. Completing a bank/card verification requires the account owner. A missing saved method is a discrepancy to resolve, not proof that an earlier verification failed or that adding a method guarantees activation.

If the owner has already completed payment verification successfully, send this request to AWS Account and Billing Support only after explicit authorisation. The current support dashboard starts with an Issue description box and a Send message button. No support message or case has been submitted.

## Evidence and references

- [Fresh authenticated checks and setup audit](evidence/aws-recheck-20260923.json).
- [Earlier scheduled check](evidence/aws-followup-20260923.json), before CLI access was restored.
- [AWS India account activation](https://docs.aws.amazon.com/accounts/latest/reference/managing-accounts-india.html).
- [AWS India payment verification and saving methods](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/edit-aispl-payment-method.html).
