# Alloc — UI/UX specification

## Direction

A compact **settlement workbench**: technical, calm, evidence-first. The memorable element is a clear two-recipient allocation bar attached to the actual inference receipt. Avoid a marketplace landing page, fake analytics, crypto prices, or a decorative dashboard.

One route `/`. Desktop: task/input at left, quote and receipt at right. After completion, result appears immediately below the uploaded image. Mobile: task → upload → price/split → action → state/result/receipt. No sidebar or separate admin surface.

## Content hierarchy

1. Alloc wordmark, short promise, always-visible **Solana Devnet · test SOL** badge.
2. Task: “Classify one image.” Model/weight version and upstream attribution.
3. Choose JPEG/PNG; show size constraints, file preview, and replace action.
4. Connect wallet. Display shortened payer with copy/full address access.
5. Quote: 0.01 test SOL total; creator 0.007 (70%), compute 0.003 (30%); network fee extra.
6. “Approve payment & classify” with expiry and explanation of what wallet signs.
7. Progressive server state, then top-three labels, measured inference duration, and receipt.
8. Receipt: both roles and full addresses, exact amounts, signature copy, Explorer link, and confirmation level.

Place “Prepaid trusted compute. Payment can succeed even if inference fails; automatic refunds are not implemented” beside payment review, not buried in a footer. Clarify upstream model authorship and demo recipient identity.

## Visual tokens

| Token | Value / rule |
| --- | --- |
| Canvas | #101716 |
| Surface | #192421 |
| Main text | #F1F5F0 |
| Secondary text | #B8C8BE |
| Main action / allocation accent | #B8ED88 with dark text |
| Border | #40534A |
| Error | #FFB4A8; include text/icon |
| Spacing | 4, 8, 12, 16, 24, 32, 48 px |
| Corners | 8–12 px, consistent |
| Type | IBM Plex Sans body; IBM Plex Mono amounts/addresses; self-host/cache |
| Body | 16 px; metadata at least 14 px |
| Measure | Content width at most 1120 px; readable paragraph length |

Check actual contrast after implementation; listed colors are design choices, not an accessibility certification. Distinguish the two beneficiaries by labels and amounts as well as color. Keep allocation proportions fixed to the quote; highlight only after server verification.

## Interaction/state table

| State | Main action and visible message |
| --- | --- |
| Empty | Choose image; explain single-image task |
| Invalid input | Inline reason and limits; keep payment disabled |
| Wallet disconnected | Connect wallet |
| Ready quote | Approve payment & classify |
| Awaiting wallet | “Review the two recipients in your wallet”; allow rejection |
| Payment pending | “Checking Devnet payment. Do not pay again”; show known signature |
| Verified / waiting | “Payment verified; classification queued” |
| Running | “Running the model”; keep price/receipt visible |
| Succeeded | Top-three results + Explorer receipt; “New paid request” |
| Quote expired | Refresh quote only when no uncertain payment |
| RPC unavailable | “Payment status unknown”; retry checking same signature |
| Paid failure | “Payment verified; inference failed”; receipt and no automatic second charge |

Refresh recovers using session capability. Editing image or switching payer invalidates an unpaid quote; never mutate its bound input. If a candidate is unresolved, preserve its recovery card before permitting a separate purchase. Repeated clicks cannot create multiple payments/executions.

## Accessibility and responsive acceptance

Keyboard-operable input and wallet controls; visible focus; labeled status live region; focus error summary on submission failure. Touch targets at least 44 px. Test 360 px, 768 px, and 1440 px widths with long addresses. Wrap addresses/JSON and prevent horizontal overflow. Provide copy feedback in text.

Use real state transitions, not simulated progress percentages. Motion is limited to a short allocation highlight and state fade; honor reduced motion. No confetti, particle backgrounds, typewriter text, or animation blocking receipt access.

## Demo-quality checklist

One glance explains input, cost, recipients, and output. Browser wallet popup and receipt are legible at recording resolution. No fake provider profiles, “live network” badges, throughput charts, or unearned trust claims. See [DEMO](DEMO.md).
