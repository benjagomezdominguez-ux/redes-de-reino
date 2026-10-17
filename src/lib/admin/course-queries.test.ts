import { describe, expect, it, beforeEach, vi } from "vitest";
import { FakeStore } from "@/lib/whatsapp/scheduler.test-helpers";

let store: FakeStore;

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => store.client() }));

const { listAllCourses, getCourseForEdit, listCourseParticipants } = await import("./course-queries");

beforeEach(() => {
  store = new FakeStore();
});

describe("listAllCourses", () => {
  it("returns an empty list without querying counts when there are no courses", async () => {
    const result = await listAllCourses();
    expect(result).toEqual([]);
  });

  it("CRITICAL: counts enrolled (active only) and meetings per course in one pass each — never one query per course", async () => {
    store.seed("courses", [
      { id: "c1", title: "Curso 1", created_at: "2026-01-02T00:00:00Z" },
      { id: "c2", title: "Curso 2", created_at: "2026-01-01T00:00:00Z" },
    ]);
    store.seed("course_enrollments", [
      { course_id: "c1", user_id: "u1", status: "active" },
      { course_id: "c1", user_id: "u2", status: "active" },
      { course_id: "c1", user_id: "u3", status: "cancelled" },
      { course_id: "c2", user_id: "u1", status: "active" },
    ]);
    store.seed("course_meetings", [
      { course_id: "c1" },
      { course_id: "c1" },
      { course_id: "c2" },
    ]);

    const result = await listAllCourses();
    const c1 = result.find((c) => c.id === "c1")!;
    const c2 = result.find((c) => c.id === "c2")!;
    expect(c1.enrolledCount).toBe(2); // cancelled one excluded
    expect(c1.meetingCount).toBe(2);
    expect(c2.enrolledCount).toBe(1);
    expect(c2.meetingCount).toBe(1);
  });

  it("courses with zero enrollments/meetings still show 0, not undefined or an error", async () => {
    store.seed("courses", [{ id: "c1", title: "Curso vacío", created_at: "2026-01-01T00:00:00Z" }]);
    const result = await listAllCourses();
    expect(result[0]).toMatchObject({ enrolledCount: 0, meetingCount: 0 });
  });
});

describe("getCourseForEdit", () => {
  it("returns null for a nonexistent course", async () => {
    const result = await getCourseForEdit("missing");
    expect(result).toBeNull();
  });

  it("reports hasAttendancePassword based on whether a hash is set, never the hash itself", async () => {
    store.seed("courses", [{ id: "c1", title: "Curso", attendance_password_hash: "$2a$bcrypt-hash-value" }]);
    const result = await getCourseForEdit("c1");
    expect(result?.hasAttendancePassword).toBe(true);
    expect(JSON.stringify(result)).not.toContain("bcrypt-hash-value");
  });

  it("returns meetings ordered by position", async () => {
    store.seed("courses", [{ id: "c1", title: "Curso" }]);
    store.seed("course_meetings", [
      { id: "m2", course_id: "c1", position: 1, title: "Segundo" },
      { id: "m1", course_id: "c1", position: 0, title: "Primero" },
    ]);
    const result = await getCourseForEdit("c1");
    expect(result?.meetings.map((m) => m.title)).toEqual(["Primero", "Segundo"]);
  });
});

describe("listCourseParticipants", () => {
  it("returns an empty page for a course with no enrollments", async () => {
    const result = await listCourseParticipants("c1", { page: 1 });
    expect(result).toEqual({ rows: [], total: 0, page: 1, pageSize: 20 });
  });

  it("resolves display name, counts attendance per person, never leaks the raw email", async () => {
    store.seed("course_enrollments", [{ course_id: "c1", user_id: "u1", status: "active", enrolled_at: "2026-01-01T00:00:00Z" }]);
    store.seed("profiles", [{ id: "u1", first_name: "Juan", last_name: "Perez", email: "juan@example.com" }]);
    store.seed("course_meetings", [{ id: "m1", course_id: "c1" }, { id: "m2", course_id: "c1" }]);
    store.seed("course_attendance", [{ meeting_id: "m1", user_id: "u1" }]);

    const result = await listCourseParticipants("c1", { page: 1 });
    expect(result.rows[0]).toMatchObject({ userId: "u1", displayName: "Juan Perez", attendanceCount: 1 });
    expect(JSON.stringify(result)).not.toContain("juan@example.com");
  });

  it("falls back to the local part of the email when no name is set", async () => {
    store.seed("course_enrollments", [{ course_id: "c1", user_id: "u1", status: "active", enrolled_at: "2026-01-01T00:00:00Z" }]);
    store.seed("profiles", [{ id: "u1", first_name: null, last_name: null, email: "maria.gonzalez@example.com" }]);
    const result = await listCourseParticipants("c1", { page: 1 });
    expect(result.rows[0].displayName).toBe("maria.gonzalez");
  });

  it("search is accent-insensitive", async () => {
    store.seed("course_enrollments", [{ course_id: "c1", user_id: "u1", status: "active", enrolled_at: "2026-01-01T00:00:00Z" }]);
    store.seed("profiles", [{ id: "u1", first_name: "José", last_name: "Gómez", email: "j@example.com" }]);
    const result = await listCourseParticipants("c1", { page: 1, search: "jose gomez" });
    expect(result.rows).toHaveLength(1);
  });

  it("CRITICAL: one course's participant list never includes another course's enrollments", async () => {
    store.seed("course_enrollments", [
      { course_id: "c1", user_id: "u1", status: "active", enrolled_at: "2026-01-01T00:00:00Z" },
      { course_id: "c2", user_id: "u2", status: "active", enrolled_at: "2026-01-01T00:00:00Z" },
    ]);
    store.seed("profiles", [
      { id: "u1", first_name: "Uno", last_name: "", email: "u1@example.com" },
      { id: "u2", first_name: "Dos", last_name: "", email: "u2@example.com" },
    ]);
    const result = await listCourseParticipants("c1", { page: 1 });
    expect(result.rows.map((r) => r.userId)).toEqual(["u1"]);
  });

  it("paginates: a page beyond the real count returns an empty rows array with the real total", async () => {
    const enrollments = Array.from({ length: 5 }, (_, i) => ({
      course_id: "c1",
      user_id: `u${i}`,
      status: "active" as const,
      enrolled_at: "2026-01-01T00:00:00Z",
    }));
    store.seed("course_enrollments", enrollments);
    store.seed(
      "profiles",
      enrollments.map((e, i) => ({ id: e.user_id, first_name: `User${i}`, last_name: "", email: `u${i}@example.com` }))
    );
    const result = await listCourseParticipants("c1", { page: 2 });
    expect(result.total).toBe(5);
    expect(result.rows).toEqual([]); // page size 20, only 5 rows exist — page 2 is empty
  });
});
