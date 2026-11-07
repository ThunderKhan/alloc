import { requireRequest } from "@/lib/db";
import { reconcile, status } from "@/lib/payments";
import { scheduleJobs } from "@/lib/jobs";
import { rate, ipOf } from "@/lib/rate";
import { apiErrorResponse } from "@/lib/errors";
import { noStore } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    requireRequest(id, request.headers.get("authorization"));
    rate("status:" + ipOf(request) + ":" + id, 60);
    await reconcile(id).catch(() => undefined); // RPC doubt cannot erase a pending receipt.
    scheduleJobs();
    return noStore(status(id));
  } catch (error) { return apiErrorResponse(error, id); }
}
