# Alloc — UI/UX specification

## Design source and component reuse

Use [design.md](design.md) as the visual foundation. It is an **unmodified copy** of Dima Braven's community-authored Vercel-inspired reference, not an official Vercel specification or an accessibility/performance certification.

- Pinned source: https://github.com/dimabraven/design-md/blob/f74ca151f92af178f1e0b93f2191e5ec77b33203/examples/vercel.md
- Upstream file/blob SHA: `c03c7c481438fa26835ee40d16757b239c74c219`.
- License: MIT, copyright (c) 2026 Dima Braven; full notice retained in [DESIGN_LICENSE.txt](DESIGN_LICENSE.txt).
- Preserve the copied file verbatim. Record Alloc's functional, responsive, sizing, and accessibility requirements here rather than rewriting the source reference.

| Source | Reuse in Alloc | Selection rule |
| --- | --- | --- |
| [shadcn/ui components](https://ui.shadcn.com/docs/components) · [source](https://github.com/shadcn-ui/ui) | Buttons, cards, fields, dialogs, badges, skeletons, tooltips | Main UI foundation; copy only needed components and retain MIT notices |
| [Wallet UI](https://wallet-ui.dev/) · [source](https://github.com/wallet-ui/wallet-ui) | Wallet selector, connection controls, connected-wallet menu | Preferred wallet component candidate; verify compatible Kit/React versions and exact transaction signing at M0 |
| [coss ui / Origin UI](https://github.com/cosscom/ui) | Optional reference for image upload/preview interactions and forms | MIT alternative; Origin is a legacy snapshot. Do not install a second full component system alongside shadcn |

The checkout review, two-beneficiary allocation, payment states, result, and receipt are Alloc-specific compositions of these components. Wallet connection does not replace payment verification. No generic checkout or wallet library is assumed to implement our split/memo/replay contract. Lock compatible versions and preserve third-party attribution before reusing code; this documentation change does not install packages.

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

## Visual foundation and sizing

The Vercel-inspired reference replaces the previous charcoal/green/IBM Plex theme. Do not combine the two themes. Follow its black/neutral surfaces, Geist typography, bordered panels, restrained semantic color, and component geometry.

| Item | Selected reference / implementation rule |
| --- | --- |
| Canvas / card / nested surface | #000000 / #111111 / #1A1A1A |
| Main / secondary text | #EDEDED / #A1A1AA |
| Border | #333333; #555555 for emphasized boundaries |
| Primary action | White fill with black text, as in the reference's actual Primary component example |
| Status | Success #50E3C2; warning #F5A623; error #FF4444; icon plus text/badge |
| Type | Geist Sans; Geist Mono for addresses, signatures, durations, and amounts; tabular numerals |
| Reference scale | Body 0.875rem (14px at 16px root); small 0.8125rem; h1 2rem; h2 1.375rem |
| Reference geometry | 6px buttons/inputs; 8px cards; spacing scale 4, 8, 12, 16, 24, 32, 48, 64, 96px |
| Main container | At most 1200px, centered; 24px desktop padding; 16px narrow-screen padding |

### Explicit precedence for usability

These are bounded application requirements, not a replacement design system. Where the copied reference conflicts with them, this section controls the Alloc implementation:

- Keep the browser root at 16px; never shrink the root or scale the whole interface to fit.
- Use 16px text for upload guidance, payment review, primary form inputs, and result explanation. Keep critical amounts and signing actions at least 16px; secondary receipt metadata at least 14px.
- The reference's approximately 36px compact controls are desktop defaults. Make primary upload/connect/pay actions at least 44px high and provide at least 44px hit areas for touch controls, including copy/remove buttons. Visible icons can remain compact inside those hit areas.
- Keep visible form labels, keyboard focus, sufficient actual contrast, and selectable/wrapping addresses. Copy controls must be reachable on keyboard and touch, not revealed only on hover.
- Use black text on white primary buttons; the source's final “white-on-black” wording is ambiguous, so follow its explicit component code.
- Source sidebar, deployment rows, and marketing hero examples are optional patterns, not instructions to add product scope. Alloc remains one route with top navigation and no sidebar.
- Check focus/error/link contrast in the implemented UI. If a source token fails a necessary contrast check, use a documented accessible foreground/border from the existing neutral palette rather than assuming the reference is certified.

Use a two-column workbench only when both panels remain readable; stack below 768px. Give grid/flex children min-width: 0, prevent page-level horizontal overflow, and wrap long payment identifiers. Test 360px, 768px, and 1440px widths and 200% browser zoom. No fixed card heights that clip results or error text.

### Motion and responsiveness

Follow the reference's 150ms hover and 200ms panel transitions; honor reduced motion. No artificial delay, long intro, full-page animation dependency, or simulated percentage progress. Render validation/loading feedback immediately while real wallet/RPC/model operations continue. Lazy-load wallet-only code where appropriate; do not load the coss monorepo or unused component registries into Alloc.

Measure actual interaction responsiveness during implementation; copying a design document is not a runtime performance test. Distinguish the two beneficiaries by labels and amounts as well as color. Keep allocation proportions fixed to the quote and mark settlement complete only after server verification.

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
