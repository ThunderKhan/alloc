# Alloc — public HTTPS deployment (unexecuted host handoff)

This describes a deployable **single-gateway, private-worker, persistent-volume** configuration. No host, domain, public URL, real wallet-approved payment, or deployment success is implied by committing these files. Hosted CI Docker smoke tests local containers only.

## Where to run

Use a user-controlled Linux Docker host with available storage/CPU for PyTorch, durable named Docker volumes, TCP ports 80/443 reachable, and a domain/subdomain with an A/AAAA DNS record pointing at that host. Public HTTPS is provided by the optional Caddy overlay. The connected Vercel account cannot by itself satisfy the in-process scheduler, private long-lived worker and durable local SQLite ledger. Do **not** put the gateway on an ephemeral/serverless filesystem or create two independent gateway replicas. No paid hosting is required or authorized by this document.

## Prepare safely on the host

```sh
git clone https://github.com/ThunderKhan/alloc.git
cd alloc
git switch feat/paid-inference-mvp-20261107
cp .env.example .env
chmod 600 .env
# Edit .env locally:
# PUBLIC_DOMAIN=alloc.your-real-domain.example (DNS points to this host)
# CREATOR_PUBLIC_KEY=<public Devnet beneficiary 1>
# PROVIDER_PUBLIC_KEY=<public Devnet beneficiary 2>
# WORKER_TOKEN=<locally generated secret, e.g. openssl rand -hex 32>
# APP_ORIGIN is overridden by the HTTPS compose overlay.
# Keep SOLANA_CLUSTER=devnet and use a verified Devnet RPC.
# Do not put any private keys, seeds or request capabilities into .env.
docker compose -f compose.yaml -f compose.https.yaml config --quiet
docker compose -f compose.yaml -f compose.https.yaml up --build -d
docker compose -f compose.yaml -f compose.https.yaml ps
node scripts/public-readiness.mjs https://alloc.your-real-domain.example
```

The gateway port remains bound to host loopback on 127.0.0.1:3000 and is also reachable by Caddy on Docker's private network. Only Caddy publishes 80/443. The worker's 8000 port is **not** published. Caddy's request-body cap is 6 MB; the gateway enforces its stricter 5 MiB image limit. Keep firewall and DNS limited to the intended host; automatic certificate issuance requires successful public HTTP/HTTPS reachability. Verify HTTPS from a separate device/network, not only from the host. Use exactly one gateway replica.

## Release checks and real-payment evidence

Run the public probe above, then upload JPEG/PNG in a desktop browser with a Solana wallet set to **Devnet** and supporting `signTransaction` / Wallet Standard signing without automatic broadcast. Use **three distinct wallets**: the payer in the browser, and configured creator/provider public addresses in .env. Fund the payer with at least 0.01 test SOL plus fee reserve using an authorized faucet; the public RPC airdrop previously returned HTTP 410, so **do not repeatedly retry it**. All secrets stay in wallet applications. Confirm the single prepared transaction contains the expected 0.007 + 0.003 SOL native transfers and the Alloc request memo, then approve once.

Observe `PAYMENT_PENDING` until independent RPC verification, then the genuine model result and receipt. Copy only non-secret evidence: tested commit, UTC time, public request UUID, signature, Devnet Explorer URL, recipient addresses, confirmed slot, actual top three classes and measured inferenceMs. Never copy bearer capabilities, signed blobs or private images into the repository. Test three fresh purchases with at least two different images. Exercise refused/replayed payment, paid worker failure, gateway restart, and cached result access. These checks remain **unverified until actually performed**.

Run this on the deployed host after an upgrade or restart:

```sh
docker compose -f compose.yaml -f compose.https.yaml restart gateway
node scripts/public-readiness.mjs https://alloc.your-real-domain.example
```

Do not erase the database to reset a demo. Keep signature tombstones. Take regular SQLite online backups (the WAL file makes naive copies of an open database unsafe); test restoration on an isolated copy before release. Preserve the gateway `alloc-data` volume across recreations, together with model and Caddy data volumes. Do not run `docker compose down -v` on a deployed ledger.

## What still needs operator access

A DNS name pointing to a Docker host with durable volumes and open 80/443; the public creator/provider addresses in the host's private .env; a separate Devnet payer browser wallet funded with test SOL. Without that host the Compose overlay is a **tested configuration candidate**, not an accessible public deployment. Do not paste wallet private keys, secrets, or session capabilities into chats or build logs.
