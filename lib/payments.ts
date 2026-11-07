import { randomUUID, createHash } from "node:crypto";
import { db, transact, getAttempt, getFulfillment, getRequest, audit, type RequestRow, type AttemptRow } from "./db";
import { ApiError } from "./errors";
import { assertDevnet, rpc, makeUnsigned, bytes64, base64, signatureFromSigned, fetchOutcome, broadcast } from "./chain";
import { workerReady } from "./worker";
import { scheduleJobs } from "./jobs";

export function isAtCapacity() {
  const row = db().prepare("SELECT COUNT(*) as count FROM fulfillments WHERE state IN ('PAID','RUNNING')").get() as { count: number };
  return row.count >= 3;
}
export async function prepare(request: RequestRow) {
  const existing = getAttempt(request.id);
  if (request.state !== "QUOTED" && request.state !== "PAYMENT_PENDING") {
    if (existing) return describeAttempt(existing);
    throw new ApiError(409, "PAYMENT_UNCERTAIN", "Request is no longer payable");
  }
  if (existing?.state === "SUBMITTED" || existing?.state === "VERIFIED") {
    throw new ApiError(409, "PAYMENT_UNCERTAIN", "Previous payment outcome is not yet resolved; check status");
  }
  if (Date.now() >= request.expires_at) throw new ApiError(410, "QUOTE_EXPIRED", "Quote expired");
  if (isAtCapacity()) throw new ApiError(429, "RATE_LIMITED", "Inference queue is full", true);
  await workerReady();
  await assertDevnet();
  const height = Number(await rpc().getBlockHeight({ commitment: "confirmed" }).send());
  if (existing?.state === "PREPARED" && height <= existing.last_valid_block_height) {
    return describeAttempt(existing);
  }
  const value = (await rpc().getLatestBlockhash({ commitment: "confirmed" }).send()).value;
  const unsigned = makeUnsigned(request, value.blockhash, BigInt(value.lastValidBlockHeight));
  const attempt: AttemptRow = {
    id: randomUUID(), request_id: request.id, unsigned_base64: unsigned,
    message_sha256: createHash("sha256").update(bytes64(unsigned).subarray(65)).digest("hex"),
    blockhash: value.blockhash, last_valid_block_height: Number(value.lastValidBlockHeight),
    prepared_at: Date.now(), signature: null, signed_base64: null, state: "PREPARED", verified_slot: null,
  };
  return transact(() => {
    const latest = getRequest(request.id);
    const active = getAttempt(request.id);
    if (!latest || latest.state !== "QUOTED") {
      if (active?.state === "PREPARED") return describeAttempt(active);
      throw new ApiError(409, "PAYMENT_UNCERTAIN", "Request changed during preparation");
    }
    if (active?.state === "PREPARED") {
      db().prepare("UPDATE payment_attempts SET state='EXPIRED' WHERE id=?").run(active.id);
    }
    db().prepare(`INSERT INTO payment_attempts
      (id,request_id,unsigned_base64,message_sha256,blockhash,last_valid_block_height,prepared_at,state)
      VALUES (@id,@request_id,@unsigned_base64,@message_sha256,@blockhash,@last_valid_block_height,@prepared_at,@state)`)
      .run({
        id: attempt.id, request_id: attempt.request_id,
        unsigned_base64: attempt.unsigned_base64,
        message_sha256: attempt.message_sha256,
        blockhash: attempt.blockhash,
        last_valid_block_height: attempt.last_valid_block_height,
        prepared_at: attempt.prepared_at, state: attempt.state,
      });
    audit(request.id, "PREPARED");
    return describeAttempt(attempt);
  });
}
function describeAttempt(a: AttemptRow) {
  return {
    paymentAttemptId: a.id, unsignedTransactionBase64: a.unsigned_base64,
    blockhash: a.blockhash, lastValidBlockHeight: a.last_valid_block_height,
  };
}

