"use server";

import { z } from "zod";
import { getSupabaseSessionClient } from "@/lib/supabase/session";
import { getAuthProfile } from "@/lib/supabase/get-profile";
import { isOnlinePaymentConfigured } from "@/lib/payments/provider";

const itemSchema = z.object({
  productId: z.string().uuid(),
  modality: z.enum(["digital", "fisico", "digital_fisico"]),
  quantity: z.number().int().positive(),
});

const shippingSchema = z.object({
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  country: z.string().trim().min(1),
  state: z.string().trim().min(1),
  city: z.string().trim().min(1),
  postal_code: z.string().trim().min(1),
  street: z.string().trim().min(1),
  number: z.string().trim().min(1),
  floor_unit: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CheckoutState = {
  status: "idle" | "error" | "success";
  errorKey?: "outOfStock" | "notAvailable" | "generic" | "required";
  orderId?: string;
  reference?: string;
  subtotalCents?: number;
  taxCents?: number;
  totalCents?: number;
  currency?: string;
  paymentMethod?: "online" | "bank_transfer";
};

// Note: this only ever creates a PENDING order, whichever payment method
// was chosen. It intentionally never marks anything paid itself — see
// admin_confirm_bank_transfer() (bank_transfer) and
// src/app/api/webhooks/payments/route.ts (online, once a provider is
// configured), which are the only two things that ever do that.
export async function createOrder(
  _prevState: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  // A deactivated account keeps its historical orders untouched, but
  // can never create a new one — same status check every other
  // protected write in this app makes (see require-auth.ts, chat.ts).
  const profile = await getAuthProfile();
  if (!profile || !profile.email || profile.status !== "active") {
    return { status: "error", errorKey: "generic" };
  }
  const user = { id: profile.id, email: profile.email };

  const supabase = await getSupabaseSessionClient();

  let items: z.infer<typeof itemSchema>[];
  try {
    items = itemSchema.array().min(1).parse(JSON.parse(String(formData.get("items"))));
  } catch {
    return { status: "error", errorKey: "generic" };
  }

  const firstName = formData.get("first_name");
  const lastName = formData.get("last_name");
  if (!firstName || !lastName) {
    return { status: "error", errorKey: "required" };
  }

  const billingCountry = formData.get("billing_country");
  if (!billingCountry || typeof billingCountry !== "string") {
    return { status: "error", errorKey: "required" };
  }

  // The client can only ever pick between the two real methods, and
  // "online" is rejected server-side too when nothing is configured —
  // never just a disabled button relying on the UI to enforce this.
  const paymentMethodRaw = formData.get("payment_method");
  const paymentMethod = paymentMethodRaw === "online" ? "online" : "bank_transfer";
  if (paymentMethod === "online" && !isOnlinePaymentConfigured()) {
    return { status: "error", errorKey: "notAvailable" };
  }

  const requiresShipping = formData.get("requiresShipping") === "true";
  let shipping: z.infer<typeof shippingSchema> | null = null;

  if (requiresShipping) {
    const parsed = shippingSchema.safeParse({
      first_name: firstName,
      last_name: lastName,
      phone: formData.get("phone"),
      country: formData.get("country"),
      state: formData.get("state"),
      city: formData.get("city"),
      postal_code: formData.get("postal_code"),
      street: formData.get("street"),
      number: formData.get("number"),
      floor_unit: formData.get("floor_unit"),
      notes: formData.get("notes"),
    });
    if (!parsed.success) {
      return { status: "error", errorKey: "required" };
    }
    shipping = parsed.data;
  }

  const { data, error } = await supabase.rpc("create_order", {
    p_user_id: user.id,
    p_email: user.email,
    p_items: items.map((i) => ({
      product_id: i.productId,
      modality: i.modality,
      quantity: i.quantity,
    })),
    p_shipping: shipping,
    p_payment_method: paymentMethod,
    p_billing_country: billingCountry,
  });

  if (error) {
    console.error("create_order failed", error);
    const message = error.message.toLowerCase();
    if (message.includes("out of stock")) {
      return { status: "error", errorKey: "outOfStock" };
    }
    if (message.includes("not available") || message.includes("no price")) {
      return { status: "error", errorKey: "notAvailable" };
    }
    return { status: "error", errorKey: "generic" };
  }

  const result = data as {
    order_id: string;
    reference: string;
    subtotal_cents: number;
    tax_cents: number;
    total_cents: number;
    currency: string;
    payment_method: "online" | "bank_transfer";
  };

  return {
    status: "success",
    orderId: result.order_id,
    reference: result.reference,
    subtotalCents: result.subtotal_cents,
    taxCents: result.tax_cents,
    totalCents: result.total_cents,
    currency: result.currency,
    paymentMethod: result.payment_method,
  };
}
