import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAllProducts } from "@/lib/admin/book-queries";
import { Link } from "@/i18n/navigation";
import { BookStatusButtons } from "@/components/ui/BookStatusButtons";
import { formatPrice as formatPriceBase } from "@/lib/books/format-price";

function formatPrice(cents: number | null, currency: string) {
  if (cents === null) return "—";
  return formatPriceBase(cents, currency);
}

export default async function AdminBooksPage({
  params,
}: PageProps<"/[locale]/admin/books">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.books");

  const products = await listAllProducts();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{t("count", { count: products.length })}</p>
        <Link
          href="/admin/books/new"
          className="inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
        >
          {t("addNew")}
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-6 py-4">{t("columns.cover")}</th>
                <th className="px-6 py-4">{t("columns.title")}</th>
                <th className="px-6 py-4">{t("columns.author")}</th>
                <th className="px-6 py-4">{t("columns.price")}</th>
                <th className="px-6 py-4">{t("columns.status")}</th>
                <th className="px-6 py-4">{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-border last:border-0">
                  <td className="px-6 py-4">
                    <div className="relative h-16 w-12 overflow-hidden rounded bg-surface-alt">
                      {product.cover_url ? (
                        <Image src={product.cover_url} alt="" fill className="object-cover" />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-text">
                    <Link href={`/admin/books/${product.id}/edit`} className="font-medium underline">
                      {product.title ?? "—"}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-muted">{product.author ?? "—"}</td>
                  <td className="px-6 py-4 text-muted">
                    {product.product_type !== "fisico"
                      ? formatPrice(product.digital_price_cents, product.currency)
                      : formatPrice(product.physical_price_cents, product.currency)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        product.status === "active"
                          ? "bg-success/15 text-success"
                          : "bg-muted/20 text-muted"
                      }`}
                    >
                      {t(`status.${product.status}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/books/${product.id}/edit`}
                        className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
                      >
                        {t("edit")}
                      </Link>
                      <BookStatusButtons productId={product.id} status={product.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
