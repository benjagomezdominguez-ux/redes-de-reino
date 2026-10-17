import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale, getFormatter } from "next-intl/server";
import { NavbarWithAuth } from "@/components/sections/NavbarWithAuth";
import { Footer } from "@/components/sections/Footer";
import { Container } from "@/components/ui/Container";
import { Link } from "@/i18n/navigation";
import { CourseEnrollButton } from "@/components/ui/CourseEnrollButton";
import { CourseAttendanceButton } from "@/components/ui/CourseAttendanceButton";
import { getPublicCourseBySlug, getPublicEnrollmentCounts } from "@/lib/courses/queries";
import { getMyEnrollmentStatus, getMyAttendedMeetingIds } from "@/lib/courses/student-queries";
import { getAuthProfile } from "@/lib/supabase/get-profile";

export default async function CourseDetailPage({
  params,
}: PageProps<"/[locale]/cursos/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("courses");
  const format = await getFormatter();

  const result = await getPublicCourseBySlug(slug);
  if (!result) notFound();
  const { course, meetings } = result;

  const profile = await getAuthProfile();
  const [enrollmentCounts, enrollmentStatus, attendedMeetingIds] = await Promise.all([
    getPublicEnrollmentCounts(),
    profile ? getMyEnrollmentStatus(course.id) : Promise.resolve(null),
    profile ? getMyAttendedMeetingIds(course.id) : Promise.resolve(new Set<string>()),
  ]);

  const isEnrolled = enrollmentStatus === "active";
  const coursePath = `/cursos/${slug}`;

  return (
    <>
      <NavbarWithAuth />
      <main className="flex-1 py-20 sm:py-28">
        <Container className="mx-auto flex max-w-3xl flex-col gap-10">
          <Link href="/cursos" className="text-sm font-medium text-primary-900/80 underline">
            {t("backToList")}
          </Link>

          {course.cover_url ? (
            <div className="w-full overflow-hidden rounded-2xl bg-surface-alt">
              {/* eslint-disable-next-line @next/next/no-img-element -- intrinsic sizing (no fixed box, no object-fit crop), same pattern as BookCard.tsx */}
              <img src={course.cover_url} alt={course.title} className="block h-auto w-full" />
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ${
                course.status === "closed" ? "bg-muted" : "bg-primary-900"
              }`}
            >
              {course.status === "closed" ? t("statusBadge.closed") : t("statusBadge.published")}
            </span>
            <h1 className="font-display text-3xl font-medium text-primary-900 sm:text-4xl">{course.title}</h1>
            {course.description ? <p className="text-base text-text sm:text-lg">{course.description}</p> : null}
            <p className="text-sm text-muted">{t("enrolledCount", { count: enrollmentCounts.get(course.id) ?? 0 })}</p>
          </div>

          <CourseEnrollButton
            courseId={course.id}
            coursePath={coursePath}
            isAuthenticated={Boolean(profile)}
            enrollmentOpen={course.status === "published" && course.enrollment_open}
            initialStatus={enrollmentStatus}
          />

          <div className="flex flex-col gap-4">
            <h2 className="font-display text-xl font-medium text-primary-900">{t("meetingsTitle")}</h2>
            {meetings.length === 0 ? (
              <p className="text-sm text-muted">{t("noMeetings")}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {meetings.map((meeting) => (
                  <li
                    key={meeting.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-display text-base font-medium text-primary-900">{meeting.title}</span>
                      {meeting.scheduled_at ? (
                        <span className="text-sm text-muted">
                          {format.dateTime(new Date(meeting.scheduled_at), { dateStyle: "long", timeStyle: "short" })}
                        </span>
                      ) : null}
                    </div>

                    {isEnrolled ? (
                      <CourseAttendanceButton
                        meetingId={meeting.id}
                        attendanceAvailable={course.attendance_enabled && meeting.attendance_enabled}
                        initiallyRecorded={attendedMeetingIds.has(meeting.id)}
                      />
                    ) : profile ? null : (
                      <p className="text-xs text-muted">{t("loginRequiredAttendance")}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
