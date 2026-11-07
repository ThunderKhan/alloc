export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable = false) {
    super(message);
  }
}
export function apiErrorResponse(error: unknown, requestId?: string) {
  const e = error instanceof ApiError ? error : new ApiError(503, "SERVICE_UNAVAILABLE", "Service temporarily unavailable", true);
  return Response.json({ error: { code: e.code, message: e.message, retryable: e.retryable }, ...(requestId ? { requestId } : {}) }, { status: e.status, headers: { "Cache-Control": "no-store" } });
}
