"use client";
import { createClient } from "@solana/kit";
import { walletSigner } from "@solana/kit-plugin-wallet";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { ClientProvider } from "@solana/react";
import type { ReactNode } from "react";
// Wallet connection uses the maintained official Kit wallet plugin (Wallet Standard).
export const client = createClient()
  .use(walletSigner({ chain: "solana:devnet", storage: null, autoConnect: false }))
  .use(solanaRpc({ rpcUrl: "https://api.devnet.solana.com" }));
export type AppClient = Awaited<typeof client>;
export default function Providers({ children }: { children: ReactNode }) {
  return <ClientProvider client={client}>{children}</ClientProvider>;
}
