import { randomUUID } from "node:crypto";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import {
  GetAccountCommand,
  GetEmailIdentityCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";
import { AWSMessagingAdapter } from "../src/server/adapters/messaging.js";
import { BedrockReasoningAdapter } from "../src/server/adapters/reasoning.js";
import { createWorkspace } from "../src/server/seed.js";
import type {
  MessagingAdapter,
  ReasoningAdapter,
} from "../src/shared/types.js";

type Sender = { send(command: any): Promise<any> };
type Env = Record<string, string | undefined>;
export interface ValidationDependencies {
  sts?: Sender;
  ses?: Sender;
  messaging?: MessagingAdapter;
  reasoning?: ReasoningAdapter;
}
export interface ValidationOptions {
  env?: Env;
  region?: string;
  dependencies?: ValidationDependencies;
}
export interface PreflightReport {
  schemaVersion: 1;
  product: "SecondCrate";
  checkedAt: string;
  readOnly: true;
  region: string;
  credentials: { valid: boolean; errorCode?: string };
  channels: {
    emailConfigured: boolean;
    whatsappConfigured: boolean;
    smsConfigured: boolean;
    whatsappTemplateConfigured: boolean;
    liveSendsEnabled: boolean;
    inboundWorkspaceConfigured: boolean;
  };
  ses: {
    accountChecked: boolean;
    sandbox?: boolean;
    sendingEnabled?: boolean;
    errorCode?: string;
    sender: {
      configured: boolean;
      verified: boolean;
      identityType?: "email" | "domain";
      status?: string;
      errorCode?: string;
    };
  };
  bedrock: { configured: boolean; modelId?: string; invocationChecked: false };
}
export const SIMULATOR_DESTINATION = "success@simulator.amazonses.com";
export function safeErrorCode(error: unknown): string {
  const name = (error as { name?: unknown })?.name;
  return typeof name === "string" && /^[A-Za-z][A-Za-z0-9]{0,70}$/.test(name)
    ? name
    : "AwsRequestFailed";
}
export function publicModelId(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.includes("@") || /[\r\n]/.test(value))
    return "[redacted-invalid-model-id]";
  if (value.startsWith("arn:")) {
    const pieces = value.split(":");
    pieces[4] = "REDACTED";
    return pieces.join(":");
  }
  return value;
}
export function resolveRegion(options: ValidationOptions): string {
  const env = options.env ?? process.env;
  const region = options.region ?? env.AWS_REGION ?? env.AWS_DEFAULT_REGION;
  if (!region || !/^[a-z]{2}(?:-[a-z]+)+-\d+$/.test(region))
    throw Object.assign(
      new Error("Set AWS_REGION or pass --region with the deployment Region."),
      { name: "RegionRequired" },
    );
  return region;
}
async function checkSender(
  ses: Sender,
  address?: string,
): Promise<PreflightReport["ses"]["sender"]> {
  if (!address) return { configured: false, verified: false };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
    return {
      configured: true,
      verified: false,
      errorCode: "InvalidSenderConfiguration",
    };
  const identities = [address, address.split("@")[1]];
  const checks = await Promise.allSettled(
    identities.map((EmailIdentity) =>
      ses.send(new GetEmailIdentityCommand({ EmailIdentity })),
    ),
  );
  for (let index = 0; index < checks.length; index++) {
    const result = checks[index];
    if (
      result.status === "fulfilled" &&
      result.value.VerifiedForSendingStatus === true
    )
      return {
        configured: true,
        verified: true,
        identityType: index === 0 ? "email" : "domain",
        status: "VERIFIED",
      };
  }
  const failure = checks.find(
    (result) =>
      result.status === "rejected" &&
      safeErrorCode(result.reason) !== "NotFoundException",
  );
  return {
    configured: true,
    verified: false,
    status: "NOT_VERIFIED",
    ...(failure?.status === "rejected"
      ? { errorCode: safeErrorCode(failure.reason) }
      : {}),
  };
}
export async function runPreflight(
  options: ValidationOptions = {},
): Promise<PreflightReport> {
  const env = options.env ?? process.env,
    region = resolveRegion(options),
    dependencies = options.dependencies ?? {};
  const report: PreflightReport = {
    schemaVersion: 1,
    product: "SecondCrate",
    checkedAt: new Date().toISOString(),
    readOnly: true,
    region,
    credentials: { valid: false },
    channels: {
      emailConfigured: Boolean(env.SES_FROM_EMAIL),
      whatsappConfigured: Boolean(
        env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_META_API_VERSION,
      ),
      smsConfigured: Boolean(env.SMS_ORIGINATION_IDENTITY),
      whatsappTemplateConfigured: Boolean(
        env.WHATSAPP_OFFER_TEMPLATE && env.WHATSAPP_TEMPLATE_LANGUAGE,
      ),
      liveSendsEnabled: env.LIVE_SENDS_ENABLED === "true",
      inboundWorkspaceConfigured: Boolean(env.SINGLE_LIVE_WORKSPACE_ID),
    },
    ses: {
      accountChecked: false,
      sender: { configured: Boolean(env.SES_FROM_EMAIL), verified: false },
    },
    bedrock: {
      configured: Boolean(env.BEDROCK_MODEL_ID),
      modelId: publicModelId(env.BEDROCK_MODEL_ID),
      invocationChecked: false,
    },
  };
  const sts = dependencies.sts ?? new STSClient({ region, maxAttempts: 1 });
  try {
    await sts.send(new GetCallerIdentityCommand({}));
    report.credentials.valid = true;
  } catch (error) {
    report.credentials.errorCode = safeErrorCode(error);
    return report;
  }
  const ses = dependencies.ses ?? new SESv2Client({ region, maxAttempts: 1 });
  const [account, sender] = await Promise.allSettled([
    ses.send(new GetAccountCommand({})),
    checkSender(ses, env.SES_FROM_EMAIL),
  ]);
  if (account.status === "fulfilled") {
    report.ses.accountChecked = true;
    report.ses.sandbox = account.value.ProductionAccessEnabled !== true;
    report.ses.sendingEnabled = account.value.SendingEnabled === true;
  } else report.ses.errorCode = safeErrorCode(account.reason);
  if (sender.status === "fulfilled") report.ses.sender = sender.value;
  else report.ses.sender.errorCode = safeErrorCode(sender.reason);
  return report;
}
export interface VerificationOptions extends ValidationOptions {
  sendSimulator?: boolean;
  confirmSender?: boolean;
  invokeBedrock?: boolean;
}
export async function runVerification(options: VerificationOptions = {}) {
  const env = options.env ?? process.env;
  const sendSimulator =
    options.sendSimulator === true ||
    env.SECONDCRATE_VERIFY_SEND_SIMULATOR === "true";
  const confirmSender =
    options.confirmSender === true ||
    env.SECONDCRATE_VERIFY_CONFIRM_SENDER === "true";
  const invokeBedrock =
    options.invokeBedrock === true || env.SECONDCRATE_VERIFY_BEDROCK === "true";
  // Require explicit intent before any network work. There is deliberately no
  // recipient option; this utility cannot contact a buyer or arbitrary person.
  if (sendSimulator && !confirmSender)
    throw Object.assign(
      new Error("Sending requires --confirm-sender and --send-simulator."),
      { name: "SenderConfirmationRequired" },
    );
  const preflight = await runPreflight(options);
  const evidence: {
    schemaVersion: 1;
    product: string;
    startedAt: string;
    region: string;
    preflight: PreflightReport;
    ses: Record<string, unknown>;
    bedrock: Record<string, unknown>;
    ok: boolean;
    completedAt?: string;
  } = {
    schemaVersion: 1,
    product: "SecondCrate",
    startedAt: new Date().toISOString(),
    region: preflight.region,
    preflight,
    ses: { requested: sendSimulator, status: "not_run" },
    bedrock: { requested: invokeBedrock, status: "not_run" },
    ok: preflight.credentials.valid,
  };
  if (!preflight.credentials.valid) {
    evidence.ok = false;
    evidence.completedAt = new Date().toISOString();
    return evidence;
  }
  if (sendSimulator) {
    if (!preflight.ses.sender.verified || !preflight.ses.sendingEnabled) {
      evidence.ses = {
        requested: true,
        status: "blocked",
        errorCode: !preflight.ses.sender.verified
          ? "SenderNotVerified"
          : "SesSendingNotEnabled",
      };
      evidence.ok = false;
    } else {
      const adapter =
        options.dependencies?.messaging ??
        new AWSMessagingAdapter({
          region: preflight.region,
          sesFromEmail: env.SES_FROM_EMAIL,
          sesConfigurationSet: env.SES_CONFIGURATION_SET,
        });
      const started = Date.now();
      try {
        const result = await adapter.send({
          channel: "email",
          purpose: "confirmation",
          to: SIMULATOR_DESTINATION,
          subject: "SecondCrate controlled AWS verification",
          text: "Synthetic verification only. Eight crates of cherry tomatoes at GBP 17 per crate; total GBP 136. No real buyer, inventory, payment or delivery is involved.",
          idempotencyKey: `aws-verification:${randomUUID()}`,
        });
        evidence.ses = {
          requested: true,
          status: result.status,
          recipientClass: "AWS_SES_MAILBOX_SIMULATOR",
          providerId: result.providerId,
          durationMs: Date.now() - started,
          acceptanceOnly: true,
        };
        if (!["sent", "delivered"].includes(result.status)) {
          evidence.ok = false;
          evidence.ses.errorCode =
            result.status === "unknown"
              ? "ProviderOutcomeUnknownDoNotRetryAutomatically"
              : "ProviderRejected";
        }
      } catch (error) {
        evidence.ses = {
          requested: true,
          status: "error",
          errorCode: safeErrorCode(error),
        };
        evidence.ok = false;
      }
    }
  }
  if (invokeBedrock) {
    if (!env.BEDROCK_MODEL_ID) {
      evidence.bedrock = {
        requested: true,
        status: "blocked",
        errorCode: "ModelNotConfigured",
      };
      evidence.ok = false;
    } else {
      const started = Date.now();
      try {
        const adapter =
          options.dependencies?.reasoning ??
          new BedrockReasoningAdapter({
            region: preflight.region,
            modelId: env.BEDROCK_MODEL_ID,
          });
        const workspace = createWorkspace("Synthetic verification", true);
        const result = await adapter.decide({
          workspace,
          buyer: workspace.buyers[0],
          lot: workspace.lots[0],
          text: "I will take 8 crates at £17 each.",
        });
        const expected =
          result.decision.intent === "accept" &&
          result.decision.quantity === 8 &&
          result.decision.unitPrice === 17;
        evidence.bedrock = {
          requested: true,
          status: expected ? "passed" : "unexpected_decision",
          modelId: publicModelId(result.model),
          decision: {
            intent: result.decision.intent,
            quantity: result.decision.quantity,
            unitPrice: result.decision.unitPrice,
          },
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          durationMs: Date.now() - started,
          inputClass: "SYNTHETIC_NO_CUSTOMER_DATA",
        };
        if (!expected) evidence.ok = false;
      } catch (error) {
        evidence.bedrock = {
          requested: true,
          status: "error",
          errorCode: safeErrorCode(error),
        };
        evidence.ok = false;
      }
    }
  }
  evidence.completedAt = new Date().toISOString();
  return evidence;
}
export function parseArgs(args: string[], verify: boolean) {
  const options: {
    help?: boolean;
    region?: string;
    sendSimulator?: boolean;
    confirmSender?: boolean;
    invokeBedrock?: boolean;
  } = {};
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--region" && args[index + 1])
      options.region = args[++index];
    else if (verify && argument === "--send-simulator")
      options.sendSimulator = true;
    else if (verify && argument === "--confirm-sender")
      options.confirmSender = true;
    else if (verify && argument === "--bedrock") options.invokeBedrock = true;
    else
      throw Object.assign(
        new Error(
          "Unsupported argument. Use --help; arbitrary recipients are not supported.",
        ),
        { name: "UnsupportedArgument" },
      );
  }
  return options;
}
