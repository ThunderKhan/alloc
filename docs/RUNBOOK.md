# Alloc — operations, recovery, and current implementation handoff

Last updated: **2026-11-07 UTC** · branch: `feat/paid-inference-mvp-20261107`.
**Milestone: M0–M4 implemented source; CI green for model, gateway, persistence and browser fixtures. Live paid Devnet acceptance and public deployment remain blocked/unverified.**

This file separates implemented source, tests actually passed, and externally blocked acceptance. Do not label working-looking code as a proven payment.

## Source and progress

- Baseline main `fa59287`: specifications and reference design only; no source application.
- `b9308cd`: private FastAPI worker for real MobileNetV3 Small, pinned ImageNet weights, input validation and tests.
- `16e24ec`: Node/TS package pins, SQLite WAL schema, capability hashes, payment uniqueness, restart-safe interrupted-job state.
- `0bf8277`: exact prepared legacy transfer/transfer/memo, Ed25519 signature checking, independent confirmed Devnet RPC evidence and one durable claim, CPU job dispatch.
- `10b7f15`: authenticated quote/payment/status API and worker-readiness admission.
- `1c5f023`: one responsive upload/wallet/payment/result/receipt workbench, matching copied monochrome Geist reference.
- `2d671c0`: fix multipart field counting and duplicate-field checks.
- `0dea079`: payment and database unit tests, Docker, CI, README and operational commands.
- `c5237aa` + Actions bot: resolved and committed reproducible `package-lock.json`.
- `e0c9ff3`–`443c762`: Kit API compatibility, stored immutable price/split, startup recovery, ten-process claim race, bounded upload streams, browser failure/recovery tests and patched dependencies.
- `cc4baea`: opt-in real Devnet smoke using temporary in-memory test wallets (no private keys stored). This run was **blocked at faucet funding**, not a successful payment.
- `2dec09b`: pinned-model file full SHA-256 check; model load fails before accepting payments if cache is missing/tampered.
- `91d4e2c`–`fa94f96`: wallet partial-signing of exact Kit transaction and lifetime reconstruction, fixed quote recovery.
- `8b1ae1c`: restart-safe rebroadcast of the *same* signed candidate after a crash before network submission; never authorize a second signature.
- `1d784a9`: independent Docker Compose deployment smoke CI and complete npm audit reporting.
- `8b4ad51`–`66dded4`: independent legacy-wire instruction decoder verifying exact payer/beneficiaries/amounts/memo, contract-preserving explicit Memo v2 builder; final v2 commit awaiting its own CI pass.
- `390c080`: upgrade test-only Vitest to patched v4; subsequent npm audit reports zero advisories.

**Implemented (source present, not execution proof)**: private /validate and /infer, immutable upload/quote, server-bound signed payment candidate, single-signer check, two-recipient/memo prepared bytes, signature collision tombstones, post-RPC verification and unique claim, conditional worker dispatch, stored result/receipt, paid-failure and refresh UI, Docker Compose /data persistence.

**Not yet verified**: actual browser wallet signing, genuine Devnet split, cross-restart live chain claim, Docker deployment on persistent host, and three fresh paid model outputs. GitHub Actions **42325487964** (commit 3aa8479) passed Node 24 installation, TypeScript, **15 Vitest gateway tests** (including cross-process SQLite claims and exact legacy-wire parsing), Next 16.4.5 production build, **5 Chromium UI fixture tests**, **6 worker security tests** and **1 genuine CPU pretrained-model test**. Logs: https://github.com/ThunderKhan/alloc/actions/runs/42325487964 . The explicit Memo v2 builder+strict parser commit **66dded4** has a separate CI run pending at this documentation snapshot. These checks do NOT prove a funded Solana transaction or human wallet approval.

## Environment and dependencies

