# Alloc — security specification

Devnet prototype, not audited payment infrastructure. Controls below are implementation requirements; verify in [TESTING](TESTING.md).

## Assets and trust

Assets: payer authorization, payment uniqueness, request/input integrity, result access, worker capacity, and private operational secrets. Browser and uploads are hostile. Gateway is trusted. Worker is trusted but private. RPC is an external dependency. Both beneficiary wallets are team-controlled demonstration roles.

No custody: the service holds **no payer or recipient private keys**. Only public beneficiary addresses are required for the app. A public key in a request is not authenticated identity; a signed payment plus request capability supplies the relevant authorization.

## Threat / control mapping

| Threat | Required control |
| --- | --- |
| Client says “paid” | Fetch actual successful transaction independently from server-selected Devnet RPC |
| Partial/wrong payment | Exact stored-message match plus decoded program/payer/amount/memo checks |
| Copied memo/signature | Unique request binding; immutable input/model/quote; bearer capability |
| Concurrent/restarted replay | UNIQUE signature and fulfillment request keys; transactional conditional transitions |
| Lost submit response | Persist signature before broadcast; reconcile same candidate, never blind re-payment |
| Unsupported transaction/parser trick | Legacy format only, exactly three allowlisted instructions, one signer; fail closed |
| Direct free inference | Private network worker + server-only bearer token; no public /infer |
| Upload bomb / file execution | 5 MiB, 16MP, decode validation, JPEG/PNG allowlist, no SVG/archives/URLs, random paths |
| Arbitrary model/code loading | Fixed model/weights list; no pickle/model upload or remote user-supplied fetch |
| Capacity abuse | Bounded storage/queue; rate limits; worker readiness/admission before payment |
| Capability theft / XSS | Hash stored token, HTTPS, same-origin API, strict output escaping/CSP, no token in URL/log |
| Secret leaks | No keys in repo/prompts; server-only RPC/internal token; scrub logs and examples |
| Result tampering claim | Mark results as trusted-worker output; do not call them cryptographically verified inference |

The memo contains an opaque UUID only. Images, user names, bearer tokens, and input hashes do not need to be published on-chain. A memo is public and permanent.

## Payment-specific requirements

Use integer lamports; total split must equal exact price. Require distinct payer/creator/provider so self-payments cannot masquerade as revenue sharing. Pre-fund recipients to avoid account-creation/rent surprises in the demo.

Missing RPC transaction/metadata is not proof of rejection. “Processed” is insufficient. Confirmed is an explicitly accepted Devnet fork risk; the receipt records that level. Successful transaction instructions are atomic together, but inference and settlement are not.

Verify wallet signature over exactly prepared bytes before broadcast. Never accept an arbitrary signed message as a transaction, a memo-shaped log from another program, or net wallet balance change as exact-payment proof. No extra compute-budget or wallet-added instructions until explicitly supported and tested; initial contract rejects them.

## Upload/storage/HTTP policy

Gateway checks raw-body limits before parsing where possible; reverse proxy enforces hard cap. Worker treats Pillow decompression-bomb warnings as errors, rejects excessive dimensions/animation, normalizes RGB, and removes metadata from output. Disallow path names from input. Uploaded bytes are outside public web root and have restrictive permissions.

Results require a request capability until its 24-hour expiry. SessionStorage enables refresh but is XSS-readable; minimize third-party scripts and do not offer durable multi-device history. Rate-limit creation/preparation per IP and payer (starting policy: 10/minute each), submissions/status to 60/minute per capability/IP with bounded backoff. Payer-only limits cannot stop wallet rotation; IP and global admission also matter.

Reject cross-origin mutations and unexpected content types; use strict same-origin CORS. Internal token comparison and request-capability hash checks must avoid accidental logging/exposure. Parameterize SQL; no raw HTML from model labels or filenames.

## Limitations and response

No decentralized worker verification, escrow, automatic refund, delivery guarantee, mainnet support, or production authentication. CPU worker timeout or crash can strand a paid request. Show PAID_FAILED and preserve the receipt. No automatic retry after uncertain execution.

If secrets leak, rotate RPC/internal tokens and disable payment preparation while repairing. If ledger corruption is suspected, stop acceptance, back up the disk, reconcile signatures against Devnet, and preserve payment tombstones. Do not reset the database to make errors disappear.

If a future real-money version is desired, first redesign delivery/recovery/refunds, confirmation policy, multi-replica persistence, abuse protection, legal obligations, and security review. That work is outside this event.
