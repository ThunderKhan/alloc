import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ApiError } from "./errors";
import { config } from "./config";
import { MODEL_ID, WEIGHTS_ID } from "./constants";
import type { RequestRow } from "./db";

function workerHeaders() { return { Authorization: "Bearer " + config().token }; }
async function workerFetch(path: string, init: RequestInit = {}) {
  try {
    return await fetch(config().workerUrl + path, {
      ...init,
      headers: { ...workerHeaders(), ...(init.headers || {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(path === "/infer" ? 30_000 : 8_000),
    });
  } catch {
    throw new ApiError(503, "SERVICE_UNAVAILABLE", "Private inference worker unavailable", true);
  }
}
export async function workerReady() {
  const res = await workerFetch("/ready");
  if (!res.ok) throw new ApiError(503, "SERVICE_UNAVAILABLE", "Model not ready", true);
  const body = await res.json();
  if (body.ready !== true || body.modelId !== MODEL_ID || body.weightsId !== WEIGHTS_ID) {
    throw new ApiError(503, "SERVICE_UNAVAILABLE", "Worker model mismatch");
  }
}
export async function validateImage(bytes: Buffer) {
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(bytes)]), "image");
  const response = await workerFetch("/validate", { method: "POST", body: form });
  if (!response.ok) {
    if (response.status === 413) throw new ApiError(413, "INPUT_TOO_LARGE", "Image exceeds supported limits");
    if (response.status === 422) throw new ApiError(400, "INVALID_INPUT", "Invalid JPEG/PNG image");
    throw new ApiError(503, "SERVICE_UNAVAILABLE", "Image validator unavailable", true);
  }
  const body = await response.json();
  if (body.inputSha256 !== createHash("sha256").update(bytes).digest("hex")) {
    throw new ApiError(503, "SERVICE_UNAVAILABLE", "Worker digest mismatch");
  }
  return body as { inputSha256: string; width: number; height: number; format: string };
}
export async function runInference(request: RequestRow, executionId: string) {
  const data = await readFile(request.upload_path);
  const digest = createHash("sha256").update(data).digest("hex");
  if (digest !== request.input_sha256) throw new Error("INPUT_DIGEST_MISMATCH");
  const form = new FormData();
  form.append("image", new Blob([new Uint8Array(data)]), "image");
  form.append("executionId", executionId);
  form.append("inputSha256", digest);
  form.append("modelId", MODEL_ID);
  form.append("weightsId", WEIGHTS_ID);
  const response = await workerFetch("/infer", { method: "POST", body: form });
  if (!response.ok) throw new Error("WORKER_INFER_FAILED");
  const result = await response.json();
  if (result.inputSha256 !== digest || result.modelId !== MODEL_ID || result.weightsId !== WEIGHTS_ID ||
      !Array.isArray(result.predictions) || result.predictions.length !== 3 ||
      !result.predictions.every((p: { label: string; score: number }) =>
        typeof p.label === "string" && Number.isFinite(p.score) && p.score >= 0 && p.score <= 1)) {
    throw new Error("INVALID_WORKER_RESULT");
  }
  return result;
}
