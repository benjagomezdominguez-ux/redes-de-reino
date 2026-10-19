"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { getCourseParticipants, getCourseMeetingsForPanel } from "@/lib/actions/admin-course-participants";
import { correctAttendance } from "@/lib/actions/admin-courses";
import type { CourseParticipantRow } from "@/lib/admin/course-queries";
import type { CourseMeeting } from "@/lib/courses/types";

// Admin-only "who's enrolled, how much did they attend" panel for one
// course row in /admin/courses. Same responsive strategy as
// DevotionalViewersPanel.tsx (one panel, no JS viewport branching — a
// bottom sheet below `sm`, a right-side panel at `sm` and up, decided
// entirely by Tailwind breakpoints) and the same lazy-load-on-first-open
// + debounced search + "cargar más" pagination.

function formatCount(t: ReturnType<typeof useTranslations>, count: number): string {
  return t("participants.count", { count });
}

export function CourseParticipantsPanel({
  courseId,
  courseTitle,
  initialCount,
}: {
  courseId: string;
  courseTitle: string;
  initialCount: number;
}) {
  const t = useTranslations("admin.courses");
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CourseParticipantRow[]>([]);
  const [total, setTotal] = useState(initialCount);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "loadingMore" | "error" | "ready">("idle");
  const [correctingUserId, setCorrectingUserId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<CourseMeeting[]>([]);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  async function load(targetPage: number, targetSearch: string, mode: "loading" | "loadingMore") {
    setStatus(mode);
    const result = await getCourseParticipants(courseId, { page: targetPage, search: targetSearch });
    if (!result.ok) {
      setStatus("error");
      return;
    }
    setRows((prev) => (targetPage === 1 ? result.data.rows : [...prev, ...result.data.rows]));
    setTotal(result.data.total);
    setPage(result.data.page);
    setStatus("ready");
  }

  function openPanel() {
    setOpen(true);
    if (status === "idle") {
      void load(1, "", "loading");
      void getCourseMeetingsForPanel(courseId).then(setMeetings);
    }
  }

  function closePanel() {
    setOpen(false);
    setCorrectingUserId(null);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open || status === "idle") return;
    const handle = setTimeout(() => void load(1, search, "loading"), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load() closes over courseId, stable for this component's lifetime
  }, [search, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTarget = searchInputRef.current ?? panelRef.current;
    focusTarget?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      closePanel();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const hasMore = rows.length < total;

  return (
    <>
      <div className="flex flex-col items-start gap-1.5">
        <p className="text-sm text-muted">{formatCount(t, initialCount)}</p>
        <button
          ref={triggerRef}
          type="button"
          onClick={openPanel}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
        >
          {t("participants.trigger")}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            aria-hidden="true"
            data-testid="course-participants-backdrop"
            onClick={closePanel}
            className="absolute inset-0 h-full w-full cursor-default bg-primary-950/50 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none"
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className="absolute inset-x-0 bottom-0 flex max-h-[88vh] translate-y-0 flex-col rounded-t-3xl bg-surface shadow-lifted outline-none transition-transform duration-300 ease-out motion-reduce:transition-none sm:inset-y-0 sm:right-0 sm:bottom-auto sm:left-auto sm:h-full sm:max-h-none sm:w-full sm:max-w-md sm:translate-x-0 sm:rounded-t-none sm:rounded-l-3xl md:max-w-lg"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-1">
                <h2 id={titleId} className="font-display text-lg font-medium text-primary-900 sm:text-xl">
                  {t("participants.title")}
                </h2>
                <p className="line-clamp-1 text-xs text-muted">{courseTitle}</p>
                <p className="text-sm font-medium text-secondary-700">{formatCount(t, total)}</p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label={t("participants.close")}
                className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-900/70 transition-colors hover:bg-primary-900/5 hover:text-primary-900"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="border-b border-border px-5 py-3 sm:px-6">
              <label htmlFor={`${titleId}-search`} className="sr-only">
                {t("participants.searchLabel")}
              </label>
              <input
                ref={searchInputRef}
                id={`${titleId}-search`}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("participants.searchPlaceholder")}
                className="h-11 w-full rounded-full border border-border bg-background px-4 text-sm text-text outline-none transition-colors focus:border-primary-900/40"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3 sm:px-6" aria-live="polite">
              {status === "loading" ? (
                <p className="py-10 text-center text-sm text-muted">{t("participants.loading")}</p>
              ) : status === "error" ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm text-error">{t("participants.error")}</p>
                  <button
                    type="button"
                    onClick={() => void load(1, search, "loading")}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
                  >
                    {t("participants.retry")}
                  </button>
                </div>
              ) : rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">
                  {search.trim() ? t("participants.noResults") : t("participants.empty")}
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {rows.map((participant, index) => (
                    <ParticipantRow
                      key={participant.userId}
                      participant={participant}
                      index={index}
                      meetings={meetings}
                      expanded={correctingUserId === participant.userId}
                      onToggleExpand={() =>
                        setCorrectingUserId((prev) => (prev === participant.userId ? null : participant.userId))
                      }
                      onCorrected={(delta) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.userId === participant.userId ? { ...r, attendanceCount: r.attendanceCount + delta } : r
                          )
                        )
                      }
                    />
                  ))}
                </ul>
              )}

              {status === "ready" && hasMore ? (
                <div className="flex justify-center py-4">
                  <button
                    type="button"
                    onClick={() => void load(page + 1, search, "loadingMore")}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
                  >
                    {t("participants.loadMore")}
                  </button>
                </div>
              ) : null}
              {status === "loadingMore" ? <p className="py-4 text-center text-sm text-muted">{t("participants.loading")}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ParticipantRow({
  participant,
  index,
  meetings,
  expanded,
  onToggleExpand,
  onCorrected,
}: {
  participant: CourseParticipantRow;
  index: number;
  meetings: CourseMeeting[];
  expanded: boolean;
  onToggleExpand: () => void;
  onCorrected: (delta: number) => void;
}) {
  const t = useTranslations("admin.courses.participants");
  const format = useFormatter();

  return (
    <li
      className="flex flex-col gap-2 py-3 opacity-0 animate-[fade-in_0.3s_ease-out_forwards] motion-reduce:opacity-100 motion-reduce:animate-none"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-900/5 text-base text-primary-900"
        >
          👤
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-text">{participant.displayName}</span>
          <span className="text-xs text-muted">
            {format.dateTime(new Date(participant.enrolledAt), { dateStyle: "short" })}
            {participant.status === "cancelled" ? ` · ${t("cancelled")}` : ""}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-secondary-500/15 px-2.5 py-1 text-[11px] font-medium text-secondary-700">
          {/* "0 de 0 encuentros" reads as broken/confusing — a course
              with no meetings configured yet is a different, honest
              state from "nobody has attended any of its meetings",
              and this must say so plainly rather than conflating the
              two (same distinction /mis-cursos already makes for the
              student's own view). */}
          {meetings.length === 0
            ? t("noMeetingsYet")
            : t("attendanceCount", { attended: participant.attendanceCount, total: meetings.length })}
        </span>
      </div>

      {meetings.length > 0 ? (
        <button
          type="button"
          onClick={onToggleExpand}
          className="self-start text-xs font-medium text-primary-900 underline"
        >
          {t("markPresent")} / {t("markAbsent")}
        </button>
      ) : null}

      {expanded ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-alt p-3">
          {meetings.map((meeting) => (
            <MeetingCorrectionRow
              key={meeting.id}
              meeting={meeting}
              userId={participant.userId}
              onCorrected={onCorrected}
            />
          ))}
          <p className="pt-1 text-[11px] text-muted">{t("correctionNote")}</p>
        </div>
      ) : null}
    </li>
  );
}

