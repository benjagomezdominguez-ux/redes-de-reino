"use server";

import { requireAdmin } from "@/lib/supabase/require-auth";
import { listCourseParticipants, type CourseParticipantRow } from "@/lib/admin/course-queries";
import type { Paginated } from "@/lib/admin/queries";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CourseMeeting } from "@/lib/courses/types";

// The only way the participants panel (a Client Component) can ever
// reach listCourseParticipants() — requireAdmin() runs on every call,
// server-side, never trusting that the "Ver participantes" button was
// only rendered for an admin. There is no client-reachable path to
// course_enrollments/course_attendance beyond "your own row" that skips
// this check.
export type GetCourseParticipantsResult = { ok: true; data: Paginated<CourseParticipantRow> } | { ok: false };

export async function getCourseParticipants(
  courseId: string,
  { page, search }: { page: number; search?: string }
): Promise<GetCourseParticipantsResult> {
  await requireAdmin();
  try {
    const data = await listCourseParticipants(courseId, { page, search });
    return { ok: true, data };
  } catch (err) {
    console.error("getCourseParticipants failed", err);
    return { ok: false };
  }
}

// Fetched once, alongside the panel's first open — not passed down from
// the list page's own render, which would mean fetching every course's
// meetings up front even for the (common) case where its panel is never
// opened. Needed so the panel's per-meeting attendance correction can
// show one row per real meeting rather than a made-up list.
export async function getCourseMeetingsForPanel(courseId: string): Promise<CourseMeeting[]> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("course_meetings")
    .select("*")
    .eq("course_id", courseId)
    .order("position", { ascending: true });
  return (data ?? []) as CourseMeeting[];
}
