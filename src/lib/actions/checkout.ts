"use server";

import { z } from "zod";
import { getSupabaseSessionClient } from "@/lib/supabase/session";

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
};

// Note: this only ever creates a PENDING order. It intentionally does not
// mark anything as paid — the server-confirmed payment status (once a
// provider is configured) is the only thing that ever does that. See
// grant_digital_access() in the books-store migration.
export async function createOrder(
  _prevState: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const supabase = await getSupabaseSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return { status: "error", errorKey: "generic" };
  }

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

  return { status: "success", orderId: data as string };
}
