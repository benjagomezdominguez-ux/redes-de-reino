import { getTranslations, setRequestLocale } from "next-intl/server";
import { listAllCourses } from "@/lib/admin/course-queries";
import { Link } from "@/i18n/navigation";
import { CourseStatusButtons } from "@/components/ui/CourseStatusButtons";
import { CourseParticipantsPanel } from "@/components/ui/CourseParticipantsPanel";

export default async function AdminCoursesPage({
  params,
}: PageProps<"/[locale]/admin/courses">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.courses");

  const courses = await listAllCourses();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{t("count", { count: courses.length })}</p>
        <Link
          href="/admin/courses/new"
          className="inline-flex items-center justify-center rounded-full bg-primary-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
        >
          {t("addNew")}
        </Link>
      </div>

      {courses.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-6 py-4">{t("columns.cover")}</th>
                <th className="px-6 py-4">{t("columns.title")}</th>
                <th className="px-6 py-4">{t("columns.status")}</th>
                <th className="px-6 py-4">{t("columns.meetings")}</th>
                <th className="px-6 py-4">{t("columns.enrolled")}</th>
                <th className="px-6 py-4">{t("columns.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courses.map((course) => (
                <tr key={course.id}>
                  <td className="px-6 py-4">
                    <div className="h-14 w-20 overflow-hidden rounded-lg bg-surface-alt">
                      {course.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- intrinsic sizing (no fixed box, no object-fit crop), same pattern as admin/books
                        <img src={course.cover_url} alt="" className="block h-full w-full object-cover" />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-primary-900">{course.title}</td>
                  <td className="px-6 py-4 text-muted">{t(`status.${course.status}`)}</td>
                  <td className="px-6 py-4 text-muted">{course.meetingCount}</td>
                  <td className="px-6 py-4">
                    <CourseParticipantsPanel
                      courseId={course.id}
                      courseTitle={course.title}
                      initialCount={course.enrolledCount}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/courses/${course.id}/edit`}
                        className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary-900 transition-colors hover:bg-primary-900/5"
                      >
                        {t("edit")}
                      </Link>
                      <CourseStatusButtons id={course.id} status={course.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
