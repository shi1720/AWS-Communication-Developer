import { describe, expect, it } from "vitest";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoAuthStore } from "../src/server/auth.js";

describe("DynamoDB account mutations", () => {
  it("retries conflicting account writes without reviving an earlier password or session version", async () => {
    let item: any = {
      pk: "AUTH#user:operator@example.com",
      sk: "AUTH",
      revision: 0,
      data: {
        record: { verified: false, authVersion: 0, passwordHash: "old" },
      },
    };
    let conflicts = 0;
    const client = {
      async send(command: any) {
        if (command instanceof GetCommand)
          return { Item: structuredClone(item) };
        if (!(command instanceof PutCommand))
          throw new Error("Unexpected command");
        const revision = command.input.ExpressionAttributeValues?.[":revision"];
        if (item.revision !== revision) {
          conflicts++;
          throw Object.assign(new Error("Concurrent account update"), {
            name: "ConditionalCheckFailedException",
          });
        }
        item = structuredClone(command.input.Item);
        return {};
      },
    };
    const store = new DynamoAuthStore("state", "eu-west-2", client as any);
    await Promise.all([
      store.update("user:operator@example.com", (old) => ({
        ...old,
        record: { ...(old!.record as any), verified: true },
      })),
      store.update("user:operator@example.com", (old) => ({
        ...old,
        record: {
          ...(old!.record as any),
          passwordHash: "reset-one",
          authVersion: (old!.record as any).authVersion + 1,
        },
      })),
      store.update("user:operator@example.com", (old) => ({
        ...old,
        record: {
          ...(old!.record as any),
          passwordHash: "reset-two",
          authVersion: (old!.record as any).authVersion + 1,
        },
      })),
    ]);
    expect(conflicts).toBeGreaterThan(0);
    expect(item.data.record).toEqual({
      verified: true,
      authVersion: 2,
      passwordHash: "reset-two",
    });
    expect(item.revision).toBe(3);
  });
});
