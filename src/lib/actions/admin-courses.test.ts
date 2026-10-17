import { describe, expect, it, vi, beforeEach } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

const requireAdminMock = vi.fn();
const rpcMock = vi.fn();
let store: FakeStore;

vi.mock("@/lib/supabase/require-auth", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({ ...store.client(), rpc: rpcMock }),
}));

const {
  createCourse,
  updateCourse,
  setCourseStatus,
  archiveCourse,
  deleteEmptyCourse,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  setMeetingAttendanceEnabled,
  setCourseAttendancePassword,
  correctAttendance,
} = await import("./admin-courses");

const ADMIN_PROFILE = { id: "admin-1", firstName: "Ariel", lastName: "Gomez", role: "admin" as const, status: "active" as const };

function buildFormData(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  store = new FakeStore();
  requireAdminMock.mockReset();
  requireAdminMock.mockResolvedValue(ADMIN_PROFILE);
  rpcMock.mockReset();
});

describe("createCourse", () => {
  it("CRITICAL: requires an admin before writing anything", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(createCourse({ status: "idle" }, buildFormData({ title: "Curso", description: "" }))).rejects.toThrow(
      "REDIRECT"
    );
    expect(store.tables.courses ?? []).toHaveLength(0);
  });

  it("rejects a blank title without writing anything", async () => {
    const result = await createCourse({ status: "idle" }, buildFormData({ title: "   ", description: "" }));
    expect(result).toEqual({ status: "error", errorKey: "required" });
    expect(store.tables.courses ?? []).toHaveLength(0);
  });

  it("creates a draft course with the real admin as created_by — never a client-supplied actor", async () => {
    const result = await createCourse({ status: "idle" }, buildFormData({ title: "Curso Bíblico", description: "x" }));
    expect(result.status).toBe("success");
    expect(store.tables.courses[0]).toMatchObject({ title: "Curso Bíblico", status: "draft", created_by: ADMIN_PROFILE.id });
  });

  it("logs the creation to audit_log", async () => {
    await createCourse({ status: "idle" }, buildFormData({ title: "Curso", description: "" }));
    expect(store.tables.audit_log[0]).toMatchObject({ actor_id: ADMIN_PROFILE.id, action: "course_created" });
  });
});

describe("updateCourse", () => {
  it("CRITICAL: requires an admin", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(
      updateCourse({ status: "idle" }, buildFormData({ courseId: "c1", title: "T", description: "" }))
    ).rejects.toThrow("REDIRECT");
  });

  it("updates title/description for the given course id", async () => {
    store.seed("courses", [{ id: "c1", title: "Old", description: null }]);
    const result = await updateCourse({ status: "idle" }, buildFormData({ courseId: "c1", title: "New", description: "d" }));
    expect(result).toEqual({ status: "success", courseId: "c1" });
    expect(store.tables.courses[0]).toMatchObject({ title: "New", description: "d" });
  });
});

describe("setCourseStatus", () => {
  it("CRITICAL: requires an admin before changing status", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(setCourseStatus("c1", "published")).rejects.toThrow("REDIRECT");
  });

  it("stamps published_at the first time a course is published", async () => {
    store.seed("courses", [{ id: "c1", status: "draft", published_at: null }]);
    await setCourseStatus("c1", "published");
    expect(store.tables.courses[0].status).toBe("published");
    expect(store.tables.courses[0].published_at).not.toBeNull();
  });

  it("never overwrites published_at on a later status change (e.g. closing, then reopening)", async () => {
    const firstPublishedAt = "2026-01-01T00:00:00.000Z";
    store.seed("courses", [{ id: "c1", status: "published", published_at: firstPublishedAt }]);
    await setCourseStatus("c1", "closed");
    await setCourseStatus("c1", "published");
    expect(store.tables.courses[0].published_at).toBe(firstPublishedAt);
  });

  it("archiveCourse() is shorthand for setCourseStatus(..., 'archived')", async () => {
    store.seed("courses", [{ id: "c1", status: "published", published_at: "2026-01-01T00:00:00.000Z" }]);
    const result = await archiveCourse("c1");
    expect(result).toEqual({ ok: true });
    expect(store.tables.courses[0].status).toBe("archived");
  });
});

describe("deleteEmptyCourse", () => {
  it("CRITICAL: refuses to delete a course that has any enrollment history — preserves it instead", async () => {
    store.seed("courses", [{ id: "c1", title: "Curso" }]);
    store.seed("course_enrollments", [{ id: "e1", course_id: "c1", user_id: "u1" }]);
    const result = await deleteEmptyCourse("c1");
    expect(result).toEqual({ ok: false, reason: "has_history" });
    expect(store.tables.courses).toHaveLength(1);
  });

  it("deletes a course with zero enrollments and logs it", async () => {
    store.seed("courses", [{ id: "c1", title: "Curso" }]);
    const result = await deleteEmptyCourse("c1");
    expect(result).toEqual({ ok: true });
    expect(store.tables.courses).toHaveLength(0);
    expect(store.tables.audit_log[0]).toMatchObject({ action: "course_deleted", resource_id: "c1" });
  });
});

