import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { Workspace, WorkspaceStore } from "../shared/types.js";
import { ConflictError } from "./errors.js";

export class MemoryWorkspaceStore implements WorkspaceStore {
  private records = new Map<string, Workspace>();
  async get(id: string) {
    const value = this.records.get(id);
    return value ? structuredClone(value) : undefined;
  }
  async create(workspace: Workspace) {
    if (this.records.has(workspace.id)) throw new ConflictError();
    this.records.set(workspace.id, structuredClone(workspace));
  }
  async save(workspace: Workspace, expectedVersion: number) {
    if (this.records.get(workspace.id)?.version !== expectedVersion)
      throw new ConflictError();
    this.records.set(workspace.id, structuredClone(workspace));
  }
}
/** Single-process development persistence; DynamoDB supplies distributed CAS in AWS. */
export class LocalWorkspaceStore implements WorkspaceStore {
  private locks = new Map<string, Promise<void>>();
  constructor(
    public directory = resolve(process.env.DATA_DIR || ".data", "workspaces"),
  ) {}
  private file(id: string) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
      throw new Error("Invalid storage identifier");
    return join(this.directory, `${id}.json`);
  }
  async get(id: string): Promise<Workspace | undefined> {
    try {
      return JSON.parse(await readFile(this.file(id), "utf8")) as Workspace;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
  private async serial(id: string, fn: () => Promise<void>) {
    const previous = this.locks.get(id) || Promise.resolve();
    const next = previous.catch(() => {}).then(fn);
    this.locks.set(id, next);
    try {
      await next;
    } finally {
      if (this.locks.get(id) === next) this.locks.delete(id);
    }
  }
  private async write(workspace: Workspace) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const target = this.file(workspace.id);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(workspace), { mode: 0o600 });
    await rename(temporary, target);
  }
  async create(workspace: Workspace) {
    return this.serial(workspace.id, async () => {
      if (await this.get(workspace.id)) throw new ConflictError();
      await this.write(workspace);
    });
  }
  async save(workspace: Workspace, expectedVersion: number) {
    return this.serial(workspace.id, async () => {
      if ((await this.get(workspace.id))?.version !== expectedVersion)
        throw new ConflictError();
      await this.write(workspace);
    });
  }
}
