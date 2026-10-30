import type { LookUpPaymentIntent, StripePaymentRecord } from "@adasouls/sdk";

/**
 * Reads a PaymentIntent in this agent's own Stripe account, so its payee
 * can confirm a card payment with what the account shows
 * (Agent.confirmCardPayment). AdaSouls holds no Stripe key: the key is
 * this server's (STRIPE_API_KEY, in the environment of the process the
 * developer runs), never a tool argument, so the model never sees it.
 *
 * Read-only: one GET of one PaymentIntent. Test mode only, like
 * @adasouls/provider-adapters' Stripe adapter: a live key is refused
 * before any call, and so is a PaymentIntent that comes back in live
 * mode. A restricted key (rk_test_) with read access to PaymentIntents is
 * enough. The key never appears in an error, and neither does Stripe's
 * raw response.
 */
const TEST_KEY = /^(sk|rk)_test_[A-Za-z0-9]+$/;
const PAYMENT_INTENT = /^pi_[A-Za-z0-9]{1,250}$/;

export class StripeLookupError extends Error {}

export function createPaymentIntentLookup(apiKey: string, fetchImpl: typeof fetch = fetch, timeoutMs = 15_000): LookUpPaymentIntent {
  if (!TEST_KEY.test(apiKey)) {
    throw new StripeLookupError("STRIPE_API_KEY must be a Stripe test key (sk_test_ or rk_test_): card payments are test mode only");
  }
  return async (paymentIntentId) => {
    if (!PAYMENT_INTENT.test(paymentIntentId)) throw new StripeLookupError(`not a PaymentIntent id: "${paymentIntentId}"`);
    const res = await fetchImpl(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      amount?: number;
      currency?: string;
      created?: number;
      livemode?: boolean;
      metadata?: Record<string, string>;
      error?: { message?: string; code?: string };
    };
    if (!res.ok) throw new StripeLookupError(`Stripe couldn't read ${paymentIntentId}: ${body.error?.message ?? `HTTP ${res.status}`}`);
    if (body.livemode !== false) throw new StripeLookupError(`refusing ${paymentIntentId}: it is in live mode`);
    if (typeof body.id !== "string" || typeof body.status !== "string" || typeof body.amount !== "number" || typeof body.currency !== "string" || typeof body.created !== "number") {
      throw new StripeLookupError(`Stripe's answer for ${paymentIntentId} isn't a PaymentIntent`);
    }
    const record: StripePaymentRecord = {
      reference: body.id,
      status: body.status,
      amount: body.amount,
      currency: body.currency,
      createdAt: new Date(body.created * 1000).toISOString(),
      livemode: false,
      ...(body.metadata?.action_id ? { actionId: body.metadata.action_id } : {}),
    };
    return record;
  };
}
