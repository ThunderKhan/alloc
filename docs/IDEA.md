# Alloc — The Idea

> **Compute independently. Earn collectively.**
>
> **One-line pitch:** Alloc is a pay-per-use AI inference service built on Solana. When someone pays to run an AI model, the payment is automatically divided between the person who created the model and the provider who runs it.

**Status:** Hackathon concept and proposed MVP — not a claim that the platform is already implemented.  
**Event:** Solana × Major League Hacking, November 6–8, 2026.  
**Official hackathon links:**
- **MLH registration, schedule, judging direction, and resources:** https://events.mlh.com/events/15200-solana-hackathon
- **MLH event overview, prize categories, and submission:** https://www.mlh.com/events/solana-hackathon

**Key event timing (IST):** Hacking starts Friday, November 6 at 10:30 PM; the initial submission is due Sunday, November 8 at 8:30 PM; **final submission is due Sunday, November 8 at 10:15 PM**. Confirm any changes on the official event pages.  
**Repository:** https://github.com/ThunderKhan/alloc

---

## 1. The idea in plain English

Think about ordering food through a delivery app. You pay once, but your payment ultimately supports more than one person: the restaurant prepares the food, and a delivery partner brings it to you.

AI services have a similar division of labor:

- Someone **creates the AI model** — the software that knows how to recognize an object, understand a sentence, or perform another useful task.
- Someone **provides the computing power** — a server or GPU that actually runs the model.
- Someone **uses the AI** — a customer who wants the answer, not the burden of managing models and GPUs.

Today, a central platform will often combine these roles and manage billing internally. Alloc explores a more open arrangement: **a model and the compute that runs it can belong to different parties, while payments are settled transparently through Solana.**

A user pays to run an AI model once. Alloc verifies the blockchain payment, runs the model off-chain, and returns the result. The payment is split automatically between the model creator and the compute provider.

In short, **Alloc connects AI model ownership, AI compute, and payment settlement**.

## 2. What problem does Alloc solve?

Useful AI models require two resources that do not always belong to the same person:

1. **Model expertise.** Creating or improving a model takes data, time, experimentation, and expertise.
2. **Compute infrastructure.** Running that model requires a machine with sufficient resources, sometimes a GPU.

A model developer may not own a powerful GPU. A GPU owner may not know how to develop models. A user just wants to pay for a useful result.

When independent parties collaborate, they need a way to decide **who receives what share of each paid inference** and to show that the money was actually distributed.

Alloc's specific first problem is **automatic, verifiable revenue sharing for a single paid AI inference**. We are not trying to solve every problem in decentralized AI, scheduling, model discovery, or GPU rental during this hackathon.

### Why would someone care?

- A **model developer** could earn a share each time their model is used, without running the hardware themselves.
- A **compute provider** could be compensated for executing requests for independently developed models.
- An **AI consumer** could buy a single useful computation rather than needing to operate infrastructure or subscribe to a broad platform.
- The participants could **inspect the payment on-chain** instead of relying only on a platform's private payout ledger.

This is a product vision. The hackathon will test the core transaction and inference loop, not prove market demand or launch a public business.

## 3. A simple example: Alice, Bob, and Charlie

Meet three people:

- **Alice** builds an AI model that identifies objects in images.
- **Bob** runs Alice's model on a server or GPU.
- **Charlie** wants to upload a photo and find out what is in it.

Suppose one inference costs **0.01 test SOL** and the agreed revenue split is **70% to Alice and 30% to Bob**.

| Participant | Role | Share of the example payment |
| --- | --- | ---: |
| Charlie | Pays to use the AI | Pays 0.01 test SOL |
| Alice | Created the AI model | Receives 0.007 test SOL |
| Bob | Runs the model | Receives 0.003 test SOL |

Charlie uploads a picture of a dog and approves a wallet transaction. After the payment is verified, Bob's compute service runs Alice's model and returns a classification such as **"dog"**. Alice and Bob have already received their respective shares in the on-chain payment.

**Important:** These are example prices and percentages, not established market rates. The demonstration uses Solana **Devnet**, where test SOL has no monetary value.

## 4. What a user actually does

The simplest complete product experience is:

