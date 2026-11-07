import { unlink } from "node:fs/promises";
import { db, getRequest, transact, type FulfillmentRow } from "./db";
import { runInference } from "./worker";

let running = false;

/** Single in-process pump; the database conditional transition is the real concurrency guard. */
export function scheduleJobs() {
  if (running) return;
  running = true;
  setImmediate(async () => {
    try {
      for (;;) {
        const pending = db().prepare("SELECT * FROM fulfillments WHERE state='PAID' ORDER BY rowid LIMIT 1")
          .get() as FulfillmentRow | undefined;
        if (!pending) break;
        const won = transact(() => {
          const info = db().prepare("UPDATE fulfillments SET state='RUNNING',started_at=? WHERE request_id=? AND state='PAID'")
            .run(Date.now(), pending.request_id);
          if (info.changes) {
            db().prepare("UPDATE requests SET state='RUNNING' WHERE id=?").run(pending.request_id);
          }
          return info.changes === 1;
        });
        if (!won) continue;
        const request = getRequest(pending.request_id);
        try {
          if (!request) throw new Error("MISSING_REQUEST");
          const result = await runInference(request, pending.execution_id);
          transact(() => {
            db().prepare("UPDATE fulfillments SET state='SUCCEEDED',result_json=?,finished_at=? WHERE request_id=? AND state='RUNNING'")
              .run(JSON.stringify(result), Date.now(), pending.request_id);
            db().prepare("UPDATE requests SET state='SUCCEEDED' WHERE id=? AND state='RUNNING'")
              .run(pending.request_id);
          });
        } catch {
          // We cannot know if a crashed worker finished before gateway failure. No auto retry.
          transact(() => {
            db().prepare("UPDATE fulfillments SET state='PAID_FAILED',finished_at=?,error_code='INFERENCE_UNCERTAIN' WHERE request_id=? AND state='RUNNING'")
              .run(Date.now(), pending.request_id);
            db().prepare("UPDATE requests SET state='PAID_FAILED' WHERE id=? AND state='RUNNING'")
              .run(pending.request_id);
          });
        } finally {
          if (request) await unlink(request.upload_path).catch(() => undefined);
        }
      }
    } finally {
      running = false;
    }
  });
}
