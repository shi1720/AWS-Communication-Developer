#!/usr/bin/env node
// Run with: node --import tsx scripts/aws-preflight.mjs --region eu-west-2
import { parseArgs, runPreflight, safeErrorCode } from "./aws-validation.ts";
try {
  const options = parseArgs(process.argv.slice(2), false);
  if (options.help) {
    console.log(
      "Usage: node --import tsx scripts/aws-preflight.mjs [--region REGION]\nRead-only STS and SES checks. Reports configuration flags without credentials, account IDs or sender addresses. Set AWS_PROFILE and AWS_REGION/AWS_DEFAULT_REGION; SES_FROM_EMAIL and BEDROCK_MODEL_ID are optional.",
    );
  } else {
    if (options.region) process.env.AWS_DEFAULT_REGION = options.region;
    const report = await runPreflight(options);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.credentials.valid ? 0 : 1;
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
