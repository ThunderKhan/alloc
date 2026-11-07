import { config } from "@/lib/config";
import { NETWORK, MODEL_ID, WEIGHTS_ID, PRICE, CREATOR_AMOUNT, PROVIDER_AMOUNT } from "@/lib/constants";
import { apiErrorResponse } from "@/lib/errors";
import { noStore } from "@/lib/http";
export const runtime = "nodejs";
export async function GET() {
  try {
    const cfg = config();
    return noStore({
      network: NETWORK, modelId: MODEL_ID, weightsId: WEIGHTS_ID,
      provenance: "torchvision MobileNetV3 Small pretrained ImageNet-1K weights; not trained by Alloc",
      priceLamports: String(PRICE),
      creator: { address: cfg.creator, lamports: String(CREATOR_AMOUNT) },
      provider: { address: cfg.provider, lamports: String(PROVIDER_AMOUNT) },
      accepted: ["image/jpeg", "image/png"], maxBytes: 5 * 1024 * 1024,
    });
  } catch (error) { return apiErrorResponse(error); }
}
