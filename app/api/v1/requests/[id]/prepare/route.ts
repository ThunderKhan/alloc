import { requireRequest } from "@/lib/db";
import { prepare } from "@/lib/payments";
import { corsGuard, noStore } from "@/lib/http";
import { rate, ipOf } from "@/lib/rate";
import { apiErrorResponse } from "@/lib/errors";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    corsGuard(request);
    rate("prepare:" + ipOf(request), 60);
    const row = requireRequest(id, request.headers.get("authorization"));
    return noStore(await prepare(row));
  } catch (error) { return apiErrorResponse(error, id); }
}
