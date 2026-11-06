# Alloc — sources, advice, and confidence

Checked 7 November 2026 IST. URLs below are provenance for this specification, not evidence that the app is implemented.

## Official event and rules

| Source | What we use / confidence |
| --- | --- |
| [MLH schedule and tracks](https://events.mlh.com/events/15200-solana-hackathon) | Readable schedule table and AI-track direction; official event source |
| [MLH event/submission page](https://www.mlh.com/events/solana-hackathon) | Supplied official destination; fetch failed. Submission fields/rules still need live confirmation |
| [MLH standard rules](https://github.com/MLH/mlh-policies/blob/main/standard-hackathon-rules.md) | Generic guidance, not verified event-specific adoption: public work, AI disclosure, concise demo, technology/design/completion/learning |
| [MLH organizer judging plan](https://github.com/MLH/mlh-hackathon-organizer-guide/blob/master/general-information/judging-and-submissions/judging-plan.md) | General context only; does not establish this event's judging duration |

Search caches had inconsistent header time and submission-platform wording. Use the directly opened schedule table for planning; verify the current form rather than assume Devpost or MLH Challenges fields.

## Technical primary references

| Source | Design decision |
| --- | --- |
| [Solana transactions](https://solana.com/docs/core/transactions) | Multiple instructions execute atomically; fees can still be charged on failure |
| [getTransaction](https://solana.com/docs/rpc/http/gettransaction) | Server retrieves actual transaction at explicit commitment; null is not a successful payment |
| [Payment verification](https://solana.com/docs/payments/accept-payments/verification-tools) | Independent verification, memo reconciliation, double-fulfillment prevention |
| [Payment memo](https://solana.com/docs/payments/send-payments/payment-with-memo) | Public request reference alongside transfers; no private data in memo |
| [Current frontend SDK guide](https://solana.com/docs/frontend) | Kit/React and generated program-client package families; verify exact installed APIs |
| [web3.js documentation](https://solana-foundation.github.io/solana-web3.js/) | Legacy APIs differ from current releases; avoid mixing versions/examples |
| [MobileNetV3 Small](https://docs.pytorch.org/vision/main/models/generated/torchvision.models.mobilenet_v3_small.html) | Explicit IMAGENET1K_V1 and bundled preprocessing; small CPU classifier, not detector |
| [Torchvision model guidance](https://docs.pytorch.org/vision/stable/models.html) | Cache weights, eval mode, correct preprocessing, separate weight usage terms |
| [Torchvision code license](https://github.com/pytorch/vision/blob/main/LICENSE) | BSD-3-Clause code; does not by itself settle pretrained-weight/dataset permissions |

Custom request capabilities, signed-message templates, admission limits, DB claims, failure states, and milestone cutoffs are **Alloc design choices** informed by these primitives. They are not organizer requirements or guarantees supplied by Solana.

## Hackathon advice and application

| Source | Interpretation | Concrete action |
| --- | --- | --- |
| Supplied LinkedIn screenshot, attributed to Eduardo Pane; no independently verified post URL | Aggressive scope reduction and choosing a presenter early are practical heuristics; personal win count and scoring percentage are unverified | Cut marketplace/delivery guarantees; assign presenter at M0; preserve rehearsal |
| [Reddit participant discussion](https://www.reddit.com/r/hackathon/comments/1sz938i/best_hackathon_advice_youve_been_given_or_learned/) | Anecdotal emphasis on explaining/showing results; not evidence of this event's scoring | Make result, split, receipt, and failure legible in a short demo |
| MLH standard demo guidance above | Demonstrating actual work matters more than selling a vision | Show real payment + inference; keep slides optional and minimal |

We apply scope discipline without adopting the screenshot's suggestion that code quality does not matter: payment correctness and evidence remain mandatory. We do not infer that video production earns a fixed score or that any tactic guarantees a prize.

## Known unknowns to close at M0

Event-specific submission fields/video limit, team-size and eligibility rules, any additional organizer announcements, chosen hosting capacity, exact compatible dependency versions, and resolved pretrained-weight usage terms/checksum.

The supplied “Zero Dependency” text is a **format reference only**. Its dates, prizes, standard-library rules, example toolchains, and claims are unrelated and must not become Alloc requirements.
