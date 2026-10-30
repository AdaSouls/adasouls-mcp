---
"@adasouls/mcp": minor
---

`adasouls_confirm_payment` confirms a card payment with what the agent's own Stripe account shows. adasouls-api now refuses an agent's card-payment confirmation without that record, so the server reads the PaymentIntent with `STRIPE_API_KEY` (a test key kept in this process, never a tool argument and never sent to AdaSouls) and calls the SDK's `confirmCardPayment()`. Without the key, confirming a card payment returns an error saying what to set; declining and on-chain confirmations work as before. Requires @adasouls/sdk 0.9.
