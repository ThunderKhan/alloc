# Alloc — implementation-agent instructions

## Read before changing code

Read docs/CONTEXT.md, docs/MVP.md, and the current milestone in docs/IMPLEMENTATION_PLAN.md. For affected work, read docs/PRD.md, docs/ARCHITECTURE.md, docs/API.md, docs/SECURITY.md, and docs/TESTING.md. Use docs/design.md (the copied Vercel-inspired reference) and docs/UI_UX.md (component sources, sizing/accessibility precedence, and app behavior) for the interface and docs/DEMO.md for the visible proof.

The existing concept file is docs/IDEA.md (singular, uppercase). Do not create a competing ideas.md. CONTEXT uses the supplied context-pack format, not the unrelated event rules.

## Scope and correctness

- Implement one real image classifier, one private trusted worker, fixed native Devnet SOL price/split, and a repeatable result/receipt.
- No marketplace, training, arbitrary model uploads, custom program, refunds, agent framework, or production-money support.
- Reject incorrect payments server-side. Preserve durable payment uniqueness, immutable request binding, and same-request idempotency across restarts.
- Never replace real inference/payment with a mock in a release demonstration. Tests may use explicitly labeled fixtures.
- Do not promise exactly-once computation across crashes. Follow the documented paid-failure and recovery policy.
- Payer keys stay in the wallet. Never commit seeds, bearer capabilities, .env, databases, uploads, or private logs.
- Current Solana APIs may differ from familiar examples: verify compatible versions at M0 and commit locks. Follow the one chosen SDK family.

## Workflow

Inspect actual code/status before assuming a milestone is done. Implement the smallest missing acceptance gate. Run meaningful checks for affected payment/data/worker behavior. Update contracts when behavior changes, and write actual evidence into the release record in docs/RUNBOOK.md.

Choose a presenter and submission owner early; do not invent their identities. Distinguish plans from tests actually run. Document third-party model provenance and AI assistance. Prefer boring, complete behavior over optional surface area.

This file does not request delegation or parallel agent work. Follow the user's current authorization for repository changes; do not buy hosting or services merely because the plan mentions deployment.
