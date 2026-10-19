import "server-only";
import { getSupabaseSessionClient } from "@/lib/supabase/session";
import { getAuthProfile } from "@/lib/supabase/get-profile";
import type { Course, CourseMeeting, EnrollmentStatus } from "./types";

// Reads scoped to "whoever is actually signed in right now".
//
// CRITICAL, real bug fixed here: course_enrollments/course_attendance's
// RLS policy is "auth.uid() = user_id OR is_admin(auth.uid())" — an
// admin's own session client can read every row of either table, not
// just their own. Every function here originally queried with only a
// course_id (or no) filter and no explicit user_id, trusting RLS alone
// to narrow it down to "my own rows" — which is exactly true for an
// ordinary user, but silently false for an admin. Reproduced for real:
// Ariel (an admin) enrolled in "Columnas", and once anyone else also had
// a row in course_enrollments for that course, his own enrollment query
// stopped matching a single row — maybeSingle() errors on more than one
// match, so getMyEnrollmentStatus() silently returned null and the page
// kept showing "Inscribirme" despite a real, successful enrollment.
// getMyCourses() had the same gap in a worse shape: with no course_id
// filter at all, an admin's "mis cursos" page would have mixed in every
// other user's enrollments across every course in the system.
//
// Every query below now filters explicitly by the real signed-in user's
// own id — never relying on RLS's broader "or admin" allowance to do
// double duty as "and this happens to also be mine".

export async function getMyEnrollmentStatus(courseId: string): Promise<EnrollmentStatus | null> {
  const profile = await getAuthProfile();
  if (!profile) return null;

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase
    .from("course_enrollments")
    .select("status")
    .eq("course_id", courseId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (error) console.error("getMyEnrollmentStatus failed", error);
  return (data?.status as EnrollmentStatus | undefined) ?? null;
}

export async function getMyAttendedMeetingIds(courseId: string): Promise<Set<string>> {
  const profile = await getAuthProfile();
  if (!profile) return new Set();

  const supabase = await getSupabaseSessionClient();
  // course_attendance has no course_id column (attendance is scoped to a
  // meeting, which belongs to a course) — join through the meeting.
  const { data, error } = await supabase
    .from("course_attendance")
    .select("meeting_id, course_meetings!inner(course_id)")
    .eq("course_meetings.course_id", courseId)
    .eq("user_id", profile.id);

  if (error) console.error("getMyAttendedMeetingIds failed", error);
  return new Set((data ?? []).map((row) => row.meeting_id as string));
}

export type MyCourseEntry = {
  course: Course;
  enrollmentStatus: EnrollmentStatus;
  enrolledAt: string;
  meetings: CourseMeeting[];
  attendedMeetingIds: Set<string>;
};

// Powers /mis-cursos — one pass per enrolled course, never N+1: all
// enrollments in one query, all their courses in one IN() query, all
// meetings in one IN() query, all attendance in one IN() query.
export async function getMyCourses(): Promise<MyCourseEntry[]> {
  const profile = await getAuthProfile();
  if (!profile) return [];

  const supabase = await getSupabaseSessionClient();

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from("course_enrollments")
    .select("course_id, status, enrolled_at")
    .eq("user_id", profile.id)
    .order("enrolled_at", { ascending: false });

  if (enrollmentsError) console.error("getMyCourses failed", enrollmentsError);
  if (!enrollments || enrollments.length === 0) return [];

  const courseIds = enrollments.map((e) => e.course_id);
  const { data: courses } = await supabase.from("courses").select("*").in("id", courseIds);
  const { data: meetings } = await supabase
    .from("course_meetings")
    .select("*")
    .in("course_id", courseIds)
    .order("position", { ascending: true });
  const { data: attendance } = await supabase
    .from("course_attendance")
    .select("meeting_id, course_meetings!inner(course_id)")
    .eq("user_id", profile.id);

  const courseById = new Map((courses ?? []).map((c) => [c.id, c as Course]));
  const meetingsByCourseId = new Map<string, CourseMeeting[]>();
  for (const meeting of meetings ?? []) {
    const list = meetingsByCourseId.get(meeting.course_id) ?? [];
    list.push(meeting);
    meetingsByCourseId.set(meeting.course_id, list);
  }
  const attendedByCourseId = new Map<string, Set<string>>();
  type AttendanceJoinRow = { meeting_id: string; course_meetings: { course_id: string } | { course_id: string }[] };
  for (const row of (attendance ?? []) as unknown as AttendanceJoinRow[]) {
    const joined = Array.isArray(row.course_meetings) ? row.course_meetings[0] : row.course_meetings;
    if (!joined) continue;
    const set = attendedByCourseId.get(joined.course_id) ?? new Set<string>();
    set.add(row.meeting_id);
    attendedByCourseId.set(joined.course_id, set);
  }

  return enrollments
    .map((e) => {
      const course = courseById.get(e.course_id);
      if (!course) return null;
      return {
        course,
        enrollmentStatus: e.status as EnrollmentStatus,
        enrolledAt: e.enrolled_at,
        meetings: meetingsByCourseId.get(e.course_id) ?? [],
        attendedMeetingIds: attendedByCourseId.get(e.course_id) ?? new Set<string>(),
      };
    })
    .filter((entry): entry is MyCourseEntry => entry !== null);
}
