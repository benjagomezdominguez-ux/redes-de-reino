import { describe, expect, it, vi, beforeEach } from "vitest";

const requireUserMock = vi.fn();
const rpcMock = vi.fn();
const revalidatePathMock = vi.fn();
const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

vi.mock("@/lib/supabase/require-auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/supabase/session", () => ({
  getSupabaseSessionClient: async () => ({ rpc: rpcMock }),
}));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const { enrollInCourse, cancelCourseEnrollment, recordCourseAttendance } = await import("./courses");

const STUDENT = { id: "student-1", firstName: "Ana", lastName: "Gómez", role: "user" as const, status: "active" as const };

beforeEach(() => {
  requireUserMock.mockReset();
  requireUserMock.mockResolvedValue(STUDENT);
  rpcMock.mockReset();
  revalidatePathMock.mockReset();
  consoleErrorSpy.mockClear();
});

describe("enrollInCourse", () => {
  it("CRITICAL: requires a real signed-in session before calling the RPC", async () => {
    requireUserMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(enrollInCourse("course-1")).rejects.toThrow("REDIRECT");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("CRITICAL: never passes a user id — the RPC derives it from auth.uid() itself", async () => {
    rpcMock.mockResolvedValue({ data: "enrolled", error: null });
    await enrollInCourse("course-1");
    expect(rpcMock).toHaveBeenCalledWith("enroll_in_course", { p_course_id: "course-1" });
  });

  it("maps 'enrolled' to ok:true, enrolled:true", async () => {
    rpcMock.mockResolvedValue({ data: "enrolled", error: null });
    const result = await enrollInCourse("course-1");
    expect(result).toEqual({ ok: true, enrolled: true });
  });

  it("maps 'not_available' (closed/draft course) to ok:true, enrolled:false — not a thrown error", async () => {
    rpcMock.mockResolvedValue({ data: "not_available", error: null });
    const result = await enrollInCourse("course-1");
    expect(result).toEqual({ ok: true, enrolled: false });
  });

  it("maps an RPC error to ok:false, logged server-side", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "db down" } });
    const result = await enrollInCourse("course-1");
    expect(result).toEqual({ ok: false });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe("cancelCourseEnrollment", () => {
  it("CRITICAL: requires a real signed-in session", async () => {
    requireUserMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(cancelCourseEnrollment("course-1")).rejects.toThrow("REDIRECT");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls cancel_enrollment with only the course id — never a user id", async () => {
    rpcMock.mockResolvedValue({ error: null });
    await cancelCourseEnrollment("course-1");
    expect(rpcMock).toHaveBeenCalledWith("cancel_enrollment", { p_course_id: "course-1" });
  });
});

describe("recordCourseAttendance", () => {
  it("CRITICAL: requires a real signed-in session before touching the password at all", async () => {
    requireUserMock.mockRejectedValue(new Error("REDIRECT"));
    await expect(recordCourseAttendance("meeting-1", "secret")).rejects.toThrow("REDIRECT");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects a blank password without ever calling the RPC (never sends an empty password over the wire)", async () => {
    const result = await recordCourseAttendance("meeting-1", "   ");
    expect(result).toBe("invalid");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ["recorded", "recorded"],
    ["already_recorded", "already_recorded"],
    ["not_enrolled", "not_enrolled"],
    ["attendance_closed", "attendance_closed"],
    ["wrong_password", "wrong_password"],
    ["locked", "locked"],
  ])("CRITICAL: passes the RPC's own '%s' status straight through, never reinterpreting it", async (rpcStatus, expected) => {
    rpcMock.mockResolvedValue({ data: rpcStatus, error: null });
    const result = await recordCourseAttendance("meeting-1", "secret");
    expect(result).toBe(expected);
  });

  it("CRITICAL: a wrong password never maps to 'recorded' or any success-shaped result", async () => {
    rpcMock.mockResolvedValue({ data: "wrong_password", error: null });
    const result = await recordCourseAttendance("meeting-1", "wrong");
    expect(result).not.toBe("recorded");
    expect(result).toBe("wrong_password");
  });

  it("maps a transport/RPC error to 'error', logged server-side — never silently 'recorded'", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "network blip" } });
    const result = await recordCourseAttendance("meeting-1", "secret");
    expect(result).toBe("error");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("passes the exact meeting id and password to the RPC, unmodified", async () => {
    rpcMock.mockResolvedValue({ data: "recorded", error: null });
    await recordCourseAttendance("meeting-42", "  clave123  ");
    const [, args] = rpcMock.mock.calls[0];
    expect(args.p_meeting_id).toBe("meeting-42");
    // trimmed server-side (same convention as every other credential-ish
    // field in this project), but still the real value, not altered
    expect(args.p_password).toBe("clave123");
  });
});
