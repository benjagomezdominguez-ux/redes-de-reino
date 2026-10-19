import { describe, expect, it, vi, beforeEach } from "vitest";

const getAuthProfileMock = vi.fn();
vi.mock("@/lib/supabase/get-profile", () => ({ getAuthProfile: getAuthProfileMock }));

// A minimal chainable query-builder mock, purpose-built to make one
// thing directly assertable: exactly which (column, value) pairs every
// .eq() call in these functions actually used. This is the regression
// guard for the real bug fixed here — see student-queries.ts's own
// comment — reproduced live against the real database before this fix:
// course_enrollments/course_attendance's RLS policy is "my own row OR
// admin sees all", so a query that filters by course_id but never by
// user_id silently returns every matching row for an admin caller, not
// just their own. A FakeStore-style full fake isn't needed to prove
// that — what matters is that .eq("user_id", theRealCallerId) is always
// part of the query, never left to RLS alone to narrow.
function makeQuery(result: { data: unknown; error?: unknown }) {
  const eqCalls: [string, unknown][] = [];
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return builder;
    },
    order: () => builder,
    maybeSingle: async () => result,
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  return { builder, eqCalls };
}

const tableMocks = new Map<string, ReturnType<typeof makeQuery>>();
vi.mock("@/lib/supabase/session", () => ({
  getSupabaseSessionClient: async () => ({
    from: (table: string) => {
      const mock = tableMocks.get(table);
      if (!mock) throw new Error(`no mock registered for table "${table}" in this test`);
      return mock.builder;
    },
  }),
}));

const { getMyEnrollmentStatus, getMyAttendedMeetingIds, getMyCourses } = await import("./student-queries");

const PROFILE = { id: "real-caller-id", firstName: "Ariel", lastName: "Gomez", role: "admin" as const, status: "active" as const };

beforeEach(() => {
  getAuthProfileMock.mockReset();
  getAuthProfileMock.mockResolvedValue(PROFILE);
  tableMocks.clear();
});

describe("getMyEnrollmentStatus", () => {
  it("returns null without querying anything when nobody is signed in", async () => {
    getAuthProfileMock.mockResolvedValue(null);
    const result = await getMyEnrollmentStatus("course-1");
    expect(result).toBeNull();
  });

  it("CRITICAL (regression): filters by the real caller's own user_id, not just course_id — RLS alone is not enough for an admin caller", async () => {
    const q = makeQuery({ data: { status: "active" }, error: null });
    tableMocks.set("course_enrollments", q);

    await getMyEnrollmentStatus("course-1");

    expect(q.eqCalls).toContainEqual(["course_id", "course-1"]);
    expect(q.eqCalls).toContainEqual(["user_id", PROFILE.id]);
  });

  it("returns the status on a clean single-row match", async () => {
    tableMocks.set("course_enrollments", makeQuery({ data: { status: "active" }, error: null }));
    const result = await getMyEnrollmentStatus("course-1");
    expect(result).toBe("active");
  });

  it("CRITICAL (regression): the exact real failure mode — maybeSingle() erroring on more than one match — resolves to null, not a thrown exception that would break the page", async () => {
    tableMocks.set(
      "course_enrollments",
      makeQuery({ data: null, error: { message: "JSON object requested, multiple (or no) rows returned" } })
    );
    const result = await getMyEnrollmentStatus("course-1");
    expect(result).toBeNull();
  });
});

describe("getMyAttendedMeetingIds", () => {
  it("returns an empty set without querying when nobody is signed in", async () => {
    getAuthProfileMock.mockResolvedValue(null);
    const result = await getMyAttendedMeetingIds("course-1");
    expect(result.size).toBe(0);
  });

  it("CRITICAL (regression): filters by the real caller's own user_id — otherwise an admin would see every enrolled person's attendance as their own", async () => {
    const q = makeQuery({ data: [{ meeting_id: "m1" }], error: null });
    tableMocks.set("course_attendance", q);

    await getMyAttendedMeetingIds("course-1");

    expect(q.eqCalls).toContainEqual(["user_id", PROFILE.id]);
  });
});

describe("getMyCourses", () => {
  it("returns an empty list without querying when nobody is signed in", async () => {
    getAuthProfileMock.mockResolvedValue(null);
    const result = await getMyCourses();
    expect(result).toEqual([]);
  });

  it("CRITICAL (regression): the enrollments query filters by the real caller's own user_id — the original bug had NO filter at all here, so an admin's 'Mis Cursos' leaked every enrollment in the whole system (reproduced live: 14 rows instead of 1)", async () => {
    const enrollmentsQuery = makeQuery({ data: [], error: null });
    tableMocks.set("course_enrollments", enrollmentsQuery);

    await getMyCourses();

    expect(enrollmentsQuery.eqCalls).toContainEqual(["user_id", PROFILE.id]);
  });

  it("returns [] cleanly when the real caller has no enrollments at all", async () => {
    tableMocks.set("course_enrollments", makeQuery({ data: [], error: null }));
    const result = await getMyCourses();
    expect(result).toEqual([]);
  });
});