- Gateway selected: Node **24 LTS**, Next **16.4.5**, React **19.3.0**, `@solana/kit` **8.5.0**, `@solana/react` **8.5.0**, `@solana/kit-plugin-wallet` **0.21.0**, `@solana/kit-plugin-rpc` **0.19.0**, `better-sqlite3` **12.4.1**. Exact package pins are in `package.json`; resolved `package-lock.json` is committed and validated with `npm ci` on CI.
- Private worker selected: Python **3.11**, CPU `torch==2.10.0` + `torchvision==0.25.0` and `worker/requirements.txt`. `MobileNet_V3_Small_Weights.IMAGENET1K_V1`, built-in torchvision preprocessing and class metadata, `eval()`, `inference_mode()`. The Docker worker downloads the official weights *at build time*, never after payment.
- Actual execution environment for code authoring has Node 22.16.0 and Python 3.13.5, **not** chosen deployment versions. We used the connected GitHub API to commit source; no local Node install/build was executed. The Python environment has torch 2.10.0+cpu and torchvision 0.25.0+cpu but these are not evidence that the checked-in worker was run.
- Model source: https://pytorch.org/vision/stable/models/generated/torchvision.models.mobilenet_v3_small.html . The pinned `IMAGENET1K_V1` weights are from upstream PyTorch, not produced/trained by Alloc. Torchvision code is BSD-3-Clause. Downloaded model file SHA-256 on GitHub Actions: **047dcff4addef86ea5bc2eff13c9614dc11f47ab1160d0a71a25e7db994f4e1f** (run 42324361698). Docker refuses to load a missing or hash-mismatched cache; separate upstream ImageNet dataset usage/license suitability for non-demo production remains to be reviewed.
- Repo's `docs/design.md` is preserved verbatim; `docs/DESIGN_LICENSE.txt` contains Dima Braven's MIT attribution. Only selected local-style components; no second component framework/dashboard.
- AI development disclosure: ChatGPT (GPT-6) was used to author planning documentation, source, tests and implementation guidance; source should be reviewed and tested by maintainers.

## Reproduction commands (core CI passed; Docker deployment still unverified)

```bash
git clone https://github.com/ThunderKhan/alloc.git
cd alloc
git switch feat/paid-inference-mvp-20261107
cp .env.example .env
# Fill CREATOR_PUBLIC_KEY, PROVIDER_PUBLIC_KEY with two distinct DEVNET PUBLIC addresses.
# Set WORKER_TOKEN to a local random secret: openssl rand -hex 32
# No seed phrase, secret key, or test-keypair file belongs in the repo or prompts.
npm ci
npm run typecheck
npm test
npm run build
docker compose up --build
curl -i http://localhost:3000/api/v1/health
```

Worker isolation tests:
```bash
python3.11 -m pip install torch==2.10.0 torchvision==0.25.0 --index-url https://download.pytorch.org/whl/cpu
python3.11 -m pip install -r worker/requirements.txt pytest httpx
PYTHONPATH=worker python3.11 -m pytest worker/test_app.py -q -m 'not live_model'
ALLOC_REAL_MODEL_TEST=1 PYTHONPATH=worker python3.11 -m pytest worker/test_app.py -q -m live_model
```

The gateway is bound to **localhost port 3000** by `compose.yaml`; the worker port is not published. **Docker Compose deployment smoke passed** on GitHub Actions https://github.com/ThunderKhan/alloc/actions/runs/42325153752 : actual Docker build of both services, readiness, fixed model/price/recipient checks, protected request route, and persisted `/data` marker across gateway restart. This is not a publicly deployed URL and does not prove wallet signing. For external public demo, configure a separately managed HTTPS reverse proxy with explicit upload size cap and persistent storage, then verify full flow through that public origin. No hosting purchased or provisioned yet; public app URL **unknown**. Public Devnet RPC `requestAirdrop` returned HTTP 410 in live smoke run https://github.com/ThunderKhan/alloc/actions/runs/42324588291 (2026-11-07 UTC). The smoke test exited at its faucet step **before creating a quote or broadcasting any payment**. It is not real settlement evidence. User-controlled Devnet wallet funding or permitted faucet action is needed. Avoid embedding private key material or automated wallet keys in persisted GitHub logs.

## Configuration / wallet boundary

Copy `.env.example` and set:
- `SOLANA_CLUSTER=devnet`, `SOLANA_RPC_URL=https://api.devnet.solana.com` (or another independently verified Devnet endpoint), optional Devnet fallback.
- `CREATOR_PUBLIC_KEY`, `PROVIDER_PUBLIC_KEY` — public keys only, distinct from each other and payer.
- `WORKER_TOKEN` — private random bearer shared only by gateway and private worker.
- `DATABASE_PATH=/data/alloc.sqlite`, `UPLOAD_DIR=/data/uploads` for Compose gateway, `WORKER_URL=http://worker:8000`, `APP_ORIGIN`.

**Operator action pending**: prepare **three distinct browser/team-controlled Devnet wallets** (payer, creator, provider); only public beneficiary addresses are entered in configuration. Payer wallet must be able to sign (not automatically send) the prepared one-signer legacy transaction; fund via an available authorized Devnet faucet with at least 0.01 test SOL plus network-fee reserve (the public RPC airdrop may be unavailable: HTTP 410 observed). Do not send private keys or seed phrases to ChatGPT.

## Trust boundaries and recovery

