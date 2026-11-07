import { ApiError } from "./errors";
const windows = new Map<string, { start: number; count: number }>();
export function rate(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.start > windowMs) {
    windows.set(key, { start: now, count: 1 });
    return;
  }
  current.count++;
  if (current.count > limit) throw new ApiError(429, "RATE_LIMITED", "Too many requests; retry shortly", true);
  if (windows.size > 10000) {
    for (const [k, v] of windows) if (now - v.start > windowMs) windows.delete(k);
  }
}
export function ipOf(request: Request) {
  // Proxy must replace inbound x-forwarded-for. Not an authentication signal.
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
}
