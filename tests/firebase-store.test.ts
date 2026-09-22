import { describe, expect, it } from "vitest";
import { Firestore, Timestamp } from "@google-cloud/firestore";
import {
  FirestoreAuthStore,
  FirestoreWorkspaceStore,
} from "../src/server/adapters/firestore.js";
import { createWorkspace } from "../src/server/seed.js";
import { ConflictError } from "../src/server/errors.js";

function fakeFirestore() {
  const records = new Map<string, any>();
  let pending: Promise<unknown> = Promise.resolve();
  const doc = (path: string): any => ({
    path,
    collection: (name: string) => collection(`${path}/${name}`),
    get: async () => ({ data: () => records.get(path) }),
    delete: async () => {
      records.delete(path);
    },
  });
  const collection = (path: string): any => ({
    doc: (id: string) => doc(`${path}/${id}`),
  });
  const db = {
    collection,
    runTransaction: async (
      fn: (tx: any) => Promise<any>,
      options?: { readOnly?: boolean },
    ) => {
      const run = pending
        .catch(() => {})
        .then(async () => {
          const staged = new Map(records);
          const tx = {
            get: async (ref: any) => ({ data: () => staged.get(ref.path) }),
            getAll: async (...refs: any[]) =>
              refs.map((ref) => ({ data: () => staged.get(ref.path) })),
            set: (ref: any, data: any) => {
              if (options?.readOnly)
                throw new Error("Read-only transaction wrote data");
              staged.set(ref.path, data);
            },
            delete: (ref: any) => {
              if (options?.readOnly)
                throw new Error("Read-only transaction deleted data");
              staged.delete(ref.path);
            },
          };
          const value = await fn(tx);
          records.clear();
          for (const [key, data] of staged) records.set(key, data);
          return value;
        });
      pending = run;
      return run;
    },
  } as unknown as Firestore;
  return { db, records };
}

describe("Firestore hosted preview persistence", () => {
  it("round-trips a workspace larger than a Firestore document with UTF-8 integrity", async () => {
    const { db, records } = fakeFirestore();
    const store = new FirestoreWorkspaceStore(db);
    const workspace = createWorkspace("Depot", true, "large");
    workspace.processedEvents = ["🍅".repeat(300_000)];
    await store.create(workspace);
    expect(records.size).toBe(4);
    expect(await store.get("large")).toEqual(workspace);
    expect(
      [...records.values()].every(
        (value) => value.expiresAt instanceof Timestamp,
      ),
    ).toBe(true);
  });
  it("allows only one concurrent version claim and leaves no partial writes", async () => {
    const { db, records } = fakeFirestore();
    const store = new FirestoreWorkspaceStore(db);
    const workspace = createWorkspace("Depot", false, "race");
    await store.create(workspace);
    const claims = await Promise.allSettled([
      store.save({ ...workspace, version: 1, processedEvents: ["first"] }, 0),
      store.save({ ...workspace, version: 1, processedEvents: ["second"] }, 0),
    ]);
    expect(claims.filter((claim) => claim.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(
      (
        claims.find(
          (claim) => claim.status === "rejected",
        ) as PromiseRejectedResult
      ).reason,
    ).toBeInstanceOf(ConflictError);
    expect(records.size).toBe(2);
    expect((await store.get("race"))?.version).toBe(1);
    expect([...records.values()].every((value) => !value.expiresAt)).toBe(true);
  });
  it("rejects duplicate creates, invalid version jumps and oversized state", async () => {
    const { db } = fakeFirestore();
    const store = new FirestoreWorkspaceStore(db);
    const workspace = createWorkspace("Depot", true, "bounds");
    await store.create(workspace);
    await expect(store.create(workspace)).rejects.toBeInstanceOf(ConflictError);
    await expect(store.save({ ...workspace, version: 2 }, 0)).rejects.toThrow(
      "increment exactly once",
    );
    await expect(
      store.save(
        { ...workspace, version: 1, processedEvents: ["x".repeat(2_000_000)] },
        0,
      ),
    ).rejects.toThrow("capacity");
    expect((await store.get("bounds"))?.version).toBe(0);
  });
  it("removes stale chunks when state shrinks and detects corrupted bytes", async () => {
    const { db, records } = fakeFirestore();
    const store = new FirestoreWorkspaceStore(db);
    const workspace = createWorkspace("Depot", true, "integrity");
    workspace.processedEvents = ["x".repeat(1_100_000)];
    await store.create(workspace);
    await store.save({ ...workspace, version: 1, processedEvents: [] }, 0);
    expect(records.size).toBe(2);
    records.get("workspaces/integrity/chunks/0").payload[0] = 0;
    await expect(store.get("integrity")).rejects.toThrow("integrity check");
  });
  it("does not serve an expired demo while asynchronous TTL cleanup is pending", async () => {
    const { db, records } = fakeFirestore();
    const store = new FirestoreWorkspaceStore(db);
    await store.create(createWorkspace("Depot", true, "expired"));
    records.get("workspaces/expired").expiresAt = Timestamp.fromMillis(
      Date.now() - 1,
    );
    expect(await store.get("expired")).toBeUndefined();
  });
  it("consumes verification/reset tokens only once under concurrency", async () => {
    const { db, records } = fakeFirestore();
    const store = new FirestoreAuthStore(db);
    await store.put("reset:private-token", {
      userId: "user",
      expires: Date.now() + 60000,
    });
    expect([...records.keys()][0]).not.toContain("private-token");
    const results = await Promise.all([
      store.consume("reset:private-token"),
      store.consume("reset:private-token"),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await store.get("reset:private-token")).toBeUndefined();
  });
  it("serializes concurrent rate limits and resets an expired counter", async () => {
    const { db } = fakeFirestore();
    const store = new FirestoreAuthStore(db);
    const expiry = Date.now() + 60000;
    expect(
      (
        await Promise.all(
          Array.from({ length: 8 }, () => store.increment("rate", expiry)),
        )
      ).sort(),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    await store.put("rate", { count: 8, expires: Date.now() - 1 });
    expect(await store.increment("rate", expiry)).toBe(1);
  });
  it("uses atomic account creation and updates without exposing expired records", async () => {
    const { db } = fakeFirestore();
    const store = new FirestoreAuthStore(db);
    await store.put("account", { revision: 0 }, true);
    await expect(
      store.put("account", { revision: 0 }, true),
    ).rejects.toBeInstanceOf(ConflictError);
    await Promise.all(
      Array.from({ length: 3 }, () =>
        store.update("account", (current) => ({
          revision: Number(current?.revision || 0) + 1,
        })),
      ),
    );
    expect(await store.get("account")).toEqual({ revision: 3 });
    await store.put("expired", { expires: Date.now() - 1 });
    expect(await store.get("expired")).toBeUndefined();
    await store.put("expired", { revived: true }, true);
    expect(await store.get("expired")).toEqual({ revived: true });
  });
});