1. Gateway hashes the uploaded image and capability before saving the quote. Quote pricing is fixed: 10,000,000 lamports, split 7,000,000 + 3,000,000. UUID request memo is public.
2. Gateway prepares exactly three ordered instructions in a **legacy transaction** and stores immutable unsigned bytes and recent blockhash. Browser wallet signs this message, never sending its secret to the app.
3. Gateway checks signed message byte equality, payer Ed25519 signature, single signer and size, stores signature + signed candidate in SQLite **before** network broadcast.
4. A server-selected **Devnet** RPC must show successful transaction, matching exact signed bytes, slot and quote time, then gateway atomically claims payment via UNIQUE keys. RPC null/unavailable means **PENDING**, not failed; only definitive observed errors may advance failure.
5. Dispatcher transitions PAID→RUNNING transactionally and runs the fixed private worker only after verified claim. Result is persisted with public receipt. On interrupted RUNNING, startup marks PAID_FAILED; do not automatically repeat uncertain computation. Preserved payments remain visible in failed cases.
6. SQLite remains a **single-gateway-replica** requirement; never scale out to independent local SQLite disks. Back up with SQLite backup API; don't hot-copy only the DB file without WAL. Never wipe ledger signatures to reset a demo.
7. No guarantee of exactly-once compute or refund, no on-chain computation proof, no mainnet, no production-money use. Signed payment confirmation is a Devnet prototype guarantee, not inference delivery guarantee.

If Devnet RPC fails, check the **same** candidate signature on an independently configured Devnet endpoint; never prepare a new payment until the outcome is reconciled. A chain write may succeed after the send request times out. If worker fails after payment, preserve receipt and show paid failure.

## Test evidence / acceptance

| Check | Status as of this handoff |
| --- | --- |
| Code files and documented architecture | Implemented in feature branch |
| Unit payment parsing/signature hostility tests (`tests/chain.test.ts`) | **PASS** on GitHub Actions run 42325487964 |
| SQLite UNIQUE claims/capability/restart read (`tests/db.test.ts`) | **PASS** in CI 42325487964; 10 competing separate Node processes claim exactly once |
| Worker auth/validation/forged-input rejection tests | **6 passed** in CI 42325487964 |
| Fresh real PyTorch CPU inference on two images | **PASS** on GitHub Actions: opt-in test classified two fresh images with genuine CPU forward passes |
| Node 24/npm resolution, exact lockfile, TS/Next build | **PASS** on GitHub Actions run 42324361698 |
| Browser width 360/768/1440 and 5 disconnected/pending/failed/success fixture UI checks | **5 passed in Chromium**; actual wallet signing/keyboard manual review pending |
| Actual Devnet signature and Explorer recipients | **Not performed**; automated live attempt failed at Devnet faucet HTTP 410 before payment; needs funded wallets and payer approval |
| Three fresh paid end-to-end runs | Not performed |
| Persistent deployment and two demo rehearsals | Not performed |
| Short public video, screenshots, submitted entry | Not performed |

CI found vulnerabilities in the original Next 16.3.8/Zod 4.1.12 pins; updated to patched Next 16.4.5 and Zod 4.6.7. Latest npm audit produced **zero advisories for both runtime and development dependencies** following Vitest 4.1.12 upgrade (GitHub Actions 42325487964).

The main release gate remains **one authentic paid Devnet inference tied to its matching Explorer receipt**. A mock payment or prefilled prediction cannot satisfy it.

## Schedule and external deadline

MLH event header reports **Nov 8 at 1:00 PM EST**, but its detailed schedule lists an **earlier final deadline at 11:45 AM EST**. Keep earliest **Nov 8 22:15 IST** hard cutoff and earlier internal final target **21:30 IST**, with internal initial target **19:30 IST**. Check the live submission form before entering; do not submit without explicit user authorization. Presenter and submission owner are **not assigned**.

## Next engineer's sequence

Review current pull request and latest branch CI; reproduce Docker build/health with persistent storage; investigate remaining dev-only dependency advisories, then obtain operator-funded Devnet wallet approval for a genuine payment. The public RPC faucet produced HTTP 410, not a signature. When funded, run the live smoke and browser-wallet test, recheck exact message binding and receipt, then deploy with a persistent volume. Fix browser states and pending/paid failure edges, run restart/concurrency tests, and deploy with persistent volumes. Record real UTC timestamp, commit, commands and conclusion, only real signature and Explorer link, real measured CPU time, and user-provided public demo URL.

Do not claim all MVP gates pass solely because the source exists.


### Memo-program version compatibility (7 November 2026)

The generated `@solana-program/memo@0.16.0` instruction defaults to Memo v4 (`Memo4c2p...`), unlike the committed legacy payment contract (`MemoSq4...`). The implementation explicitly constructs a Kit instruction with the original Memo v2 address and UTF-8 request memo; the independent legacy parser enforces that same program. This is an exact contract fix, not a payment/split change. Verify GitHub CI for the resulting commit before marking its tests green. No real Devnet payment is claimed from this correction.
