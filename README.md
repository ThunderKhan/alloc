# Alloc

**Compute independently. Earn collectively.**

A hackathon prototype specification for paid AI inference: one image classification, with one Solana Devnet transaction splitting the price between a model beneficiary and compute provider.

**Current status:** documentation only. No implemented app, deployment, or passing tests claimed.

Start with [docs/README.md](docs/README.md), then [CONTEXT](docs/CONTEXT.md), [MVP](docs/MVP.md), and the [implementation plan](docs/IMPLEMENTATION_PLAN.md). The original concept is in [IDEA](docs/IDEA.md).

Target: MLH Solana Hackathon, November 6–8, 2026. [Official schedule](https://events.mlh.com/events/15200-solana-hackathon) · [Event/submission page](https://www.mlh.com/events/solana-hackathon).

The required demo uses one pretrained classifier, one trusted worker, and three distinct team-controlled wallets. Payment splitting is atomic; subsequent inference delivery is not. Test SOL only. No marketplace, custom contract, training, or autonomous agent is required.

Implementation agents: read [AGENTS.md](AGENTS.md). Actual setup commands, dependency locks, deployment URL, model attribution, test results, and AI-tool disclosures must be added as the build progresses.
