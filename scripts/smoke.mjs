/** HTTP end-to-end probe. Creates a disposable isolated demo; sends no external messages. */
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.SECONDCRATE_URL || "http://127.0.0.1:5279";
let cookie = "";
const log = [];
async function request(path, body, expected = 200) {
  const started = performance.now();
  const res = await fetch(`${base}/api${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: new URL(base).origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  const json = await res.json();
  assert.equal(res.status, expected, `${path}: ${JSON.stringify(json)}`);
  log.push({
    path,
    status: res.status,
    latencyMs: Math.round(performance.now() - started),
  });
  return json;
}
const home = await fetch(base);
assert.equal(home.status, 200);
assert.match(await home.text(), /SecondCrate/);
await request("/auth/demo", {});
const initial = await request("/dashboard");
assert.equal(initial.user.isDemo, true);
assert.equal(initial.workspace.orders.length, 0);
const lot = initial.workspace.lots[0];
const send = (
  buyerId,
  text,
  eventId = crypto.randomUUID(),
  channel = "whatsapp",
) => request("/inbound", { buyerId, lotId: lot.id, channel, text, eventId });
await request(`/lots/${lot.id}/launch`, {});
const first = await send("buyer_maya", "I can take 12 crates at £17 each.");
assert.equal(first.workspace.orders[0].quantity, 12);
assert.equal(first.workspace.orders[0].total, 204);
const duplicateId = crypto.randomUUID();
const second = await send(
  "buyer_table",
  "I'll take 20 crates at £18 each.",
  duplicateId,
  "sms",
);
assert.equal(second.workspace.lots[0].available, 8);
await send(
  "buyer_table",
  "I'll take 20 crates at £18 each.",
  duplicateId,
  "sms",
);
await Promise.all([
  send(
    "buyer_union",
    "I'll take 8 crates at £18 each.",
    crypto.randomUUID(),
    "email",
  ),
  send("buyer_common", "I'll take 8 crates at £18 each."),
]);
const final = await request("/dashboard");
assert.equal(final.workspace.orders.length, 3);
assert.equal(final.workspace.lots[0].available, 0);
assert.equal(
  final.workspace.orders.reduce((s, o) => s + o.quantity, 0),
  40,
);
assert.equal(
  final.workspace.orders.reduce((s, o) => s + o.total, 0),
  708,
);
assert.ok(
  final.workspace.messages
    .filter((m) => m.direction === "outbound")
    .every((m) => m.status === "simulated"),
);
await request("/auth/logout", {});
await request("/dashboard", undefined, 401);
const evidence = {
  verifiedAt: new Date().toISOString(),
  target: base,
  mode: "isolated-demo",
  externalMessagesSent: 0,
  checks: [
    "served frontend",
    "same-origin session cookie through real HTTP",
    "launch matched buyers",
    "cross-channel acceptance",
    "duplicate event replay",
    "parallel final-stock claims",
    "persisted stock=0, orders=3, crates=40, totalGBP=708",
    "all outbound messages simulated",
    "logout revokes session",
  ],
  requests: log,
};
await mkdir("docs/evidence", { recursive: true });
await writeFile(
  "docs/evidence/http-smoke.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(
  `PASS: ${evidence.checks.length} end-to-end checks; 40 crates, 3 orders, £708. No external messages sent.`,
);
