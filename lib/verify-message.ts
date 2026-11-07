/** Strict, independent validation of a Solana *legacy* wire transaction.
 * This is not a general-purpose transaction decoder: reject every unsupported
 * account/program/instruction shape rather than interpreting a balance delta.
 */
import { createHash } from "node:crypto";
import { getBase58Decoder } from "@solana/kit";
import { ApiError } from "./errors";
import type { AttemptRow, RequestRow } from "./db";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
// Contractually pinned legacy SPL Memo v2 program. Do not confuse with Memo v4.
const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const BASE58 = getBase58Decoder();
function mismatch(message: string): never {
  throw new ApiError(422, "PAYMENT_MISMATCH", message);
}
function decodeShortVec(data: Buffer, position: { offset: number }): number {
  let value = 0;
  for (let shift = 0; shift <= 14; shift += 7) {
    if (position.offset >= data.length) mismatch("Truncated legacy message");
    const byte = data[position.offset++];
    value |= (byte & 0x7f) << shift;
    if (!(byte & 0x80)) return value;
  }
  return mismatch("Oversized short vector");
}
function sliceBytes(data: Buffer, position: { offset: number }, count: number): Buffer {
  if (!Number.isSafeInteger(count) || count < 0 || data.length - position.offset < count) {
    mismatch("Truncated or malformed instruction");
  }
  const value = data.subarray(position.offset, position.offset + count);
  position.offset += count;
  return value;
}
function accountFor(data: Buffer, programOrAccountIndex: number, keys: string[]): string {
  if (!Number.isInteger(programOrAccountIndex) || programOrAccountIndex >= keys.length) {
    mismatch("Unknown account index");
  }
  return keys[programOrAccountIndex];
}
export function validateExactLegacyMessage(
  signedWire: Buffer,
  request: RequestRow,
  attempt: AttemptRow,
): void {
  if (signedWire.length > 1232 || signedWire[0] !== 1 || signedWire.length <= 65) {
    mismatch("Not an exact one-signer legacy transaction");
  }
  if (attempt.message_sha256 !== createHash("sha256").update(signedWire.subarray(65)).digest("hex")) {
    mismatch("Signed message differs from immutable prepared digest");
  }
  const position = { offset: 65 };
  const requiredSignatures = sliceBytes(signedWire, position, 1)[0];
  const readonlySigned = sliceBytes(signedWire, position, 1)[0];
  const readonlyUnsigned = sliceBytes(signedWire, position, 1)[0];
  if (requiredSignatures !== 1 || readonlySigned !== 0 || readonlyUnsigned !== 2) {
    mismatch("Unsupported fee-payer/signer/access header");
  }
  const accountsCount = decodeShortVec(signedWire, position);
  if (accountsCount !== 5) mismatch("Unexpected account keys");
  const keys = Array.from({ length: accountsCount }, () =>
    BASE58.decode(sliceBytes(signedWire, position, 32))
  );
  if (new Set(keys).size !== 5 ||
      keys[0] !== request.payer || !keys.includes(request.creator) ||
      !keys.includes(request.provider) || !keys.includes(SYSTEM_PROGRAM) ||
      !keys.includes(MEMO_PROGRAM)) {
    mismatch("Fee payer or beneficiary/program account mismatch");
  }
  const blockhash = BASE58.decode(sliceBytes(signedWire, position, 32));
  if (blockhash !== attempt.blockhash) mismatch("Recent blockhash mismatch");
  const instructionCount = decodeShortVec(signedWire, position);
  if (instructionCount !== 3) mismatch("Expected only transfer, transfer, memo");

  for (let i = 0; i < 3; i++) {
    const programIndex = sliceBytes(signedWire, position, 1)[0];
    const accountLength = decodeShortVec(signedWire, position);
    if (accountLength > 5) mismatch("Extra instruction accounts");
    const accountIndices = [...sliceBytes(signedWire, position, accountLength)];
    const dataLength = decodeShortVec(signedWire, position);
    if (dataLength > 64) mismatch("Unexpected instruction data size");
    const instructionData = sliceBytes(signedWire, position, dataLength);
    const program = accountFor(signedWire, programIndex, keys);
    const addresses = accountIndices.map(idx => accountFor(signedWire, idx, keys));

    if (i < 2) {
      const recipient = i === 0 ? request.creator : request.provider;
      const amount = i === 0 ? request.creator_lamports : request.provider_lamports;
      if (program !== SYSTEM_PROGRAM || addresses.length !== 2 ||
          addresses[0] !== request.payer || addresses[1] !== recipient ||
          instructionData.length !== 12 || instructionData.readUInt32LE(0) !== 2 ||
          instructionData.readBigUInt64LE(4) !== BigInt(amount)) {
        mismatch("System transfer does not match required beneficiary and lamports");
      }
    } else {
      if (program !== MEMO_PROGRAM || addresses.length !== 0 ||
          instructionData.toString("utf8") !== "alloc:v1:" + request.id) {
        mismatch("Exact request memo missing or altered");
      }
    }
  }
  if (position.offset !== signedWire.length) mismatch("Trailing or extra instructions");
}
