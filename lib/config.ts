import { address } from "@solana/kit";
import { ApiError } from "./errors";

const PUBLIC_DEVNET = "https://api.devnet.solana.com";
export function config() {
  if (process.env.SOLANA_CLUSTER && process.env.SOLANA_CLUSTER !== "devnet") {
    throw new ApiError(503, "SERVICE_UNAVAILABLE", "Alloc supports Devnet only");
  }
  const creator = process.env.CREATOR_PUBLIC_KEY;
  const provider = process.env.PROVIDER_PUBLIC_KEY;
  const token = process.env.WORKER_TOKEN;
  if (!creator || !provider || !token || token.length < 20) {
    throw new ApiError(503, "SERVICE_UNAVAILABLE", "Operator must configure recipients and private worker");
  }
  try {
    address(creator);
    address(provider);
    if (creator === provider) throw new Error("Recipients must be distinct");
  } catch {
    throw new ApiError(503, "SERVICE_UNAVAILABLE", "Invalid beneficiary configuration");
  }
  const rpc = process.env.SOLANA_RPC_URL || PUBLIC_DEVNET;
  const fallback = process.env.SOLANA_RPC_FALLBACK_URL;
  for (const url of [rpc, fallback].filter(Boolean) as string[]) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !parsed.hostname) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "RPC requires a secure Devnet endpoint");
    }
    if (/mainnet|testnet/i.test(parsed.hostname + parsed.pathname)) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Only Devnet endpoints allowed");
    }
  }
  return {
    creator, provider, token, rpc, fallback,
    workerUrl: process.env.WORKER_URL || "http://worker:8000",
    uploadDir: process.env.UPLOAD_DIR || "./data/uploads",
    origin: process.env.APP_ORIGIN || "http://localhost:3000",
  };
}
