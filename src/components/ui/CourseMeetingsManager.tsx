"use client";

import { useState, type FormEvent } from "react";
import { useTranslations, useFormatter } from "next-intl";
import {
  createMeeting,
  updateMeeting,
  deleteMeeting,
  setMeetingAttendanceEnabled,
} from "@/lib/actions/admin-courses";
import type { CourseMeeting } from "@/lib/courses/types";

const inputClasses =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus-visible:outline-2 focus-visible:outline-secondary-500";

// Converts a stored ISO timestamp to the value a <input type="datetime-local">
// needs (local time, no timezone/seconds) — and back, below, in handleAdd.
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MeetingRow({
  meeting,
  onChanged,
  onDeleted,
}: {
  meeting: CourseMeeting;
  onChanged: (updated: CourseMeeting) => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("admin.courses.meetings");
  const format = useFormatter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<"generic" | "required" | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorKey(null);
    const formData = new FormData(event.currentTarget);
    const result = await updateMeeting(meeting.id, { status: "idle" }, formData);
    setPending(false);
    if (result.status !== "success") {
      setErrorKey(result.errorKey ?? "generic");
      return;
    }
    onChanged({
      ...meeting,
      title: String(formData.get("title")),
      scheduled_at: formData.get("scheduledAt") ? new Date(String(formData.get("scheduledAt"))).toISOString() : null,
    });
    setEditing(false);
  }

  async function handleToggleAttendance() {
    setPending(true);
    const result = await setMeetingAttendanceEnabled(meeting.id, !meeting.attendance_enabled);
    setPending(false);
    if (result.ok) onChanged({ ...meeting, attendance_enabled: !meeting.attendance_enabled });
  }

  async function handleDelete() {
    setPending(true);
    const result = await deleteMeeting(meeting.id);
    setPending(false);
    if (result.ok) onDeleted();
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-2 rounded-xl border border-border bg-surface-alt p-3">
        <input name="title" required defaultValue={meeting.title} className={inputClasses} />
        <input
          name="scheduledAt"
          type="datetime-local"
          defaultValue={toLocalInputValue(meeting.scheduled_at)}
          className={inputClasses}
        />
        {errorKey ? <p className="text-xs font-medium text-error">{t(`errors.${errorKey}`)}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={pending}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 hover:bg-primary-900/5 disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-primary-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
          >
            {pending ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-primary-900">{meeting.title}</span>
        {meeting.scheduled_at ? (
          <span className="text-xs text-muted">
            {format.dateTime(new Date(meeting.scheduled_at), { dateStyle: "medium", timeStyle: "short" })}
          </span>
        ) : null}
        <span className={`text-xs font-medium ${meeting.attendance_enabled ? "text-success" : "text-muted"}`}>
          {meeting.attendance_enabled ? t("attendanceEnabled") : t("attendanceDisabled")}
        </span>
      </div>

      {confirmingDelete ? (
        <div className="flex flex-col gap-2 text-left sm:text-right">
          <p className="text-xs text-muted">{t("deleteConfirm")}</p>
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={pending}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 hover:bg-primary-900/5"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="rounded-full bg-error px-3 py-1.5 text-xs font-semibold text-white hover:bg-error/90"
            >
              {t("delete")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={handleToggleAttendance}
            disabled={pending}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 transition-colors hover:bg-primary-900/5 disabled:opacity-50"
          >
            {meeting.attendance_enabled ? t("attendanceDisabled") : t("attendanceEnabled")}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
          >
            {t("editCta")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-full border border-error/30 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/10"
          >
            {t("delete")}
          </button>
        </div>
      )}
    </div>
  );
}

export function CourseMeetingsManager({
  courseId,
  initialMeetings,
}: {
  courseId: string;
  initialMeetings: CourseMeeting[];
}) {
  const t = useTranslations("admin.courses.meetings");
  const [meetings, setMeetings] = useState(initialMeetings);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<"generic" | "required" | null>(null);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorKey(null);
    // event.currentTarget is a live reference that can go null once
    // control returns to the browser across an await (a real bug caught
    // live: "Cannot read properties of null (reading 'reset')") — capture
    // the form element itself up front, before the first await, same as
    // formData already does.
    const form = event.currentTarget;
    const formData = new FormData(form);
    const result = await createMeeting(courseId, { status: "idle" }, formData);
    setPending(false);
    if (result.status !== "success") {
      setErrorKey(result.errorKey ?? "generic");
      return;
    }
    const scheduledAtValue = formData.get("scheduledAt");
    setMeetings((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        course_id: courseId,
        title: String(formData.get("title")),
        scheduled_at: scheduledAtValue ? new Date(String(scheduledAtValue)).toISOString() : null,
        position: prev.length,
        attendance_enabled: true,
      },
    ]);
    form.reset();
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-medium text-primary-900">{t("title")}</h2>

      {meetings.length === 0 ? <p className="text-sm text-muted">{t("empty")}</p> : null}

      <div className="flex flex-col gap-2">
        {meetings.map((meeting) => (
          <MeetingRow
            key={meeting.id}
            meeting={meeting}
            onChanged={(updated) => setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))}
            onDeleted={() => setMeetings((prev) => prev.filter((m) => m.id !== meeting.id))}
          />
        ))}
      </div>

      {adding ? (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-primary-900">
            {t("titleLabel")}
            <input name="title" required className={inputClasses} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-primary-900">
            {t("dateLabel")}
            <input name="scheduledAt" type="datetime-local" className={inputClasses} />
          </label>
          {errorKey ? <p className="text-xs font-medium text-error">{t(`errors.${errorKey}`)}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              disabled={pending}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 hover:bg-primary-900/5 disabled:opacity-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-primary-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
            >
              {pending ? t("saving") : t("save")}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-fit rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
        >
          {t("addNew")}
        </button>
      )}
    </div>
  );
}
