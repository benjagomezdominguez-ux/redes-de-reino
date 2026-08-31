import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Admin reads use the admin client (not the session client) because
// products has no admin-facing SELECT policy for drafts/inactive books —
// only "status = active" is public. Safe here because every caller is
// already behind requireAdmin() at the /admin layout level.

export type AdminProductRow = {
  id: string;
  slug: string;
  title: string | null;
  author: string | null;
  cover_url: string | null;
  product_type: string;
  digital_price_cents: number | null;
  physical_price_cents: number | null;
  currency: string;
  stock: number | null;
  status: "draft" | "active" | "inactive";
  created_at: string;
};

export async function listAllProducts(): Promise<AdminProductRow[]> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("products")
    .select("id, slug, title, author, cover_url, product_type, digital_price_cents, physical_price_cents, currency, stock, status, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as AdminProductRow[];
}

export async function getProductForEdit(productId: string) {
  const admin = getSupabaseAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return null;

  const { data: file } = await admin
    .from("product_files")
    .select("storage_path")
    .eq("product_id", productId)
    .maybeSingle();

  return { product, hasDigitalFile: Boolean(file) };
}

export async function getProductSales(productId: string): Promise<{ unitsSold: number; revenueCents: number }> {
  const admin = getSupabaseAdminClient();
  const { data: items } = await admin
    .from("order_items")
    .select("quantity, unit_price_cents, orders!inner(status)")
    .eq("product_id", productId)
    .in("orders.status", ["paid", "processing", "shipped", "delivered"]);

  type Row = { quantity: number; unit_price_cents: number };
  const rows = (items ?? []) as unknown as Row[];
  return {
    unitsSold: rows.reduce((sum, r) => sum + r.quantity, 0),
    revenueCents: rows.reduce((sum, r) => sum + r.quantity * r.unit_price_cents, 0),
  };
}
