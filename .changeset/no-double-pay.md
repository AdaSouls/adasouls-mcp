---
"@adasouls/mcp": minor
---

On @adasouls/sdk 0.7.0, with tools that keep a model from paying twice (AdaSouls/adasouls-mcp#10).

- `adasouls_execute` requires `amount`, `asset` and an `idempotencyKey` (one per payment, reused on retry); `adasouls_check_policy` requires `amount` and `asset`. The API already refused an intent without them.
- `adasouls_report_payment` takes a card payment's Stripe PaymentIntent as `reference`, says never to pay again after a failure, and answers "already reported, do not send the payment again" when the action isn't waiting for a payment any more.
- New `adasouls_confirm_payment`: the payee's answer, which completes or fails a card payment.
- Timeouts map to `kind: "timeout"`, with "it may have gone through" in the message.
