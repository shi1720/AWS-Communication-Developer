import { describe, expect, it, vi } from "vitest";
import {
  GetAccountCommand,
  GetEmailIdentityCommand,
} from "@aws-sdk/client-sesv2";
import {
  parseArgs,
  runPreflight,
  runVerification,
  SIMULATOR_DESTINATION,
} from "../scripts/aws-validation.js";
const env = {
  AWS_REGION: "eu-west-2",
  SES_FROM_EMAIL: "private-operator@example.com",
  BEDROCK_MODEL_ID: "test-model",
};
function dependencies() {
  const sts = {
    send: vi
      .fn()
      .mockResolvedValue({
        Account: "123456789012",
        Arn: "arn:aws:iam::123456789012:root",
      }),
  };
  const ses = {
    send: vi.fn(async (command) => {
      if (command instanceof GetAccountCommand)
        return { ProductionAccessEnabled: false, SendingEnabled: true };
      if (command instanceof GetEmailIdentityCommand)
        return {
          VerifiedForSendingStatus:
            command.input.EmailIdentity === "example.com",
        };
      throw new Error("Unexpected command");
    }),
  };
  const messaging = {
    send: vi
      .fn()
      .mockResolvedValue({ status: "sent", providerId: "provider-test-id" }),
  };
  const reasoning = {
    decide: vi
      .fn()
      .mockResolvedValue({
        decision: { intent: "accept", quantity: 8, unitPrice: 17 },
        model: "test-model",
        inputTokens: 400,
        outputTokens: 25,
      }),
  };
  return { sts, ses, messaging, reasoning };
}
describe("AWS preflight and explicit verification CLI", () => {
  it("reports a verified domain fallback and sandbox without printing sender or principal PII", async () => {
    const mocks = dependencies();
    const report = await runPreflight({ env, dependencies: mocks });
    expect(report.credentials.valid).toBe(true);
    expect(report.ses).toMatchObject({
      sandbox: true,
      sendingEnabled: true,
      sender: { verified: true, identityType: "domain" },
    });
    const output = JSON.stringify(report);
    expect(output).not.toContain(env.SES_FROM_EMAIL);
    expect(output).not.toContain("example.com");
    expect(output).not.toContain("123456789012");
    expect(mocks.messaging.send).not.toHaveBeenCalled();
    expect(mocks.reasoning.decide).not.toHaveBeenCalled();
  });
  it("stops on credential failure without exposing SDK messages or trying downstream APIs", async () => {
    const mocks = dependencies();
    mocks.sts.send.mockRejectedValue(
      Object.assign(new Error("secret-key private-operator@example.com"), {
        name: "ExpiredTokenException",
      }),
    );
    const result = await runPreflight({ env, dependencies: mocks });
    expect(result.credentials).toEqual({
      valid: false,
      errorCode: "ExpiredTokenException",
    });
    expect(JSON.stringify(result)).not.toContain("secret-key");
    expect(mocks.ses.send).not.toHaveBeenCalled();
  });
  it("requires explicit sender confirmation before any network access", async () => {
    const mocks = dependencies();
    await expect(
      runVerification({ env, dependencies: mocks, sendSimulator: true }),
    ).rejects.toMatchObject({ name: "SenderConfirmationRequired" });
    expect(mocks.sts.send).not.toHaveBeenCalled();
    expect(mocks.messaging.send).not.toHaveBeenCalled();
  });
  it("supports read-only defaults and rejects arbitrary recipient options", async () => {
    const mocks = dependencies();
    const result = await runVerification({ env, dependencies: mocks });
    expect(result.ses.status).toBe("not_run");
    expect(result.bedrock.status).toBe("not_run");
    expect(mocks.messaging.send).not.toHaveBeenCalled();
    expect(mocks.reasoning.decide).not.toHaveBeenCalled();
    expect(() => parseArgs(["--to", "person@example.com"], true)).toThrow();
  });
  it("sends only to the fixed simulator and validates a real-adapter-compatible synthetic decision", async () => {
    const mocks = dependencies();
    const result = await runVerification({
      env,
      dependencies: mocks,
      sendSimulator: true,
      confirmSender: true,
      invokeBedrock: true,
    });
    expect(mocks.messaging.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: SIMULATOR_DESTINATION,
        channel: "email",
        purpose: "confirmation",
      }),
    );
    expect(mocks.messaging.send).toHaveBeenCalledTimes(1);
    expect(result.ses).toMatchObject({
      status: "sent",
      providerId: "provider-test-id",
      acceptanceOnly: true,
    });
    expect(result.bedrock).toMatchObject({
      status: "passed",
      inputTokens: 400,
      outputTokens: 25,
      decision: { intent: "accept", quantity: 8, unitPrice: 17 },
    });
    expect(JSON.stringify(result)).not.toContain(env.SES_FROM_EMAIL);
  });
  it("blocks unverified sender and disabled account before the provider send", async () => {
    const mocks = dependencies();
    mocks.ses.send.mockResolvedValue({
      VerifiedForSendingStatus: false,
      SendingEnabled: false,
    } as any);
    const result = await runVerification({
      env,
      dependencies: mocks,
      sendSimulator: true,
      confirmSender: true,
    });
    expect(result.ok).toBe(false);
    expect(result.ses.status).toBe("blocked");
    expect(mocks.messaging.send).not.toHaveBeenCalled();
  });
  it("does not retry an unknown send and records model failures without provider text", async () => {
    const mocks = dependencies();
    mocks.messaging.send.mockResolvedValue({ status: "unknown" } as any);
    mocks.reasoning.decide.mockRejectedValue(
      Object.assign(new Error("private@example.com denied"), {
        name: "AccessDeniedException",
      }),
    );
    const result = await runVerification({
      env,
      dependencies: mocks,
      sendSimulator: true,
      confirmSender: true,
      invokeBedrock: true,
    });
    expect(result.ok).toBe(false);
    expect(mocks.messaging.send).toHaveBeenCalledTimes(1);
    expect(result.ses.errorCode).toBe(
      "ProviderOutcomeUnknownDoNotRetryAutomatically",
    );
    expect(result.bedrock.errorCode).toBe("AccessDeniedException");
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });
  it("treats a syntactically valid but incorrect model interpretation as failed verification", async () => {
    const mocks = dependencies();
    mocks.reasoning.decide.mockResolvedValue({
      decision: { intent: "accept", quantity: 80, unitPrice: 17 },
      model: "test-model",
    } as any);
    const result = await runVerification({
      env,
      dependencies: mocks,
      invokeBedrock: true,
    });
    expect(result.bedrock.status).toBe("unexpected_decision");
    expect(result.ok).toBe(false);
  });
});
