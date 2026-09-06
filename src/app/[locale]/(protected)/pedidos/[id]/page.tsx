import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";
import { TransferProofForm } from "@/components/ui/TransferProofForm";
import { getOrderDetail } from "@/lib/admin/queries";
import { formatPrice } from "@/lib/books/format-price";
import { bankTransfer } from "@/lib/site-config";

const MODALITY_KEYS: Record<string, string> = {
  digital: "digital",
  fisico: "physical",
  digital_fisico: "digitalPhysical",
};

// getOrderDetail() runs through the session client, not the admin
// client — access is granted purely by RLS ("users see their own
// orders/payments"), the same function the admin order-detail page
// already reuses for the same reason. That's what actually makes this
// page safe for a regular user to load their OWN order by id and never
// anyone else's: Postgres denies the read outright, not just the UI
// choosing not to show a link.
export default async function OrderDetailPage({
  params,
}: PageProps<"/[locale]/pedidos/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("books.orderDetail");
  const tOrders = await getTranslations("books.orders");
  const tCheckout = await getTranslations("books.checkout");
  const tBooks = await getTranslations("books");

  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  const { order, items, payment } = detail;

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="mx-auto max-w-2xl">
          <Link href="/pedidos" className="text-sm font-medium text-primary-900/80 underline">
            {t("backToList")}
          </Link>

          <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-border bg-surface p-6 shadow-soft sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-sm text-muted">
                {tOrders("orderNumber")}: {order.reference ?? order.id.slice(0, 8)}
              </p>
              <p className="text-sm text-muted">{new Date(order.created_at).toLocaleString(locale)}</p>
            </div>
            <span className="w-fit rounded-full bg-secondary-300/60 px-3 py-1 text-xs font-semibold text-secondary-700">
              {tOrders(`status.${order.status}`)}
            </span>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-surface shadow-soft">
            <table className="w-full text-left text-sm">
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 text-text">
                      {item.title_snapshot ?? "—"}
                      {item.author_snapshot ? (
                        <span className="block text-xs text-muted">{item.author_snapshot}</span>
                      ) : null}
                      <span className="block text-xs text-muted">
                        {tBooks(MODALITY_KEYS[item.modality] ?? "digital")} × {item.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-text">
                      {formatPrice(item.unit_price_cents * item.quantity, order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="grid grid-cols-2 gap-2 border-t border-border p-6 text-sm sm:w-64 sm:justify-self-end">
              <dt className="text-muted">{tCheckout("subtotal")}</dt>
              <dd className="text-right font-medium text-primary-900">
                {formatPrice(order.subtotal_cents, order.currency)}
              </dd>
              <dt className="text-muted">{tCheckout("tax")}</dt>
              <dd className="text-right font-medium text-primary-900">
                {formatPrice(order.tax_cents, order.currency)}
              </dd>
              <dt className="font-semibold text-primary-900">{tCheckout("total")}</dt>
              <dd className="text-right font-semibold text-primary-900">
                {formatPrice(order.total_cents, order.currency)}
              </dd>
            </dl>
          </div>

          {payment && payment.method === "bank_transfer" ? (
            <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
              <h2 className="font-display text-lg font-medium text-primary-900">{t("paymentTitle")}</h2>

              {payment.status === "confirmed" ? (
                <p role="status" className="rounded-xl bg-success/10 p-4 text-sm font-medium text-success">
                  {t("paymentConfirmed")}
                </p>
              ) : payment.status === "rejected" ? (
                <div className="flex flex-col gap-1 rounded-xl bg-error/10 p-4 text-sm">
                  <p className="font-medium text-error">{t("paymentRejected")}</p>
                  {payment.review_notes ? <p className="text-text">{payment.review_notes}</p> : null}
                </div>
              ) : (
                <>
                  <div className="rounded-xl bg-surface-alt p-5 text-sm text-text">
                    <p className="font-semibold text-primary-900">{tCheckout("transfer.instructionsTitle")}</p>
                    <dl className="mt-3 flex flex-col gap-2">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">CBU</dt>
                        <dd className="font-mono">{bankTransfer.cbu}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                          {tCheckout("transfer.amount")}
                        </dt>
                        <dd className="font-semibold">{formatPrice(payment.amount_cents, payment.currency)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                          {tCheckout("transfer.reference")}
                        </dt>
                        <dd className="font-mono">{payment.bank_reference}</dd>
                      </div>
                    </dl>
                  </div>

                  <TransferProofForm
                    orderId={order.id}
                    initial={{
                      operationNumber: payment.declared_operation_number ?? "",
                      declaredAmount:
                        payment.declared_amount_cents != null ? (payment.declared_amount_cents / 100).toString() : "",
                      declaredDate: payment.declared_at ?? "",
                      hasProof: Boolean(payment.proof_storage_path),
                    }}
                  />
                </>
              )}
            </div>
          ) : null}
        </Container>
      </main>
      <Footer />
    </>
  );
}
