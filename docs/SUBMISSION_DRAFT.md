# Alloc — submission copy (UNVERIFIED release fields)

**Project name:** Alloc

**Tagline:** One image. Two beneficiaries. One independently verified Solana payment before genuine AI inference.

**Short description (implementation claim, not live-proof claim):**

Alloc is a scoped Solana Devnet demonstration of prepaid AI inference. A user uploads one JPEG/PNG and receives a fixed 0.01 test-SOL quote. The browser wallet signs a single transaction containing two native SOL transfers (0.007 to a configured model beneficiary and 0.003 to a configured compute beneficiary) plus a request-specific memo. The server independently verifies the confirmed on-chain transaction and exact prepared bytes before its private CPU worker runs pretrained MobileNetV3 Small. The gateway persists an inspectable receipt, model result, and measured inference duration in SQLite, with strict replay prevention and pending/paid-failure recovery.

**Important honesty clause:** The payment flow is implemented and extensively fixture-tested, but as of this draft no real browser-approved Devnet transaction or public hosted deployment has been verified. Do not call it a working paid demo until corresponding signature and receipt evidence exists.

**Stack:** Next.js 16, React 19, TypeScript, Solana Kit, SQLite (WAL), FastAPI, PyTorch/torchvision, pretrained MobileNetV3 Small ImageNet-1K weights, Docker Compose; optional Caddy HTTPS reverse proxy.

**Differentiator:** one atomic payment splits direct proceeds between two distinct demo beneficiary roles; the backend enforces an immutable payer/input/request/model/price binding, unique signature claim, and real compute gating. This is *not* a marketplace, decentralized computation, invented new payment protocol, delivery guarantee, or training of the pretrained model.

**Repository:** https://github.com/ThunderKhan/alloc

**Draft PR:** https://github.com/ThunderKhan/alloc/pull/1 (unmerged)

**Public HTTPS demo:** NOT DEPLOYED / fill only after external verification.

**Genuine Explorer payment:** NONE YET / must come from the same request shown in the recording.

**Video:** NOT RECORDED / use the ~115-second script in DEMO.md after successful paid runs.

**Evidence:** CI jobs validate strict lockfile installation, gateway DB/replay/payment parsing, Chromium fixture states, private worker validation, and genuine PyTorch CPU inference. Docker Compose isolated smoke provides local readiness/persistence evidence separately. Fixture tests do **not** demonstrate wallet approval or on-chain settlement. Include exact final run URLs and tested commit when finished.

**Known limitations:** Devnet only, trusted private CPU worker, fixed model and fixed public addresses, one gateway/SQLite volume, no automatic refunds/escrow/proof-of-computation, no guarantee inference succeeds after payment, no mainnet/real-money support. Pretrained model belongs to upstream PyTorch/torchvision authors. UI design reference was adapted with retained MIT attribution. ChatGPT/GPT-6 assisted coding, testing and documentation.

**Before final submission:** Replace placeholders only after a genuine public-origin transaction, three paid runs on two images, complete evidence manifest, login-free public demo checks, screenshots and a public demo video. No submission was made by this draft.
