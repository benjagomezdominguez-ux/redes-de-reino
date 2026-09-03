import "server-only";
import { getSupabaseSessionClient } from "@/lib/supabase/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// All of these run through the session client (not the admin/service-role
// client) on purpose: access is granted by the "Admins can view all ..."
// RLS policies added in the profiles/roles migration, scoped to
// is_admin(auth.uid()). That means even a bug in requireAdmin() (the
// page-level gate that calls these) couldn't leak this data — Postgres
// itself re-checks the caller's role on every query. See rules 2 and 30.

const CONFIRMED_ORDER_STATUSES = ["paid", "processing", "shipped", "delivered"];
const PENDING_ORDER_STATUSES = ["pending", "payment_processing"];

export type DashboardCounts = {
  registeredUsers: number;
  purchases: number;
  pendingOrders: number;
  booksSold: number;
};

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const supabase = await getSupabaseSessionClient();

  const [usersResult, purchasesResult, pendingResult, confirmedOrdersResult] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", CONFIRMED_ORDER_STATUSES),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("status", PENDING_ORDER_STATUSES),
    supabase.from("orders").select("id").in("status", CONFIRMED_ORDER_STATUSES),
  ]);

  const confirmedOrderIds = (confirmedOrdersResult.data ?? []).map((o: { id: string }) => o.id);
  let booksSold = 0;
  if (confirmedOrderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("quantity")
      .in("order_id", confirmedOrderIds);
    booksSold = (items ?? []).reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
  }

  return {
    registeredUsers: usersResult.count ?? 0,
    purchases: purchasesResult.count ?? 0,
    pendingOrders: pendingResult.count ?? 0,
    booksSold,
  };
}

export type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  created_at: string;
  status: "active" | "inactive";
  role: "user" | "admin";
};

export type Paginated<T> = { rows: T[]; total: number; page: number; pageSize: number };

export type UserStatusFilter = "all" | "active" | "inactive";

export async function listUsers(
  page: number,
  pageSize = 20,
  statusFilter: UserStatusFilter = "all"
): Promise<Paginated<ProfileRow>> {
  const supabase = await getSupabaseSessionClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("profiles")
    .select("id, first_name, last_name, email, created_at, status, role", { count: "exact" });
  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, count } = await query.order("created_at", { ascending: false }).range(from, to);

  return { rows: (data ?? []) as ProfileRow[], total: count ?? 0, page, pageSize };
}

export type OrderListRow = {
  id: string;
  email: string;
  created_at: string;
  status: string;
  total_cents: number;
  currency: string;
  item_count: number;
  payment_method: string;
  reference: string | null;
  payment_status: string | null;
};

export async function listOrders(page: number, pageSize = 20): Promise<Paginated<OrderListRow>> {
  const supabase = await getSupabaseSessionClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count } = await supabase
    .from("orders")
    .select(
      "id, email, created_at, status, total_cents, currency, payment_method, reference, order_items(count), payments(status)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  type RawRow = {
    id: string;
    email: string;
    created_at: string;
    status: string;
    total_cents: number;
    currency: string;
    payment_method: string;
    reference: string | null;
    order_items: { count: number }[];
    payments: { status: string }[];
  };

  const rows = ((data ?? []) as unknown as RawRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    created_at: row.created_at,
    status: row.status,
    total_cents: row.total_cents,
    currency: row.currency,
    item_count: row.order_items?.[0]?.count ?? 0,
    payment_method: row.payment_method,
    reference: row.reference,
    payment_status: row.payments?.[0]?.status ?? null,
  }));

  return { rows, total: count ?? 0, page, pageSize };
}

export async function listPendingTransfers(): Promise<
  { payment_id: string; order_id: string; reference: string | null; email: string; amount_cents: number; currency: string; created_at: string }[]
> {
  const supabase = await getSupabaseSessionClient();
  const { data } = await supabase
    .from("payments")
    .select("id, order_id, bank_reference, amount_cents, currency, created_at, orders(email)")
    .eq("method", "bank_transfer")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  type RawRow = {
    id: string;
    order_id: string;
    bank_reference: string | null;
    amount_cents: number;
    currency: string;
    created_at: string;
    orders: { email: string } | { email: string }[] | null;
  };

  return ((data ?? []) as unknown as RawRow[]).map((row) => {
    const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
    return {
      payment_id: row.id,
      order_id: row.order_id,
      reference: row.bank_reference,
      email: order?.email ?? "",
      amount_cents: row.amount_cents,
      currency: row.currency,
      created_at: row.created_at,
    };
  });
}

export type OrderItemRow = {
  id: string;
  product_id: string;
  modality: string;
  quantity: number;
  unit_price_cents: number;
  title_snapshot: string | null;
  author_snapshot: string | null;
};

export type ShippingAddressRow = {
  first_name: string;
  last_name: string;
  phone: string | null;
  country: string;
  state: string;
  city: string;
  postal_code: string;
  street: string;
  number: string;
  floor_unit: string | null;
  notes: string | null;
};

export type PaymentRow = {
  id: string;
  method: string;
  provider: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  bank_reference: string | null;
  proof_storage_path: string | null;
  declared_operation_number: string | null;
  declared_amount_cents: number | null;
  declared_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
};

export type OrderDetail = {
  order: {
    id: string;
    email: string;
    user_id: string;
    created_at: string;
    status: string;
    currency: string;
    subtotal_cents: number;
    tax_cents: number;
    shipping_cents: number;
    total_cents: number;
    requires_shipping: boolean;
    payment_method: string;
    reference: string | null;
    billing_country: string | null;
  };
  items: OrderItemRow[];
  shipping: ShippingAddressRow | null;
  payment: PaymentRow | null;
};

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await getSupabaseSessionClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, email, user_id, created_at, status, currency, subtotal_cents, tax_cents, shipping_cents, total_cents, requires_shipping, payment_method, reference, billing_country"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_id, modality, quantity, unit_price_cents, title_snapshot, author_snapshot")
    .eq("order_id", orderId);

  const { data: shipping } = await supabase
    .from("shipping_addresses")
    .select(
      "first_name, last_name, phone, country, state, city, postal_code, street, number, floor_unit, notes"
    )
    .eq("order_id", orderId)
    .maybeSingle();

  const { data: payment } = await supabase
    .from("payments")
    .select(
      "id, method, provider, amount_cents, currency, status, bank_reference, proof_storage_path, declared_operation_number, declared_amount_cents, declared_at, reviewed_by, reviewed_at, review_notes"
    )
    .eq("order_id", orderId)
    .maybeSingle();

  return {
    order: order as OrderDetail["order"],
    items: (items ?? []) as OrderItemRow[],
    shipping: (shipping as ShippingAddressRow | null) ?? null,
    payment: (payment as PaymentRow | null) ?? null,
  };
}

// The proof lives in a private bucket with zero storage.objects policies
// — only the admin/service-role client can ever read it. Safe to call
// here because every caller is already behind requireAdmin() at the
// /admin layout level.
export async function getPaymentProofSignedUrl(storagePath: string): Promise<string | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage.from("payment-proofs").createSignedUrl(storagePath, 300);
  if (error || !data) return null;
  return data.signedUrl;
}