export async function submit(request: RequestRow, signedBase64: string) {
  const attempt = getAttempt(request.id);
  if (!attempt) throw new ApiError(409, "PAYMENT_UNCERTAIN", "Prepare a payment first");
  const candidate = signatureFromSigned(signedBase64, attempt, request.payer);
  if (attempt.signature && attempt.signature !== candidate) {
    throw new ApiError(409, "PAYMENT_UNCERTAIN", "A different payment is already pending");
  }
  const accepted = transact(() => {
    const current = getAttempt(request.id);
    if (!current || current.id !== attempt.id) {
      throw new ApiError(409, "PAYMENT_UNCERTAIN", "Prepared payment changed");
    }
    if (current.signature) {
      if (current.signature !== candidate) throw new ApiError(409, "PAYMENT_UNCERTAIN", "Payment already submitted");
      return false;
    }
    if (Date.now() >= request.expires_at || current.state !== "PREPARED") {
      throw new ApiError(410, "QUOTE_EXPIRED", "Cannot submit a new payment after expiry");
    }
    try {
      db().prepare("UPDATE payment_attempts SET signature=?,signed_base64=?,state='SUBMITTED' WHERE id=? AND state='PREPARED' AND signature IS NULL")
        .run(candidate, signedBase64, current.id);
    } catch {
      throw new ApiError(409, "PAYMENT_REUSED", "Transaction already claimed by another request");
    }
    db().prepare("UPDATE requests SET state='PAYMENT_PENDING' WHERE id=? AND state='QUOTED'").run(request.id);
    audit(request.id, "SUBMITTED");
    return true;
  });
  // Persisted before network send; repeated submit of same bytes cannot broadcast again.
  if (accepted) await broadcast(signedBase64);
  await reconcile(request.id);
  return status(request.id);
}

export async function reconcile(requestId: string) {
  const request = getRequest(requestId), attempt = getAttempt(requestId);
  if (!request || !attempt || !attempt.signature || attempt.state === "VERIFIED") return;
  if (attempt.state !== "SUBMITTED") return;
  const outcome = await fetchOutcome(request, attempt);
  if (outcome.kind === "pending") return;
  if (outcome.kind === "failed") {
    transact(() => {
      db().prepare("UPDATE payment_attempts SET state='FAILED' WHERE id=? AND state='SUBMITTED'").run(attempt.id);
      db().prepare("UPDATE requests SET state='QUOTED' WHERE id=? AND state='PAYMENT_PENDING'").run(requestId);
      audit(requestId, "CHAIN_FAILED");
    });
    return;
  }
  transact(() => {
    const current = getAttempt(requestId);
    if (!current || current.id !== attempt.id || current.state !== "SUBMITTED") return;
    // Unique attempt and request keys make claims durable through concurrency and restart.
    db().prepare("UPDATE payment_attempts SET state='VERIFIED',verified_slot=? WHERE id=? AND state='SUBMITTED'")
      .run(outcome.slot, attempt.id);
    db().prepare("INSERT INTO fulfillments(request_id,attempt_id,execution_id,state) VALUES(?,?,?,'PAID')")
      .run(requestId, attempt.id, randomUUID());
    db().prepare("UPDATE requests SET state='PAID' WHERE id=?").run(requestId);
    audit(requestId, "VERIFIED_AND_CLAIMED");
  });
  scheduleJobs();
}

export function status(id: string) {
  const request = getRequest(id);
  if (!request) throw new ApiError(401, "INVALID_CAPABILITY", "Request not accessible");
  const attempt = getAttempt(id);
  const fulfillment = getFulfillment(id);
  const receipt = attempt?.state === "VERIFIED" && attempt.signature && attempt.verified_slot != null ? {
    network: "devnet", signature: attempt.signature, slot: attempt.verified_slot,
    commitment: "confirmed", priceLamports: String(request.price_lamports), creatorLamports: String(request.creator_lamports),
    providerLamports: String(request.provider_lamports), creatorAddress: request.creator,
    providerAddress: request.provider, memo: "alloc:v1:" + id,
    explorerUrl: `https://explorer.solana.com/tx/${attempt.signature}?cluster=devnet`,
  } : null;
  const state = !attempt && request.state === "QUOTED" && Date.now() > request.expires_at ? "EXPIRED" : request.state;
  return {
    requestId: id, state, receipt,
    signature: attempt?.state === "SUBMITTED" || attempt?.state === "VERIFIED" ? attempt.signature : null,
    expiresAt: new Date(request.expires_at).toISOString(),
    result: fulfillment?.state === "SUCCEEDED" && fulfillment.result_json ? JSON.parse(fulfillment.result_json) : null,
    errorCode: fulfillment?.state === "PAID_FAILED" ? fulfillment.error_code : null,
  };
}
