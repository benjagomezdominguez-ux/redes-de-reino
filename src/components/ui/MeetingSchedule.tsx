import type { Meeting } from "@/lib/site-config";

export function MeetingSchedule({
  meetings,
  dayLabels,
  pendingLabel,
}: {
  meetings: Meeting[];
  /** Translated weekday name for each dayKey (e.g. "domingo" -> "Domingo"). */
  dayLabels: Record<string, string>;
  /** Shown for any field (day/title/time/description) still pending real data. */
  pendingLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {meetings.map((meeting, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-6 text-center shadow-soft transition-transform duration-200 hover:-translate-y-1 hover:shadow-lifted"
        >
          <span className="text-sm font-semibold uppercase tracking-[0.14em] text-secondary-600">
            {meeting.dayKey ? dayLabels[meeting.dayKey] : pendingLabel}
          </span>
          <h3 className="font-display text-lg font-medium text-primary-900">
            {meeting.title ?? pendingLabel}
          </h3>
          <p className="font-display text-3xl font-medium text-primary-900">
            {meeting.time ?? pendingLabel}
          </p>
          {meeting.description ? (
            <p className="mt-1 text-sm text-muted">{meeting.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
