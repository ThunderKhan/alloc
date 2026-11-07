# Alloc

**Compute independently. Earn collectively.**

A scoped Solana Devnet prototype: one image → fixed payment quote → one wallet-approved atomic transaction sending **0.007 test SOL** to the configured model-beneficiary wallet and **0.003 test SOL** to the compute-beneficiary wallet → independent server payment verification → private pretrained MobileNetV3 Small CPU inference → durable result with Solana Explorer receipt.

**Status: implemented and automated tests passing; a browser-approved live Devnet payment and public deployment are still not confirmed.** Payment must be real, never faked. Do not treat UI code, mocked unit tests, or an unexecuted request as payment evidence.

## Quick local setup

Requires Node.js 24, Python 3.11, and optionally Docker Compose. From a clean checkout:

```sh
cp .env.example .env
# Edit .env: set two DIFFERENT Devnet recipient PUBLIC addresses and WORKER_TOKEN.
# Generate token locally: openssl rand -hex 32
# No private keys belong in .env, code, or logs.
npm ci
npm run typecheck
npm test
npm run build
docker compose up --build
```

The gateway runs on `http://localhost:3000` (loopback only). The worker is accessible only inside the Docker network. To run a public demo, put an HTTPS reverse proxy with an explicit upload-size limit (at least the app's 5 MiB cap, no unbounded payloads) in front of the gateway and configure `APP_ORIGIN`. **Do not deploy the gateway on ephemeral serverless storage**: SQLite and uploads need a persistent volume and one gateway replica.

For development without Docker, start the worker with Python 3.11 and the pinned requirements, set `TORCH_HOME`, `WORKER_TOKEN` and `WORKER_URL=http://127.0.0.1:8000`, then run `npm run dev`.

## Operator requirements

Configure exactly two recipient public addresses and connect a **third distinct payer wallet** on **Solana Devnet**. The payer needs faucet-funded test SOL plus a network-fee reserve; recipients should be pre-funded. Wallet must support sign-transaction without broadcasting; gateway stores signed bytes before broadcasting and verifies the actual confirmed transaction. A transaction's memo includes public request ID, not a secret or image hash. The capability is returned only once and retained in browser sessionStorage for refresh.

`SOLANA_CLUSTER=devnet` is mandatory; never use real-money mainnet. Only the browser wallet signs. The private worker requires a server-only bearer token. No refund, delivery guarantee, or proof-of-computation is claimed.

## Checks

- `npm run typecheck` / `npm test` / `npm run build` — TS, payment fixtures, and SQLite durability.
- `PYTHONPATH=worker python -m pytest worker/test_app.py -q -m 'not live_model'` — worker security and upload validation.
- `ALLOC_REAL_MODEL_TEST=1 PYTHONPATH=worker python -m pytest worker/test_app.py -q -m live_model` — actually loads and runs pinned pretrained CPU weights; may download weights.
- `docker compose up --build` — gateway and private worker with persisted volumes.

CI checks are independent of a real browser wallet or Devnet funding. The required live transaction, three fresh paid runs, browser testing, and public deployment must be recorded separately in [docs/RUNBOOK.md](docs/RUNBOOK.md).

**Third-party:** pretrained MobileNetV3 Small and torchvision by upstream PyTorch authors (model not trained by this project). Visual style based on an MIT-licensed community reference: [docs/design.md](docs/design.md) and [license](docs/DESIGN_LICENSE.txt). AI-assisted development: ChatGPT GPT-6 helped write documentation and implementation; outputs require actual testing and human review. See [docs/](docs/README.md) for architecture, scope, security, testing and demo.
