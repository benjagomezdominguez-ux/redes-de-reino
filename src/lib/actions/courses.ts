"use server";

import { z } from "zod";
import { requireUser } from "@/lib/supabase/require-auth";
import { getSupabaseSessionClient } from "@/lib/supabase/session";
import { revalidatePath } from "next/cache";

// Every action here starts with requireUser() — server-side redirect to
// /login if there's no session, same gate every other (protected) action
// in this project uses. The actual write then goes through a SECURITY
// DEFINER RPC bound to auth.uid() (see the migration): this file never
// passes a user id anywhere, so there's no parameter here a client could
// tamper with to act as someone else.

export type EnrollResult = { ok: true; enrolled: true } | { ok: true; enrolled: false } | { ok: false };

export async function enrollInCourse(courseId: string): Promise<EnrollResult> {
  await requireUser();
  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase.rpc("enroll_in_course", { p_course_id: courseId });
  if (error) {
    console.error("enrollInCourse failed", error);
    return { ok: false };
  }
  revalidatePath("/[locale]/cursos/[slug]", "page");
  return { ok: true, enrolled: data === "enrolled" };
}

export async function cancelCourseEnrollment(courseId: string): Promise<{ ok: boolean }> {
  await requireUser();
  const supabase = await getSupabaseSessionClient();
  const { error } = await supabase.rpc("cancel_enrollment", { p_course_id: courseId });
  if (error) {
    console.error("cancelCourseEnrollment failed", error);
    return { ok: false };
  }
  revalidatePath("/[locale]/cursos/[slug]", "page");
  return { ok: true };
}

const passwordSchema = z.string().trim().min(1);

export type RecordAttendanceResult =
  | "recorded"
  | "already_recorded"
  | "not_enrolled"
  | "attendance_closed"
  | "wrong_password"
  | "locked"
  | "invalid"
  | "error";

// The server never trusts a disabled button or a client-side check: the
// RPC itself re-verifies enrollment, the meeting/course's attendance
// state, and the password, every single call — this action is a thin,
// honest pass-through of whatever it actually decided, nothing here
// second-guesses or reinterprets that result.
export async function recordCourseAttendance(meetingId: string, password: string): Promise<RecordAttendanceResult> {
  await requireUser();
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return "invalid";

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase.rpc("record_course_attendance", {
    p_meeting_id: meetingId,
    p_password: parsed.data,
  });
  if (error) {
    console.error("recordCourseAttendance failed", error);
    return "error";
  }
  if (data === "recorded") {
    revalidatePath("/[locale]/cursos/[slug]", "page");
    revalidatePath("/[locale]/mis-cursos", "page");
  }
  return (data as RecordAttendanceResult) ?? "error";
}
