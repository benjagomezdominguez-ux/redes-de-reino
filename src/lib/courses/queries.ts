import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Course, CourseMeeting } from "./types";

// Public reads — the plain anon-key client is enough here: RLS already
// restricts "courses" to status in ('published', 'closed') for anyone,
// signed in or not (see the migration), so this never needs to know who
// (if anyone) is asking.

export async function getPublicCourses(): Promise<Course[]> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("getPublicCourses failed", error);
    return [];
  }
  return data ?? [];
}

// Aggregate-only counts, via a SECURITY DEFINER RPC — course_enrollments
// itself has no public SELECT policy (see the migration's own comment on
// get_public_course_enrollment_counts()).
export async function getPublicEnrollmentCounts(): Promise<Map<string, number>> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_public_course_enrollment_counts");
  if (error) {
    console.error("getPublicEnrollmentCounts failed", error);
    return new Map();
  }
  return new Map((data ?? []).map((row: { course_id: string; enrolled_count: number }) => [row.course_id, row.enrolled_count]));
}

export async function getPublicCourseBySlug(
  slug: string
): Promise<{ course: Course; meetings: CourseMeeting[] } | null> {
  const supabase = getSupabaseServerClient();
  const { data: course, error } = await supabase.from("courses").select("*").eq("slug", slug).maybeSingle();

  if (error || !course) {
    if (error) console.error("getPublicCourseBySlug failed", error);
    return null;
  }

  const { data: meetings } = await supabase
    .from("course_meetings")
    .select("*")
    .eq("course_id", course.id)
    .order("position", { ascending: true });

  return { course, meetings: meetings ?? [] };
}
