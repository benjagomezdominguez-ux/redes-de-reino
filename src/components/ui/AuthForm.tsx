"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { signIn, signUp, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = { status: "idle" };

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const t = useTranslations("auth");
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.status === "checkEmail") {
    return (
      <p role="status" className="text-center text-sm text-text">
        {t("checkEmail")}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {t("email")}
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className={inputClasses}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {t("password")}
        <input
          type="password"
          name="password"
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className={inputClasses}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-800 disabled:opacity-60"
      >
        {mode === "login" ? t("loginCta") : t("signupCta")}
      </button>

      {state.status === "error" && state.errorKey ? (
        <p role="alert" className="text-sm font-medium text-error">
          {t(`errors.${state.errorKey}`)}
        </p>
      ) : null}

      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            {t("noAccount")}{" "}
            <Link href="/signup" className="font-medium text-primary-900 underline">
              {t("signupLink")}
            </Link>
          </>
        ) : (
          <>
            {t("haveAccount")}{" "}
            <Link href="/login" className="font-medium text-primary-900 underline">
              {t("loginLink")}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
