import { unlink } from "node:fs/promises";
import { db, getAttempt, getRequest, audit, type AttemptRow, type RequestRow } from "./db";
import { reconcile } from "./payments";
import { broadcast, rpc } from "./chain";
import { scheduleJobs } from "./jobs";

let booted = false;

/** Re-send only the exact signed candidate already approved by the wallet.
 * A second broadcast with identical signature cannot authorize a second charge.
 * Never re-send beyond quote or blockhash expiry.
 */
export function eligibleForRebroadcast(
  request: RequestRow | undefined,
  attempt: AttemptRow | undefined,
  currentBlockHeight: bigint,
  now = Date.now(),
) {
  return !!request && !!attempt && attempt.state === "SUBMITTED" &&
    !!attempt.signature && !!attempt.signed_base64 &&
    now < request.expires_at &&
    currentBlockHeight <= BigInt(attempt.last_valid_block_height);
}

export async function housekeeping() {
  const database = db();
  const expired = database.prepare(
    "SELECT * FROM requests WHERE state IN ('SUCCEEDED','PAID_FAILED') OR (state IN ('QUOTED','EXPIRED') AND expires_at < ?)"
  ).all(Date.now() - 60 * 60 * 1000) as RequestRow[];
  for (const row of expired) {
    // Payment-pending candidates are NEVER purged until reconciled. Retain tombstones.
    // Finished/failed requests may be cleaned immediately after a crash, too.
    await unlink(row.upload_path).catch(() => undefined);
    database.prepare("UPDATE requests SET state='EXPIRED' WHERE id=? AND state='QUOTED'")
      .run(row.id);
  }
}
export async function startRecovery() {
  if (booted) return;
  booted = true;
  const database = db(); // Startup marks interrupted RUNNING as PAID_FAILED.
  scheduleJobs(); // Jobs claimed but never started may run on restart.
  const ids = database.prepare(
    "SELECT DISTINCT request_id FROM payment_attempts WHERE state='SUBMITTED'"
  ).all() as Array<{request_id:string}>;
  // Reconcile existing candidates; never fabricate failure on timeout or create new payment.
  for (const {request_id} of ids) {
    try {
      // Crash window: the candidate was durably claimed for broadcast, but
      // the process may have exited before sendTransaction. First inspect RPC.
      await reconcile(request_id);
      const request = getRequest(request_id), attempt = getAttempt(request_id);
      if (attempt?.state === "SUBMITTED" && attempt.signed_base64) {
        const height = await rpc().getBlockHeight({ commitment: "confirmed" }).send();
        if (eligibleForRebroadcast(request, attempt, height)) {
          // Never construct another transaction or ask the wallet to sign again.
          audit(request_id, "RELAY_SAME_SIGNED_TRANSACTION_AFTER_RESTART");
          await broadcast(attempt.signed_base64);
          await reconcile(request_id);
        }
      }
    } catch {
      // Any RPC or storage uncertainty leaves existing pending state intact;
      // operator can reconcile the same signature later.
    }
  }
  await housekeeping();
  const interval = setInterval(() => {void housekeeping().catch(() => undefined);}, 15 * 60 * 1000);
  interval.unref();
}
