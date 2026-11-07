import { describe, it, expect } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { getBase58Decoder } from "@solana/kit";
import { ApiError } from "../lib/errors";
import { makeUnsigned, signatureFromSigned, verifyRpcEvidence } from "../lib/chain";
import type { RequestRow, AttemptRow } from "../lib/db";
function newPayer() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  return { payer: getBase58Decoder().decode(der.subarray(-32)), privateKey };
}
const creator = "FnHyam9w4NZoWR6mKN1CuGBritdsEWZQa4Z4oawLZGxa";
const provider = "JJBeanoTcSMU3xKQa5Gru71Wi3AaEgTfA6z7MaLUT6h";
function fixture() {
  const keys = newPayer();
  const now = Date.now();
  const row: RequestRow = {
    id: "3f04ca42-8efe-4ef5-972d-c983e335ebd8",
    payer: keys.payer, creator, provider, model_id: "mobilenet-v3-small",
    weights_id: "IMAGENET1K_V1", input_sha256: "a".repeat(64),
    capability_hash: "b".repeat(64), upload_path: "/tmp/no-image",
    created_at: now - 30_000, expires_at: now + 600_000,
    created_slot: 100, state: "QUOTED",
  };
  const unsigned = makeUnsigned(row, "11111111111111111111111111111111", 999999n);
  const signed = Buffer.from(unsigned, "base64");
  const signature = sign(null, signed.subarray(65), keys.privateKey);
  signature.copy(signed, 1);
  const signedBase64 = signed.toString("base64");
  const attempt: AttemptRow = {
    id: "a", request_id: row.id, unsigned_base64: unsigned,
    message_sha256: "c".repeat(64), blockhash: "11111111111111111111111111111111",
    last_valid_block_height: 999999, prepared_at: now,
    signature: null, signed_base64: signedBase64, state: "SUBMITTED", verified_slot: null,
  };
  attempt.signature = signatureFromSigned(signedBase64, attempt, row.payer);
  return { row, attempt, signedBase64, signed };
}

describe("prepared legacy transaction and independent chain evidence", () => {
  it("encodes exact fixed split/memo and proves an Ed25519 payer signature", () => {
    const x = fixture();
    expect(x.signed[0]).toBe(1);
    expect(signatureFromSigned(x.signedBase64, x.attempt, x.row.payer)).toBe(x.attempt.signature);
    const meta = { err: null };
    expect(verifyRpcEvidence({
      meta, slot: 101, blockTime: Math.floor(Date.now() / 1000),
      transaction: [x.signedBase64, "base64"], version: "legacy",
    }, x.row, x.attempt)).toEqual({ kind: "confirmed", slot: 101, signature: x.attempt.signature });
  });
  it("rejects a signed candidate under a distinct request", () => {
    const a = fixture();
    const b: RequestRow = { ...a.row, id: "f40937f7-eb1b-42da-8799-c72c3e8cfecd" };
    const bAttempt = { ...a.attempt, unsigned_base64: makeUnsigned(b, "11111111111111111111111111111111", 999999n) };
    expect(() => signatureFromSigned(a.signedBase64, bAttempt, b.payer)).toThrow(ApiError);
  });
  it("rejects one altered transfer/memo message even when signature is copied", () => {
    const x = fixture();
    const bytes = Buffer.from(x.signed);
    bytes[bytes.length - 8] ^= 1;
    expect(() => signatureFromSigned(bytes.toString("base64"), x.attempt, x.row.payer)).toThrow(ApiError);
  });
  it("rejects invalid wallet signature, including wrong payer", () => {
    const x = fixture();
    const corrupt = Buffer.from(x.signed);
    corrupt[12] ^= 1;
    expect(() => signatureFromSigned(corrupt.toString("base64"), x.attempt, x.row.payer)).toThrow(ApiError);
    expect(() => signatureFromSigned(x.signedBase64, x.attempt, creator)).toThrow(ApiError);
  });
  it("treats missing transaction or metadata or block time as pending", () => {
    const x = fixture();
    expect(verifyRpcEvidence(null, x.row, x.attempt).kind).toBe("pending");
    expect(verifyRpcEvidence({meta:null,slot:101,transaction:[x.signedBase64,"base64"]},x.row,x.attempt).kind).toBe("pending");
    expect(verifyRpcEvidence({meta:{err:null},slot:101,transaction:[x.signedBase64,"base64"]},x.row,x.attempt).kind).toBe("pending");
  });
  it("refuses failed transaction and wrong slot/time/signature or unsupported version", () => {
    const x = fixture();
    const good = {
      meta: { err: null }, slot: 101, blockTime: Math.floor(Date.now()/1000),
      transaction: [x.signedBase64, "base64"], version: "legacy",
    };
    expect(verifyRpcEvidence({...good,meta:{err:{InstructionError:[0, "InsufficientFunds"]}}},x.row,x.attempt).kind).toBe("failed");
    expect(() => verifyRpcEvidence({...good,slot:99},x.row,x.attempt)).toThrow(ApiError);
    expect(() => verifyRpcEvidence({...good,blockTime:Math.floor(x.row.expires_at/1000)+60},x.row,x.attempt)).toThrow(ApiError);
    expect(() => verifyRpcEvidence({...good,version:0},x.row,x.attempt)).toThrow(ApiError);
    const different = { ...good, transaction:[Buffer.alloc(25).toString("base64"),"base64"] };
    expect(() => verifyRpcEvidence(different,x.row,x.attempt)).toThrow(ApiError);
  });
});
