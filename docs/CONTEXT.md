# ALLOC — FULL CONTEXT PACK

You are helping build Alloc for the MLH Solana Hackathon. Read this pack first, then the linked implementation documents. This file reuses the supplied example's organization, not its unrelated event rules, dates, technology restrictions, or prize claims.

Source of concept: [IDEA.md](IDEA.md). Last event check: 7 November 2026 IST. Repository: https://github.com/ThunderKhan/alloc.

# THE EVENT

Online Solana × MLH event, November 6–8, 2026. Official references:
- https://events.mlh.com/events/15200-solana-hackathon
- https://www.mlh.com/events/solana-hackathon

The first page was readable; the second could not be retrieved in this documentation session. Use the live submission form to verify its fields, restrictions, and any updated rules. Do not substitute search snippets for that check.

# THE ONE RULE — WHAT COUNTS AS A COMPLETE ALLOC DEMO

One image → one verified Devnet payment split → one real classification → one inspectable receipt. No unpaid inference, cross-request payment reuse, or hidden mocked success.

This is our scope rule, not an organizer quotation. Dependencies and pretrained models are allowed in this plan; **there is no zero-dependency restriction**.

# TRACKS

Primary target: AI. Secondary ambition: overall placement. Both AI inference and Solana settlement must do observable work. Beginner eligibility remains unconfirmed; verify the team's composition before selecting it. No DeFi positioning solely because funds move.

# DELIVERABLES

Our release bundle: public repository, runnable app, reproducible setup, public short demo video, transaction evidence, test summary, model attribution, and completed submission form. Exact required fields and event-specific video limits still need checking in the form.

Generic MLH digital guidance suggests a public video no longer than two minutes and naming the event at the start. Adopt that conservative format unless the event says otherwise.

# SCORING

No event-specific percentage rubric was verified. Generic MLH criteria cover technology, design, completion, and learning. The screenshot's claim that presentation is 40–50% is anecdotal, not an event rule.

# PRIZES

Award details live on the official pages. Do not spend build time optimizing for unverified eligibility or prize amounts.

# OUT OF SCOPE

Public marketplace, provider bidding, arbitrary model uploads, training, counting/detection, multiple models, token issuance, subscriptions, custom on-chain program, escrow/refunds, proof-of-compute, production real-money use, and autonomous agents.

An optional bounded API client may use the same gateway only after every MVP gate passes; it is not required for submission.

# RULES

Event-specific directions take precedence. Pending confirmation, follow generic MLH guidance: build during the event, keep code/video public, disclose AI assistance and third-party components, and complete registration. Do not infer team-size or tool restrictions from the unrelated supplied template.

Never put private keys in prompts, source, browser storage, screenshots, or docs. Devnet only.

# TIMELINE — IST (UTC+05:30)

| Event | IST | UTC |
| --- | --- | --- |
| Start | Nov 6, 22:30 | Nov 6, 17:00 |
| Initial submission | Nov 8, 20:30 | Nov 8, 15:00 |
| Final cutoff | Nov 8, 22:15 | Nov 8, 16:45 |

The schedule table, rather than a conflicting search-result header, is the planning source. Three calendar days provide **47h45m**, not 72 hours. Follow [milestones](IMPLEMENTATION_PLAN.md), recheck changes before submission, and preserve rest and upload buffers.

# CAPABILITY MATRIX — WHAT SHIPS

| Capability | Decision |
| --- | --- |
| Classifier | One CPU MobileNetV3 Small, explicit pretrained weight version |
| Settlement | Two native-SOL transfers plus one request memo in one legacy transaction |
| Verification | Independent server RPC check and exact stored transaction-message match |
| Persistence | SQLite on a persistent disk, one gateway replica |
| Frontend | Next.js/TypeScript, wallet signing only |
| Compute | Private Python/FastAPI worker |
| Proof | Real Explorer signature, result, negative tests |

# STACK CHEAT-SHEETS

See [PRD](PRD.md) for packages and [API](API.md) for endpoint contracts. Start from current official Solana Kit/React guidance; verify compatible package versions at milestone M0 and commit lockfiles. Never combine copied legacy SDK examples with current APIs.

# PER-TRACK GUIDANCE

Our advantage hypothesis is a compact, trustworthy demonstration of separate model and compute revenue. It is not a claim to have invented micropayments. Show the split and the enforced payment boundary, not a fictional marketplace.

# OPTIONAL CHALLENGES

Only after the core is green: one capped Devnet client using the same API. No extra protocol, agent framework, MCP server, or model required.

# FAQ

**Is computation on-chain?** No; only settlement and request reference are on-chain.

**Does atomic payment guarantee delivery?** No. Two transfers are atomic together; subsequent inference can fail.

**Who made the model?** Upstream authors supplied the pretrained model. The creator wallet is a demonstration beneficiary, not proof our team trained it.

**Can it count inventory?** No. IDEA's counting example is broader vision; this MVP classifies one image with top-three labels.

**What is built already?** At this documentation baseline, only README and IDEA existed. All implementation checks start unverified.

---

END OF CONTEXT PACK.

When continuing: read the relevant contract, inspect the repository, state the current milestone, implement the smallest missing acceptance criterion, test it, and update evidence. If a fact is unknown, mark it unknown.
