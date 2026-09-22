import { createHash } from "node:crypto";
import {
  Firestore,
  Timestamp,
  type Transaction,
} from "@google-cloud/firestore";
import type { Workspace, WorkspaceStore } from "../../shared/types.js";
import type { AuthData, AuthStore } from "../auth.js";
import { ConflictError } from "../errors.js";
import { MAX_WORKSPACE_BYTES, WorkspaceCapacityError } from "./store.js";

const CHUNK_BYTES = 500_000;
const DEMO_RETENTION_MS = 7 * 24 * 3600 * 1000;
type Manifest = {
  version: number;
  chunks: number;
  bytes: number;
  hash: string;
  expiresAt?: Timestamp;
};

/** Firebase preview persistence. Every read/write spans the manifest and its
 * bounded chunks in one transaction, preserving stock CAS across Cloud Run instances. */
export class FirestoreWorkspaceStore implements WorkspaceStore {
  constructor(private db: Firestore) {}
  private head(id: string) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      throw new Error("Invalid storage identifier");
    return this.db.collection("workspaces").doc(id);
  }
  private chunks(id: string, count: number) {
    return Array.from({ length: count }, (_, i) =>
      this.head(id).collection("chunks").doc(String(i)),
    );
  }
  async get(id: string): Promise<Workspace | undefined> {
    return this.db.runTransaction(
      async (tx) => {
        const snapshot = await tx.get(this.head(id));
        const head = snapshot.data() as Manifest | undefined;
        if (
          !head ||
          (head.expiresAt && head.expiresAt.toMillis() <= Date.now())
        )
          return undefined;
        if (
          !Number.isInteger(head.chunks) ||
          head.chunks < 1 ||
          head.chunks > Math.ceil(MAX_WORKSPACE_BYTES / CHUNK_BYTES)
        )
          throw new Error("Workspace snapshot manifest is invalid.");
        const pieces = await tx.getAll(...this.chunks(id, head.chunks));
        const payload = Buffer.concat(
          pieces.map((piece) => {
            const data = piece.data()?.payload;
            if (!(data instanceof Uint8Array))
              throw new Error("Workspace snapshot is incomplete.");
            return Buffer.from(data);
          }),
        );
        if (
          payload.length !== head.bytes ||
          createHash("sha256").update(payload).digest("hex") !== head.hash
        )
          throw new Error("Workspace snapshot integrity check failed.");
        const workspace = JSON.parse(payload.toString("utf8")) as Workspace;
        if (workspace.id !== id || workspace.version !== head.version)
          throw new Error("Workspace snapshot version mismatch.");
        return workspace;
      },
      { readOnly: true },
    );
  }
  private async write(workspace: Workspace, expectedVersion?: number) {
    const payload = Buffer.from(JSON.stringify(workspace), "utf8");
    if (payload.length > MAX_WORKSPACE_BYTES)
      throw new WorkspaceCapacityError();
    await this.db.runTransaction(async (tx) => {
      const ref = this.head(workspace.id);
      const current = (await tx.get(ref)).data() as Manifest | undefined;
      if (
        expectedVersion === undefined
          ? Boolean(current)
          : current?.version !== expectedVersion
      )
        throw new ConflictError();
      const count = Math.ceil(payload.length / CHUNK_BYTES);
      const expiry =
        workspace.settings.mode === "demo"
          ? { expiresAt: Timestamp.fromMillis(Date.now() + DEMO_RETENTION_MS) }
          : {};
      this.chunks(workspace.id, count).forEach((chunk, i) =>
        tx.set(chunk, {
          payload: payload.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES),
          ...expiry,
        }),
      );
      for (const old of this.chunks(workspace.id, current?.chunks || 0).slice(
        count,
      ))
        tx.delete(old);
      tx.set(ref, {
        version: workspace.version,
        chunks: count,
        bytes: payload.length,
        hash: createHash("sha256").update(payload).digest("hex"),
        ...expiry,
      });
    });
  }
  async create(workspace: Workspace) {
    await this.write(workspace);
  }
  async save(workspace: Workspace, expectedVersion: number) {
    if (workspace.version !== expectedVersion + 1)
      throw new Error(
        "Workspace version must increment exactly once per write.",
      );
    await this.write(workspace, expectedVersion);
  }
}

/** Opaque hashed keys and transactional mutation keep sessions, one-use tokens
 * and rate limits consistent when more than one container serves requests. */
export class FirestoreAuthStore implements AuthStore {
  constructor(private db: Firestore) {}
  private ref(key: string) {
    return this.db
      .collection("auth")
      .doc(createHash("sha256").update(key).digest("hex"));
  }
  private decode(
    data: FirebaseFirestore.DocumentData | undefined,
  ): AuthData | undefined {
    return data?.payload ? (JSON.parse(data.payload) as AuthData) : undefined;
  }
  private active(value: AuthData | undefined) {
    return value && (!value.expires || value.expires > Date.now())
      ? value
      : undefined;
  }
  private set(tx: Transaction, key: string, value: AuthData) {
    tx.set(this.ref(key), {
      payload: JSON.stringify(value),
      ...(value.expires
        ? { expiresAt: Timestamp.fromMillis(value.expires) }
        : {}),
    });
  }
  async get(key: string) {
    return this.active(this.decode((await this.ref(key).get()).data()));
  }
  async put(key: string, value: AuthData, onlyNew = false) {
    await this.db.runTransaction(async (tx) => {
      const existing = this.decode((await tx.get(this.ref(key))).data());
      if (onlyNew && this.active(existing))
        throw new ConflictError("An account already exists for this email.");
      this.set(tx, key, value);
    });
  }
  async update(key: string, mutate: (value: AuthData | undefined) => AuthData) {
    await this.db.runTransaction(async (tx) => {
      const value = this.active(
        this.decode((await tx.get(this.ref(key))).data()),
      );
      this.set(tx, key, mutate(value));
    });
  }
  async delete(key: string) {
    await this.ref(key).delete();
  }
  async consume(key: string) {
    return this.db.runTransaction(async (tx) => {
      const value = this.active(
        this.decode((await tx.get(this.ref(key))).data()),
      );
      tx.delete(this.ref(key));
      return value;
    });
  }
  async increment(key: string, expires: number) {
    return this.db.runTransaction(async (tx) => {
      const value = this.active(
        this.decode((await tx.get(this.ref(key))).data()),
      );
      const count = Number(value?.count || 0) + 1;
      this.set(tx, key, { count, expires });
      return count;
    });
  }
}

export function createFirestoreStores(
  projectId: string,
  databaseId = "(default)",
) {
  const db = new Firestore({
    projectId,
    databaseId,
    ignoreUndefinedProperties: true,
  });
  return {
    store: new FirestoreWorkspaceStore(db),
    authStore: new FirestoreAuthStore(db),
  };
}
