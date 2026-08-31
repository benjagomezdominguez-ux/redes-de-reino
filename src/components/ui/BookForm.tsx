"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createBook, updateBook, type AdminBookState } from "@/lib/actions/admin-books";

const initialState: AdminBookState = { status: "idle" };

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

export type BookFormInitial = {
  id: string;
  title: string | null;
  author: string | null;
  description: string | null;
  category: string | null;
  language: string;
  product_type: "digital" | "fisico" | "digital_fisico";
  digital_price_cents: number | null;
  physical_price_cents: number | null;
  stock: number | null;
  cover_url: string | null;
};

export function BookForm({
  mode,
  initial,
  hasDigitalFile,
}: {
  mode: "create" | "edit";
  initial?: BookFormInitial;
  hasDigitalFile?: boolean;
}) {
  const t = useTranslations("admin.books.form");
  const action = mode === "create" ? createBook : updateBook;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {mode === "edit" && initial ? (
        <input type="hidden" name="productId" value={initial.id} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900 sm:col-span-2">
          {t("title")}
          <input name="title" required defaultValue={initial?.title ?? ""} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("author")}
          <input name="author" defaultValue={initial?.author ?? ""} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("category")}
          <input name="category" defaultValue={initial?.category ?? ""} className={inputClasses} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900 sm:col-span-2">
          {t("description")}
          <textarea
            name="description"
            rows={4}
            defaultValue={initial?.description ?? ""}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("language")}
          <select name="language" defaultValue={initial?.language ?? "es"} className={inputClasses}>
            <option value="es">Español</option>
            <option value="en">English</option>
            <option value="pt">Português</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("productType")}
          <select
            name="productType"
            defaultValue={initial?.product_type ?? "digital"}
            className={inputClasses}
          >
            <option value="digital">{t("typeDigital")}</option>
            <option value="fisico">{t("typePhysical")}</option>
            <option value="digital_fisico">{t("typeBoth")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("digitalPrice")}
          <input
            name="digitalPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              initial?.digital_price_cents != null ? (initial.digital_price_cents / 100).toFixed(2) : ""
            }
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("physicalPrice")}
          <input
            name="physicalPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={
              initial?.physical_price_cents != null ? (initial.physical_price_cents / 100).toFixed(2) : ""
            }
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("stock")}
          <input
            name="stock"
            type="number"
            min="0"
            step="1"
            defaultValue={initial?.stock ?? ""}
            className={inputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("cover")}
          <input name="cover" type="file" accept="image/jpeg,image/png,image/webp" className={inputClasses} />
          {initial?.cover_url ? (
            <span className="text-xs text-muted">{t("coverCurrent")}</span>
          ) : null}
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
          {t("file")}
          <input name="file" type="file" accept="application/pdf" className={inputClasses} />
          {hasDigitalFile ? <span className="text-xs text-muted">{t("fileCurrent")}</span> : null}
        </label>
      </div>

      {state.status === "error" && state.errorKey ? (
        <p role="alert" className="text-sm font-medium text-error">
          {t(`errors.${state.errorKey}`)}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="text-sm font-medium text-success">
          {t("saved")}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
