# Alloc — product requirements

**Version 1 · hackathon specification · implementation unverified.** Scope authority: [MVP](MVP.md).

## Problem and users

Model development and inference hosting can belong to different people, yet per-call revenue allocation is usually hidden in a platform ledger. Alloc tests a visibly split, prepaid inference purchase.

Buyer: a developer/judge with a Devnet wallet and an image. Model beneficiary and compute provider: two configured demo wallets, not onboarding users. Operator: our team maintaining the trusted service.

Value hypothesis: a buyer and both beneficiaries can inspect the same settlement. No measured demand, throughput, or cost advantage is claimed.

## Core journey and requirements

| ID | User-visible requirement |
| --- | --- |
| R1 | Show task, model provenance, Devnet badge, total price, both recipients, and fee disclaimer before signing |
| R2 | Accept JPEG/PNG only, up to 5 MiB and 16 megapixels decoded; reject malformed/animated input |
| R3 | Bind validated uploaded bytes, payer, model/weight version, immutable split, and request ID |
| R4 | Let the wallet approve exactly the server-prepared payment; no server-held payer key |
| R5 | Show pending until server verification succeeds; no success inferred from wallet closure |
| R6 | Execute only after durable verified payment claim |
| R7 | Return top-three labels/scores, model version, execution time, and receipt |
| R8 | Recover status after refresh with a request-specific bearer capability |
| R9 | Refuse cross-request reuse, preserve same-request idempotency, and distinguish paid failure |
| R10 | Offer a new request only as a deliberate separate purchase |

Classification is not detection or counting. Scores are model outputs, not calibrated probabilities of correctness. Recipient labels describe configured roles; do not imply upstream model authors actually receive payments.

## Chosen stack and dependency boundary

| Layer | Selection | Purpose / constraint |
| --- | --- | --- |
| Runtime/web | Node 24 LTS, Next.js App Router, React, TypeScript | One Node server with route handlers; no Edge runtime for DB |
| UI | Tailwind CSS + selected shadcn/ui source components; Wallet UI for compatible wallet controls | Follow [design.md](design.md) and [UI_UX](UI_UX.md); one page, one theme; no dashboard framework |
| Solana | @solana/kit, @solana/react, compatible Kit wallet plugins, @solana-program/system and memo | Follow current official frontend recipe; pin interoperable versions at M0 |
| Validation | Zod for TS schemas; Pydantic in worker | Reject unrecognized or oversized fields |
| Persistence | better-sqlite3 | Single gateway instance, WAL, persistent local disk |
| Worker | Python 3.11, FastAPI, Uvicorn, python-multipart, Pillow | Private image validation and inference |
| Inference | Matched CPU torch + torchvision releases | mobilenet_v3_small; IMAGENET1K_V1 explicit weights; no training |
| Tests | Vitest, Playwright, pytest | Pure verification fixtures, DB races, browser flows, worker checks |
| Packaging | Docker Compose; HTTPS reverse proxy for deployment | Gateway and private worker; persistent data and model cache |

M0 must record exact installed versions, engine compatibility, lockfiles, and the real wallet smoke-test result. This is a deliberate package-family choice, not a claim those versions have already been installed. Use one SDK family consistently; do not silently substitute old web3.js/wallet-adapter code. A version incompatibility should be resolved once and documented before core implementation.

## External services / APIs

| Service | Required? | Credentials / use |
| --- | --- | --- |
| Solana Devnet JSON-RPC | Yes | Public endpoint initially; optional private provider URL server-side |
| Devnet faucet | Setup only | Manually fund payer plus fee reserve and both recipients |
| Solana Explorer | Receipt link | No key; signature with cluster=devnet |
| Official PyTorch weight download | Build/setup only | Cache approved weights before accepting payments |
| HTTPS host with persistent volume | Public demo | Existing capacity preferred; record selected host and URL at M0 |
| LLM API, Hugging Face token, x402 service, Supabase, paid GPU | No | Not part of the MVP dependency chain |

No API subscription purchase is assumed. Public RPC throttling is a known risk; support one operator-configured Devnet fallback. See [RUNBOOK](RUNBOOK.md).

## Operational targets (not benchmarks)

Warm-model inference target: under five seconds on the chosen CPU, excluding network settlement. Gateway should surface an unknown payment state within a 30-second bounded check, not spin indefinitely. Measure actual durations and record hardware. Accuracy is not a hackathon performance claim.

Single gateway replica; one worker invocation at a time; at most three accepted paid jobs waiting. Suspend preparation when worker readiness, storage, or queue capacity is unavailable. Recheck admission just before submission; a race after payment must become visible paid failure, never discarded evidence.

Quote lifetime: 15 minutes. Result/capability lifetime: 24 hours. Retain minimal request/payment anti-replay metadata for the demo deployment; remove uploaded bytes promptly after completion and within one hour of abandonment. Delete stale results after their lifetime without deleting used-payment tombstones.

## Nonfunctional release requirements

Strict server verification; durable request state; private worker endpoint; sensible upload/rate limits; keyboard operation; clear focus; readable mobile layout; reproducible build; no private keys in the service. No result claimed before model execution. Payment and delivery are explicitly separate.

License checkpoint: torchvision code is BSD-3-Clause; pretrained weights/dataset terms need their own review. Record source URL, resolved checksum, usage terms, and notices in the release README. Use only team-owned or suitably licensed demo images.

## Definition of done

Every MVP gate has evidence. Setup and actual service commands are added to README/RUNBOOK during implementation. API contracts, browser states, and deployed behavior agree. No placeholder deployment URL, invented benchmark, or unchecked eligibility is presented as verified.
