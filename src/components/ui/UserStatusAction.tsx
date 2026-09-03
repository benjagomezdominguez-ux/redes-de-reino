"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deactivateUser, reactivateUser, type SetUserStatusResult } from "@/lib/actions/admin-users";

type Props = {
  userId: string;
  status: "active" | "inactive";
  displayName: string;
  email: string | null;
};

// Deactivation needs an explicit confirmation step (it removes the
// user's access); reactivation is the reversible "undo" and doesn't —
// matching the confirmation-only-where-it-matters approach already used
// elsewhere in this admin panel (e.g. WhatsAppCampaignControls' cancel
// form). requireAdmin()/the admin_set_user_status() RPC are the real
// authorization boundary (see admin-users.ts) — this component only
// renders the button, it never decides who's allowed to click it.
export function UserStatusAction({ userId, status, displayName, email }: Props) {
  const t = useTranslations("admin.users.actions");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  function handleResult(result: SetUserStatusResult, successKey: "deactivateSuccess" | "reactivateSuccess") {
    if (result.ok) {
      setFeedback({ kind: "success", text: t(successKey) });
      router.refresh();
    } else {
      setFeedback({ kind: "error", text: t(`errors.${result.errorKey}`) });
    }
  }

  function handleDeactivate() {
    startTransition(async () => {
      const result = await deactivateUser(userId);
      setConfirming(false);
      handleResult(result, "deactivateSuccess");
    });
  }

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateUser(userId);
      handleResult(result, "reactivateSuccess");
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-alt p-3 text-left">
        <p className="text-sm font-medium text-text">{t("confirmTitle")}</p>
        <p className="text-xs text-muted">{t("confirmBody")}</p>
        <dl className="text-xs text-muted">
          <div className="flex gap-1">
            <dt className="font-semibold">{t("confirmName")}:</dt>
            <dd>{displayName}</dd>
          </div>
          {email ? (
            <div className="flex gap-1">
              <dt className="font-semibold">{t("confirmEmail")}:</dt>
              <dd>{email}</dd>
            </div>
          ) : null}
        </dl>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={pending}
            className="rounded-full bg-error px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
          >
            {pending ? t("deactivating") : t("confirmButton")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {status === "active" ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="rounded-full border border-error/30 px-4 py-2 text-sm font-medium text-error transition-colors hover:bg-error/10 disabled:opacity-50"
        >
          {t("deactivate")}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleReactivate}
          disabled={pending}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-50"
        >
          {pending ? t("reactivating") : t("reactivate")}
        </button>
      )}
      {feedback ? (
        <p role={feedback.kind === "error" ? "alert" : "status"} className={`text-xs ${feedback.kind === "error" ? "text-error" : "text-success"}`}>
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