function MeetingCorrectionRow({
  meeting,
  userId,
  onCorrected,
}: {
  meeting: CourseMeeting;
  userId: string;
  onCorrected: (delta: number) => void;
}) {
  const t = useTranslations("admin.courses.participants");
  // Starts unknown (no per-meeting read here, only the aggregate count —
  // a real per-meeting state would need one more query per expand;
  // instead both buttons stay available and simply reflect the action
  // just taken, optimistic-style).
  const [lastAction, setLastAction] = useState<"present" | "absent" | null>(null);
  const [pending, setPending] = useState(false);

  async function handleMark(present: boolean) {
    setPending(true);
    const result = await correctAttendance(meeting.id, userId, present);
    setPending(false);
    if (!result.ok) return;
    if (lastAction !== (present ? "present" : "absent")) {
      onCorrected(present ? 1 : lastAction === "present" ? -1 : 0);
    }
    setLastAction(present ? "present" : "absent");
  }

  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-text">{meeting.title}</span>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => handleMark(true)}
          disabled={pending}
          className={`rounded-full border px-2.5 py-1 font-medium transition-colors disabled:opacity-50 ${
            lastAction === "present" ? "border-success bg-success/10 text-success" : "border-border text-primary-900 hover:bg-primary-900/5"
          }`}
        >
          {t("markPresent")}
        </button>
        <button
          type="button"
          onClick={() => handleMark(false)}
          disabled={pending}
          className={`rounded-full border px-2.5 py-1 font-medium transition-colors disabled:opacity-50 ${
            lastAction === "absent" ? "border-error bg-error/10 text-error" : "border-border text-primary-900 hover:bg-primary-900/5"
          }`}
        >
          {t("markAbsent")}
        </button>
      </div>
    </div>
  );
}
