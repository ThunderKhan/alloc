import { describe, expect, it } from "vitest";
import { eligibleForRebroadcast } from "../lib/recovery";
import type { AttemptRow, RequestRow } from "../lib/db";

const now = 1_800_000_000_000;
const row = {
  expires_at: now + 30_000,
  state: "PAYMENT_PENDING",
} as RequestRow;
const attempt = {
  state: "SUBMITTED", signature: "onchain-signature",
  signed_base64: "nonempty-saved-transaction",
  last_valid_block_height: 420,
} as AttemptRow;

describe("restart-safe same-signature relay", () => {
  it("may resend only the preexisting signed bytes while quote and blockhash are valid", () => {
    expect(eligibleForRebroadcast(row, attempt, 419n, now)).toBe(true);
    expect(eligibleForRebroadcast(row, attempt, 420n, now)).toBe(true);
    expect(eligibleForRebroadcast(row, attempt, 421n, now)).toBe(false);
    expect(eligibleForRebroadcast(row, attempt, 420n, now + 30_000)).toBe(false);
  });
  it("never broadcasts an unsigned, failed, already verified, or missing candidate", () => {
    expect(eligibleForRebroadcast(row, { ...attempt, signed_base64: null }, 400n, now)).toBe(false);
    expect(eligibleForRebroadcast(row, { ...attempt, signature: null }, 400n, now)).toBe(false);
    expect(eligibleForRebroadcast(row, { ...attempt, state: "FAILED" }, 400n, now)).toBe(false);
    expect(eligibleForRebroadcast(row, { ...attempt, state: "VERIFIED" }, 400n, now)).toBe(false);
    expect(eligibleForRebroadcast(undefined, attempt, 400n, now)).toBe(false);
  });
});
