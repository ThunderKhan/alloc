import { unlink } from "node:fs/promises";
import { db, type RequestRow } from "./db";
import { reconcile } from "./payments";
import { scheduleJobs } from "./jobs";

let booted = false;
export async function housekeeping() {
  const database = db();
  const expired = database.prepare(
    "SELECT * FROM requests WHERE state IN ('QUOTED','EXPIRED') AND expires_at < ?"
  ).all(Date.now() - 60 * 60 * 1000) as RequestRow[];
  for (const row of expired) {
    // Payment-pending candidates are NEVER purged until reconciled. Retain tombstones.
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
    await reconcile(request_id).catch(() => undefined);
  }
  await housekeeping();
  const interval = setInterval(() => {void housekeeping().catch(() => undefined);}, 15 * 60 * 1000);
  interval.unref();
}
