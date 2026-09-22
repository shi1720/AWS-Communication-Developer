import { createHash, randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Workspace, WorkspaceStore } from "../../shared/types.js";
import { AppError, ConflictError } from "../errors.js";

type Sender = { send(command: any): Promise<any> };
export const MAX_WORKSPACE_BYTES = 2_000_000;
export const SNAPSHOT_CHUNK_BYTES = 190_000;
const RETENTION_SECONDS = 7 * 24 * 3600;
type Manifest = {
  pk: string;
  sk: string;
  version: number;
  generation?: string;
  chunkCount?: number;
  bytes?: number;
  contentHash?: string;
  workspace?: Workspace;
  expiresAt?: number;
};
export class WorkspaceCapacityError extends AppError {
  constructor() {
    super(
      409,
      "Workspace capacity reached. Export and archive closed campaigns before adding more activity.",
      "WORKSPACE_LIMIT",
    );
  }
}
export interface StoreOptions {
  region: string;
  tableName: string;
  client?: Sender;
}
/** Immutable snapshots + an atomic manifest preserve the existing aggregate CAS
 * interface without placing the whole workspace in a 400 KB DynamoDB item.
 * Old snapshots receive TTL only when replaced. The current live snapshot never
 * expires. Both old/new payloads fit within the 4 MiB transaction limit. */
export class DynamoWorkspaceStore implements WorkspaceStore {
  private client: Sender;
  constructor(private options: StoreOptions) {
    if (!options.tableName) throw new Error("DYNAMODB_TABLE is required.");
    this.client =
      options.client ??
      DynamoDBDocumentClient.from(
        new DynamoDBClient({ region: options.region }),
        { marshallOptions: { removeUndefinedValues: true } },
      );
  }
  private key(id: string, sk = "STATE") {
    return { pk: `WORKSPACE#${id}`, sk };
  }
  private chunkKey(id: string, generation: string, index: number) {
    return this.key(
      id,
      `SNAPSHOT#${generation}#${String(index).padStart(4, "0")}`,
    );
  }
  private async manifest(id: string): Promise<Manifest | undefined> {
    return (
      await this.client.send(
        new GetCommand({
          TableName: this.options.tableName,
          Key: this.key(id),
          ConsistentRead: true,
        }),
      )
    ).Item;
  }
  async get(id: string): Promise<Workspace | undefined> {
    const manifest = await this.manifest(id);
    if (
      !manifest ||
      (manifest.expiresAt &&
        manifest.expiresAt <= Math.floor(Date.now() / 1000))
    )
      return undefined;
    if (manifest.workspace) return manifest.workspace; // Read/migrate the original one-item schema.
    if (
      !manifest.generation ||
      !Number.isInteger(manifest.chunkCount) ||
      manifest.chunkCount! < 1 ||
      manifest.chunkCount! >
        Math.ceil(MAX_WORKSPACE_BYTES / SNAPSHOT_CHUNK_BYTES)
    )
      throw new Error("Workspace snapshot manifest is invalid.");
    const chunks = await Promise.all(
      Array.from({ length: manifest.chunkCount! }, async (_, index) => {
        const result = await this.client.send(
          new GetCommand({
            TableName: this.options.tableName,
            Key: this.chunkKey(id, manifest.generation!, index),
            ConsistentRead: true,
          }),
        );
        if (!(result.Item?.payload instanceof Uint8Array))
          throw new Error(
            "Workspace snapshot is incomplete. Restore it from backup.",
          );
        return Buffer.from(result.Item.payload);
      }),
    );
    const payload = Buffer.concat(chunks);
    if (
      payload.length !== manifest.bytes ||
      createHash("sha256").update(payload).digest("hex") !==
        manifest.contentHash
    )
      throw new Error("Workspace snapshot integrity check failed.");
    const workspace = JSON.parse(payload.toString("utf8")) as Workspace;
    if (workspace.id !== id || workspace.version !== manifest.version)
      throw new Error("Workspace snapshot version mismatch.");
    return workspace;
  }
  private async write(
    workspace: Workspace,
    previous?: Manifest,
  ): Promise<void> {
    const payload = Buffer.from(JSON.stringify(workspace), "utf8");
    if (payload.length > MAX_WORKSPACE_BYTES)
      throw new WorkspaceCapacityError();
    const generation = randomUUID();
    const chunkCount = Math.ceil(payload.length / SNAPSHOT_CHUNK_BYTES);
    const expiry = Math.floor(Date.now() / 1000) + RETENTION_SECONDS;
    const demoExpiry =
      workspace.settings.mode === "demo" ? { expiresAt: expiry } : {};
    const items: NonNullable<
      ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]
    > = [];
    for (let index = 0; index < chunkCount; index++)
      items.push({
        Put: {
          TableName: this.options.tableName,
          Item: {
            ...this.chunkKey(workspace.id, generation, index),
            payload: payload.subarray(
              index * SNAPSHOT_CHUNK_BYTES,
              (index + 1) * SNAPSHOT_CHUNK_BYTES,
            ),
            ...demoExpiry,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        },
      });
    items.push({
      Put: {
        TableName: this.options.tableName,
        Item: {
          ...this.key(workspace.id),
          storageFormat: "snapshot-v1",
          version: workspace.version,
          generation,
          chunkCount,
          bytes: payload.length,
          contentHash: createHash("sha256").update(payload).digest("hex"),
          ...demoExpiry,
        },
        ConditionExpression: previous
          ? "#version = :expected"
          : "attribute_not_exists(pk)",
        ...(previous
          ? {
              ExpressionAttributeNames: { "#version": "version" },
              ExpressionAttributeValues: { ":expected": previous.version },
            }
          : {}),
      },
    });
    // TTL is set in the SAME transaction as pointer replacement. A failed CAS
    // creates no orphan chunks and cannot expire the current generation.
    if (previous?.generation && previous.chunkCount)
      for (let index = 0; index < previous.chunkCount; index++)
        items.push({
          Update: {
            TableName: this.options.tableName,
            Key: this.chunkKey(workspace.id, previous.generation, index),
            UpdateExpression: "SET expiresAt = :expiresAt",
            ExpressionAttributeValues: { ":expiresAt": expiry },
            ConditionExpression: "attribute_exists(pk)",
          },
        });
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: items,
          ClientRequestToken: generation,
        }),
      );
    } catch (error) {
      const failure = error as {
        name?: string;
        CancellationReasons?: { Code?: string }[];
      };
      if (
        failure.name === "ConditionalCheckFailedException" ||
        (failure.name === "TransactionCanceledException" &&
          failure.CancellationReasons?.some(
            (reason) => reason.Code === "ConditionalCheckFailed",
          ))
      )
        throw new ConflictError();
      throw error;
    }
  }
  async create(workspace: Workspace): Promise<void> {
    await this.write(workspace);
  }
  async save(workspace: Workspace, expectedVersion: number): Promise<void> {
    if (workspace.version !== expectedVersion + 1)
      throw new Error(
        "Workspace version must increment exactly once per write.",
      );
    const previous = await this.manifest(workspace.id);
    if (!previous || previous.version !== expectedVersion)
      throw new ConflictError();
    await this.write(workspace, previous);
  }
}
