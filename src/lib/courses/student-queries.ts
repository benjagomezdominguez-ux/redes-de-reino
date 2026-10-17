import "server-only";
import { getSupabaseSessionClient } from "@/lib/supabase/session";
import type { Course, CourseMeeting, EnrollmentStatus } from "./types";

// Reads scoped to "whoever is actually signed in right now" — the
// session client, so course_enrollments/course_attendance's own RLS
// ("auth.uid() = user_id or admin") does the real narrowing; these
// functions never accept or trust a user id from a caller.

export async function getMyEnrollmentStatus(courseId: string): Promise<EnrollmentStatus | null> {
  const supabase = await getSupabaseSessionClient();
  const { data } = await supabase
    .from("course_enrollments")
    .select("status")
    .eq("course_id", courseId)
    .maybeSingle();
  return (data?.status as EnrollmentStatus | undefined) ?? null;
}

export async function getMyAttendedMeetingIds(courseId: string): Promise<Set<string>> {
  const supabase = await getSupabaseSessionClient();
  // course_attendance has no course_id column (attendance is scoped to a
  // meeting, which belongs to a course) — join through the meeting.
  const { data } = await supabase
    .from("course_attendance")
    .select("meeting_id, course_meetings!inner(course_id)")
    .eq("course_meetings.course_id", courseId);

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
  const supabase = await getSupabaseSessionClient();

  const { data: enrollments } = await supabase
    .from("course_enrollments")
    .select("course_id, status, enrolled_at")
    .order("enrolled_at", { ascending: false });

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
    .select("meeting_id, course_meetings!inner(course_id)");

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
