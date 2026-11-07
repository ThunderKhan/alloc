import { ApiError } from "./errors";
export function corsGuard(request: Request) {
  const origin = request.headers.get("origin");
  const own = new URL(request.url).origin;
  if (origin && origin !== own) {
    throw new ApiError(403, "INVALID_ORIGIN", "Cross-origin mutation refused");
  }
}
export function noStore(json: unknown, status = 200) {
  return Response.json(json, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export function checkContentType(request: Request, type: string) {
  if (!request.headers.get("content-type")?.startsWith(type)) {
    throw new ApiError(400, "INVALID_INPUT", "Unsupported content type");
  }
}