1. **Open Alloc.** The page shows one available AI model, what it does, and the fixed price per inference.
2. **Provide an input.** For the hackathon, upload one image for classification.
3. **Connect a wallet and approve payment.** The application prepares one Solana transaction that transfers the correct amounts to the creator's and compute provider's wallets.
4. **Wait for payment verification.** The backend independently checks that the transaction occurred, involved the expected payer and recipients, paid the correct amounts, and has not been used for a different request.
5. **Run the actual AI model.** An off-chain inference service processes the image.
6. **See the answer and receipt.** The app displays the model's result and a clickable transaction reference that can be inspected in Solana Explorer.

**One payment → two recipients → one real inference → one verifiable receipt.**

### What happens if payment is missing or wrong?

The inference gateway rejects the request. The user sees a clear explanation, not an AI response obtained without a valid payment.

That gives us two useful demos: **a successful paid inference** and **a rejected unpaid/invalid request**.

## 5. Why Solana? Why not a normal database?

A normal app could absolutely track a price and distribute funds using traditional payment providers. Alloc does not claim that blockchain is required to run AI or that it magically makes inference more accurate.

Solana's role is narrower and concrete:

- **Atomic payment splitting:** One transaction can contain transfers to multiple recipients. On Solana, either all instructions in a transaction succeed or the transaction fails. The creator and compute provider therefore receive their defined shares together.
- **Independently inspectable settlement:** Each successful payment has a transaction signature that participants can check on the blockchain.
- **Programmatic payments:** The same general payment mechanism can eventually be called by applications and AI agents, not only people clicking through a website.
- **Low-cost testable settlement:** Devnet lets us demonstrate the payment flow without using real funds.

The **AI inference happens off-chain**. Solana is the settlement layer, not the GPU or model execution engine.

For the first prototype, an ordinary Solana transaction containing two transfers is sufficient to demonstrate atomic splitting. A custom on-chain program is **not required** to make the initial payment split work. A more advanced protocol could later move pricing and revenue-share enforcement into a program.

## 6. What we will build for the hackathon

We will deliberately build **a small system that works end to end**, rather than a half-finished marketplace.

### Included in the MVP

| Component | Smallest useful implementation |
| --- | --- |
| Model catalog | **One** predefined, genuinely working image classifier |
| Compute | **One** trusted server/worker running the classifier |
| Participants | **Three** test wallets controlled by our team: payer, model creator, compute provider |
| Price | **One** fixed per-inference price and revenue split |
| Settlement | **One** atomic Solana Devnet transaction with two payment recipients |
| Gateway | Backend checks transaction details and prevents a payment from being reused |
| Result | Display the model output, payment status, and Explorer transaction link |
| Error case | Reject unpaid, incorrect, or reused payment attempts |

A model may run on a GPU if available, but **GPU hardware is not a hard requirement** for the first demo: reliable real inference and correct settlement matter more than proving high performance.

### Explicitly out of scope

We will **not** build the following for this event:

- A public marketplace with dozens of models or GPU providers
- User-submitted model uploads or arbitrary code execution
- GPU bidding, auctions, auto-scaling, or provider discovery
- Model fine-tuning, training pipelines, or dataset marketplaces
- Token issuance, staking, a speculative economy, or investments
- Subscriptions, fiat payment processing, or live customer onboarding
- Decentralized proof-of-compute, fault-proof inference, or dispute arbitration
- An elaborate dashboard, community features, or analytics suite

These are possible future directions, **not promises for this weekend**.

## 7. Proposed technical architecture

```text
Charlie (payer) — browser + Solana wallet
     |
     | Upload an image, prepare and sign the payment
     v
Solana Devnet
     |
     | Atomic transfers:
     |   70% → Alice (model creator)
     |   30% → Bob (compute provider)
     v
Alloc inference gateway (backend)
     |
     | Independently verify confirmed transaction
     | Validate payer, recipients, amounts, request, and single use
     v
Off-chain AI model worker
     |
     | Run the image classifier
     v
Alloc interface
     |
     └─ Show classification + transaction receipt
```

**Likely stack:** Next.js and TypeScript for the web app, Solana wallet tooling and RPC for transactions, and a small Python/FastAPI or similar inference worker for the real model. We can use a suitably licensed pretrained model to avoid model-training work during the hackathon.

