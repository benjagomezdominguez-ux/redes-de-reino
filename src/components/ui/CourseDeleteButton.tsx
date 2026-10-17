"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteEmptyCourse } from "@/lib/actions/admin-courses";

// Inline confirm, same pattern as DevotionalDeleteButton — deleteEmptyCourse()
// itself refuses (server-side, not just here) to delete a course that has
// any enrollment history, so a blocked attempt surfaces that honestly
// rather than silently doing an archive instead.
export function CourseDeleteButton({ id, hasHistory }: { id: string; hasHistory: boolean }) {
  const t = useTranslations("admin.courses");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [blocked, setBlocked] = useState(false);

  function handleDelete() {
    setBlocked(false);
    startTransition(async () => {
      const result = await deleteEmptyCourse(id);
      if (!result.ok) {
        setBlocked(true);
        return;
      }
      router.push("/admin/courses");
    });
  }

  if (hasHistory) {
    return <p className="text-xs text-muted">{t("deleteBlocked")}</p>;
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-alt p-3">
        <p className="text-sm text-text">{t("deleteConfirm")}</p>
        {blocked ? <p className="text-xs font-medium text-error">{t("deleteBlocked")}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-50"
          >
            {t("meetings.cancel")}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-full bg-error px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
          >
            {t("delete")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="w-fit rounded-full border border-error/30 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/10"
    >
      {t("delete")}
    </button>
  );
}