describe("createMeeting / updateMeeting / deleteMeeting / setMeetingAttendanceEnabled", () => {
  it("rejects a blank title without writing anything", async () => {
    const result = await createMeeting("c1", { status: "idle" }, buildFormData({ title: "  ", scheduledAt: "" }));
    expect(result).toEqual({ status: "error", errorKey: "required" });
    expect(store.tables.course_meetings ?? []).toHaveLength(0);
  });

  it("creates a meeting positioned after any existing ones for that course", async () => {
    store.seed("course_meetings", [{ id: "m1", course_id: "c1", position: 0 }]);
    const result = await createMeeting("c1", { status: "idle" }, buildFormData({ title: "Encuentro 2", scheduledAt: "" }));
    expect(result.status).toBe("success");
    const created = store.tables.course_meetings.find((m) => m.title === "Encuentro 2");
    expect(created?.position).toBe(1);
  });

  it("updateMeeting changes title/scheduled_at for the given meeting", async () => {
    store.seed("course_meetings", [{ id: "m1", title: "Old", scheduled_at: null }]);
    await updateMeeting("m1", { status: "idle" }, buildFormData({ title: "New", scheduledAt: "" }));
    expect(store.tables.course_meetings[0].title).toBe("New");
  });

  it("deleteMeeting removes the row", async () => {
    store.seed("course_meetings", [{ id: "m1" }]);
    const result = await deleteMeeting("m1");
    expect(result).toEqual({ ok: true });
    expect(store.tables.course_meetings).toHaveLength(0);
  });

  it("setMeetingAttendanceEnabled toggles the flag", async () => {
    store.seed("course_meetings", [{ id: "m1", attendance_enabled: true }]);
    await setMeetingAttendanceEnabled("m1", false);
    expect(store.tables.course_meetings[0].attendance_enabled).toBe(false);
  });
});

describe("setCourseAttendancePassword", () => {
  it("CRITICAL: requires an admin before touching the password at all", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(
      setCourseAttendancePassword("c1", { status: "idle" }, buildFormData({ password: "clave123" }))
    ).rejects.toThrow("REDIRECT");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects a too-short password without calling the RPC", async () => {
    const result = await setCourseAttendancePassword("c1", { status: "idle" }, buildFormData({ password: "ab" }));
    expect(result).toEqual({ status: "error", errorKey: "tooShort" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: hashing happens via the RPC (crypt()/gen_salt), never in application code — this just forwards the raw value once", async () => {
    rpcMock.mockResolvedValue({ error: null });
    await setCourseAttendancePassword("c1", { status: "idle" }, buildFormData({ password: "clave-real-123" }));
    expect(rpcMock).toHaveBeenCalledWith("set_course_attendance_password", {
      p_course_id: "c1",
      p_password: "clave-real-123",
    });
  });

  it("logs the password change to audit_log without the password itself", async () => {
    rpcMock.mockResolvedValue({ error: null });
    await setCourseAttendancePassword("c1", { status: "idle" }, buildFormData({ password: "clave-real-123" }));
    const entry = store.tables.audit_log[0];
    expect(entry).toMatchObject({ action: "course_attendance_password_changed", resource_id: "c1" });
    expect(JSON.stringify(entry)).not.toContain("clave-real-123");
  });

  it("maps an RPC failure to a generic error, not a false success", async () => {
    rpcMock.mockResolvedValue({ error: { message: "db error" } });
    const result = await setCourseAttendancePassword("c1", { status: "idle" }, buildFormData({ password: "clave-real-123" }));
    expect(result).toEqual({ status: "error", errorKey: "generic" });
  });
});

describe("correctAttendance", () => {
  it("CRITICAL: requires an admin", async () => {
    requireAdminMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(correctAttendance("m1", "u1", true)).rejects.toThrow("REDIRECT");
  });

  it("marking present writes a row with corrected_by set to the acting admin — distinguishable from a self-recorded one", async () => {
    await correctAttendance("m1", "u1", true);
    expect(store.tables.course_attendance[0]).toMatchObject({ meeting_id: "m1", user_id: "u1", corrected_by: ADMIN_PROFILE.id });
  });

  it("marking absent removes the attendance row", async () => {
    store.seed("course_attendance", [{ id: "a1", meeting_id: "m1", user_id: "u1" }]);
    await correctAttendance("m1", "u1", false);
    expect(store.tables.course_attendance).toHaveLength(0);
  });

  it("CRITICAL: every correction is logged to audit_log with who and when, never silent", async () => {
    await correctAttendance("m1", "u1", true);
    expect(store.tables.audit_log[0]).toMatchObject({
      actor_id: ADMIN_PROFILE.id,
      action: "course_attendance_corrected",
      resource_id: "m1:u1",
      metadata: { present: true },
    });
  });
});
