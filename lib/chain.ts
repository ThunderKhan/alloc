import {
  address, appendTransactionMessageInstructions, compileTransaction,
  createNoopSigner, createSolanaRpc, createTransactionMessage,
  getBase58Decoder, getBase58Encoder, getTransactionEncoder, lamports,
  pipe, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash,
  signature as kitSignature,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { getAddMemoInstruction } from "@solana-program/memo";
import { createPublicKey, createHash, timingSafeEqual, verify as verifyEd25519 } from "node:crypto";
import { ApiError } from "./errors";
import { config } from "./config";
import { CREATOR_AMOUNT, PROVIDER_AMOUNT } from "./constants";
import type { AttemptRow, RequestRow } from "./db";

export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const MEMO_PREFIX = "alloc:v1:";
export function memoFor(id: string) { return MEMO_PREFIX + id; }

export function rpc(url?: string) {
  return createSolanaRpc(url || config().rpc);
}
export async function assertDevnet(url?: string) {
  const genesis = await rpc(url).getGenesisHash().send();
  if (genesis !== DEVNET_GENESIS) throw new ApiError(503, "SERVICE_UNAVAILABLE", "RPC genesis is not Devnet");
}
export function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
export function bytes64(text: string): Buffer {
  if (text.length > 8192 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text) || text.length % 4 !== 0) {
    throw new ApiError(400, "INVALID_TRANSACTION", "Invalid base64 transaction");
  }
  const bytes = Buffer.from(text, "base64");
  if (base64(bytes) !== text || bytes.length > 1232) {
    throw new ApiError(400, "INVALID_TRANSACTION", "Invalid legacy transaction size");
  }
  return bytes;
}

export function makeUnsigned(row: RequestRow, blockhash: string, lastValidBlockHeight: bigint): string {
  if (row.creator === row.provider || row.payer === row.creator || row.payer === row.provider) {
    throw new ApiError(400, "INVALID_INPUT", "Payer and beneficiaries must be distinct");
  }
  const payer = address(row.payer);
  const signedSource = createNoopSigner(payer);
  const instructions = [
    getTransferSolInstruction({
      source: signedSource, destination: address(row.creator), amount: lamports(BigInt(CREATOR_AMOUNT)),
    }),
    getTransferSolInstruction({
      source: signedSource, destination: address(row.provider), amount: lamports(BigInt(PROVIDER_AMOUNT)),
    }),
    getAddMemoInstruction({ memo: memoFor(row.id) }),
  ];
  const message = pipe(
    createTransactionMessage({ version: "legacy" }),
    m => setTransactionMessageFeePayer(payer, m),
    m => setTransactionMessageLifetimeUsingBlockhash({ blockhash: blockhash as never, lastValidBlockHeight }, m),
    m => appendTransactionMessageInstructions(instructions, m),
  );
  const encoded = getTransactionEncoder().encode(compileTransaction(message));
  if (encoded.length > 1232 || encoded[0] !== 1) {
    throw new ApiError(400, "INVALID_TRANSACTION", "Expected one-signer legacy transaction");
  }
  return base64(encoded);
}

export function signatureFromSigned(signedBase64: string, attempt: AttemptRow, payer: string): string {
  const signed = bytes64(signedBase64);
  const unsigned = bytes64(attempt.unsigned_base64);
  if (signed.length !== unsigned.length || signed[0] !== 1 || unsigned[0] !== 1 ||
      !timingSafeEqual(signed.subarray(65), unsigned.subarray(65))) {
    throw new ApiError(422, "PAYMENT_MISMATCH", "Wallet altered the server-prepared transaction");
  }
  const sig = signed.subarray(1, 65);
  if (sig.every(b => b === 0)) {
    throw new ApiError(400, "INVALID_TRANSACTION", "Missing wallet signature");
  }
  const pubBytes = getBase58Encoder().encode(payer);
  if (pubBytes.length !== 32) throw new ApiError(400, "INVALID_INPUT", "Invalid payer key");
  const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pubBytes)]);
  const key = createPublicKey({ key: spki, format: "der", type: "spki" });
  if (!verifyEd25519(null, signed.subarray(65), key, sig)) {
    throw new ApiError(400, "INVALID_TRANSACTION", "Signature does not authorize this message");
  }
  return getBase58Decoder().decode(sig);
}

export type ChainOutcome =
  | { kind: "confirmed"; slot: number; signature: string }
  | { kind: "pending" }
  | { kind: "failed" };

export function verifyRpcEvidence(
  tx: { meta?: { err: unknown } | null; slot: bigint | number; blockTime?: bigint | number | null;
        transaction?: readonly [string, string] | string[]; version?: string | number } | null,
  request: RequestRow, attempt: AttemptRow,
): ChainOutcome {
  if (!tx || !tx.meta || tx.blockTime == null || !tx.transaction) return { kind: "pending" };
  if (tx.meta.err != null) return { kind: "failed" };
  if (tx.version !== undefined && tx.version !== "legacy") {
    throw new ApiError(422, "PAYMENT_MISMATCH", "Unsupported transaction version");
  }
  const slot = Number(tx.slot), blockTime = Number(tx.blockTime) * 1000;
  if (!Number.isSafeInteger(slot) || slot < request.created_slot ||
      blockTime < request.created_at - 30_000 || blockTime > request.expires_at) {
    throw new ApiError(422, "PAYMENT_MISMATCH", "Payment outside the immutable quote window");
  }
  const [encoded, format] = tx.transaction;
  if (format !== "base64" || typeof encoded !== "string") {
    throw new ApiError(422, "PAYMENT_MISMATCH", "Unsupported RPC transaction encoding");
  }
  const signed = bytes64(encoded);
  const stored = bytes64(attempt.signed_base64 || "");
  if (signed.length !== stored.length || !timingSafeEqual(signed, stored)) {
    throw new ApiError(422, "PAYMENT_MISMATCH", "On-chain payment differs from saved signed message");
  }
  if (!attempt.signature || signatureFromSigned(encoded, attempt, request.payer) !== attempt.signature) {
    throw new ApiError(422, "PAYMENT_MISMATCH", "Transaction signature does not match candidate");
  }
  return { kind: "confirmed", signature: attempt.signature, slot };
}

export async function fetchOutcome(request: RequestRow, attempt: AttemptRow): Promise<ChainOutcome> {
  if (!attempt.signature || !attempt.signed_base64) return { kind: "pending" };
  const cfg = config();
  for (const url of [cfg.rpc, cfg.fallback].filter(Boolean) as string[]) {
    try {
      await assertDevnet(url);
      const response = await rpc(url).getTransaction(kitSignature(attempt.signature), {
        commitment: "confirmed", encoding: "base64", maxSupportedTransactionVersion: 0,
      }).send();
      // RPC shape is checked at runtime as well as via the Kit transport schema.
      const outcome = verifyRpcEvidence(response as never, request, attempt);
      if (outcome.kind !== "pending") return outcome;
    } catch (e) {
      if (e instanceof ApiError && e.code === "PAYMENT_MISMATCH") throw e;
      // Network and provider uncertainty is never interpreted as proof of failure.
    }
  }
  return { kind: "pending" };
}

export async function broadcast(signedBase64: string): Promise<void> {
  const cfg = config();
  await assertDevnet(cfg.rpc);
  try {
    await rpc(cfg.rpc).sendTransaction(signedBase64 as never, {
      encoding: "base64", preflightCommitment: "confirmed", skipPreflight: false,
      maxRetries: 2,
    }).send();
  } catch {
    // A timed-out send can still land. The signature is durable and will be reconciled.
  }
}
