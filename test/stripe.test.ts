import { describe, expect, it, vi } from "vitest";
import { createPaymentIntentLookup } from "../src/stripe.js";

const KEY = "rk_test_abc123";
const pi = { id: "pi_3Ncard", object: "payment_intent", status: "succeeded", amount: 1250, currency: "usd", created: 1793336400, livemode: false, metadata: { action_id: "eco_2" }, client_secret: "pi_3Ncard_secret_x" };
const answering = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("reading a PaymentIntent in the agent's own Stripe account", () => {
  it("returns the record the API checks, read with the key in the header, and nothing else from Stripe", async () => {
    const fetch = answering(200, pi);
    expect(await createPaymentIntentLookup(KEY, fetch)("pi_3Ncard")).toEqual({
      reference: "pi_3Ncard",
      status: "succeeded",
      amount: 1250,
      currency: "usd",
      createdAt: new Date(1793336400 * 1000).toISOString(),
      livemode: false,
      actionId: "eco_2",
    });
    expect(fetch).toHaveBeenCalledWith("https://api.stripe.com/v1/payment_intents/pi_3Ncard", expect.objectContaining({ headers: { authorization: `Bearer ${KEY}` } }));
  });

  it("test mode only: a live or unknown key is refused before any call, and so is a live PaymentIntent", async () => {
    for (const key of ["sk_live_abc", "rk_live_abc", "pk_test_abc", ""]) {
      let message = "";
      try {
        createPaymentIntentLookup(key, vi.fn());
      } catch (err) {
        message = String(err);
      }
      expect(message, key).toMatch(/must be a Stripe test key/);
      if (key) expect(message).not.toContain(key);
    }
    await expect(createPaymentIntentLookup(KEY, answering(200, { ...pi, livemode: true }))("pi_3Ncard")).rejects.toThrow(/live mode/);
  });

  it("refuses what isn't a PaymentIntent id before calling, and reports Stripe's refusal without the key", async () => {
    const fetch = vi.fn();
    await expect(createPaymentIntentLookup(KEY, fetch)("ch_3Nabc")).rejects.toThrow(/not a PaymentIntent id/);
    await expect(createPaymentIntentLookup(KEY, fetch)("pi_3N/../../v1/charges")).rejects.toThrow(/not a PaymentIntent id/);
    expect(fetch).not.toHaveBeenCalled();
    const err = await createPaymentIntentLookup(KEY, answering(404, { error: { message: "No such payment_intent: 'pi_3Nnone'" } }))("pi_3Nnone").catch((e: Error) => e);
    expect(String(err)).toMatch(/No such payment_intent/);
    expect(String(err)).not.toContain(KEY);
  });
});
