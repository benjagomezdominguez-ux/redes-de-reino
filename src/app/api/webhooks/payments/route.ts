import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments/provider";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Scaffolding for a real payment gateway's webhook — inert today (503)
// because getPaymentProvider() has nothing registered (see
// src/lib/payments/provider.ts). Once a real provider is configured,
// this becomes the ONLY thing that can mark an online payment confirmed
// — never a browser redirect/return URL (rule 16 of the payments
// prompt), and never twice for the same event (rule 17).
export async function POST(request: Request) {
  const provider = getPaymentProvider();
  if (!provider) {
    return NextResponse.json({ error: "no_payment_provider_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const event = await provider.verifyWebhook(request, rawBody);
  if (!event) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  // Idempotency: a (provider, event_id) unique constraint means a
  // duplicate delivery hits this insert's conflict and stops here,
  // before touching orders/entitlements a second time.
  const { error: insertError } = await admin.from("payment_events").insert({
    provider: provider.name,
    event_id: event.eventId,
    event_type: event.eventType,
    payload: { ...event },
  });
  if (insertError) {
    return NextResponse.json({ status: "already_processed" });
  }

  if (event.status !== "confirmed") {
    return NextResponse.json({ status: "recorded" });
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, total_cents, currency")
    .eq("reference", event.orderReference)
    .maybeSingle();

  // Never trust the webhook's amount over the order's own server-computed
  // total — a mismatch is refused outright, not silently accepted.
  if (!order || order.total_cents !== event.amountCents || order.currency !== event.currency) {
    return NextResponse.json({ error: "amount_mismatch" }, { status: 409 });
  }

  const { data: payment } = await admin
    .from("payments")
    .update({ status: "confirmed", provider_reference: event.providerReference })
    .eq("order_id", order.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (payment) {
    await admin.from("orders").update({ status: "paid" }).eq("id", order.id);
    await admin.rpc("grant_digital_access", { p_order_id: order.id, p_payment_id: payment.id });
    await admin.from("audit_log").insert({
      action: "payment_confirmed",
      resource_type: "payment",
      resource_id: payment.id,
      metadata: { order_id: order.id, provider: provider.name },
    });
  }

  return NextResponse.json({ status: "ok" });
}
