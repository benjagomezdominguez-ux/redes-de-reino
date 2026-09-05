"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteDevotional } from "@/lib/actions/admin-devotionals";

// Inline confirm, same pattern already used elsewhere in this admin
// panel (e.g. UserStatusAction's deactivate confirmation) — a real
// confirmation step before an irreversible delete, without a separate
// modal/dialog system.
export function DevotionalDeleteButton({ id, title }: { id: string; title: string }) {
  const t = useTranslations("admin.devotionals");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errored, setErrored] = useState(false);

  function handleDelete() {
    setErrored(false);
    startTransition(async () => {
      const result = await deleteDevotional(id);
      if (!result.ok) {
        setErrored(true);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-alt p-3 text-left">
        <p className="text-sm font-medium text-text">{t("confirmDeleteTitle")}</p>
        <p className="text-xs text-muted">{title}</p>
        {errored ? (
          <p role="alert" className="text-xs font-medium text-error">
            {t("errors.generic")}
          </p>
        ) : null}
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
            onClick={handleDelete}
            disabled={pending}
            className="rounded-full bg-error px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
          >
            {pending ? t("deleting") : t("confirmDeleteButton")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-full border border-error/30 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/10"
    >
      {t("delete")}
    </button>
  );
}
