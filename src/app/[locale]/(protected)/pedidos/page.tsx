import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { getSupabaseSessionClient } from "@/lib/supabase/session";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function OrdersPage({
  params,
}: PageProps<"/[locale]/pedidos">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("books.orders");

  const supabase = await getSupabaseSessionClient();

  type OrderRow = {
    id: string;
    created_at: string;
    status: string;
    total_cents: number;
    currency: string;
  };
  const { data } = await supabase
    .from("orders")
    .select("id, created_at, status, total_cents, currency")
    .order("created_at", { ascending: false });
  const orders: OrderRow[] = data ?? [];

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="mx-auto max-w-3xl">
          <h1 className="mb-10 font-display text-3xl font-medium text-primary-900">
            {t("title")}
          </h1>

          {orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
              {t("empty")}
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-mono text-sm text-muted">
                      {t("orderNumber")}: {order.id.slice(0, 8)}
                    </p>
                    <p className="text-sm text-muted">
                      {new Date(order.created_at).toLocaleDateString(locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="rounded-full bg-secondary-300/60 px-3 py-1 text-xs font-semibold text-secondary-700">
                      {t(`status.${order.status}`)}
                    </span>
                    <span className="font-display text-lg font-medium text-primary-900">
                      {formatPrice(order.total_cents, order.currency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
