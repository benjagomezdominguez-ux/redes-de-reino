import { getTranslations, setRequestLocale } from "next-intl/server";
import { listOrders } from "@/lib/admin/queries";
import { AdminPagination } from "@/components/ui/AdminPagination";
import { Link } from "@/i18n/navigation";

const PAGE_SIZE = 20;

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function AdminOrdersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/orders">) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin.orders");

  const page = Math.max(1, Number(pageParam) || 1);
  const { rows, total } = await listOrders(page, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-6 py-4">{t("columns.orderNumber")}</th>
                <th className="px-6 py-4">{t("columns.email")}</th>
                <th className="px-6 py-4">{t("columns.items")}</th>
                <th className="px-6 py-4">{t("columns.total")}</th>
                <th className="px-6 py-4">{t("columns.date")}</th>
                <th className="px-6 py-4">{t("columns.status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/orders/${row.id}`}
                      className="font-mono text-primary-900 underline"
                    >
                      {row.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-muted">{row.email}</td>
                  <td className="px-6 py-4 text-muted">{row.item_count}</td>
                  <td className="px-6 py-4 font-medium text-primary-900">
                    {formatPrice(row.total_cents, row.currency)}
                  </td>
                  <td className="px-6 py-4 text-muted">
                    {new Date(row.created_at).toLocaleDateString(locale)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-secondary-300/60 px-3 py-1 text-xs font-semibold text-secondary-700">
                      {t(`status.${row.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination basePath="/admin/orders" page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}
