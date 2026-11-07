import { requireRequest } from "@/lib/db";
import { submit } from "@/lib/payments";
import { ApiError, apiErrorResponse } from "@/lib/errors";
import { corsGuard, checkContentType, noStore } from "@/lib/http";
import { rate, ipOf } from "@/lib/rate";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    corsGuard(request);
    checkContentType(request, "application/json");
    rate("submit:" + ipOf(request), 60);
    if (Number(request.headers.get("content-length") || 0) > 8192) {
      throw new ApiError(413, "INPUT_TOO_LARGE", "Payment message too large");
    }
    const row = requireRequest(id, request.headers.get("authorization"));
    const body = await request.json();
    if (!body || typeof body !== "object" || Object.keys(body).join(",") !== "signedTransaction" ||
        typeof body.signedTransaction !== "string" || body.signedTransaction.length > 8192) {
      throw new ApiError(400, "INVALID_TRANSACTION", "Expected one signedTransaction base64 field");
    }
    const result = await submit(row, body.signedTransaction);
    return noStore(result, result.state === "PAYMENT_PENDING" ? 202 : 200);
  } catch (error) { return apiErrorResponse(error, id); }
}
