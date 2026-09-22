/** Deploy an already-built frontend through Firebase's official Hosting REST API.
 * Uses the existing gcloud login in memory. Never writes access tokens to disk. */
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const firebase = JSON.parse(await readFile("firebase.json", "utf8"));
const aliases = JSON.parse(await readFile(".firebaserc", "utf8"));
const project = process.env.FIREBASE_PROJECT_ID || aliases.projects.default;
const site = process.env.FIREBASE_SITE_ID || firebase.hosting.site;
const directory = resolve(firebase.hosting.public);
const token = execFileSync("gcloud", ["auth", "print-access-token"], {
  encoding: "utf8",
}).trim();
const headers = {
  Authorization: `Bearer ${token}`,
  "x-goog-user-project": project,
};
const api = "https://firebasehosting.googleapis.com/v1beta1";
async function json(path, method = "GET", body) {
  const response = await fetch(`${api}/${path}`, {
    method,
    headers: { ...headers, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      `${method} ${path}: ${data.error?.message || response.status}`,
    );
  return data;
}
async function files(path) {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(path, entry.name);
    if (entry.isDirectory()) result.push(...(await files(full)));
    else if (entry.isFile()) result.push(full);
  }
  return result;
}
const manifest = {};
const compressed = new Map();
for (const file of await files(directory)) {
  const payload = gzipSync(await readFile(file), { level: 9 });
  const hash = createHash("sha256").update(payload).digest("hex");
  manifest[`/${relative(directory, file).split("\\").join("/")}`] = hash;
  compressed.set(hash, payload);
}
if (!manifest["/index.html"])
  throw new Error("Build the application before deploying Hosting.");
const config = {
  headers: firebase.hosting.headers.map((rule) => ({
    glob: rule.source,
    headers: Object.fromEntries(
      rule.headers.map((header) => [header.key, header.value]),
    ),
  })),
  rewrites: firebase.hosting.rewrites.map((rule) => ({
    glob: rule.source,
    ...(rule.run ? { run: rule.run } : { path: rule.destination }),
  })),
};
const version = await json(`sites/${site}/versions`, "POST", { config });
const population = await json(`${version.name}:populateFiles`, "POST", {
  files: manifest,
});
const required = population.uploadRequiredHashes || [];
for (let i = 0; i < required.length; i += 8) {
  await Promise.all(
    required.slice(i, i + 8).map(async (hash) => {
      const response = await fetch(`${population.uploadUrl}/${hash}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/octet-stream" },
        body: compressed.get(hash),
      });
      if (!response.ok)
        throw new Error(`Hosting file upload failed: ${response.status}`);
    }),
  );
}
await json(`${version.name}?updateMask=status`, "PATCH", {
  status: "FINALIZED",
});
await json(
  `sites/${site}/releases?versionName=${encodeURIComponent(version.name)}`,
  "POST",
  { message: "SecondCrate hosted preview" },
);
console.log(
  `Published ${Object.keys(manifest).length} files: https://${site}.web.app`,
);
console.log(`Hosting version: ${version.name}`);
