"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { updatePassword, type ResetPasswordState } from "@/lib/actions/auth";

const initialState: ResetPasswordState = { status: "idle" };

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p role="status" className="text-sm text-text">
          {t("resetPasswordSuccess")}
        </p>
        <Link href="/login" className="font-medium text-primary-900 underline">
          {t("loginLink")}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {t("newPassword")}
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClasses}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {t("confirmNewPassword")}
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClasses}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-800 disabled:opacity-60"
      >
        {t("resetPasswordCta")}
      </button>

      {state.status === "error" && state.errorKey ? (
        <p role="alert" className="text-sm font-medium text-error">
          {t(`errors.${state.errorKey}`)}
        </p>
      ) : null}
    </form>
  );
}
