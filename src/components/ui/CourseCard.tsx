import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Course } from "@/lib/courses/types";

export async function CourseCard({ course, enrolledCount }: { course: Course; enrolledCount: number }) {
  const t = await getTranslations("courses");

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lifted active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="relative w-full overflow-hidden bg-surface-alt">
        {course.cover_url ? (
          // Unlike BookCard's intrinsic (h-auto) sizing — right for a
          // book's own, consistently portrait-ish cover ratio — course
          // covers are uploaded at whatever ratio an admin's source
          // graphic happens to be (confirmed live: a real course's cover
          // is ~1197×1252, nearly square). At full card width on mobile,
          // that rendered as tall as the card was wide, pushing the
          // title/description/enroll button below the fold before
          // anyone could read them. A fixed aspect-ratio container with
          // object-cover crops to fill it — never stretches or distorts
          // the source — and keeps every card the same height regardless
          // of what ratio its own cover happens to be.
          // eslint-disable-next-line @next/next/no-img-element -- object-cover crop inside a fixed-aspect container, not intrinsic sizing
          <img
            src={course.cover_url}
            alt={course.title}
            loading="lazy"
            className="aspect-[16/9] w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center text-sm text-muted">
            {t("title")}
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ${
            course.status === "closed" ? "bg-muted" : "bg-primary-900/90"
          }`}
        >
          {course.status === "closed" ? t("statusBadge.closed") : t("statusBadge.published")}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-6">
        <h3 className="font-display text-lg font-medium text-primary-900">{course.title}</h3>
        {course.description ? <p className="text-sm text-muted line-clamp-3">{course.description}</p> : null}
        <p className="text-sm text-text">{t("enrolledCount", { count: enrolledCount })}</p>

        <div className="mt-auto pt-3">
          <Link
            href={`/cursos/${course.slug}`}
            className="inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
          >
            {t("viewCourse")}
          </Link>
        </div>
      </div>
    </article>
  );
}
