"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { resendConfirmationEmail, type ResendConfirmationState } from "@/lib/actions/auth";

const initialState: ResendConfirmationState = { status: "idle" };

// Supabase's default mailer (this project has no custom SMTP configured)
// enforces a real, low, project-wide rate limit on outgoing auth emails —
// see the signUp()/resendConfirmationEmail() comments in actions/auth.ts.
// This cooldown exists specifically so one impatient person re-clicking
// "reenviar" a few times in a row can't burn through that shared quota
// by themselves; it starts the moment the form is submitted, before even
// waiting for the server's response, so it covers a failed attempt
// (e.g. an already-rate-limited call) exactly the same as a successful
// one.
const COOLDOWN_SECONDS = 60;

export function ResendConfirmationButton({ email }: { email: string }) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(resendConfirmationEmail, initialState);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  // Ticks `now` once a cooldown is running, purely to re-render the
  // remaining-seconds display — this only ever calls setState from the
  // interval's own callback (an external-system subscription), never
  // synchronously in the effect body itself. `now`'s initial value for
  // a freshly-started cooldown is set in the onSubmit handler below,
  // alongside `cooldownEndsAt` — not here.
  useEffect(() => {
    if (!cooldownEndsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownEndsAt]);

  const remaining = cooldownEndsAt && now ? Math.max(0, Math.ceil((cooldownEndsAt - now) / 1000)) : 0;
  const disabled = pending || remaining > 0;

  return (
    <form
      action={formAction}
      onSubmit={() => {
        const start = Date.now();
        setCooldownEndsAt(start + COOLDOWN_SECONDS * 1000);
        setNow(start);
      }}
      className="flex flex-col items-center gap-2"
    >
      <input type="hidden" name="email" value={email} />
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-full border border-border px-5 py-2.5 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? t("resendConfirmationPending")
          : remaining > 0
            ? t("resendConfirmationCooldown", { seconds: remaining })
            : t("resendConfirmationCta")}
      </button>

      {state.status === "success" ? (
        <p role="status" className="text-center text-sm text-success">
          {t("resendConfirmationSuccess")}
        </p>
      ) : null}
      {state.status === "error" && state.errorKey ? (
        <p role="alert" className="text-center text-sm font-medium text-error">
          {t(`errors.${state.errorKey}`)}
        </p>
      ) : null}
    </form>
  );
}
