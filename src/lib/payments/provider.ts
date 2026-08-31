import "server-only";

// Rule 51 of the payments prompt: no provider is configured today (no
// Mercado Pago/Stripe/etc. keys exist in this project), so this file
// deliberately does NOT implement a real gateway. It exists so the rest
// of the system — checkout, orders, entitlements — never depends on a
// specific provider's SDK; only on this interface. Wiring in a real
// provider later means implementing PaymentProvider once and registering
// it below, with zero changes anywhere else (checkout, webhook route,
// order/payment tables are all provider-agnostic already).

export type PaymentProvider = {
  name: string;
  // Starts a hosted checkout for one order; the buyer is redirected here
  // to actually pay. Must never be called with a client-supplied amount
  // — callers always pass the order's own server-computed total.
  createCheckoutSession(params: {
    orderId: string;
    reference: string;
    amountCents: number;
    currency: string;
    buyerEmail: string;
  }): Promise<{ redirectUrl: string }>;
  // Verifies a webhook payload came from the real provider (signature/
  // secret check) before anything in it is trusted. Returns the
  // normalized event, or null if verification fails.
  verifyWebhook(request: Request, rawBody: string): Promise<PaymentWebhookEvent | null>;
};

export type PaymentWebhookEvent = {
  eventId: string;
  eventType: string;
  providerReference: string;
  orderReference: string | null;
  status: "confirmed" | "failed" | "refunded";
  amountCents: number;
  currency: string;
};

// No env var naming a provider today, so this is always null — the
// checkout UI uses this to disable "Pagar online" and show it as coming
// soon, rather than pretending a payment gateway exists. See README for
// exactly what configuring a real one requires.
export function isOnlinePaymentConfigured(): boolean {
  return Boolean(process.env.PAYMENT_PROVIDER);
}

export function getPaymentProvider(): PaymentProvider | null {
  const name = process.env.PAYMENT_PROVIDER;
  if (!name) return null;

  // No provider is registered yet. When one is configured, import and
  // return its PaymentProvider implementation here — e.g.:
  //   if (name === "mercadopago") return mercadoPagoProvider;
  return null;
}
