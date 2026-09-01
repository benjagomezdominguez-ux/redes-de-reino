"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useCart } from "@/lib/cart/CartContext";
import { createOrder, type CheckoutState } from "@/lib/actions/checkout";
import { bankTransfer } from "@/lib/site-config";
import { countries } from "@/lib/checkout/countries";
import { TransferProofForm } from "@/components/ui/TransferProofForm";
import { formatPrice } from "@/lib/books/format-price";

const initialState: CheckoutState = { status: "idle" };

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

export function CheckoutView({ onlinePaymentAvailable }: { onlinePaymentAvailable: boolean }) {
  const t = useTranslations("books.checkout");
  const { items, subtotalCents, requiresShipping, clear } = useCart();
  const [state, formAction, pending] = useActionState(createOrder, initialState);
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "online">("bank_transfer");

  useEffect(() => {
    if (state.status === "success") {
      clear();
    }
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
    const currency = state.currency ?? "ARS";
    return (
      <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-8 shadow-soft">
        <div className="text-center">
          <h2 className="font-display text-2xl font-medium text-primary-900">{t("orderCreated")}</h2>
          <p className="mt-1 text-sm text-muted">
            {t("orderNumber")}: <span className="font-mono">{state.reference}</span>
          </p>
        </div>

        <dl className="mx-auto grid w-full max-w-sm grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">{t("subtotal")}</dt>
          <dd className="text-right text-text">{formatPrice(state.subtotalCents ?? 0, currency)}</dd>
          <dt className="text-muted">{t("tax")}</dt>
          <dd className="text-right text-text">{formatPrice(state.taxCents ?? 0, currency)}</dd>
          <dt className="font-semibold text-primary-900">{t("total")}</dt>
          <dd className="text-right font-semibold text-primary-900">
            {formatPrice(state.totalCents ?? 0, currency)}
          </dd>
        </dl>

        {state.paymentMethod === "bank_transfer" ? (
          <div className="mx-auto flex w-full max-w-md flex-col gap-4">
            <div className="rounded-xl bg-surface-alt p-5 text-sm text-text">
              <p className="font-semibold text-primary-900">{t("transfer.instructionsTitle")}</p>
              <dl className="mt-3 flex flex-col gap-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">CBU</dt>
                  <dd className="font-mono">{bankTransfer.cbu}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t("transfer.amount")}
                  </dt>
                  <dd className="font-semibold">{formatPrice(state.totalCents ?? 0, currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {t("transfer.reference")}
                  </dt>
                  <dd className="font-mono">{state.reference}</dd>
                </div>
              </dl>
              <p className="mt-3 text-muted">{t("transfer.instructionsBody")}</p>
            </div>

            {state.orderId ? <TransferProofForm orderId={state.orderId} /> : null}
          </div>
        ) : (
          <div className="mx-auto max-w-md rounded-xl bg-surface-alt p-4 text-center text-sm text-text">
            <p className="font-semibold">{t("paymentPendingTitle")}</p>
            <p className="mt-1 text-muted">{t("paymentPendingBody")}</p>
          </div>
        )}
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
      <input type="hidden" name="payment_method" value={paymentMethod} />

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
            <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
              {t("phone")}
              <input name="phone" type="tel" className={inputClasses} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
              {t("billingCountry")}
              <select name="billing_country" required defaultValue="AR" className={inputClasses}>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
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

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <h2 className="mb-4 font-display text-lg font-medium text-primary-900">{t("paymentMethod")}</h2>
          <div className="flex flex-col gap-3" role="radiogroup" aria-label={t("paymentMethod")}>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                paymentMethod === "bank_transfer"
                  ? "border-primary-900 bg-primary-900/5"
                  : "border-border"
              }`}
            >
              <input
                type="radio"
                name="payment_method_choice"
                checked={paymentMethod === "bank_transfer"}
                onChange={() => setPaymentMethod("bank_transfer")}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-primary-900">{t("method.bank_transfer")}</span>
                <span className="block text-sm text-muted">{t("method.bankTransferHint")}</span>
              </span>
            </label>

            <label
              className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                onlinePaymentAvailable
                  ? paymentMethod === "online"
                    ? "cursor-pointer border-primary-900 bg-primary-900/5"
                    : "cursor-pointer border-border"
                  : "cursor-not-allowed border-border opacity-50"
              }`}
            >
              <input
                type="radio"
                name="payment_method_choice"
                checked={paymentMethod === "online"}
                onChange={() => setPaymentMethod("online")}
                disabled={!onlinePaymentAvailable}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-primary-900">{t("method.online")}</span>
                <span className="block text-sm text-muted">
                  {onlinePaymentAvailable ? t("method.onlineHint") : t("method.onlineComingSoon")}
                </span>
              </span>
            </label>
          </div>
        </div>
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
        <div className="flex justify-between text-sm text-muted">
          <span>{t("tax")}</span>
          <span>{t("taxCalculatedNext")}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-primary-900">
          <span>{t("subtotal")}</span>
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
