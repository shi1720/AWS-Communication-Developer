#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { SecondCrateStack } from "./stack.js";
const app = new App();
new SecondCrateStack(app, "SecondCrate", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region:
      process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "eu-west-2",
  },
});
