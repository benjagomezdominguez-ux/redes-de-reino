"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { setCourseEnrollmentOpen } from "@/lib/actions/admin-courses";

export function CourseEnrollmentToggle({ courseId, initialOpen }: { courseId: string; initialOpen: boolean }) {
  const t = useTranslations("admin.courses.enrollmentToggle");
  const [open, setOpen] = useState(initialOpen);
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);
    const result = await setCourseEnrollmentOpen(courseId, !open);
    setPending(false);
    if (result.ok) setOpen((v) => !v);
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <span className="text-sm font-medium text-primary-900">{t("label")}</span>
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
          open ? "bg-success/15 text-success" : "bg-muted/20 text-muted"
        }`}
      >
        {open ? t("open") : t("closed")}
      </button>
    </div>
  );
}
