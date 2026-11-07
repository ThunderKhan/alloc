/**
 * Opt-in live Devnet acceptance smoke. Ephemeral ED25519 software wallets exist
 * only in this process; NO secret key is persisted, logged or put in browser storage.
 * Uses real faucet test SOL, real Solana RPC, production gateway + PyTorch worker.
 * Does NOT constitute a human-approved browser wallet demonstration.
 */
import { generateKeyPairSync, sign, randomBytes } from "node:crypto";
import { getBase58Decoder } from "@solana/kit";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

if (process.env.ALLOC_LIVE_DEVNET !== "1") {
  throw new Error("Live Devnet check requires explicit ALLOC_LIVE_DEVNET=1");
}
const chainUrl = "https://api.devnet.solana.com";
const base = "http://127.0.0.1:3000";
const dir = mkdtempSync(join(tmpdir(), "alloc-live-devnet-"));
const workerToken = randomBytes(32).toString("hex");
const children = [];
let rpcId = 0;
function wallet() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ format: "der", type: "spki" });
  const addr = getBase58Decoder().decode(der.subarray(-32));
  return { privateKey, address: addr };
}
const payer = wallet(), creator = wallet(), provider = wallet();
if (new Set([payer.address, creator.address, provider.address]).size !== 3) throw new Error("Wallet collision");

