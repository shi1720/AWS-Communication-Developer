import { describe, expect, it } from "vitest";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import {
  DynamoWorkspaceStore,
  MAX_WORKSPACE_BYTES,
  SNAPSHOT_CHUNK_BYTES,
} from "../src/server/adapters/store.js";
import { ConflictError } from "../src/server/errors.js";
import { createWorkspace } from "../src/server/seed.js";

function fakeDynamo() {
  const items = new Map<string, any>();
  const transactions: any[] = [];
  let beforeTransaction: (() => void) | undefined;
  let afterHeadRead: (() => Promise<void>) | undefined;
  const key = (item: any) => `${item.pk}|${item.sk}`;
  const client = {
    async send(command: any): Promise<any> {
      if (command instanceof GetCommand) {
        const Item = structuredClone(items.get(key(command.input.Key)));
        if (command.input.Key?.sk === "STATE" && afterHeadRead) {
          const callback = afterHeadRead;
          afterHeadRead = undefined;
          await callback();
        }
        return { Item };
      }
      if (!(command instanceof TransactWriteCommand))
        throw new Error("Unexpected command");
      beforeTransaction?.();
      beforeTransaction = undefined;
      const actions = command.input.TransactItems!;
      transactions.push(actions);
      for (const action of actions) {
        const operation = action.Put ?? action.Update!;
        const current = items.get(key(action.Put?.Item ?? action.Update?.Key));
        const expression = operation.ConditionExpression;
        if (
          (expression === "attribute_not_exists(pk)" && current) ||
          (expression === "attribute_exists(pk)" && !current) ||
          (expression === "#version = :expected" &&
            current?.version !==
              operation.ExpressionAttributeValues?.[":expected"])
        ) {
          throw Object.assign(new Error("Conditional race"), {
            name: "TransactionCanceledException",
            CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
          });
        }
      }
      for (const action of actions) {
        if (action.Put)
          items.set(key(action.Put.Item), structuredClone(action.Put.Item));
        if (action.Update)
          items.get(key(action.Update.Key)).expiresAt =
            action.Update.ExpressionAttributeValues?.[":expiresAt"];
      }
      return {};
    },
  };
  return {
    items,
    transactions,
    client,
    race: (fn: () => void) => {
      beforeTransaction = fn;
    },
    onHead: (fn: () => Promise<void>) => {
      afterHeadRead = fn;
    },
  };
}
describe("DynamoDB immutable aggregate snapshots", () => {
  it("round-trips a >400KB UTF-8 workspace across bounded binary chunks", async () => {
    const db = fakeDynamo(),
      store = new DynamoWorkspaceStore({
        region: "eu-west-2",
        tableName: "state",
        client: db.client,
      });
    const state = createWorkspace("Test", false, "large");
    state.processedEvents = ["🍅".repeat(150000)];
    await store.create(state);
    const chunks = [...db.items.values()].filter((item) => item.payload);
    expect(chunks.length).toBeGreaterThan(3);
    expect(
      chunks.every((item) => item.payload.byteLength <= SNAPSHOT_CHUNK_BYTES),
    ).toBe(true);
    expect(chunks.every((item) => item.expiresAt === undefined)).toBe(true);
    expect(await store.get("large")).toEqual(state);
  });
  it("retains coherent reader generation during a concurrent manifest switch", async () => {
    const db = fakeDynamo(),
      store = new DynamoWorkspaceStore({
        region: "eu-west-2",
        tableName: "state",
        client: db.client,
      });
    const old = createWorkspace("Test", false, "race");
    await store.create(old);
    const next = { ...old, version: 1, processedEvents: ["new-generation"] };
    db.onHead(() => store.save(next, 0));
    expect(await store.get("race")).toEqual(old);
    expect(await store.get("race")).toEqual(next);
    const chunks = [...db.items.values()].filter((item) => item.payload);
    expect(chunks.filter((item) => item.expiresAt).length).toBe(1);
    expect(chunks.filter((item) => !item.expiresAt).length).toBe(1);
    expect(chunks.find((item) => item.expiresAt).expiresAt).toBeGreaterThan(
      Date.now() / 1000 + 6 * 86400,
    );
  });
  it("failed CAS creates no partial chunks and never expires current data", async () => {
    const db = fakeDynamo(),
      store = new DynamoWorkspaceStore({
        region: "eu-west-2",
        tableName: "state",
        client: db.client,
      });
    const state = createWorkspace("Test", false, "race");
    await store.create(state);
    const before = db.items.size;
    db.race(() => {
      db.items.get("WORKSPACE#race|STATE").version = 2;
    });
    await expect(
      store.save({ ...state, version: 1 }, 0),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(db.items.size).toBe(before);
    expect(
      [...db.items.values()].every((item) => item.expiresAt === undefined),
    ).toBe(true);
  });
  it("migrates legacy inline records and expires both demo manifest and chunks", async () => {
    const db = fakeDynamo(),
      store = new DynamoWorkspaceStore({
        region: "eu-west-2",
        tableName: "state",
        client: db.client,
      });
    const state = createWorkspace("Test", true, "legacy");
    db.items.set("WORKSPACE#legacy|STATE", {
      pk: "WORKSPACE#legacy",
      sk: "STATE",
      version: 0,
      workspace: state,
    });
    expect(await store.get("legacy")).toEqual(state);
    await store.save({ ...state, version: 1 }, 0);
    expect(db.items.get("WORKSPACE#legacy|STATE").workspace).toBeUndefined();
    expect(
      [...db.items.values()].every(
        (item) => item.expiresAt > Date.now() / 1000,
      ),
    ).toBe(true);
    expect((await store.get("legacy"))?.version).toBe(1);
  });
  it("keeps old plus new snapshots below transaction item and payload limits", async () => {
    const db = fakeDynamo(),
      store = new DynamoWorkspaceStore({
        region: "eu-west-2",
        tableName: "state",
        client: db.client,
      });
    const state = createWorkspace("Test", false, "large");
    state.processedEvents = ["x".repeat(MAX_WORKSPACE_BYTES - 1000)];
    await store.create(state);
    await store.save({ ...state, version: 1 }, 0);
    const actions = db.transactions.at(-1)!;
    expect(actions.length).toBeLessThanOrEqual(23);
    const payloadBytes = actions.reduce(
      (sum: number, action: any) =>
        sum +
        (action.Put?.Item.payload?.byteLength ??
          (action.Update
            ? db.items.get(`${action.Update.Key.pk}|${action.Update.Key.sk}`)
                .payload.byteLength
            : 0)),
      0,
    );
    expect(payloadBytes + 20000).toBeLessThan(4 * 1024 * 1024);
    expect((await store.get("large"))?.version).toBe(1);
  });
  it("detects corrupted snapshot bytes instead of reading partial state", async () => {
    const db = fakeDynamo(),
      store = new DynamoWorkspaceStore({
        region: "eu-west-2",
        tableName: "state",
        client: db.client,
      });
    await store.create(createWorkspace("Test", false, "integrity"));
    const chunk = [...db.items.values()].find((item) => item.payload);
    chunk.payload[0] = 0;
    await expect(store.get("integrity")).rejects.toThrow("integrity check");
  });
});
