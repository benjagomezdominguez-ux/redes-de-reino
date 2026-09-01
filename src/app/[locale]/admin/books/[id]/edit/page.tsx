import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getProductForEdit, getProductSales } from "@/lib/admin/book-queries";
import { BookForm } from "@/components/ui/BookForm";
import { Link } from "@/i18n/navigation";
import { formatPrice } from "@/lib/books/format-price";

export default async function AdminEditBookPage({
  params,
}: PageProps<"/[locale]/admin/books/[id]/edit">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.books");

  const result = await getProductForEdit(id);
  if (!result) notFound();
  const { product, hasDigitalFile } = result;

  const sales = await getProductSales(id);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/books" className="text-sm font-medium text-primary-900/80 underline">
        {t("backToList")}
      </Link>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="mb-2 font-display text-lg font-medium text-primary-900">{product.title}</h2>
        <p className="mb-6 text-sm text-muted">
          {t("salesSummary", {
            units: sales.unitsSold,
            revenue: formatPrice(sales.revenueCents, product.currency ?? "ARS"),
          })}
        </p>
        <BookForm
          mode="edit"
          hasDigitalFile={hasDigitalFile}
          initial={{
            id: product.id,
            title: product.title,
            author: product.author,
            description: product.description,
            category: product.category,
            language: product.language,
            product_type: product.product_type,
            digital_price_cents: product.digital_price_cents,
            physical_price_cents: product.physical_price_cents,
            stock: product.stock,
            cover_url: product.cover_url,
          }}
        />
      </div>
    </div>
  );
}
