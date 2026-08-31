"use client";

import { useActionState, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { signIn, signUp, type AuthFormState } from "@/lib/actions/auth";

const initialState: AuthFormState = { status: "idle" };

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

function PasswordField({
  name,
  label,
  autoComplete,
}: {
  name: string;
  label: string;
  autoComplete: string;
}) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
      <label htmlFor={id}>{label}</label>
      <span className="relative flex items-center">
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={name}
          required
          minLength={6}
          autoComplete={autoComplete}
          className={`${inputClasses} pr-16`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 text-xs font-semibold text-primary-900/70 hover:text-primary-900"
          aria-label={visible ? t("hidePassword") : t("showPassword")}
        >
          {visible ? t("hidePassword") : t("showPassword")}
        </button>
      </span>
    </div>
  );
}

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
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
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {mode === "signup" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
            {t("firstName")}
            <input type="text" name="firstName" required autoComplete="given-name" className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
            {t("lastName")}
            <input type="text" name="lastName" required autoComplete="family-name" className={inputClasses} />
          </label>
        </div>
      ) : null}

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

      <PasswordField
        name="password"
        label={t("password")}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
      />

      {mode === "signup" ? (
        <PasswordField
          name="confirmPassword"
          label={t("confirmPassword")}
          autoComplete="new-password"
        />
      ) : null}

      {mode === "login" ? (
        <Link
          href="/forgot-password"
          className="self-end text-sm font-medium text-primary-900/80 underline hover:text-primary-900"
        >
          {t("forgotPasswordLink")}
        </Link>
      ) : null}

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
            <Link
              href={next ? { pathname: "/signup", query: { next } } : "/signup"}
              className="font-medium text-primary-900 underline"
            >
              {t("signupLink")}
            </Link>
          </>
        ) : (
          <>
            {t("haveAccount")}{" "}
            <Link
              href={next ? { pathname: "/login", query: { next } } : "/login"}
              className="font-medium text-primary-900 underline"
            >
              {t("loginLink")}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
