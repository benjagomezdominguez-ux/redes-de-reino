"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  setCourseAttendancePassword,
  setCourseAttendanceEnabled,
  type SetPasswordState,
} from "@/lib/actions/admin-courses";

const initialState: SetPasswordState = { status: "idle" };

export function CourseAttendancePasswordForm({
  courseId,
  hasPassword,
  attendanceEnabled,
}: {
  courseId: string;
  hasPassword: boolean;
  attendanceEnabled: boolean;
}) {
  const t = useTranslations("admin.courses");
  const action = setCourseAttendancePassword.bind(null, courseId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [enabled, setEnabled] = useState(attendanceEnabled);
  const [togglePending, setTogglePending] = useState(false);

  async function handleToggle() {
    setTogglePending(true);
    const result = await setCourseAttendanceEnabled(courseId, !enabled);
    setTogglePending(false);
    if (result.ok) setEnabled((v) => !v);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-primary-900">{t("attendanceToggle.label")}</span>
        <button
          type="button"
          onClick={handleToggle}
          disabled={togglePending}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
            enabled ? "bg-success/15 text-success" : "bg-muted/20 text-muted"
          }`}
        >
          {enabled ? t("attendanceToggle.enabled") : t("attendanceToggle.disabled")}
        </button>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="font-display text-base font-medium text-primary-900">{t("password.title")}</h3>
        <p className="text-sm text-muted">{hasPassword ? t("password.hasPassword") : t("password.noPassword")}</p>

        <form action={formAction} className="flex flex-col gap-2 pt-1 sm:max-w-sm">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
            {t("password.label")}
            <input
              name="password"
              type="password"
              required
              minLength={4}
              placeholder={t("password.placeholder")}
              className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text outline-none transition-colors focus:border-primary-900/40"
            />
          </label>
          <p className="text-xs text-muted">{t("password.note")}</p>

          {state.status === "error" && state.errorKey ? (
            <p role="alert" className="text-sm font-medium text-error">
              {t(`password.errors.${state.errorKey}`)}
            </p>
          ) : null}
          {state.status === "success" ? (
            <p role="status" className="text-sm font-medium text-success">
              {t("password.saved")}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 w-fit rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
          >
            {pending ? t("password.saving") : t("password.save")}
          </button>
        </form>
      </div>
    </div>
  );
}
