import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getOrderDetail } from "@/lib/admin/queries";
import { Link } from "@/i18n/navigation";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const MODALITY_KEYS: Record<string, string> = {
  digital: "digital",
  fisico: "physical",
  digital_fisico: "digitalPhysical",
};

export default async function AdminOrderDetailPage({
  params,
}: PageProps<"/[locale]/admin/orders/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.orderDetail");
  const tOrders = await getTranslations("admin.orders");
  const tBooks = await getTranslations("books");

  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  const { order, items, shipping } = detail;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/orders" className="text-sm font-medium text-primary-900/80 underline">
        {t("backToList")}
      </Link>

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-sm text-muted">{tOrders("columns.orderNumber")}: {order.id}</p>
          <p className="text-sm text-muted">{order.email}</p>
          <p className="text-sm text-muted">{new Date(order.created_at).toLocaleString(locale)}</p>
        </div>
        <span className="w-fit rounded-full bg-secondary-300/60 px-3 py-1 text-xs font-semibold text-secondary-700">
          {tOrders(`status.${order.status}`)}
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-surface shadow-soft">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-6 py-4">{t("product")}</th>
              <th className="px-6 py-4">{t("modality")}</th>
              <th className="px-6 py-4">{t("quantity")}</th>
              <th className="px-6 py-4">{t("unitPrice")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-6 py-4 text-text">
                  {item.title_snapshot ?? "—"}
                  {item.author_snapshot ? (
                    <span className="block text-xs text-muted">{item.author_snapshot}</span>
                  ) : null}
                </td>
                <td className="px-6 py-4 text-muted">
                  {tBooks(MODALITY_KEYS[item.modality] ?? "digital")}
                </td>
                <td className="px-6 py-4 text-muted">{item.quantity}</td>
                <td className="px-6 py-4 text-muted">
                  {formatPrice(item.unit_price_cents, order.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="grid grid-cols-2 gap-2 border-t border-border p-6 text-sm sm:w-64 sm:justify-self-end">
          <dt className="text-muted">{tBooks("checkout.total")}</dt>
          <dd className="text-right font-medium text-primary-900">
            {formatPrice(order.subtotal_cents, order.currency)}
          </dd>
          <dt className="text-muted">{tBooks("checkout.shippingCost")}</dt>
          <dd className="text-right font-medium text-primary-900">
            {formatPrice(order.shipping_cents, order.currency)}
          </dd>
          <dt className="font-semibold text-primary-900">{t("orderTotal")}</dt>
          <dd className="text-right font-semibold text-primary-900">
            {formatPrice(order.total_cents, order.currency)}
          </dd>
        </dl>
      </div>

      {order.requires_shipping && shipping ? (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <h2 className="mb-4 font-display text-lg font-medium text-primary-900">
            {t("shippingInfo")}
          </h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                {tBooks("checkout.firstName")} / {tBooks("checkout.lastName")}
              </dt>
              <dd className="text-text">{shipping.first_name} {shipping.last_name}</dd>
            </div>
            {shipping.phone ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {tBooks("checkout.phone")}
                </dt>
                <dd className="text-text">{shipping.phone}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                {tBooks("checkout.shippingAddress")}
              </dt>
              <dd className="text-text">
                {shipping.street} {shipping.number}
                {shipping.floor_unit ? `, ${shipping.floor_unit}` : ""}
                <br />
                {shipping.city}, {shipping.state}, {shipping.postal_code}
                <br />
                {shipping.country}
              </dd>
            </div>
            {shipping.notes ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {tBooks("checkout.notes")}
                </dt>
                <dd className="text-text">{shipping.notes}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
