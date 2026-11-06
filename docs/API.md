# Alloc — API contract

Planned version v1. Public API is same-origin `/api/v1`; JSON errors are `{error:{code,message,retryable},requestId?}`. Never expose stack traces or bearer values.

## Endpoint inventory

| Method / route | Input | Output / status |
| --- | --- | --- |
| GET /model | None | 200 model identity, provenance, constraints, decimal-string price/split, Devnet |
| POST /requests | Multipart image + payer public key | 201 immutable quote + request capability |
| POST /requests/:id/prepare | Bearer capability; empty body | 200 unsigned serialized transaction + validity metadata |
| POST /requests/:id/payments | Bearer; signedTransaction base64 | 202 pending or 200 existing paid/result state |
| GET /requests/:id | Bearer | 200 state, receipt if paid, result if succeeded |
| GET /health | None | 200 ready or 503 unavailable; no secret configuration |

All request-specific endpoints require `Authorization: Bearer <capability>`; HTTPS outside localhost. Store the bearer only in sessionStorage for refresh recovery, not a query string. Apply no-store to quotes, status/results, and signed transaction responses. Expose no unauthenticated image/result endpoint.

## Example quote shape

```json
{
  "requestId": "<uuid>",
  "capability": "<returned only on creation>",
  "network": "devnet",
  "modelId": "mobilenet-v3-small",
  "weightsId": "IMAGENET1K_V1",
  "payer": "<base58>",
  "inputSha256": "<64 hex>",
  "priceLamports": "10000000",
  "creator": {"address": "<base58>", "lamports": "7000000"},
  "provider": {"address": "<base58>", "lamports": "3000000"},
  "memo": "alloc:v1:<uuid>",
  "expiresAt": "<ISO-8601 UTC>"
}
```

Public key validation is structural, not a signed-login claim. Possession of a public key does not authorize charging it; the wallet signature authorizes the exact transaction.

Prepare returns `paymentAttemptId, unsignedTransactionBase64, blockhash, lastValidBlockHeight`. Signed submission requires only signedTransaction; server derives the signature and binds it to the saved attempt. A transaction exceeding the legacy 1,232-byte limit is rejected. HTTP request limits also cap encoded transaction bodies (8 KiB).

On a fresh submission, persist candidate signature and pending state before broadcasting. Verification may be attempted immediately; polling GET can drive bounded reconciliation until a claim exists. Durable PAID dispatch recovery is a gateway startup task. Browser never calls the worker directly.

## Result and receipt

```json
{
  "requestId": "<uuid>",
  "state": "SUCCEEDED",
  "result": {
    "modelId": "mobilenet-v3-small",
    "weightsId": "IMAGENET1K_V1",
    "inputSha256": "<64 hex>",
    "predictions": [{"label": "<actual label>", "score": 0.0}],
    "inferenceMs": 0
  },
  "receipt": {
    "network": "devnet",
    "signature": "<real signature>",
    "slot": 0,
    "commitment": "confirmed",
    "priceLamports": "10000000",
    "creatorLamports": "7000000",
    "providerLamports": "3000000",
    "explorerUrl": "https://explorer.solana.com/tx/<signature>?cluster=devnet"
  }
}
```

Placeholders and zero values above illustrate types, not recorded results. Production response has exactly three finite scores in [0,1], derived from real softmax output. Do not say the top-three scores sum to one; other classes retain mass. Include safe recipient addresses and public memo in the receipt. Receipt attests to checked payment; local result metadata is not a cryptographic proof of execution.

## Errors and retry semantics

| HTTP / code | Meaning | Client action |
| --- | --- | --- |
| 400 INVALID_INPUT / INVALID_TRANSACTION | Malformed fields, bytes, signature, or message | Correct request; no inference |
| 401 INVALID_CAPABILITY | Missing/wrong bearer | Do not disclose record existence |
| 413 INPUT_TOO_LARGE | Encoded/decoded limit exceeded | Choose smaller image |
| 422 PAYMENT_MISMATCH | Wrong payer/transfers/memo/template | Explain mismatch; never accept partial payment |
| 409 PAYMENT_REUSED | Candidate belongs to another request | Never grant another inference |
| 409 PAYMENT_UNCERTAIN | Existing candidate still unresolved | Poll; do not pay again |
| 410 QUOTE_EXPIRED | Cannot prepare/broadcast new payment | Create a fresh request only if no unresolved candidate |
| 429 RATE_LIMITED | Admission limit reached | Retry after provided delay |
| 503 SERVICE_UNAVAILABLE | DB/worker/RPC unavailable before acceptance | No inferred payment failure |
| 200 state=PAID_FAILED | Verified payment, failed/uncertain delivery | Show receipt and honest limitation |

202 PAYMENT_PENDING is a nonterminal state, not rejection. Retrying identical submission returns existing state; GET of completed A returns cached result. Presenting A's transaction under B fails even if A's bearer is known.

## Private worker interface

- `GET /ready`: authenticated internal readiness; model loaded plus warm-up complete.
- `POST /validate`: internal token + bounded image bytes; returns digest, dimensions, format; no forward pass.
- `POST /infer`: internal token + executionId, model/weights IDs, digest, bounded image bytes; verifies allowed model/digest and returns actual top-three scores and measured compute time.

Private token stays server-side; network denies public access. Worker cannot verify chain payment by itself and trusts only the gateway. Validation cannot invoke /infer. A timeout becomes PAID_FAILED; automatic /infer retries are disabled.
