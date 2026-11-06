# Alloc — testing and release evidence

This is a test plan. **No tests have run or passed at this documentation baseline.** Test the risky boundaries rather than mirroring UI implementation.

## Verification layers

| Layer | Tool / focus | Required evidence |
| --- | --- | --- |
| Payment unit tests | Vitest; RPC-decoding fixtures and exact message validation | Happy + hostile transaction cases |
| Persistence integration | Real temporary SQLite DB; concurrent submits/restart | Unique claim and durable result |
| Worker | pytest; actual CPU model and hostile images | Real outputs, validation, no free forward pass |
| Browser | Playwright; wallet mocked for deterministic error flows | State correctness and accessibility basics |
| Live acceptance | Real wallet + Devnet + deployed gateway/worker | Genuine signature, output, both recipients |
| Setup | Clean checkout/container build with persistent volume | Repeatable documented commands |

Mocks may isolate tests. They never count as live chain or inference evidence.

## Critical cases

| ID | Scenario | Expected outcome |
| --- | --- | --- |
| T01 | Exact two transfers + memo; confirmed successful transaction | One durable claim and one result |
| T02 | Missing signature, unknown transaction, failed transaction | No inference; pending distinguished from failure |
| T03 | Wrong payer or fee payer; payer not required signer | Reject |
| T04 | Creator/provider swapped, under/overpaid, missing one transfer | Reject |
| T05 | Missing/wrong/duplicated memo, unrelated program or extra instruction | Reject |
| T06 | Same signed transaction under request B | Reject; B has zero worker calls |
| T07 | Ten simultaneous identical submissions for A | One fulfillment/dispatch; others return same state |
| T08 | Refresh/re-submit A after success | Cached result; no new charge or forward pass |
| T09 | Gateway restart after candidate persistence, before/after broadcast | Reconcile same signature |
| T10 | Restart after verified claim, before RUNNING | Resume the never-started paid job once |
| T11 | Kill after RUNNING / after worker response before result write | PAID_FAILED; no automatic retry |
| T12 | Restart after success; replay attempts | Existing result and uniqueness survive |
| T13 | Wrong/absent capability; public direct worker access | No result disclosure or inference |
| T14 | Invalid JPEG/PNG, spoofed MIME, huge dimensions, animation, >5 MiB | Reject before wallet approval |
| T15 | RPC timeout, malformed metadata, unsupported version | No success claim; bounded pending/error |
| T16 | Wallet rejection, insufficient SOL, expired blockhash | Clear recovery; no unknown-state re-payment |
| T17 | Expired quote with known payment confirmed inside window | Reconcile existing candidate, do not demand payment again |
| T18 | New payment after quote expiry; null blockTime | No automatic acceptance; pending/manual as specified |
| T19 | Worker timeout/failure after verified payment | PAID_FAILED + authentic receipt |
| T20 | Disk full/unwritable, missing model, saturated queue | Preparation unavailable; no skipped payment ledger |
| T21 | Secret/token/stack-trace leakage | Absent from client bundle, logs, URLs, screenshots |
| T22 | Input bytes changed after quote | Digest mismatch; never run substituted input |

Test both DB uniqueness and conditional-state transitions; merely querying before insert is vulnerable to races. Record worker forward-pass count around unpaid/replay cases. Tests for expired candidate refresh must prove a late RPC response cannot accept two payments for one request.

## Real inference checks

Load the explicit approved weights; `eval()` plus `inference_mode()`; official preprocessing. Use two distinct licensed images plus a noisy/out-of-distribution image. Verify three finite sorted scores, labels from weight metadata, and input digest alignment. Avoid brittle exact-float or exact-label tests across hardware. Show model limitations rather than hand-correcting an unexpected prediction.

Warm once before readiness. Measure compute-only time separately from payment/network time; label hardware and sample count. An “under 5 seconds” target is not a reported result until measured.

## Browser / usability checks

Widths 360/768/1440; keyboard path; visible focus; reduced motion; error announcements; long-address wrapping; wallet disconnect; image replacement; pending payment on refresh; receipt link with Devnet query parameter. Browser fixture tests do not replace a real wallet recording.

## Release gate and evidence record

Three fresh successful Devnet runs and two full rehearsals, plus all critical negative/persistence cases. Store sanitized logs/fixtures under a future `evidence/` directory; no private keys, bearer capabilities, raw private images, or signed transaction blobs.

Record each run:
- commit and UTC timestamp; operator/hardware;
- exact command and exit result;
- expected vs actual outcome and known failures;
- request ID and public signature where appropriate;
- worker call count for negative/race tests.

CI should run install from locks, typecheck/lint, payment and DB tests, worker tests, and build. Keep external Devnet/faucet-dependent runs separate to avoid flaky CI. Add actual command names once scripts exist; do not claim planned commands already work.

Release is blocked by unpaid inference, accepted incorrect payment, replay after restart, result leakage, lost payment evidence, or fabricated output. A failed optional client is not a release blocker.
