import { ApiError } from "./errors";
export function corsGuard(request: Request) {
  const origin = request.headers.get("origin");
  // Behind HTTPS proxy the Node Request URL may be an internal http://gateway
  // URL. Use the explicitly configured public origin as the authoritative
  // browser mutation origin; never trust a client-provided forwarded host.
  const own = process.env.APP_ORIGIN
    ? new URL(process.env.APP_ORIGIN).origin : new URL(request.url).origin;
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
