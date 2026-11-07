import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

const mock = vi.hoisted(() => ({
  calls: [] as string[],
  failRequestIds: new Set<string>(),
}));
vi.mock("../lib/worker", () => ({
  runInference: async (request: {id: string; input_sha256: string}) => {
    mock.calls.push(request.id);
    if (mock.failRequestIds.has(request.id)) throw Error("synthetic private-worker failure");
    return {
      modelId: "mobilenet-v3-small", weightsId: "IMAGENET1K_V1",
      inputSha256: request.input_sha256, inferenceMs: 42,
      predictions: [
        { label: "test-class-A", score: 0.8 },
        { label: "test-class-B", score: 0.1 },
        { label: "test-class-C", score: 0.05 },
      ],
    };
  },
}));

import { db, getFulfillment } from "../lib/db";
import { scheduleJobs } from "../lib/jobs";
import { status } from "../lib/payments";

const dir = mkdtempSync(join(tmpdir(), "alloc-paid-jobs-test-"));
const path = join(dir, "ledger.sqlite");
process.env.DATABASE_PATH = path;
const database = db();
afterAll(() => { database.close(); rmSync(dir, { recursive: true, force: true }); });

function seedVerifiedPayment() {
  const requestId = randomUUID(), attemptId = randomUUID(), signature = randomUUID();
  const now = Date.now();
  const digest = createHash("sha256").update(randomBytes(64)).digest("hex");
  database.prepare(`INSERT INTO requests
    (id,capability_hash,payer,input_sha256,upload_path,model_id,weights_id,
     created_at,expires_at,created_slot,state,creator,provider)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      requestId, "a".repeat(64), "fixture-payer", digest, "/tmp/nonexistent-upload",
      "mobilenet-v3-small", "IMAGENET1K_V1",
      now, now + 900000, 1, "PAID", "fixture-creator", "fixture-provider"
    );
  database.prepare(`INSERT INTO payment_attempts
    (id,request_id,unsigned_base64,message_sha256,blockhash,last_valid_block_height,
     prepared_at,state,signature,signed_base64,verified_slot)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
      attemptId, requestId, "fixture", "b".repeat(64), "fixture", 50,
      now, "VERIFIED", signature, "fixture-signed", 10
    );
  database.prepare(`INSERT INTO fulfillments(request_id,attempt_id,execution_id,state)
    VALUES(?,?,?,'PAID')`).run(requestId,attemptId,randomUUID());
  return {requestId,signature};
}

describe("paid fulfillment / idempotent cached-result states (fixture payment, mocked worker)", () => {
  it("preserves an independently claimed receipt and a durable PAID_FAILED state on worker failure", async () => {
    const {requestId,signature} = seedVerifiedPayment();
    mock.failRequestIds.add(requestId);
    scheduleJobs();
    await vi.waitFor(() => expect(status(requestId).state).toBe("PAID_FAILED"), {timeout:3000,interval:20});
    expect(mock.calls.filter(x => x===requestId)).toHaveLength(1);
    expect(getFulfillment(requestId)?.error_code).toBe("INFERENCE_UNCERTAIN");
    expect(status(requestId).receipt?.signature).toBe(signature);
    expect(status(requestId).result).toBeNull();
    const restarted = new Database(path);
    try {
      const row = restarted.prepare("SELECT state, error_code FROM fulfillments WHERE request_id=?").get(requestId) as {state:string;error_code:string};
      expect(row).toMatchObject({state:"PAID_FAILED",error_code:"INFERENCE_UNCERTAIN"});
    } finally { restarted.close(); }
    mock.failRequestIds.delete(requestId);
    scheduleJobs();
    expect(mock.calls.filter(x => x===requestId)).toHaveLength(1);
  });

  it("stores a result once and returns it on repeated reads without redispatch", async () => {
    const {requestId,signature} = seedVerifiedPayment();
    scheduleJobs();
    await vi.waitFor(() => expect(status(requestId).state).toBe("SUCCEEDED"), {timeout:3000,interval:20});
    const first = status(requestId);
    expect(first.receipt?.signature).toBe(signature);
    expect(first.result?.inferenceMs).toBe(42);
    expect(first.result?.predictions).toHaveLength(3);
    scheduleJobs();
    expect(status(requestId).result).toEqual(first.result);
    expect(mock.calls.filter(x => x===requestId)).toHaveLength(1);
    const restarted = new Database(path);
    try {
      expect((restarted.prepare("SELECT state FROM fulfillments WHERE request_id=?").get(requestId) as {state:string}).state).toBe("SUCCEEDED");
    } finally { restarted.close(); }
  });
});
