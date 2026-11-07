# Alloc — demonstration and submission

## Story and advantage

“Our model beneficiary and compute operator are separate roles. Alloc makes one inference purchase distribute their configured shares in a single inspectable Solana payment.”

Advantage hypothesis: the result, both beneficiaries, and a meaningful rejection are shown together. No guaranteed winning claim, market-size slide, or assertion that split payments are a new invention.

Appoint the presenter at M0; rehearse the exact flow twice. Generic MLH guidance favors a working demonstration and a short public video. Use a **115-second target**, subject to event-specific instructions.

## Recording script (target 1:55)

| Time | Show / say |
| --- | --- |
| 0–10s | “This is Alloc, built for the Solana Hackathon.” One-sentence problem; show Devnet badge |
| 10–25s | Show classifier, upstream model attribution, separate demo beneficiaries, 70/30 split |
| 25–45s | Choose an image, review exact quote and wallet transaction, approve payment |
| 45–65s | Show server verification and genuine classifier result; distinguish settlement wait from inference time |
| 65–85s | Open real Explorer transaction; inspect both transfers and request memo |
| 85–105s | Show a prepared negative test: A's payment cannot buy B's inference; worker count for B stays zero |
| 105–115s | “We scoped to one model and trusted worker. Payments split atomically; compute delivery is not guaranteed.” Close with tested learning |

If live settlement takes too long, edit an authentic recording to fit and label the time cut. Do not substitute another run's receipt or a fake successful state. Never reveal capability or wallet seed. Use zoomed readable UI rather than decorative video effects.

## Negative demonstration

Use a development/test command prepared during implementation, not an unsecured public “bypass” endpoint. Attempt cross-request reuse of the signed fixture against a second request through the same verifier, show rejection and zero worker invocations. If executing a signed payment blob is needed, keep it private and redact it from artifacts.

For a live follow-up, unpaid /infer is inaccessible and a missing/incorrect payment cannot produce a result. Reading A's cached result again is intended idempotency; do not call that an exploit.

## Honest claims / common questions

| Question | Answer |
| --- | --- |
| Why use Solana? | Direct atomic distribution to two wallets and independently inspectable settlement |
| Could a centralized app do this? | Yes. This prototype explores direct shared settlement, not a claim that databases cannot track payouts |
| Is the compute decentralized? | No; one trusted team-controlled worker |
| Who trained the model? | Upstream authors; our model beneficiary is a configured demonstration role |
| Does a receipt prove correct inference? | It proves the checked payment; the worker result is trusted |
| What if compute fails? | Preserve paid-failure receipt; automatic refund/escrow is not implemented |
| Is it an AI agent? | Core is real image classification; agent purchasing is optional future/interface work |
| What did you cut? | Marketplace, multiple providers, custom contract, delivery guarantee, autonomous spending |
| What did you learn? | Fill with actual technical learning: transaction reconciliation, request binding, restart-safe claiming |
| How does it scale? | Shared DB/queue/object storage and worker recovery protocol; current release is single-gateway |

## Submission checklist

- [ ] Recheck official form, event-specific rules, allowed team size, eligibility, video length and required fields.
- [ ] Registration complete; team members and AI tools accurately disclosed.
- [ ] Public repository readable logged out; actual setup commands and limitations documented.
- [ ] Public short video playable logged out; event name stated at start.
- [ ] Working HTTPS URL tested from another browser.
- [ ] Exact tested commit/tag, model/weight attribution, demo-image license notes, and actual test summary included.
- [ ] Initial submission saved before its cutoff; final saved version checked before final cutoff.
- [ ] Public signature and Explorer link match the demonstrated request.
- [ ] Any mocks, edits, service outages, incomplete scope, or known failures disclosed.

See [CONTEXT](CONTEXT.md) for official schedule, [IMPLEMENTATION_PLAN](IMPLEMENTATION_PLAN.md) for earlier internal targets, and [SOURCES](SOURCES.md) for rule confidence.

## Failure fallback

Maintain a genuine recorded run and local reproducible setup. If public RPC or hosting fails, disclose the outage and show the earlier recording as such. Never label local-validator output as Devnet or change to mainnet. Submit the best honest working slice before the deadline rather than risking the entry for one more feature.

## Genuine screenshot capture plan (no artifacts captured yet)

Only capture from the *same real* paid request on the public HTTPS origin after wallet approval and server-verified Devnet settlement:

1. **Quote before approval**: image preview, immutable request ID, Devnet price, both full beneficiary addresses and 70/30 amounts. Use a sample image with clear use rights.
2. **Wallet approval**: browser wallet visibly on Devnet, review of the same one transaction where supported; keep seed phrases, private keys and any unrelated balances out of frame. Do not enable automatic confirmation for a human-wallet proof.
3. **Completed result and receipt**: top-three actual classes, real inferenceMs, signature, both recipients and request memo; request ID must match the quote.
4. **Solana Explorer**: open the exact receipt signature with `?cluster=devnet`; show two successful native SOL transfers and memo in one transaction.
5. **Failure/recovery evidence** separately labeled: pending and paid-failure/replay traces may be fixture screenshots but must never be portrayed as real settlement.

Never screenshot browser sessionStorage, request capabilities, signed base64 transactions, private model worker tokens or wallet recovery details. Keep timestamps and tested commit in an evidence manifest and cross-check the Explorer signature. A screenshot or animation of an unpaid state is not a successful paid-run proof.
