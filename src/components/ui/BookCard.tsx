import { getTranslations } from "next-intl/server";
import { AddToCartButton } from "@/components/ui/AddToCartButton";
import type { Product } from "@/lib/books/types";
import { formatPrice as formatPriceBase } from "@/lib/books/format-price";

function formatPrice(cents: number | null, currency: string) {
  if (cents === null) return null;
  return formatPriceBase(cents, currency);
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
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative w-full overflow-hidden bg-surface-alt">
        {product.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- intrinsic sizing (no fixed box, no object-fit crop) needs the cover's real dimensions, which next/image's fill mode doesn't expose. Real covers here are ~2:3, not the 3:4 box this used to force them into — that cropped the top/bottom off every cover. Same pattern as Gallery.tsx.
          <img
            src={product.cover_url}
            alt={product.title ?? t("pendingField")}
            loading="lazy"
            className="block h-auto w-full transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center text-sm text-muted">
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
