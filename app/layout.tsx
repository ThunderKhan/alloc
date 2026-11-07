import type { Metadata } from "next";
import { GeistSans, GeistMono } from "geist/font";
import Providers from "./providers";
import "./globals.css";
export const metadata: Metadata = {
  title: "Alloc — paid image classification on Solana Devnet",
  description: "One image. One verifiable Devnet split. One real CPU inference.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={`${GeistSans.variable} ${GeistMono.variable}`}>
    <Providers>{children}</Providers>
  </body></html>;
}
