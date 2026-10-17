"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { enrollInCourse, cancelCourseEnrollment } from "@/lib/actions/courses";
import type { EnrollmentStatus } from "@/lib/courses/types";

export function CourseEnrollButton({
  courseId,
  coursePath,
  isAuthenticated,
  enrollmentOpen,
  initialStatus,
}: {
  courseId: string;
  coursePath: string;
  isAuthenticated: boolean;
  enrollmentOpen: boolean;
  initialStatus: EnrollmentStatus | null;
}) {
  const t = useTranslations("courses");
  const [status, setStatus] = useState<EnrollmentStatus | null>(initialStatus);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border bg-surface-alt p-5">
        <p className="text-sm text-text">{t("loginRequired")}</p>
        <Link
          href={{ pathname: "/login", query: { next: coursePath } }}
          className="inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
        >
          {t("loginCta")}
        </Link>
      </div>
    );
  }

  async function handleEnroll() {
    setPending(true);
    setError(false);
    const result = await enrollInCourse(courseId);
    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setStatus("active");
  }

  async function handleCancel() {
    setPending(true);
    setError(false);
    const result = await cancelCourseEnrollment(courseId);
    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setConfirmingCancel(false);
    setStatus("cancelled");
  }

  if (status === "active") {
    // Inline confirm, same pattern as DevotionalDeleteButton — no
    // native window.confirm(), no separate modal system.
    if (confirmingCancel) {
      return (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-alt p-4">
          <p className="text-sm text-text">{t("enroll.cancelConfirm")}</p>
          {error ? <p className="text-sm text-error">{t("enroll.error")}</p> : null}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              disabled={pending}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-50"
            >
              {t("enroll.back")}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={pending}
              className="rounded-full bg-error px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-error/90 disabled:opacity-50"
            >
              {pending ? t("enroll.cancelPending") : t("enroll.cancelConfirmButton")}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm font-semibold text-success">✓ {t("enroll.alreadyEnrolled")}</p>
        <button
          type="button"
          onClick={() => setConfirmingCancel(true)}
          className="inline-flex items-center justify-center rounded-full border border-error/40 px-5 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error/5"
        >
          {t("enroll.cancelCta")}
        </button>
      </div>
    );
  }

  if (!enrollmentOpen) {
    return <p className="text-sm text-muted">{t("enroll.closed")}</p>;
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleEnroll}
        disabled={pending}
        className="inline-flex items-center justify-center rounded-full bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
      >
        {pending ? t("enroll.pending") : t("enroll.cta")}
      </button>
      {status === "cancelled" ? <p className="text-xs text-muted">{t("myCourses.cancelled")}</p> : null}
      {error ? <p className="text-sm text-error">{t("enroll.error")}</p> : null}
    </div>
  );
}
