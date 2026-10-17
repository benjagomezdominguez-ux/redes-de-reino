import { test, expect } from "@playwright/test";

// Same limitation and split as devotionals.spec.ts: the full enroll/
// attendance/admin flow needs a real authenticated session this suite
// doesn't have — covered instead by src/lib/actions/courses.test.ts,
// src/lib/actions/admin-courses.test.ts, src/lib/admin/course-queries.test.ts,
// src/components/ui/CourseEnrollButton.test.tsx,
// src/components/ui/CourseAttendanceButton.test.tsx, the SQL-level RLS/
// race-condition verification documented in the final report (real
// concurrent calls against the live database), and a manual live
// walkthrough also documented there. What's provable here, without any
// session, is the public read path: an anonymous visitor can browse and
// open a published course, is told to sign in before enrolling, and
// never sees any admin-only data (participant list, attendance password
// state) on that public page.

test.describe("public courses — anonymous visitor", () => {
  test("the catalog lists published courses and each one opens without requiring login", async ({ page }) => {
    await page.goto("/es/cursos");
    await expect(page.getByRole("heading", { name: "Cursos" })).toBeVisible();

    const links = page.getByRole("link", { name: "Ver curso" });
    const count = await links.count();
    test.skip(count === 0, "No published courses in this environment to open — nothing more to verify.");

    await links.first().click();
    await expect(page).toHaveURL(/\/es\/cursos\/[^/]+$/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("link", { name: "Volver a cursos" })).toBeVisible();
  });

  test("CRITICAL: an anonymous visitor is told to sign in to enroll, never shown an enroll button that would fail", async ({
    page,
  }) => {
    await page.goto("/es/cursos");
    const links = page.getByRole("link", { name: "Ver curso" });
    const count = await links.count();
    test.skip(count === 0, "No published courses in this environment to open — nothing more to verify.");

    await links.first().click();
    await expect(page).toHaveURL(/\/es\/cursos\/[^/]+$/);

    await expect(page.getByRole("button", { name: "Inscribirme" })).toHaveCount(0);
    await expect(page.getByText("Necesitás iniciar sesión para inscribirte.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("CRITICAL: the public page never shows admin-only participant data or the attendance password state", async ({
    page,
  }) => {
    await page.goto("/es/cursos");
    const links = page.getByRole("link", { name: "Ver curso" });
    const count = await links.count();
    test.skip(count === 0, "No published courses in this environment to open — nothing more to verify.");

    await links.first().click();
    await expect(page).toHaveURL(/\/es\/cursos\/[^/]+$/);

    await expect(page.getByRole("button", { name: "Ver participantes" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Participantes de este curso" })).toHaveCount(0);
    await expect(page.getByText(/configuraste una contraseña/)).toHaveCount(0);
  });

  test("a nonexistent course slug 404s cleanly, not a crash", async ({ page }) => {
    const res = await page.goto("/es/cursos/this-slug-does-not-exist-qa-check");
    expect(res?.status()).toBe(404);
  });
});
