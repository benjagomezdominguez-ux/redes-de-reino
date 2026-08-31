"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCart, type CartModality } from "@/lib/cart/CartContext";
import type { Product } from "@/lib/books/types";

function priceFor(product: Product, modality: CartModality): number | null {
  if (modality === "digital") return product.digital_price_cents;
  return product.physical_price_cents;
}

// "Columnas" sells through Tiendanube instead of this site's own
// cart/checkout — a one-off redirect requested directly, not a general
// mechanism. Keyed by product id (stable) rather than slug (DB-generated,
// could change).
const TIENDANUBE_OVERRIDES: Record<string, string> = {
  "852e373b-0bbc-428a-8312-e523da83e4b6": "https://redesdereino.mitiendanube.com/productos/columnas-libro-digital-85s28/",
};

export function AddToCartButton({ product }: { product: Product }) {
  const t = useTranslations("books");
  const router = useRouter();
  const { addItem } = useCart();

  const modalities: CartModality[] =
    product.product_type === "digital_fisico"
      ? ["digital", "fisico"]
      : [product.product_type];

  const [modality, setModality] = useState<CartModality>(modalities[0]);

  const externalUrl = TIENDANUBE_OVERRIDES[product.id];
  if (externalUrl) {
    return (
      <a
        href={externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-800"
      >
        {t("buy")}
      </a>
    );
  }

  const price = priceFor(product, modality);
  const outOfStock =
    (modality === "fisico" || modality === "digital_fisico") &&
    product.stock !== null &&
    product.stock <= 0;

  function handleAdd() {
    if (price === null || outOfStock) return;
    addItem({
      productId: product.id,
      modality,
      quantity: 1,
      title: product.title ?? t("pendingField"),
      author: product.author,
      coverUrl: product.cover_url,
      unitPriceCents: price,
      currency: product.currency,
      maxStock: modality === "digital" ? null : product.stock,
    });
    router.push("/libros/carrito");
  }

  return (
    <div className="flex flex-col gap-3">
      {modalities.length > 1 ? (
        <div className="flex gap-2" role="radiogroup" aria-label={t("cart.modality")}>
          {modalities.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modality === m}
              onClick={() => setModality(m)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                modality === m
                  ? "border-primary-900 bg-primary-900 text-white"
                  : "border-border text-muted hover:border-primary-900/40"
              }`}
            >
              {m === "digital" ? t("digital") : t("physical")}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleAdd}
        disabled={price === null || outOfStock}
        className="inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {outOfStock ? t("outOfStock") : t("buy")}
      </button>
    </div>
  );
}
