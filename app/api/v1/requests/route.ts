import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { address } from "@solana/kit";
import { db, audit, transact } from "@/lib/db";
import { config } from "@/lib/config";
import { assertDevnet, rpc, memoFor } from "@/lib/chain";
import { MODEL_ID, WEIGHTS_ID, PRICE, CREATOR_AMOUNT, PROVIDER_AMOUNT, QUOTE_MS, MAX_UPLOAD } from "@/lib/constants";
import { apiErrorResponse, ApiError } from "@/lib/errors";
import { corsGuard, checkContentType, noStore } from "@/lib/http";
import { workerReady, validateImage } from "@/lib/worker";
import { isAtCapacity } from "@/lib/payments";
import { ipOf, rate } from "@/lib/rate";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let uploadPath: string | null = null;
  try {
    corsGuard(request);
    checkContentType(request, "multipart/form-data");
    if (Number(request.headers.get("content-length") || 0) > MAX_UPLOAD + 20_000) {
      throw new ApiError(413, "INPUT_TOO_LARGE", "Maximum upload size is 5 MiB");
    }
    rate("upload:" + ipOf(request), 10);
    const cfg = config();
    if (isAtCapacity()) throw new ApiError(429, "RATE_LIMITED", "Inference queue full", true);
    await workerReady(); // Do not issue payment quotes while the model is unavailable.
    const form = await request.formData();
    if (form.size !== 2 || typeof form.get("payer") !== "string" || !(form.get("image") instanceof File)) {
      throw new ApiError(400, "INVALID_INPUT", "Exactly one image and payer are required");
    }
    const payer = form.get("payer") as string;
    try { address(payer); } catch { throw new ApiError(400, "INVALID_INPUT", "Invalid wallet address"); }
    if (payer === cfg.creator || payer === cfg.provider) {
      throw new ApiError(400, "INVALID_INPUT", "Three distinct demo wallets are required");
    }
    rate("payer:" + payer, 10);
    const file = form.get("image") as File;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > MAX_UPLOAD || file.size === 0) {
      throw new ApiError(400, "INVALID_INPUT", "Choose one JPEG/PNG image under 5 MiB");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const validated = await validateImage(bytes);
    await assertDevnet();
    const slot = Number(await rpc().getSlot({ commitment: "confirmed" }).send());
    const id = randomUUID();
    const capability = randomBytes(32).toString("base64url");
    const now = Date.now();
    await mkdir(cfg.uploadDir, { recursive: true, mode: 0o700 });
    uploadPath = join(cfg.uploadDir, randomUUID() + ".bin");
    await writeFile(uploadPath, bytes, { flag: "wx", mode: 0o600 });
    transact(() => {
      db().prepare(`INSERT INTO requests
        (id,capability_hash,payer,input_sha256,upload_path,model_id,weights_id,
         created_at,expires_at,created_slot,state,creator,provider)
        VALUES (?,?,?,?,?,?,?,?,?,?, 'QUOTED',?,?)`).run(
          id, createHash("sha256").update(capability).digest("hex"),
          payer, validated.inputSha256, uploadPath, MODEL_ID, WEIGHTS_ID,
          now, now + QUOTE_MS, slot, cfg.creator, cfg.provider,
        );
      audit(id, "QUOTED");
    });
    uploadPath = null; // Now owned by the persistent request.
    return noStore({
      requestId: id, capability, network: "devnet",
      modelId: MODEL_ID, weightsId: WEIGHTS_ID, payer, inputSha256: validated.inputSha256,
      priceLamports: String(PRICE),
      creator: { address: cfg.creator, lamports: String(CREATOR_AMOUNT) },
      provider: { address: cfg.provider, lamports: String(PROVIDER_AMOUNT) },
      memo: memoFor(id), expiresAt: new Date(now + QUOTE_MS).toISOString(),
    }, 201);
  } catch (error) {
    if (uploadPath) await unlink(uploadPath).catch(() => undefined);
    return apiErrorResponse(error);
  }
}
