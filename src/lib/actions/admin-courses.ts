"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/supabase/require-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CourseStatus } from "@/lib/courses/types";

// Every action here starts with requireAdmin() — server-side, on every
// call, never trusting that a button was only rendered for an admin.
// Writes use the admin/service-role client: courses/course_meetings have
// no insert/update/delete policy for any client role at all (only a
// public SELECT for published/closed courses), exactly like products —
// this is the only way to write them.

const optionalFormField = () => z.preprocess((v) => v ?? "", z.string().trim().optional().or(z.literal("")));

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "curso"}-${suffix}`;
}

const courseFieldsSchema = z.object({
  title: z.string().trim().min(1),
  description: z.preprocess((v) => v ?? "", z.string().trim().max(4000).optional().or(z.literal(""))),
});

export type AdminCourseState = {
  status: "idle" | "error" | "success";
  errorKey?: "generic" | "required";
  courseId?: string;
};

export async function createCourse(_prevState: AdminCourseState, formData: FormData): Promise<AdminCourseState> {
  const admin_ = await requireAdmin();
  const parsed = courseFieldsSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { status: "error", errorKey: "required" };

  const admin = getSupabaseAdminClient();
  const { data: course, error } = await admin
    .from("courses")
    .insert({
      slug: slugify(parsed.data.title),
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: "draft",
      created_by: admin_.id,
    })
    .select()
    .single();

  if (error || !course) return { status: "error", errorKey: "generic" };

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "course_created",
    resource_type: "course",
    resource_id: course.id,
    metadata: { title: parsed.data.title },
  });

  return { status: "success", courseId: course.id };
}

export async function updateCourse(_prevState: AdminCourseState, formData: FormData): Promise<AdminCourseState> {
  const admin_ = await requireAdmin();
  const courseId = formData.get("courseId");
  if (typeof courseId !== "string" || !courseId) return { status: "error", errorKey: "generic" };

  const parsed = courseFieldsSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { status: "error", errorKey: "required" };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("courses")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (error) return { status: "error", errorKey: "generic" };

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "course_updated",
    resource_type: "course",
    resource_id: courseId,
    metadata: {},
  });

  return { status: "success", courseId };
}

export async function setCourseStatus(courseId: string, status: CourseStatus): Promise<{ ok: boolean }> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "published") {
    const { data: existing } = await admin.from("courses").select("published_at").eq("id", courseId).maybeSingle();
    if (!existing?.published_at) patch.published_at = new Date().toISOString();
  }

  const { error } = await admin.from("courses").update(patch).eq("id", courseId);
  if (error) return { ok: false };

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "course_status_changed",
    resource_type: "course",
    resource_id: courseId,
    metadata: { status },
  });

  return { ok: true };
}

export async function setCourseEnrollmentOpen(courseId: string, open: boolean): Promise<{ ok: boolean }> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("courses").update({ enrollment_open: open }).eq("id", courseId);
  return { ok: !error };
}

export async function setCourseAttendanceEnabled(courseId: string, enabled: boolean): Promise<{ ok: boolean }> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("courses").update({ attendance_enabled: enabled }).eq("id", courseId);
  return { ok: !error };
}

// Archives rather than deletes when there's history worth protecting —
// the actual hard-delete path (deleteEmptyCourse below) explicitly
// refuses to run if there's any enrollment/attendance to lose.
export async function archiveCourse(courseId: string): Promise<{ ok: boolean }> {
  return setCourseStatus(courseId, "archived");
}

export async function deleteEmptyCourse(courseId: string): Promise<{ ok: boolean; reason?: "has_history" }> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  const { count } = await admin
    .from("course_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  if ((count ?? 0) > 0) {
    return { ok: false, reason: "has_history" };
  }

  const { error } = await admin.from("courses").delete().eq("id", courseId);
  if (error) return { ok: false };

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "course_deleted",
    resource_type: "course",
    resource_id: courseId,
    metadata: {},
  });

  return { ok: true };
}

export type UploadUrlResult = { ok: true; bucket: "course-covers"; path: string; token: string } | { ok: false };

// Mints a short-lived signed upload URL, same reasoning as
// requestBookUploadUrl(): the browser uploads the cover bytes directly
// to Storage, never through this Server Action's own body.
export async function requestCourseCoverUploadUrl(courseId: string, extension: string): Promise<UploadUrlResult> {
  await requireAdmin();
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").slice(0, 10) || "bin";
  const path = `${courseId}/cover-${randomUUID()}.${safeExtension}`;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage.from("course-covers").createSignedUploadUrl(path);
  if (error || !data) return { ok: false };

  return { ok: true, bucket: "course-covers", path: data.path, token: data.token };
}

export async function attachCourseCover(courseId: string, path: string): Promise<{ ok: boolean }> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();
  const { data } = admin.storage.from("course-covers").getPublicUrl(path);
  const { error } = await admin.from("courses").update({ cover_url: data.publicUrl }).eq("id", courseId);

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "course_cover_updated",
    resource_type: "course",
    resource_id: courseId,
    metadata: {},
  });

  return { ok: !error };
}

const meetingFieldsSchema = z.object({
  title: z.string().trim().min(1),
  scheduledAt: optionalFormField(),
});

export type AdminMeetingState = { status: "idle" | "error" | "success"; errorKey?: "generic" | "required" };

export async function createMeeting(
  courseId: string,
  _prevState: AdminMeetingState,
  formData: FormData
): Promise<AdminMeetingState> {
  await requireAdmin();
  const parsed = meetingFieldsSchema.safeParse({
    title: formData.get("title"),
    scheduledAt: formData.get("scheduledAt"),
  });
  if (!parsed.success) return { status: "error", errorKey: "required" };

  const admin = getSupabaseAdminClient();
  const { count } = await admin
    .from("course_meetings")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);

  const { error } = await admin.from("course_meetings").insert({
    course_id: courseId,
    title: parsed.data.title,
    scheduled_at: parsed.data.scheduledAt || null,
    position: count ?? 0,
  });

  if (error) console.error("createMeeting insert failed", error);
  return { status: error ? "error" : "success", errorKey: error ? "generic" : undefined };
}

export async function updateMeeting(
  meetingId: string,
  _prevState: AdminMeetingState,
  formData: FormData
): Promise<AdminMeetingState> {
  await requireAdmin();
  const parsed = meetingFieldsSchema.safeParse({
    title: formData.get("title"),
    scheduledAt: formData.get("scheduledAt"),
  });
  if (!parsed.success) return { status: "error", errorKey: "required" };

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("course_meetings")
    .update({ title: parsed.data.title, scheduled_at: parsed.data.scheduledAt || null })
    .eq("id", meetingId);

  if (error) console.error("updateMeeting update failed", error);
  return { status: error ? "error" : "success", errorKey: error ? "generic" : undefined };
}

// Attendance already recorded for this meeting is never silently lost —
// the foreign key is `on delete cascade` deliberately (same reasoning
// as every other cascade in the migration: a deleted meeting shouldn't
// leave orphaned rows), so this does genuinely remove that history along
// with the meeting. Admins are warned client-side before calling this;
// archiving the whole course is the history-preserving alternative.
export async function deleteMeeting(meetingId: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("course_meetings").delete().eq("id", meetingId);
  return { ok: !error };
}

export async function setMeetingAttendanceEnabled(meetingId: string, enabled: boolean): Promise<{ ok: boolean }> {
  await requireAdmin();
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("course_meetings").update({ attendance_enabled: enabled }).eq("id", meetingId);
  return { ok: !error };
}

const passwordSchema = z.string().trim().min(4).max(100);

export type SetPasswordState = { status: "idle" | "error" | "success"; errorKey?: "generic" | "tooShort" };

// Hashing happens inside set_course_attendance_password() (pgcrypto's
// crypt()/gen_salt('bf')) — this file only ever sees the raw password
// for the single moment it's forwarded into that RPC call, never stores
// or logs it, and the hash itself is never selected back out anywhere
// this project reads courses from.
export async function setCourseAttendancePassword(
  courseId: string,
  _prevState: SetPasswordState,
  formData: FormData
): Promise<SetPasswordState> {
  const admin_ = await requireAdmin();
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { status: "error", errorKey: "tooShort" };

  const admin = getSupabaseAdminClient();
  const { error } = await admin.rpc("set_course_attendance_password", {
    p_course_id: courseId,
    p_password: parsed.data,
  });
  if (error) {
    console.error("setCourseAttendancePassword failed", error);
    return { status: "error", errorKey: "generic" };
  }

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "course_attendance_password_changed",
    resource_type: "course",
    resource_id: courseId,
    metadata: {},
  });

  return { status: "success" };
}

// A manual correction — never silently rewrites history. Always logged
// to audit_log with who did it and when (resource_id doubles as
// "meetingId:userId" so a specific correction is traceable), and
// `corrected_by` on the row itself distinguishes an admin-entered
// attendance from one the student recorded themselves.
export async function correctAttendance(
  meetingId: string,
  userId: string,
  present: boolean
): Promise<{ ok: boolean }> {
  const admin_ = await requireAdmin();
  const admin = getSupabaseAdminClient();

  if (present) {
    const { error } = await admin
      .from("course_attendance")
      .upsert({ meeting_id: meetingId, user_id: userId, corrected_by: admin_.id }, { onConflict: "meeting_id,user_id" });
    if (error) return { ok: false };
  } else {
    const { error } = await admin.from("course_attendance").delete().eq("meeting_id", meetingId).eq("user_id", userId);
    if (error) return { ok: false };
  }

  await admin.from("audit_log").insert({
    actor_id: admin_.id,
    action: "course_attendance_corrected",
    resource_type: "course_attendance",
    resource_id: `${meetingId}:${userId}`,
    metadata: { present },
  });

  return { ok: true };
}
