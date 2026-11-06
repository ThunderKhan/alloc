# Alloc — setup, operations, and handoff

**Planned procedure.** Deployment URL, selected host, installed versions, commands, and test results remain unverified until implementation fills the release record below.

## M0 prerequisites

Choose an existing Docker-capable host with persistent local volume and HTTPS, rather than assuming serverless filesystem persistence. No paid resource provisioning is authorized by this plan. If public hosting is unavailable, record that immediately and keep a reproducible local demo plus authentic recording; do not claim a public deployment.

Install pinned Node 24/Python 3.11 environments or use Docker. Record compatible Solana Kit/React program-client versions, matched torch/torchvision CPU versions, and lockfiles. Use a wallet that supports signing the prepared legacy transaction without mutation; prove this before building around it.

Create three distinct Devnet wallets. Back up seeds privately; only public addresses enter configuration. Fund payer with price plus several transaction fees and pre-fund both beneficiaries. Confirm balances and endpoint cluster. Do not depend on a faucet during recording.

## Configuration contract

| Variable | Where | Meaning |
| --- | --- | --- |
| APP_ORIGIN | Gateway/proxy | Exact HTTPS app origin |
| SOLANA_CLUSTER | Server + public UI | Must be devnet; reject other value |
| SOLANA_RPC_URL | Server only | Devnet endpoint; private provider token stays server-side |
| SOLANA_RPC_FALLBACK_URL | Server only, optional | Verified Devnet fallback, same verification policy |
| CREATOR_PUBLIC_KEY | Server; public in quote | Model demonstration beneficiary |
| PROVIDER_PUBLIC_KEY | Server; public in quote | Compute demonstration beneficiary |
| PRICE_LAMPORTS | Server | 10000000; fixed for release |
| CREATOR_BPS | Server | 7000; provider receives remainder |
| DATABASE_PATH | Gateway | Persistent /data/alloc.sqlite |
| UPLOAD_DIR | Gateway | Persistent private /data/uploads |
| WORKER_URL | Gateway | Private service DNS, e.g. http://worker:8000 |
| WORKER_TOKEN | Gateway + worker only | Random internal auth secret |
| TORCH_HOME | Worker | Persistent/prebuilt approved weight cache |

No payer/beneficiary private-key environment variable is needed. Browser gets public model/quote data from the gateway and signs through its wallet. Gateway broadcasts the signed transaction; private RPC URL need not appear client-side.

## Build and startup contract

Implement `docker compose up --build` as the intended one-step entry point after .env setup; it does not exist yet. Services: gateway on public app port, worker private, HTTPS proxy for deployment. Mount gateway /data and worker model cache. Run DB migrations before readiness; recover pending candidates and never-started paid jobs. RUNNING jobs interrupted by restart become PAID_FAILED.

Download approved weights at build/setup, record SHA-256 and review usage terms. Startup loads explicit IMAGENET1K_V1, warms model, and reports readiness only after validation. Do not download a model after collecting a payment. Keep one gateway replica and one dispatcher.

During implementation add exact commands for locked install, local development, migration, typecheck, unit/integration tests, worker tests, build, and smoke demo to root README. Verify from a clean checkout before marking them runnable.

## Health and failure operations

Before each demo: disk writable, SQLite integrity, model loaded, worker token valid, RPC responsive, queue clear, browser wallet on Devnet, payer balance adequate. Run a real low-volume request earlier, not repeatedly while recording.

If transaction status is unknown: poll same signature with bounded backoff, optionally verify using configured fallback. Do not create another candidate until definitive reconciliation. Once a transaction lands, continue reconciliation even if browser closes or quote wall-clock expires.

If worker fails after payment: keep receipt, mark paid failure, and do not automatically invoke /infer again. If DB is unwritable: disable preparation, preserve disk and known signatures, then reconcile after repair. If restoring a backup: reconcile chain payments since backup before reopening; otherwise used-payment records may be missing.

Back up SQLite with its backup API (or stop service and copy DB consistently), not a bare hot copy that ignores WAL. Store backups privately. Never clear used signatures for a cosmetic demo reset. Purge images independently of payment tombstones.

## Agent handoff and release record

At each meaningful milestone update:
- current milestone, actual commit, UTC timestamp, and next acceptance criterion;
- selected host/public URL, exact runtime/package versions, model checksum and terms;
- actual setup/test commands and results, with sanitized evidence paths;
- public Devnet request/signature evidence and measured latency with hardware;
- known incomplete gates and recovery issues;
- presenter, submission owner, initial/final submission saved status.

Initial record: documentation only; implementation absent; host/versions/model terms/tests/submission status unverified. The next task is M0, not a marketplace scaffold.

## Repository hygiene

Commit code, source docs, lockfiles, and sanitized fixtures. Ignore .env, wallet keypairs, database/WAL files, upload directories, private logs, and cached model binaries unless redistribution is explicitly reviewed. Add upstream notices and AI-tool disclosure. Do not choose or assert a project license on behalf of the team without recording the decision.