const env = {
  ...process.env,
  SOLANA_CLUSTER: "devnet",
  SOLANA_RPC_URL: chainUrl,
  CREATOR_PUBLIC_KEY: creator.address,
  PROVIDER_PUBLIC_KEY: provider.address,
  WORKER_TOKEN: workerToken,
  WORKER_URL: "http://127.0.0.1:8000",
  DATABASE_PATH: join(dir, "alloc.sqlite"),
  UPLOAD_DIR: join(dir, "uploads"),
  APP_ORIGIN: base,
  NODE_ENV: "production",
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function start(cmd, args, cwd = process.cwd()) {
  const child = spawn(cmd, args, {cwd, env, stdio: "ignore"});
  children.push(child);
  return child;
}
async function json(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`HTTP ${response.status} ${body.error?.code || body.error?.message || "request failed"}`);
  return body;
}
async function rpc(method, params = []) {
  const result = await json(chainUrl, {
    method: "POST", headers: {"content-type": "application/json"},
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  if (result.error) throw new Error(`Devnet RPC ${method}: ${result.error.message}`);
  return result.result;
}
async function waitUntil(fn, timeoutMs, label) {
  const stop = Date.now() + timeoutMs;
  let last = "not ready";
  while (Date.now() < stop) {
    try { const v = await fn(); if (v) return v; }
    catch (error) { last = error instanceof Error ? error.message : String(error); }
    await sleep(1500);
  }
  throw new Error(`Timeout waiting for ${label}; last status: ${last}`);
}
const headers = token => ({ Authorization: `Bearer ${token}` });

try {
  const genesis = await rpc("getGenesisHash");
  if (genesis !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG") {
    throw new Error("RPC is not Solana Devnet");
  }

  const worker = start("python", ["-m","uvicorn","app:app","--host","127.0.0.1","--port","8000","--workers","1"], join(process.cwd(), "worker"));
  await waitUntil(async () => {
    if (worker.exitCode !== null) throw new Error("Worker exited before ready");
    const r = await json("http://127.0.0.1:8000/ready", {headers:headers(workerToken)});
    return r.ready && r.weightsId === "IMAGENET1K_V1";
  }, 90_000, "pretrained CPU worker");

  const server = start("npm", ["run", "start", "--", "-H", "127.0.0.1"]);
  await waitUntil(async () => {
    if (server.exitCode !== null) throw new Error("Gateway exited before ready");
    const r = await json(base + "/api/v1/health");
    return r.status === "ready" && r.network === "devnet";
  }, 90_000, "Next.js gateway + Devnet RPC");

  // Faucet tests only; receiver accounts may be created by their incoming transfers.
  await rpc("requestAirdrop", [payer.address, 50_000_000, {commitment:"confirmed"}]);
  await waitUntil(async () => {
    const result = await rpc("getBalance", [payer.address, {commitment: "confirmed"}]);
    return Number(result.value) >= 10_010_000;
  }, 90_000, "Devnet faucet balance");

  const image = spawnSync("python", ["-c",
    "from PIL import Image; import sys; im=Image.new('RGB',(256,256),(164,92,42)); im.save(sys.stdout.buffer,format='PNG')"
  ], {encoding:null});
  if (image.status !== 0 || !image.stdout?.length) throw new Error("Unable to generate new PNG");
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(image.stdout)], {type:"image/png"}), "fresh-devnet.png");
  form.append("payer", payer.address);
  const quote = await json(base + "/api/v1/requests", {method:"POST",body:form});
  if (quote.priceLamports !== "10000000" ||
      quote.creator.lamports !== "7000000" || quote.provider.lamports !== "3000000" ||
      quote.creator.address !== creator.address || quote.provider.address !== provider.address) {
    throw new Error("Server quote differs from exact fixed Devnet split");
  }
  const quoteHeaders = headers(quote.capability);
  const prepared = await json(base + `/api/v1/requests/${quote.requestId}/prepare`, {
    method:"POST",headers:quoteHeaders,
  });
  const unsigned = Buffer.from(prepared.unsignedTransactionBase64,"base64");
  if (unsigned[0] !== 1) throw new Error("Prepared transaction is not single-signature legacy");
  const signed = Buffer.from(unsigned);
  const sigBytes = sign(null,signed.subarray(65),payer.privateKey);
  sigBytes.copy(signed,1);
  const signature = getBase58Decoder().decode(sigBytes);
  try {
    await json(base + `/api/v1/requests/${quote.requestId}/payments`, {
      method:"POST",
      headers:{...quoteHeaders,"content-type":"application/json"},
      body:JSON.stringify({signedTransaction:signed.toString("base64")}),
    });
  } catch {
    // A broadcast can succeed even if the HTTP reply is lost; reconcile the same signature only.
    console.log("Payment HTTP outcome ambiguous: reconciling original signature only");
  }

  const result = await waitUntil(async () => {
    const state = await json(base + `/api/v1/requests/${quote.requestId}`, {headers:quoteHeaders});
    if (state.state === "PAID_FAILED") throw new Error("Paid inference failed; inspect preserved receipt");
    if (state.state !== "SUCCEEDED") return null;
    if (state.receipt?.signature !== signature || state.receipt?.network !== "devnet" ||
        state.receipt?.creatorAddress !== creator.address ||
        state.receipt?.providerAddress !== provider.address ||
        state.receipt?.creatorLamports !== "7000000" ||
        state.receipt?.providerLamports !== "3000000" ||
        state.result?.predictions?.length !== 3 ||
        state.result.inputSha256 !== quote.inputSha256) {
      throw new Error("Receipt/result differs from actual signed request");
    }
    return state;
  }, 120_000, "real confirmed payment and real inference");

  const confirmed = await rpc("getTransaction", [signature,
    {encoding:"base64",commitment:"confirmed",maxSupportedTransactionVersion:0}]);
  if (!confirmed || confirmed.meta?.err !== null) throw new Error("RPC did not confirm successful payment");
  const [confirmedWire] = confirmed.transaction;
  if (confirmedWire !== signed.toString("base64")) {
    throw new Error("Independent chain transaction bytes mismatch");
  }
  // Do not print private keys, bearer capabilities, signed blobs, image bytes or secret worker token.
  console.log("LIVE_DEVNET_PAID_INFERENCE_EVIDENCE", JSON.stringify({
    timestampUTC: new Date().toISOString(), network:"devnet", requestId:quote.requestId,
    signature, slot:result.receipt.slot, payer:payer.address,
    creator:creator.address, provider:provider.address, totalLamports:10000000,
    creatorLamports:7000000,providerLamports:3000000,
    imageSha256:quote.inputSha256, modelId:result.result.modelId,
    top1:result.result.predictions[0].label,inferenceMs:result.result.inferenceMs,
    explorerUrl:result.receipt.explorerUrl,
    automatedSigner:true, humanWalletApproval:false,
  }));
} finally {
  for(const child of children) { try { child.kill("SIGTERM"); } catch {} }
  rmSync(dir, {recursive:true,force:true});
}
