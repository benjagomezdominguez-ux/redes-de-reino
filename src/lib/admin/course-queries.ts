import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Paginated } from "./queries";
import type { Course, CourseMeeting } from "@/lib/courses/types";

// Admin reads use the admin/service-role client — courses has no
// admin-facing SELECT policy for draft/archived rows (only "published or
// closed" is public), and course_enrollments/course_attendance have no
// client-facing SELECT policy beyond "your own" at all. Safe here
// because every caller is already behind requireAdmin() at the /admin
// layout level, same as every other admin query in this project.

export type AdminCourseRow = Course & {
  enrolledCount: number;
  meetingCount: number;
};

// One query per table for the WHOLE list page, never one per row —
// counts are grouped in JS from a single narrow (id-only) select each,
// the same shape as getDevotionalViewCounts().
export async function listAllCourses(): Promise<AdminCourseRow[]> {
  const admin = getSupabaseAdminClient();
  const { data: courses } = await admin.from("courses").select("*").order("created_at", { ascending: false });
  const list = (courses ?? []) as Course[];
  if (list.length === 0) return [];

  const courseIds = list.map((c) => c.id);
  const [{ data: enrollments }, { data: meetings }] = await Promise.all([
    admin.from("course_enrollments").select("course_id").eq("status", "active").in("course_id", courseIds),
    admin.from("course_meetings").select("course_id").in("course_id", courseIds),
  ]);

  const enrolledCounts = new Map<string, number>();
  for (const row of enrollments ?? []) enrolledCounts.set(row.course_id, (enrolledCounts.get(row.course_id) ?? 0) + 1);
  const meetingCounts = new Map<string, number>();
  for (const row of meetings ?? []) meetingCounts.set(row.course_id, (meetingCounts.get(row.course_id) ?? 0) + 1);

  return list.map((course) => ({
    ...course,
    enrolledCount: enrolledCounts.get(course.id) ?? 0,
    meetingCount: meetingCounts.get(course.id) ?? 0,
  }));
}

export async function getCourseForEdit(
  courseId: string
): Promise<{ course: Course; meetings: CourseMeeting[]; hasAttendancePassword: boolean } | null> {
  const admin = getSupabaseAdminClient();
  const { data: courseRow } = await admin.from("courses").select("*").eq("id", courseId).maybeSingle();
  if (!courseRow) return null;

  // Strip the hash at the query layer itself, not just at whichever page
  // happens to call this today — a caller that later passes `course`
  // straight through to a Client Component (an easy mistake, and this
  // object otherwise looks like a plain, complete Course) must not be
  // the only thing standing between the hash and the browser.
  const { attendance_password_hash: hash, ...course } = courseRow as Course & { attendance_password_hash: string | null };

  const { data: meetings } = await admin
    .from("course_meetings")
    .select("*")
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  return {
    course,
    meetings: meetings ?? [],
    hasAttendancePassword: Boolean(hash),
  };
}

export type CourseParticipantRow = {
  userId: string;
  displayName: string;
  status: "active" | "cancelled";
  enrolledAt: string;
  attendanceCount: number;
};

function foldEsAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function displayNameFor(profile: { first_name: string | null; last_name: string | null; email: string | null }): string {
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (profile.email) return profile.email.split("@")[0];
  return "Usuario";
}

const PAGE_SIZE = 20;

// Fetches every enrollment for this ONE course (narrow, devotional_id-
// style indexed query), resolves names via one extra IN() query (same
// "fetch then map profiles" shape listDevotionalViewers() already
// uses — PostgREST can't embed profiles through user_id -> auth.users.id
// -> profiles.id in one call), counts attendance per person from one
// more IN() query, then filters/sorts/paginates in memory. Never sends
// more than one page's worth of rows to the client.
export async function listCourseParticipants(
  courseId: string,
  { page, search = "" }: { page: number; search?: string }
): Promise<Paginated<CourseParticipantRow>> {
  const admin = getSupabaseAdminClient();

  const { data: enrollments } = await admin
    .from("course_enrollments")
    .select("user_id, status, enrolled_at")
    .eq("course_id", courseId)
    .order("enrolled_at", { ascending: false });

  const rows = (enrollments ?? []) as { user_id: string; status: "active" | "cancelled"; enrolled_at: string }[];
  if (rows.length === 0) return { rows: [], total: 0, page: 1, pageSize: PAGE_SIZE };

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: profiles }, { data: meetingIdsRes }] = await Promise.all([
    admin.from("profiles").select("id, first_name, last_name, email").in("id", userIds),
    admin.from("course_meetings").select("id").eq("course_id", courseId),
  ]);
  const meetingIds = (meetingIdsRes ?? []).map((m) => m.id);

  const attendanceCounts = new Map<string, number>();
  if (meetingIds.length > 0) {
    const { data: attendance } = await admin
      .from("course_attendance")
      .select("user_id")
      .in("meeting_id", meetingIds)
      .in("user_id", userIds);
    for (const row of attendance ?? []) attendanceCounts.set(row.user_id, (attendanceCounts.get(row.user_id) ?? 0) + 1);
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  let merged: CourseParticipantRow[] = rows.map((r) => {
    const profile = profileById.get(r.user_id) ?? { first_name: null, last_name: null, email: null };
    return {
      userId: r.user_id,
      displayName: displayNameFor(profile as { first_name: string | null; last_name: string | null; email: string | null }),
      status: r.status,
      enrolledAt: r.enrolled_at,
      attendanceCount: attendanceCounts.get(r.user_id) ?? 0,
    };
  });

  const term = foldEsAccents(search.trim());
  if (term) merged = merged.filter((p) => foldEsAccents(p.displayName).includes(term));

  const total = merged.length;
  const from = (page - 1) * PAGE_SIZE;
  const paged = merged.slice(from, from + PAGE_SIZE);

  return { rows: paged, total, page, pageSize: PAGE_SIZE };
}
