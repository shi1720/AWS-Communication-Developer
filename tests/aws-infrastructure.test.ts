import { afterEach, describe, it, vi } from "vitest";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { resolve } from "node:path";
import { SecondCrateStack } from "../infra/stack.js";

afterEach(() => vi.unstubAllEnvs());
describe("AWS infrastructure safeguards", () => {
  it("synthesizes durable private storage, origin protection and retry-safe inbound processing", () => {
    vi.stubEnv("LIVE_SENDS_ENABLED", "false");
    vi.stubEnv("ALLOW_REGISTRATION", "false");
    const stack = new SecondCrateStack(new App(), "SecondCrateTest", {
      env: { account: "123456789012", region: "eu-west-2" },
      webAssetsPath: resolve("tests/fixtures/aws-web-assets"),
    });
    const template = Template.fromStack(stack);
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      BillingMode: "PAY_PER_REQUEST",
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
    });
    template.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      FunctionResponseTypes: ["ReportBatchItemFailures"],
      BatchSize: 5,
      ScalingConfig: { MaximumConcurrency: 2 },
    });
    template.hasResourceProperties("AWS::SQS::Queue", {
      VisibilityTimeout: 180,
      RedrivePolicy: {
        maxReceiveCount: 5,
        deadLetterTargetArn: Match.anyValue(),
      },
    });
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Environment: {
        Variables: Match.objectLike({
          LIVE_SENDS_ENABLED: "false",
          ALLOW_REGISTRATION: "false",
          ORIGIN_VERIFY_SECRET: Match.anyValue(),
        }),
      },
    });
    template.resourceCountIs("AWS::CloudWatch::Alarm", 2);
    template.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      DefaultRouteSettings: {
        ThrottlingRateLimit: 20,
        ThrottlingBurstLimit: 40,
      },
    });
    template.hasResourceProperties("AWS::Events::Rule", {
      ScheduleExpression: "rate(1 minute)",
    });
    template.hasResourceProperties("AWS::CloudFront::ResponseHeadersPolicy", {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          ContentSecurityPolicy: {
            Override: true,
            ContentSecurityPolicy: Match.stringLikeRegexp("default-src 'self'"),
          },
        }),
      }),
    });
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: "redirect-to-https",
        }),
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({
            PathPattern: "/api/*",
            CachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
          }),
        ]),
      }),
    });
  }, 30_000);
});
