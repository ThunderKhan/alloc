// Unprivileged public-origin readiness probe. This does not sign or send SOL
// and is never proof of a successful paid inference.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.argv[2];
if (!base) throw Error("Usage: node scripts/public-readiness.mjs https://alloc.example.org");
const origin = new URL(base);
assert.equal(origin.protocol, "https:", "Use a public HTTPS origin");
assert.equal(origin.pathname, "/", "Pass the origin only, without a path");
assert.equal(origin.search, "");
assert.equal(origin.hash, "");

async function read(path) {
  const response = await fetch(new URL(path, origin), {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

const health = await read("/api/v1/health");
assert.equal(health.response.status, 200, "Gateway/worker/RPC not ready");
assert.equal(health.body?.status, "ready");
assert.equal(health.body?.network, "devnet");
const model = await read("/api/v1/model");
assert.equal(model.response.status, 200, "Model information unavailable");
assert.equal(model.body?.network, "devnet");
assert.equal(model.body?.priceLamports, "10000000");
assert.equal(model.body?.creator?.lamports, "7000000");
assert.equal(model.body?.provider?.lamports, "3000000");
assert.notEqual(model.body?.creator?.address, model.body?.provider?.address);
const unauthorized = await read("/api/v1/requests/" + randomUUID());
assert.equal(unauthorized.response.status, 401, "Private request leaked without bearer");
console.log("PASS: public HTTPS reachability, Devnet/worker readiness, quote split and capability guard.");
console.log("NOT VERIFIED by this probe: browser-wallet signing, paid settlement, model inference or persistent replay.");
