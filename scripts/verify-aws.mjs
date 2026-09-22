#!/usr/bin/env node
// Run with: node --import tsx scripts/verify-aws.mjs --help
import { parseArgs, runVerification, safeErrorCode } from "./aws-validation.ts";
try {
  const options = parseArgs(process.argv.slice(2), true);
  if (options.help) {
    console.log(
      "Usage: node --import tsx scripts/verify-aws.mjs [--region REGION] [--bedrock] [--send-simulator --confirm-sender]\nDefault: read-only preflight. --bedrock performs one paid synthetic Converse request. The two send flags permit exactly one message to the fixed AWS SES success mailbox simulator using configured SES_FROM_EMAIL. No buyer-recipient option exists. Output is redacted JSON; provider acceptance is not a delivery receipt. Environment equivalents: SECONDCRATE_VERIFY_BEDROCK=true; SECONDCRATE_VERIFY_SEND_SIMULATOR=true plus SECONDCRATE_VERIFY_CONFIRM_SENDER=true.",
    );
  } else {
    if (options.region) process.env.AWS_DEFAULT_REGION = options.region;
    const evidence = await runVerification(options);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = evidence.ok ? 0 : 1;
  }
} catch (error) {
  console.log(
    JSON.stringify(
      { product: "SecondCrate", ok: false, errorCode: safeErrorCode(error) },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
