"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestPasswordReset, type ForgotPasswordState } from "@/lib/actions/auth";

const initialState: ForgotPasswordState = { status: "idle" };

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  if (state.status === "success") {
    return (
      <p role="status" className="text-center text-sm text-text">
        {t("forgotPasswordSuccess")}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {t("email")}
        <input type="email" name="email" required autoComplete="email" className={inputClasses} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-800 disabled:opacity-60"
      >
        {t("forgotPasswordCta")}
      </button>

      {state.status === "error" ? (
        <p role="alert" className="text-sm font-medium text-error">
          {t("errors.generic")}
        </p>
      ) : null}
    </form>
  );
}
