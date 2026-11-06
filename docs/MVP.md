# Alloc — minimum viable product

## Product promise

A user uploads an image and pays a fixed Devnet price. Solana splits that payment between a model beneficiary and compute provider; a trusted worker returns a real classification with a linked payment receipt.

**One model, one worker, three distinct team-controlled wallets, one price, one screen.**

## The aggressive scope cut

We are **cutting the open marketplace and delivery-guarantee protocol**. The pitch may describe independent model/compute ownership as the vision; the demo uses configured participants and prepaid trusted inference. State this plainly.

Apply the supplied LinkedIn advice by finishing one workflow, selecting a presenter at M0, and reserving rehearsal time. Do not adopt its unverified scoring percentage or treat correctness as expendable.

## Required slice

| ID | Requirement | Completion evidence |
| --- | --- | --- |
| F1 | One JPEG/PNG, checked before payment | Valid image accepted; invalid image rejected |
| F2 | One MobileNetV3 Small classifier | New image produces genuine top-three scores |
| F3 | Fixed 10,000,000 lamport quote | 7,000,000 creator + 3,000,000 provider; fee separate |
| F4 | Payer approves one transaction | Two transfers plus unique memo visible in Explorer |
| F5 | Server independently validates payment | Failure/amount/payer/memo tampering refused |
| F6 | Durable payment claim | Concurrent replay and restart tests pass |
| F7 | Result access and payment retries are idempotent | Same request returns stored result, no second bill |
| F8 | Honest failure handling | Pending RPC and paid worker failure distinguished |
| F9 | Reproducible deployment | Persistence survives restart; app runs from clean setup |
| F10 | Understandable demo | Two rehearsals and a short public video |

## Acceptance gates

- [ ] All F1–F10 have linked evidence.
- [ ] Three fresh end-to-end Devnet runs succeed with different request IDs.
- [ ] Two distinct images cause real model invocations; no canned image-to-label mapping.
- [ ] Invalid/unpaid requests never increment the inference invocation counter.
- [ ] A payment bound to request A cannot pay for request B.
- [ ] Repeated status/result reads return the cached result for A; this is allowed, not replay.
- [ ] Only one execution dispatch occurs under concurrent payment submissions for A.
- [ ] A restart preserves payment uniqueness and successful results.
- [ ] Browser, receipt, and Explorer show matching signature, network, and split.
- [ ] Paid inference failure remains visible with its receipt; no automatic re-payment.

These boxes are release gates, not results.

## Explicit exclusions

No accounts/passwords, model catalog CRUD, dashboards, admin console, provider onboarding, GPU scheduling, token/SPL stablecoin support, custom program, refunds, escrow, fraud proofs, agents as a core dependency, object detection/counting, or training.

## When behind

Cut animation, public receipt sharing, sample gallery, then optional client. Preserve payment verification, persistence, upload validation, genuine inference, receipt, and video. If those cannot be completed, report the partial build honestly. Never replace the payment gate or real inference with a mock to claim completion.

## Success and limits

Success means a repeatable prototype, not market validation, low-latency claims, or a guarantee of winning. Model license review and third-party attribution remain release tasks. See [PRD](PRD.md), [TESTING](TESTING.md), and [DEMO](DEMO.md).
