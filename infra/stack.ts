import {
  ArnFormat,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
  CfnOutput,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as eventsources from "aws-cdk-lib/aws-lambda-event-sources";
import * as apigateway from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cwActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as ses from "aws-cdk-lib/aws-ses";
import * as sesActions from "aws-cdk-lib/aws-ses-actions";
import * as events from "aws-cdk-lib/aws-events";
import * as eventTargets from "aws-cdk-lib/aws-events-targets";
import * as budgets from "aws-cdk-lib/aws-budgets";
import { resolve } from "node:path";

export interface SecondCrateStackProps extends StackProps {
  webAssetsPath?: string;
}
export class SecondCrateStack extends Stack {
  constructor(scope: Construct, id: string, props?: SecondCrateStackProps) {
    super(scope, id, props);
    const table = new dynamodb.Table(this, "State", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: "expiresAt",
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const site = new s3.Bucket(this, "WebAssets", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const mail = new s3.Bucket(this, "InboundMail", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{ expiration: Duration.days(30) }],
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const inboundTopic = new sns.Topic(this, "InboundEvents");
    for (const principal of [
      "social-messaging.amazonaws.com",
      "sms-voice.amazonaws.com",
      "ses.amazonaws.com",
    ]) {
      inboundTopic.addToResourcePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          principals: [new iam.ServicePrincipal(principal)],
          actions: ["sns:Publish"],
          resources: [inboundTopic.topicArn],
          conditions: { StringEquals: { "AWS:SourceAccount": this.account } },
        }),
      );
    }
    const dlq = new sqs.Queue(this, "InboundDeadLetters", {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
      enforceSSL: true,
    });
    const queue = new sqs.Queue(this, "InboundQueue", {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      visibilityTimeout: Duration.seconds(180),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 5 },
      enforceSSL: true,
    });
    inboundTopic.addSubscription(
      new subscriptions.SqsSubscription(queue, { rawMessageDelivery: false }),
    );
    const originSecret = new secretsmanager.Secret(this, "OriginSecret", {
      generateSecretString: { passwordLength: 48, excludePunctuation: true },
    });
    const environment: Record<string, string> = {
      NODE_ENV: "production",
      DYNAMODB_TABLE: table.tableName,
      AUTH_TABLE: table.tableName,
      ORIGIN_VERIFY_SECRET: originSecret.secretValue.unsafeUnwrap(),
      TRUSTED_SNS_TOPIC_ARN: inboundTopic.topicArn,
      INBOUND_MAIL_BUCKET: mail.bucketName,
      ALLOW_REGISTRATION: process.env.ALLOW_REGISTRATION ?? "false",
      LIVE_SENDS_ENABLED: process.env.LIVE_SENDS_ENABLED ?? "false",
    };
    for (const key of [
      "BEDROCK_MODEL_ID",
      "SES_FROM_EMAIL",
      "SES_REPLY_TO_EMAIL",
      "SES_CONFIGURATION_SET",
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_META_API_VERSION",
      "WHATSAPP_OFFER_TEMPLATE",
      "WHATSAPP_TEMPLATE_LANGUAGE",
      "SMS_ORIGINATION_IDENTITY",
      "SMS_CONFIGURATION_SET",
      "SMS_PROTECT_CONFIGURATION_ID",
      "SINGLE_LIVE_WORKSPACE_ID",
      "SES_OPERATOR_SENDERS",
      "APP_ORIGIN",
    ]) {
      if (process.env[key]) environment[key] = process.env[key]!;
    }
    const logGroup = new logs.LogGroup(this, "ApplicationLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const handler = new nodejs.NodejsFunction(this, "ApiHandler", {
      entry: resolve("src/server/lambda.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(30),
      reservedConcurrentExecutions: 10,
      environment,
      logGroup,
      bundling: {
        format: nodejs.OutputFormat.CJS,
        target: "node22",
        minify: true,
        sourceMap: true,
        externalModules: [],
      },
    });
    table.grantReadWriteData(handler);
    mail.grantRead(handler, "incoming/*");
    handler.addEventSource(
      new eventsources.SqsEventSource(queue, {
        batchSize: 5,
        reportBatchItemFailures: true,
        maxConcurrency: 2,
      }),
    );
    new events.Rule(this, "OutboxRecovery", {
      schedule: events.Schedule.rate(Duration.minutes(1)),
      targets: [
        new eventTargets.LambdaFunction(handler, {
          event: events.RuleTargetInput.fromObject({
            source: "secondcrate.maintenance",
            action: "flush_outbox",
          }),
          retryAttempts: 2,
          maxEventAge: Duration.hours(1),
        }),
      ],
    });
    if (environment.SES_FROM_EMAIL) {
      handler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["ses:SendEmail"],
          resources: [
            environment.SES_FROM_EMAIL,
            environment.SES_FROM_EMAIL.split("@")[1],
          ]
            .map((identity) =>
              this.formatArn({
                service: "ses",
                resource: "identity",
                resourceName: identity,
                arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
              }),
            )
            .concat(
              environment.SES_CONFIGURATION_SET
                ? [
                    this.formatArn({
                      service: "ses",
                      resource: "configuration-set",
                      resourceName: environment.SES_CONFIGURATION_SET,
                    }),
                  ]
                : [],
            ),
          conditions: {
            StringEquals: { "ses:FromAddress": environment.SES_FROM_EMAIL },
          },
        }),
      );
    }
    if (environment.WHATSAPP_PHONE_NUMBER_ID)
      handler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["social-messaging:SendWhatsAppMessage"],
          resources: [
            this.formatArn({
              service: "social-messaging",
              resource: "phone-number-id",
              resourceName: environment.WHATSAPP_PHONE_NUMBER_ID.replace(
                /^phone-number-id-/,
                "",
              ),
            }),
          ],
        }),
      );
    if (environment.SMS_ORIGINATION_IDENTITY)
      handler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sms-voice:SendTextMessage"],
          resources: [
            process.env.SMS_ORIGINATION_ARN ??
              (environment.SMS_ORIGINATION_IDENTITY.startsWith("arn:")
                ? environment.SMS_ORIGINATION_IDENTITY
                : this.formatArn({
                    service: "sms-voice",
                    resource: "phone-number",
                    resourceName: environment.SMS_ORIGINATION_IDENTITY,
                  })),
          ],
        }),
      );
    if (environment.BEDROCK_MODEL_ID) {
      const modelId = environment.BEDROCK_MODEL_ID;
      // Inference profiles route to foundation models in multiple Regions; both
      // profile and foundation-model resources must be permitted.
      const profiles = modelId.startsWith("arn:")
        ? [modelId]
        : [
            this.formatArn({
              service: "bedrock",
              resource: "inference-profile",
              resourceName: modelId,
            }),
          ];
      const foundation = (
        process.env.BEDROCK_FOUNDATION_MODEL_ID ?? modelId.split("/").at(-1)!
      ).replace(/^(eu|us|apac|global)\./, "");
      handler.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["bedrock:InvokeModel"],
          resources: [
            ...profiles,
            `arn:${this.partition}:bedrock:*::foundation-model/${foundation}`,
          ],
        }),
      );
    }
    const api = new apigateway.HttpApi(this, "HttpApi", {
      defaultIntegration: new integrations.HttpLambdaIntegration(
        "LambdaIntegration",
        handler,
      ),
      createDefaultStage: true,
    });
    const apiStage = api.defaultStage?.node.defaultChild as
      apigateway.CfnStage | undefined;
    if (apiStage)
      apiStage.defaultRouteSettings = {
        throttlingRateLimit: 20,
        throttlingBurstLimit: 40,
      };
    const rewrite = new cloudfront.Function(this, "SpaRoutes", {
      code: cloudfront.FunctionCode.fromInline(
        `function handler(event) { var request = event.request; request.headers['x-forwarded-host'] = { value: request.headers.host.value }; request.headers['x-secondcrate-client-ip'] = { value: event.viewer.ip }; if (request.uri.indexOf('/api') !== 0 && request.uri.split('/').pop().indexOf('.') === -1) request.uri = '/index.html'; return request; }`,
      ),
    });
    const webSecurityHeaders = new cloudfront.ResponseHeadersPolicy(
      this,
      "WebSecurityHeaders",
      {
        securityHeadersBehavior: {
          contentSecurityPolicy: {
            contentSecurityPolicy:
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests",
            override: true,
          },
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: Duration.days(365),
            includeSubdomains: true,
            override: true,
          },
        },
      },
    );
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: webSecurityHeaders,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: rewrite,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.HttpOrigin(
            `${api.apiId}.execute-api.${this.region}.${this.urlSuffix}`,
            {
              customHeaders: {
                "x-secondcrate-origin": originSecret.secretValue.unsafeUnwrap(),
              },
            },
          ),
          functionAssociations: [
            {
              function: rewrite,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset(props?.webAssetsPath ?? resolve("dist"))],
      destinationBucket: site,
      distribution,
      distributionPaths: ["/*"],
      prune: true,
    });
    const opsTopic = new sns.Topic(this, "OperationalAlerts");
    const errors = new cloudwatch.Alarm(this, "ApiErrors", {
      metric: handler.metricErrors({ period: Duration.minutes(5) }),
      threshold: 3,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const dead = new cloudwatch.Alarm(this, "InboundDeadLetterAlarm", {
      metric: dlq.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    errors.addAlarmAction(new cwActions.SnsAction(opsTopic));
    dead.addAlarmAction(new cwActions.SnsAction(opsTopic));
    if (process.env.OPS_EMAIL) {
      opsTopic.addSubscription(
        new subscriptions.EmailSubscription(process.env.OPS_EMAIL),
      );
      new budgets.CfnBudget(this, "MonthlyBudget", {
        budget: {
          budgetName: `${this.stackName}-monthly`,
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: { amount: 25, unit: "USD" },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              comparisonOperator: "GREATER_THAN",
              notificationType: "ACTUAL",
              threshold: 80,
              thresholdType: "PERCENTAGE",
            },
            subscribers: [
              { address: process.env.OPS_EMAIL, subscriptionType: "EMAIL" },
            ],
          },
        ],
      });
    }
    if (process.env.SES_INBOUND_RECIPIENT) {
      const rules = new ses.ReceiptRuleSet(this, "MailReceiptRules");
      rules.addRule("CancellationAndReplyMail", {
        recipients: [process.env.SES_INBOUND_RECIPIENT],
        scanEnabled: true,
        tlsPolicy: ses.TlsPolicy.REQUIRE,
        actions: [
          new sesActions.S3({
            bucket: mail,
            objectKeyPrefix: "incoming/",
            topic: inboundTopic,
          }),
        ],
      });
      new CfnOutput(this, "SesReceiptRuleSet", {
        value: rules.receiptRuleSetName,
        description:
          "Activate only after checking existing SES receipt rules and configuring MX.",
      });
    }
    new CfnOutput(this, "ProjectUrl", {
      value: `https://${distribution.distributionDomainName}`,
    });
    new CfnOutput(this, "ApiUrl", { value: api.url! });
    new CfnOutput(this, "StateTable", { value: table.tableName });
    new CfnOutput(this, "InboundTopicArn", { value: inboundTopic.topicArn });
    new CfnOutput(this, "InboundQueueUrl", { value: queue.queueUrl });
    new CfnOutput(this, "DeadLetterQueueUrl", { value: dlq.queueUrl });
    new CfnOutput(this, "OperationsTopicArn", { value: opsTopic.topicArn });
    new CfnOutput(this, "InboundMailBucket", { value: mail.bucketName });
  }
}
