"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { activateCampaign, pauseCampaign, resumeCampaign, cancelCampaign } from "@/lib/actions/admin-whatsapp";

const buttonClasses =
  "rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-50";

export function WhatsAppCampaignControls({ campaignId, status }: { campaignId: string; status: string }) {
  const t = useTranslations("admin.whatsapp.campaignControls");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activateError, setActivateError] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);

  function handleActivate() {
    setActivateError(null);
    startTransition(async () => {
      const result = await activateCampaign(campaignId);
      if (!result.ok) {
        setActivateError(result.errorKey ?? "generic");
      } else {
        router.refresh();
      }
    });
  }

  function handlePause() {
    startTransition(async () => {
      await pauseCampaign(campaignId);
      router.refresh();
    });
  }

  function handleResume() {
    startTransition(async () => {
      await resumeCampaign(campaignId);
      router.refresh();
    });
  }

  function handleCancel(reason: string) {
    startTransition(async () => {
      await cancelCampaign(campaignId, reason);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {(status === "draft" || status === "paused") && (
          <button type="button" disabled={pending} onClick={handleActivate} className={buttonClasses}>
            {t("activate")}
          </button>
        )}
        {status === "active" && (
          <button type="button" disabled={pending} onClick={handlePause} className={buttonClasses}>
            {t("pause")}
          </button>
        )}
        {status === "paused" && (
          <button type="button" disabled={pending} onClick={handleResume} className={buttonClasses}>
            {t("resume")}
          </button>
        )}
        {(status === "draft" || status === "active" || status === "paused") && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowCancelForm((v) => !v)}
            className="rounded-full border border-error/30 px-4 py-2 text-sm font-medium text-error transition-colors hover:bg-error/5 disabled:opacity-50"
          >
            {t("cancel")}
          </button>
        )}
      </div>

      {activateError ? (
        <p role="alert" className="text-sm font-medium text-error">
          {t(`activateErrors.${activateError}`)}
        </p>
      ) : null}

      {showCancelForm ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const reason = new FormData(e.currentTarget).get("reason");
            handleCancel(typeof reason === "string" ? reason : "");
            setShowCancelForm(false);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
            {t("cancelReason")}
            <input
              name="reason"
              className="w-64 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500"
            />
          </label>
          <button type="submit" className="rounded-full bg-error px-5 py-2.5 text-sm font-semibold text-white">
            {t("confirmCancel")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
