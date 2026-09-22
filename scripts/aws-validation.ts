import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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
  accountPlan?: (region: string, env: Env) => Promise<unknown>;
}
export interface ValidationOptions {
  env?: Env;
  region?: string;
  dependencies?: ValidationDependencies;
  checkAccountPlan?: boolean;
}
export interface PreflightReport {
  schemaVersion: 1;
  product: "SecondCrate";
  checkedAt: string;
  readOnly: true;
  region: string;
  credentials: { valid: boolean; errorCode?: string };
  readiness: {
    status:
      | "credentials_invalid"
      | "activation_blocked"
      | "ses_accessible"
      | "ses_unavailable";
    deploymentServicesChecked: false;
    simulatorSendReady: boolean;
  };
  accountPlan?: {
    requested: true;
    checked: boolean;
    type?: "FREE" | "PAID";
    status?: "NOT_STARTED" | "ACTIVE" | "EXPIRED";
    remainingCredits?: { amount: number; unit: string };
    errorCode?: string;
  };
  diagnostics?: {
    code: string;
    summary: string;
    nextSteps: string[];
  }[];
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
const execFileAsync = promisify(execFile);
const SUBSCRIPTION_ERRORS = new Set([
  "SubscriptionRequiredException",
  "SubscriptionRequired",
  "OptInRequired",
]);

/** Optional CLI read keeps Free Tier diagnostics out of the application bundle
 * and avoids adding an SDK dependency used only for account troubleshooting. */
async function readAccountPlan(region: string, env: Env): Promise<unknown> {
  try {
    const { stdout } = await execFileAsync(
      "aws",
      [
        "freetier",
        "get-account-plan-state",
        "--region",
        region,
        "--output",
        "json",
        "--no-cli-pager",
        "--cli-connect-timeout",
        "5",
        "--cli-read-timeout",
        "10",
      ],
      {
        env: {
          ...process.env,
          ...env,
          AWS_REGION: region,
          AWS_DEFAULT_REGION: region,
        },
        timeout: 15_000,
        maxBuffer: 65_536,
        encoding: "utf8",
        windowsHide: true,
      },
    );
    return JSON.parse(stdout);
  } catch (error) {
    const failure = error as {
      code?: string;
      killed?: boolean;
      stderr?: string;
    };
    const code =
      failure.code === "ENOENT"
        ? "AwsCliUnavailable"
        : failure.killed
          ? "AccountPlanCheckTimedOut"
          : (failure.stderr?.match(/\(([A-Za-z][A-Za-z0-9]{0,70})\)/)?.[1] ??
            "AccountPlanCheckFailed");
    // Raw CLI output may contain account or credential details. Never return it.
    throw Object.assign(new Error("Optional account plan check unavailable."), {
      name: code,
    });
  }
}

function sanitizedAccountPlan(
  value: unknown,
): NonNullable<PreflightReport["accountPlan"]> {
  const data = value as Record<string, unknown> | null;
  if (
    !data ||
    !["FREE", "PAID"].includes(String(data.accountPlanType)) ||
    !["NOT_STARTED", "ACTIVE", "EXPIRED"].includes(
      String(data.accountPlanStatus),
    )
  )
    throw Object.assign(new Error("Unexpected account plan response."), {
      name: "InvalidAccountPlanResponse",
    });
  const credits = data.accountPlanRemainingCredits as
    { amount?: unknown; unit?: unknown } | undefined;
  return {
    requested: true,
    checked: true,
    type: data.accountPlanType as "FREE" | "PAID",
    status: data.accountPlanStatus as "NOT_STARTED" | "ACTIVE" | "EXPIRED",
    ...(typeof credits?.amount === "number" &&
    Number.isFinite(credits.amount) &&
    credits.amount >= 0 &&
    typeof credits.unit === "string" &&
    /^[A-Z]{3}$/.test(credits.unit)
      ? { remainingCredits: { amount: credits.amount, unit: credits.unit } }
      : {}),
  };
}

function addActivationDiagnostics(report: PreflightReport) {
  const blocked = [report.ses.errorCode, report.ses.sender.errorCode].some(
    (code) => code && SUBSCRIPTION_ERRORS.has(code),
  );
  report.readiness.status = blocked
    ? "activation_blocked"
    : report.ses.accountChecked
      ? "ses_accessible"
      : "ses_unavailable";
  report.readiness.simulatorSendReady =
    report.ses.sendingEnabled === true && report.ses.sender.verified;
  const diagnostics: NonNullable<PreflightReport["diagnostics"]> = [];
  if (blocked)
    diagnostics.push({
      code: "AWS_ACTIVATION_PENDING",
      summary:
        "Authentication succeeded, but SES rejects access because the account lacks a service subscription. This is not a sender-verification result or proof that a Paid plan is required.",
      nextSteps: [
        "Keep the chosen Free plan. Check any remaining Complete your AWS registration step and payment/customer verification status in the AWS console.",
        "If verification was just completed, allow AWS activation to finish. If the console loops or the restriction persists, ask AWS account support to diagnose service enrollment.",
        "Before deployment, confirm CloudFormation, Lambda and DynamoDB access separately; this preflight does not check those services.",
      ],
    });
  if (
    report.accountPlan?.type === "FREE" &&
    report.accountPlan.status === "NOT_STARTED"
  )
    diagnostics.push({
      code: "FREE_PLAN_NOT_STARTED",
      summary:
        "AWS reports FREE / NOT_STARTED. Valid sign-in credentials do not establish completed service activation.",
      nextSteps: [
        "Review signup completion and verification status without upgrading the plan. The exact outstanding step is not exposed by GetAccountPlanState.",
        "Do not use UpgradeAccountPlan as an activation repair. Joining AWS Partner Network or AWS Organizations can automatically upgrade a Free account.",
      ],
    });
  if (report.accountPlan?.errorCode)
    diagnostics.push({
      code: "ACCOUNT_PLAN_CHECK_UNAVAILABLE",
      summary:
        "The optional Free Tier plan read was unavailable. It does not change the observed STS or SES results or the credential-based exit code.",
      nextSteps: [
        "Check AWS CLI availability and freetier:GetAccountPlanState permission if plan diagnostics are needed. Do not infer that working services are blocked from this optional read failure.",
      ],
    });
  if (diagnostics.length) report.diagnostics = diagnostics;
}
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
  const checkAccountPlan =
    options.checkAccountPlan === true ||
    env.SECONDCRATE_PREFLIGHT_ACCOUNT_PLAN === "true";
  const report: PreflightReport = {
    schemaVersion: 1,
    product: "SecondCrate",
    checkedAt: new Date().toISOString(),
    readOnly: true,
    region,
    credentials: { valid: false },
    readiness: {
      status: "credentials_invalid",
      deploymentServicesChecked: false,
      simulatorSendReady: false,
    },
    ...(checkAccountPlan
      ? { accountPlan: { requested: true as const, checked: false } }
      : {}),
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
  const [account, sender, plan] = await Promise.allSettled([
    ses.send(new GetAccountCommand({})),
    checkSender(ses, env.SES_FROM_EMAIL),
    checkAccountPlan
      ? (dependencies.accountPlan ?? readAccountPlan)(region, env).then(
          sanitizedAccountPlan,
        )
      : Promise.resolve(undefined),
  ]);
  if (account.status === "fulfilled") {
    report.ses.accountChecked = true;
    report.ses.sandbox = account.value.ProductionAccessEnabled !== true;
    report.ses.sendingEnabled = account.value.SendingEnabled === true;
  } else report.ses.errorCode = safeErrorCode(account.reason);
  if (sender.status === "fulfilled") report.ses.sender = sender.value;
  else report.ses.sender.errorCode = safeErrorCode(sender.reason);
  if (checkAccountPlan) {
    if (plan.status === "fulfilled") report.accountPlan = plan.value;
    else report.accountPlan!.errorCode = safeErrorCode(plan.reason);
  }
  addActivationDiagnostics(report);
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
    checkAccountPlan?: boolean;
  } = {};
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--region" && args[index + 1])
      options.region = args[++index];
    else if (!verify && argument === "--account-plan")
      options.checkAccountPlan = true;
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