A database is optional for a tiny local demonstration, but a **persistent request/payment record is necessary for a reliably deployed implementation** to prevent payment replay across requests and server restarts.

### Payment verification is not optional

The backend must not trust a screenshot, a wallet popup, or a transaction signature supplied by the frontend as proof of payment. It should:

- Create or recognize a **unique inference request** with fixed price, recipients, and payer.
- Independently fetch and verify a **successful confirmed transaction** from Solana RPC.
- Check that the transaction pays **the expected amounts to the exact expected wallets** and is associated with the intended request. A unique request reference/memo or equivalent binding must be part of that validation.
- Ensure the same payment **cannot be claimed twice**, including after a backend restart.
- Run inference **only after** payment verification succeeds.

The precise request-binding implementation is a design decision for the engineering stage; it must not be skipped.

## 8. The genuine innovation — and what is not new

**Our product hypothesis:** AI models and the machines running them should be able to belong to different participants, while each inference settles the predefined economic split transparently.

Alloc combines three ideas in one small user flow:

1. **Decoupled ownership:** The model author and inference host are distinct roles.
2. **Usage-based economics:** Compensation follows an actual paid inference request.
3. **Verifiable multi-party settlement:** The payment split is independently inspectable on Solana.

We should be precise about the novelty claim. **Pay-per-use APIs, blockchain micropayments, and revenue splitting already exist.** Alloc is **not** inventing any of them. Our contribution is packaging them into a simple, demonstrable model-and-compute settlement flow.

### Inspiration from earlier Solana hackathon winners

- **Latinum:** AI agents and tools paying for services.
- **MCPay:** Per-call monetization and programmable payment verification.
- **Aquanode:** Independent compute resources participating in an on-chain economy.

Alloc borrows the underlying economic and infrastructure patterns rather than attempting to reproduce those projects or their full feature sets.

## 9. How AI agents fit into Alloc

Alloc is not limited to people clicking a **Pay & Run** button. Another application—or an **AI agent**—could act as the buyer.

### What is an AI agent in this context?

An AI agent is software that decides when to call tools in order to complete a task. For example, a research agent may need an image classifier to understand an image. Rather than subscribe to a model-hosting platform, the agent could pay for exactly one classification and use the result in its work.

Alloc would expose the **same priced inference service** to both human users and agents:

1. **Discover a model/tool.** The agent learns what one inference does, its input requirements, its cost, and the model/compute revenue split.
2. **Request an inference.** The agent submits an image or text and obtains a uniquely identified quote or request.
3. **Authorize payment.** A wallet controlled by the agent's operator (or an explicitly approved payment tool) signs the required Devnet transaction. The agent should have a hard spending limit; the LLM must **never receive a wallet private key**.
4. **Verify and execute.** Alloc's backend checks the on-chain payment and runs the off-chain model once.
5. **Return a tool result.** The agent receives structured inference output and the verifiable transaction receipt, then continues its task.

The economic concept is **machine-to-machine micropayments**: software can purchase a narrowly defined AI capability when needed, while Solana distributes its payment to the model author and compute provider.

### An example an MLH judge can understand

> "I am an inventory assistant. Count the objects in this product photo."

The assistant determines that it needs the image-analysis tool. Alloc advertises a price of **0.01 test SOL**. After the operator approves the payment, Alloc splits the money 70/30 between the model creator and the compute provider, runs the actual image model, and returns an answer plus a transaction receipt.

This is **not** an agent trading cryptocurrency or making financial decisions. It is an agent *buying a useful AI computation*.

### Why this matches the hackathon's AI track

The official MLH AI track explicitly mentions **agents that act on-chain**, **machine payments for AI services**, and **verifiability**. Alloc combines a real AI inference call with a real Solana settlement, so both technologies serve a purpose.

- AI provides the actual analysis or prediction.
- Solana distributes the per-inference payment and provides an independently inspectable receipt.
- A consuming agent can call the same service programmatically rather than manually operating a web page.

