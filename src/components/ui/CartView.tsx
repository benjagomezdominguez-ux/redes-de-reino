"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { formatPrice } from "@/lib/books/format-price";

export function CartView() {
  const t = useTranslations("books.cart");
  const tBooks = useTranslations("books");
  const router = useRouter();
  const { items, removeItem, setQuantity, subtotalCents } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-dashed border-border p-12 text-center">
        <p className="text-muted">{t("empty")}</p>
        <Link
          href="/#libros"
          className="inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-800"
        >
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li
            key={`${item.productId}:${item.modality}`}
            className="flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-soft"
          >
            <div className="relative h-24 w-18 shrink-0 overflow-hidden rounded-lg bg-surface-alt">
              {item.coverUrl ? (
                <Image src={item.coverUrl} alt={item.title} fill className="object-cover" />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <h3 className="font-display text-base font-medium text-primary-900">{item.title}</h3>
              {item.author ? <p className="text-sm text-muted">{item.author}</p> : null}
              <p className="text-xs uppercase tracking-wide text-secondary-600">
                {item.modality === "digital" ? tBooks("digital") : tBooks("physical")}
              </p>

              <div className="mt-2 flex items-center justify-between">
                {item.modality === "digital" ? (
                  <span className="text-sm text-muted">{t("quantity")}: 1</span>
                ) : (
                  <label className="flex items-center gap-2 text-sm text-muted">
                    {t("quantity")}
                    <input
                      type="number"
                      min={1}
                      max={item.maxStock ?? undefined}
                      value={item.quantity}
                      onChange={(e) =>
                        setQuantity(item.productId, item.modality, Number(e.target.value))
                      }
                      className="w-16 rounded-md border border-border px-2 py-1 text-sm"
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => removeItem(item.productId, item.modality)}
                  className="text-sm font-medium text-error underline"
                >
                  {t("remove")}
                </button>
              </div>
            </div>
            <div className="whitespace-nowrap text-sm font-semibold text-primary-900">
              {formatPrice(item.unitPriceCents * item.quantity, item.currency)}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-border pt-6">
        <span className="text-base font-medium text-primary-900">{t("subtotal")}</span>
        <span className="font-display text-2xl font-medium text-primary-900">
          {formatPrice(subtotalCents, items[0]?.currency ?? "ARS")}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/#libros"
          className="inline-flex items-center justify-center rounded-full border border-primary-900/20 px-6 py-3 text-sm font-semibold text-primary-900 transition-colors hover:border-primary-900/40"
        >
          {t("continueShopping")}
        </Link>
        <button
          type="button"
          onClick={() => router.push("/libros/checkout")}
          className="inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-800"
        >
          {t("checkout")}
        </button>
      </div>
    </div>
  );
}
