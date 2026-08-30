import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { AddToCartButton } from "@/components/ui/AddToCartButton";
import type { Product } from "@/lib/books/types";

function formatPrice(cents: number | null, currency: string) {
  if (cents === null) return null;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export async function BookCard({ product }: { product: Product }) {
  const t = await getTranslations("books");

  const typeLabel =
    product.product_type === "digital"
      ? t("digital")
      : product.product_type === "fisico"
        ? t("physical")
        : t("digitalPhysical");

  const digitalPrice = formatPrice(product.digital_price_cents, product.currency);
  const physicalPrice = formatPrice(product.physical_price_cents, product.currency);

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition-transform duration-200 hover:-translate-y-1 hover:shadow-lifted">
      <div className="relative aspect-[3/4] w-full bg-surface-alt">
        {product.cover_url ? (
          <Image
            src={product.cover_url}
            alt={product.title ?? t("pendingField")}
            fill
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted">
            {t("pendingField")}
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-primary-900/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          {typeLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-6">
        <h3 className="font-display text-lg font-medium text-primary-900">
          {product.title ?? t("pendingField")}
        </h3>
        <p className="text-sm text-muted">{product.author ?? t("pendingField")}</p>
        {product.description ? (
          <p className="text-sm text-muted">{product.description}</p>
        ) : null}

        <div className="mt-1 flex flex-col gap-0.5 text-sm text-text">
          {digitalPrice ? (
            <span>
              {t("digitalPrice")}: <strong>{digitalPrice}</strong>
            </span>
          ) : null}
          {physicalPrice ? (
            <span>
              {t("physicalPrice")}: <strong>{physicalPrice}</strong>
            </span>
          ) : null}
        </div>

        <div className="mt-auto pt-3">
          <AddToCartButton product={product} />
        </div>
      </div>
    </article>
  );
}
