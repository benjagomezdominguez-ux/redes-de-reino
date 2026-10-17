"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { recordCourseAttendance, type RecordAttendanceResult } from "@/lib/actions/courses";

// Maps the RPC's honest status code straight to copy — never a generic
// "something went wrong" that would hide *why* (wrong password vs.
// locked vs. attendance genuinely closed are different, actionable
// situations for the person reading this).
const MESSAGE_KEY: Record<Exclude<RecordAttendanceResult, "recorded">, string> = {
  already_recorded: "attendance.alreadyRecorded",
  not_enrolled: "attendance.notEnrolled",
  attendance_closed: "attendance.closed",
  wrong_password: "attendance.wrongPassword",
  locked: "attendance.locked",
  invalid: "attendance.invalid",
  error: "attendance.error",
};

export function CourseAttendanceButton({
  meetingId,
  attendanceAvailable,
  initiallyRecorded,
}: {
  meetingId: string;
  attendanceAvailable: boolean;
  initiallyRecorded: boolean;
}) {
  const t = useTranslations("courses");
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [recorded, setRecorded] = useState(initiallyRecorded);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (recorded) {
    return <p className="text-sm font-semibold text-success">✓ {t("attendance.recorded")}</p>;
  }

  if (!attendanceAvailable) {
    return <p className="text-xs text-muted">{t("attendance.closed")}</p>;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorKey(null);

    const result = await recordCourseAttendance(meetingId, password);
    setPending(false);

    if (result === "recorded" || result === "already_recorded") {
      setRecorded(true);
      setOpen(false);
      return;
    }
    setErrorKey(MESSAGE_KEY[result]);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
      >
        {t("attendance.cta")}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-alt p-4 sm:max-w-sm"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-primary-900">
        {t("attendance.passwordLabel")}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("attendance.passwordPlaceholder")}
          autoFocus
          className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-text outline-none transition-colors focus:border-primary-900/40"
        />
      </label>

      {errorKey ? (
        <p role="alert" className="text-sm font-medium text-error">
          {t(errorKey)}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setErrorKey(null);
            setPassword("");
          }}
          disabled={pending}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-50"
        >
          {t("attendance.cancel")}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-primary-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:opacity-60"
        >
          {pending ? t("attendance.pending") : t("attendance.submit")}
        </button>
      </div>
    </form>
  );
}
