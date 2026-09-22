import {
  createHash,
  randomBytes,
  scrypt as rawScrypt,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { SessionUser, WorkspaceStore } from "../shared/types.js";
import { createWorkspace, uid } from "./seed.js";
import { AppError, ConflictError } from "./errors.js";
const derive = (password: string, salt: string, legacy = false) =>
  new Promise<Buffer>((resolve, reject) =>
    rawScrypt(
      password,
      salt,
      64,
      {
        N: legacy ? 16384 : 32768,
        r: 8,
        p: legacy ? 1 : 3,
        maxmem: 64 * 1024 * 1024,
      },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
const dummyHash = `scrypt-v1:00000000000000000000000000000000:${"0".repeat(128)}`;
export type AuthData = { expires?: number; [key: string]: unknown };
export interface AuthStore {
  get(key: string): Promise<AuthData | undefined>;
  put(key: string, value: AuthData, onlyNew?: boolean): Promise<void>;
  update(
    key: string,
    mutate: (value: AuthData | undefined) => AuthData,
  ): Promise<void>;
  delete(key: string): Promise<void>;
  consume(key: string): Promise<AuthData | undefined>;
  increment(key: string, expires: number): Promise<number>;
}
export class MemoryAuthStore implements AuthStore {
  protected records = new Map<string, AuthData>();
  async get(key: string) {
    const value = this.records.get(key);
    if (value?.expires && value.expires < Date.now()) return undefined;
    return value ? structuredClone(value) : undefined;
  }
  async put(key: string, value: AuthData, onlyNew = false) {
    if (
      onlyNew &&
      this.records.has(key) &&
      (!this.records.get(key)?.expires ||
        Number(this.records.get(key)?.expires) > Date.now())
    )
      throw new ConflictError("An account already exists for this email.");
    this.records.set(key, structuredClone(value));
  }
  async update(key: string, mutate: (value: AuthData | undefined) => AuthData) {
    const current = this.records.get(key);
    this.records.set(
      key,
      structuredClone(mutate(current ? structuredClone(current) : undefined)),
    );
  }
  async delete(key: string) {
    this.records.delete(key);
  }
  async consume(key: string) {
    const value = this.records.get(key);
    this.records.delete(key);
    return value && (!value.expires || value.expires > Date.now())
      ? structuredClone(value)
      : undefined;
  }
  async increment(key: string, expires: number) {
    const value = this.records.get(key);
    const count =
      Number(value && Number(value.expires) > Date.now() ? value.count : 0) + 1;
    this.records.set(key, { count, expires });
    return count;
  }
}
export class LocalAuthStore implements AuthStore {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(
    private file = resolve(process.env.DATA_DIR || ".data", "auth.json"),
  ) {}
  private async read(): Promise<Record<string, AuthData>> {
    try {
      return JSON.parse(await readFile(this.file, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw e;
    }
  }
  private async mutation<T>(
    fn: (records: Record<string, AuthData>) => T,
  ): Promise<T> {
    const next = this.pending
      .catch(() => {})
      .then(async () => {
        const records = await this.read();
        for (const [key, record] of Object.entries(records))
          if (record.expires && record.expires <= Date.now())
            delete records[key];
        const value = fn(records);
        await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
        const temp = `${this.file}.${uid("tmp")}`;
        await writeFile(temp, JSON.stringify(records), { mode: 0o600 });
        await rename(temp, this.file);
        return value;
      });
    this.pending = next;
    return next;
  }
  async get(key: string) {
    await this.pending.catch(() => {});
    const value = (await this.read())[key];
    return value && (!value.expires || value.expires > Date.now())
      ? value
      : undefined;
  }
  async put(key: string, value: AuthData, onlyNew = false) {
    await this.mutation((r) => {
      if (
        onlyNew &&
        r[key] &&
        (!r[key].expires || Number(r[key].expires) > Date.now())
      )
        throw new ConflictError("An account already exists for this email.");
      r[key] = value;
    });
  }
  async update(key: string, mutate: (value: AuthData | undefined) => AuthData) {
    await this.mutation((records) => {
      records[key] = mutate(records[key]);
    });
  }
  async delete(key: string) {
    await this.mutation((r) => {
      delete r[key];
    });
  }
  async consume(key: string) {
    return this.mutation((r) => {
      const value = r[key];
      delete r[key];
      return value && (!value.expires || value.expires > Date.now())
        ? value
        : undefined;
    });
  }
  async increment(key: string, expires: number) {
    return this.mutation((r) => {
      const count =
        Number(
          r[key] && Number(r[key].expires) > Date.now() ? r[key].count : 0,
        ) + 1;
      r[key] = { count, expires };
      return count;
    });
  }
}
export class DynamoAuthStore implements AuthStore {
  private client: DynamoDBDocumentClient;
  constructor(
    private tableName: string,
    region = process.env.AWS_REGION || "eu-west-2",
    client?: DynamoDBDocumentClient,
  ) {
    this.client =
      client ||
      DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
        marshallOptions: { removeUndefinedValues: true },
      });
  }
  private key(key: string) {
    return { pk: `AUTH#${key}`, sk: "AUTH" };
  }
  async get(key: string) {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: this.key(key),
        ConsistentRead: true,
      }),
    );
    const value = response.Item?.data as AuthData | undefined;
    return value && (!value.expires || value.expires > Date.now())
      ? value
      : undefined;
  }
  async put(key: string, value: AuthData, onlyNew = false) {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            ...this.key(key),
            data: value,
            ...(value.expires
              ? { expiresAt: Math.floor(value.expires / 1000) }
              : {}),
          },
          ConditionExpression: onlyNew ? "attribute_not_exists(pk)" : undefined,
        }),
      );
    } catch (e) {
      if ((e as Error).name === "ConditionalCheckFailedException")
        throw new ConflictError("An account already exists for this email.");
      throw e;
    }
  }
  async update(key: string, mutate: (value: AuthData | undefined) => AuthData) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const response = await this.client.send(
        new GetCommand({
          TableName: this.tableName,
          Key: this.key(key),
          ConsistentRead: true,
        }),
      );
      const revision = Number(response.Item?.revision || 0);
      const value = mutate(response.Item?.data as AuthData | undefined);
      try {
        await this.client.send(
          new PutCommand({
            TableName: this.tableName,
            Item: {
              ...this.key(key),
              data: value,
              revision: revision + 1,
              ...(value.expires
                ? { expiresAt: Math.floor(value.expires / 1000) }
                : {}),
            },
            ConditionExpression: response.Item
              ? "attribute_exists(pk) AND (attribute_not_exists(revision) OR revision = :revision)"
              : "attribute_not_exists(pk)",
            ExpressionAttributeValues: response.Item
              ? { ":revision": revision }
              : undefined,
          }),
        );
        return;
      } catch (error) {
        if ((error as Error).name !== "ConditionalCheckFailedException")
          throw error;
      }
    }
    throw new ConflictError(
      "Account changed repeatedly. Please request a new link and try again.",
    );
  }
  async delete(key: string) {
    await this.client.send(
      new DeleteCommand({ TableName: this.tableName, Key: this.key(key) }),
    );
  }
  async consume(key: string) {
    const result = await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: this.key(key),
        ReturnValues: "ALL_OLD",
      }),
    );
    const value = result.Attributes?.data as AuthData | undefined;
    return value && (!value.expires || value.expires > Date.now())
      ? value
      : undefined;
  }
  async increment(key: string, expires: number) {
    const result = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: this.key(key),
        UpdateExpression:
          "SET #count = if_not_exists(#count, :zero) + :one, #ttl = :ttl",
        ExpressionAttributeNames: { "#count": "count", "#ttl": "expiresAt" },
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":ttl": Math.floor(expires / 1000),
        },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    return Number(result.Attributes?.count);
  }
}
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
interface UserRecord extends SessionUser {
  passwordHash: string;
  verified: boolean;
  authVersion: number;
}
export class AuthService {
  constructor(
    public store: AuthStore,
    private workspaces: WorkspaceStore,
  ) {}
  async hash(password: string) {
    const salt = randomBytes(16).toString("hex");
    const key = await derive(password, salt);
    return `scrypt-v1:${salt}:${key.toString("hex")}`;
  }
  private async verify(password: string, hash: string) {
    const parts = hash.split(":");
    const legacy = parts[0] !== "scrypt-v1";
    const [salt, hex] = legacy ? parts : parts.slice(1);
    const key = await derive(password, salt, legacy);
    const expected = Buffer.from(hex, "hex");
    return key.length === expected.length && timingSafeEqual(key, expected);
  }
  async register(name: string, email: string, password: string) {
    const workspace = createWorkspace(name, false);
    const record: UserRecord = {
      id: uid("user"),
      name,
      email,
      workspaceId: workspace.id,
      isDemo: false,
      passwordHash: await this.hash(password),
      verified: false,
      authVersion: 0,
    };
    await this.store.put(`user:${email}`, { record }, true);
    // Preserve the password-protected account if provisioning is interrupted.
    // A subsequent successful login repairs a missing workspace safely.
    try {
      await this.workspaces.create(workspace);
    } catch {
      throw new AppError(
        503,
        "Your account was saved, but workspace setup was interrupted. Sign in with the same password to finish setup.",
        "WORKSPACE_SETUP_PENDING",
      );
    }
    return this.session(record);
  }
  async demo() {
    const workspace = createWorkspace("Shivam Gupta", true);
    await this.workspaces.create(workspace);
    const user: SessionUser = {
      id: uid("demo"),
      name: "Shivam Gupta",
      email: "demo@example.com",
      workspaceId: workspace.id,
      isDemo: true,
    };
    return this.session(user);
  }
  async login(email: string, password: string) {
    const data = await this.store.get(`user:${email}`);
    const user = data?.record as UserRecord | undefined;
    const hash = user?.passwordHash || dummyHash;
    if (!(await this.verify(password, hash)) || !user)
      throw new AppError(
        401,
        "Email or password is incorrect.",
        "INVALID_CREDENTIALS",
      );
    // Recover an interrupted first registration only after its password is verified.
    if (!(await this.workspaces.get(user.workspaceId))) {
      try {
        await this.workspaces.create(
          createWorkspace(user.name, false, user.workspaceId),
        );
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;
      }
    }
    return this.session(user);
  }
  private async session(record: SessionUser & { authVersion?: number }) {
    const user: SessionUser = {
      id: record.id,
      name: record.name,
      email: record.email,
      workspaceId: record.workspaceId,
      isDemo: record.isDemo,
    };
    const token = randomBytes(32).toString("base64url");
    await this.store.put(`session:${digest(token)}`, {
      user,
      authVersion: record.authVersion ?? 0,
      expires: Date.now() + (user.isDemo ? 24 : 24 * 7) * 3600_000,
    });
    return { user, token };
  }
  async getSession(token?: string) {
    if (!token || token.length > 100) return null;
    const data = await this.store.get(`session:${digest(token)}`);
    const user = data?.user as SessionUser | undefined;
    if (!user) return null;
    if (!user.isDemo) {
      const current = (await this.store.get(`user:${user.email}`))?.record as
        UserRecord | undefined;
      if (!current || current.authVersion !== data?.authVersion) return null;
    }
    return user;
  }
  async logout(token?: string) {
    if (token) await this.store.delete(`session:${digest(token)}`);
  }
  async isVerified(user: SessionUser) {
    if (user.isDemo) return false;
    return Boolean(
      (
        (await this.store.get(`user:${user.email}`))?.record as
          UserRecord | undefined
      )?.verified,
    );
  }
  async issueToken(email: string, kind: "verify" | "reset") {
    const record = (await this.store.get(`user:${email}`))?.record as
      UserRecord | undefined;
    if (!record) return undefined;
    const token = randomBytes(32).toString("base64url");
    await this.store.put(`${kind}:${digest(token)}`, {
      email,
      expires: Date.now() + 3600_000,
    });
    return token;
  }
  async useToken(token: string, kind: "verify" | "reset", password?: string) {
    const data = await this.store.consume(`${kind}:${digest(token)}`);
    if (!data)
      throw new AppError(
        400,
        "This link has expired or has already been used.",
        "INVALID_TOKEN",
      );
    const key = `user:${data.email}`;
    const passwordHash =
      kind === "reset" ? await this.hash(password!) : undefined;
    await this.store.update(key, (current) => {
      const record = current?.record as UserRecord | undefined;
      if (!record)
        throw new AppError(400, "Account not found.", "INVALID_TOKEN");
      if (kind === "verify") record.verified = true;
      else {
        record.passwordHash = passwordHash!;
        record.authVersion++;
      }
      return { record };
    });
    return true;
  }
  async rateLimit(key: string, limit = 10, windowMs = 15 * 60_000) {
    const bucket = Math.floor(Date.now() / windowMs);
    const count = await this.store.increment(
      `rate:${digest(key)}:${bucket}`,
      (bucket + 2) * windowMs,
    );
    if (count > limit)
      throw new AppError(
        429,
        "Too many attempts. Please try again later.",
        "RATE_LIMITED",
      );
  }
}
