import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCourseForEdit } from "@/lib/admin/course-queries";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { CourseForm } from "@/components/ui/CourseForm";
import { CourseMeetingsManager } from "@/components/ui/CourseMeetingsManager";
import { CourseAttendancePasswordForm } from "@/components/ui/CourseAttendancePasswordForm";
import { CourseEnrollmentToggle } from "@/components/ui/CourseEnrollmentToggle";
import { CourseDeleteButton } from "@/components/ui/CourseDeleteButton";
import { Link } from "@/i18n/navigation";

export default async function AdminEditCoursePage({
  params,
}: PageProps<"/[locale]/admin/courses/[id]/edit">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.courses");

  const result = await getCourseForEdit(id);
  if (!result) notFound();
  const { course, meetings, hasAttendancePassword } = result;

  const admin = getSupabaseAdminClient();
  const { count: enrolledCount } = await admin
    .from("course_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("course_id", id);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/courses" className="text-sm font-medium text-primary-900/80 underline">
        {t("backToList")}
      </Link>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="mb-6 font-display text-lg font-medium text-primary-900">{course.title}</h2>
        <CourseForm
          mode="edit"
          initial={{ id: course.id, title: course.title, description: course.description, cover_url: course.cover_url }}
        />
      </div>

      <CourseEnrollmentToggle courseId={course.id} initialOpen={course.enrollment_open} />

      <CourseAttendancePasswordForm
        courseId={course.id}
        hasPassword={hasAttendancePassword}
        attendanceEnabled={course.attendance_enabled}
      />

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <CourseMeetingsManager courseId={course.id} initialMeetings={meetings} />
      </div>

      <div className="rounded-2xl border border-dashed border-error/30 p-6">
        <CourseDeleteButton id={course.id} hasHistory={(enrolledCount ?? 0) > 0} />
      </div>
    </div>
  );
}
