"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { createOrder, type CheckoutState } from "@/lib/actions/checkout";

const initialState: CheckoutState = { status: "idle" };

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

export function CheckoutView() {
  const t = useTranslations("books.checkout");
  const router = useRouter();
  const { items, subtotalCents, requiresShipping, clear } = useCart();
  const [state, formAction, pending] = useActionState(createOrder, initialState);

  useEffect(() => {
    if (state.status === "success") {
      clear();
    }
    // Deliberately only reacting to a status change, not to `clear`
    // itself, or this would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  if (items.length === 0 && state.status !== "success") {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
        {t("errors.notAvailable")}
      </div>
    );
  }

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-8 text-center shadow-soft">
        <h2 className="font-display text-2xl font-medium text-primary-900">
          {t("orderCreated")}
        </h2>
        <p className="text-sm text-muted">
          {t("orderNumber")}: <span className="font-mono">{state.orderId}</span>
        </p>
        <div className="mx-auto max-w-md rounded-xl bg-surface-alt p-4 text-sm text-text">
          <p className="font-semibold">{t("paymentPendingTitle")}</p>
          <p className="mt-1 text-muted">{t("paymentPendingBody")}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/pedidos")}
          className="mx-auto mt-2 inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
        >
          {t("title")}
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="grid grid-cols-1 gap-8 lg:grid-cols-3"
    >
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          items.map((i) => ({ productId: i.productId, modality: i.modality, quantity: i.quantity }))
        )}
      />
      <input type="hidden" name="requiresShipping" value={String(requiresShipping)} />

      <div className="flex flex-col gap-6 lg:col-span-2">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <h2 className="mb-4 font-display text-lg font-medium text-primary-900">
            {t("buyerInfo")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
              {t("firstName")}
              <input name="first_name" required className={inputClasses} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
              {t("lastName")}
              <input name="last_name" required className={inputClasses} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900 sm:col-span-2">
              {t("phone")}
              <input name="phone" type="tel" className={inputClasses} />
            </label>
          </div>
        </div>

        {requiresShipping ? (
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <h2 className="mb-4 font-display text-lg font-medium text-primary-900">
              {t("shippingAddress")}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
                {t("country")}
                <input name="country" required defaultValue="Argentina" className={inputClasses} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
                {t("state")}
                <input name="state" required className={inputClasses} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
                {t("city")}
                <input name="city" required className={inputClasses} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
                {t("postalCode")}
                <input name="postal_code" required className={inputClasses} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
                {t("street")}
                <input name="street" required className={inputClasses} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
                {t("number")}
                <input name="number" required className={inputClasses} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
                {t("floorUnit")}
                <input name="floor_unit" className={inputClasses} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900 sm:col-span-2">
                {t("notes")}
                <textarea name="notes" rows={2} className={inputClasses} />
              </label>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 self-start rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="font-display text-lg font-medium text-primary-900">{t("summary")}</h2>
        <ul className="flex flex-col gap-2 text-sm text-muted">
          {items.map((item) => (
            <li key={`${item.productId}:${item.modality}`} className="flex justify-between gap-2">
              <span>
                {item.title} × {item.quantity}
              </span>
              <span>{formatPrice(item.unitPriceCents * item.quantity, item.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-border pt-3 text-sm text-muted">
          <span>{t("shippingCost")}</span>
          <span>{requiresShipping ? t("shippingPending") : "—"}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-primary-900">
          <span>{t("total")}</span>
          <span>{formatPrice(subtotalCents, items[0]?.currency ?? "ARS")}</span>
        </div>

        {state.status === "error" && state.errorKey ? (
          <p role="alert" className="text-sm font-medium text-error">
            {t(`errors.${state.errorKey}`)}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-800 disabled:opacity-60"
        >
          {pending ? t("placingOrder") : t("placeOrder")}
        </button>
      </div>
    </form>
  );
}
