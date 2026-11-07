import { db } from "@/lib/db";
import { assertDevnet } from "@/lib/chain";
import { workerReady } from "@/lib/worker";
import { scheduleJobs } from "@/lib/jobs";
import { apiErrorResponse } from "@/lib/errors";
import { noStore } from "@/lib/http";
export const runtime = "nodejs";
export async function GET() {
  try {
    db().prepare("SELECT 1").get();
    await Promise.all([assertDevnet(), workerReady()]);
    scheduleJobs(); // Resume jobs that were PAID but never RUNNING.
    return noStore({ status: "ready", network: "devnet" });
  } catch (error) { return apiErrorResponse(error); }
}