See the official [hackathon schedule and AI-track description](https://events.mlh.com/events/15200-solana-hackathon) and [event/prizes page](https://www.mlh.com/events/solana-hackathon).

### Scope: what is promised and what is optional?

**Hackathon core (required):** One human-triggered, working inference with a correct Solana Devnet revenue split and a backend that refuses missing, incorrect, or reused payments.

**Optional stretch, only if the core works:** Expose that same paid inference as **one callable tool** for a scripted or AI-driven assistant, with user approval or strictly limited Devnet spending. Use the existing inference gateway; do not introduce a second billing protocol.

**Not in the two-day MVP:** An open agent marketplace, fully autonomous real-money wallets, unrestricted spending, an agent-to-agent trading network, or a general-purpose agent framework.

This keeps the important distinction clear: **Alloc's initial product is paid AI inference, not an autonomous AI-agent platform.** The ability for agents to buy inference is a natural interface to the same settlement primitive.

## 10. What the judges should see in a live demo

**Successful path (the main demo):**

1. Show Alice's model and Bob's inference worker as separate roles.
2. Show the listed price and 70/30 split.
3. Upload a new image as Charlie.
4. Approve the Devnet transaction in Charlie's wallet.
5. Open Solana Explorer to show the payment went to **both wallets**.
6. Show a real model prediction returned by the worker.
7. Show the same transaction's receipt attached to the inference request.

**Failure path (proof this is not a fake frontend):**

1. Try calling inference without a valid payment.
2. Show that the gateway refuses to run the model.
3. Optionally attempt to reuse the prior transaction signature and show it is rejected.

We can do all of this using our own test wallets and infrastructure. **No audience, paying customers, public compute providers, or actual buyers are required.**

## 11. Important limitations and honest claims

There is a crucial distinction between **settling a payment correctly** and **guaranteeing that the paid computation was delivered**.

An atomic Solana transaction guarantees the payment instructions succeed together or fail together. It does **not** automatically guarantee that a remote GPU finishes the inference or returns a correct result.

For the hackathon:

- We use a **trusted, controlled inference worker**.
- The consumer pays **before** the worker runs, so payment success and inference delivery are **not atomic together**.
- If the worker fails after payment, a production system would require a deliberate refund, retry, escrow, or dispute mechanism. **The initial prototype does not claim to solve that problem.**
- We do not claim decentralized execution, fraud-proof computation, or trustless inference.
- We use **test tokens only** and do not operate a real-money crypto-payment business.

These limitations are part of the design, not hidden features.

## 12. Why this is realistic in two days

Alloc's core engineering task is a single chain of events:

**User request → verified on-chain split payment → real off-chain model execution → result + receipt.**

The demo requires only one model, one compute provider, and three wallets, all owned or operated by the team. The scope deliberately excludes the costly network effects of recruiting users, attracting providers, and building liquidity.

We can evaluate completion objectively:

- [ ] The selected model produces a genuine result from a new input.
- [ ] A customer wallet can pay on Solana Devnet.
- [ ] A single transaction sends the correct split to both recipients.
- [ ] The backend verifies payment details instead of trusting the client.
- [ ] An unpaid or invalid request cannot obtain a result.
- [ ] The same payment cannot purchase multiple inferences.
- [ ] The user can inspect an authentic transaction receipt.
- [ ] The demo can be repeated reliably.

These are **acceptance criteria**, not a claim that the checks have already passed.

## 13. Hackathon positioning

**Primary target:** MLH Solana Hackathon — **AI Track**.  
**Secondary target:** **Top 3 Overall**.  
**Conditional target:** **Best Beginner Hack**, only if team eligibility requirements are met.

A DeFi award is not the primary target. The mere presence of a blockchain payment split does not automatically make Alloc a meaningful decentralized finance protocol.

The best two-sentence explanation for judges:

> **Alloc makes AI inference a pay-per-use Web3 service. An independent model creator and compute provider can collaborate to deliver one AI result, while Solana transparently splits and verifies their payment in a single transaction.**

The broader ambition is an open economy for AI model creation and compute. **The hackathon deliverable is much smaller:** prove that one independently owned model, one compute service, and one customer can complete a real paid inference through Solana.

---

## 14. Future direction (not part of the hackathon MVP)

If the first payment-and-inference loop proves useful, possible later work includes provider selection, independently hosted models, more sophisticated pricing, settlement smart contracts, delivery guarantees, and agent-to-agent payments.

Those ideas need separate product validation, security design, and potentially legal/compliance review before a real-money public launch.

**For now: one problem, one working workflow, and no unnecessary features.**
