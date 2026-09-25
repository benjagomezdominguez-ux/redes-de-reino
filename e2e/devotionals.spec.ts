import { test, expect } from "@playwright/test";

// Devotional view stats: the admin side (who viewed, when, search,
// pagination) needs a real authenticated devotionals-admin session this
// suite doesn't have (see auth.spec.ts's own comment on the same
// limitation) — covered instead by src/lib/actions/devotional-views.test.ts,
// src/lib/actions/admin-devotional-views.test.ts,
// src/lib/admin/devotional-view-queries.test.ts, and
// src/components/ui/DevotionalViewersPanel.test.tsx, plus a manual live
// verification pass documented in the final report. What's provable here,
// without any session, is the public read page: it must keep working
// exactly as before for an anonymous visitor (no auth required to read a
// published devotional — see the "Anyone can view published devotionals"
// RLS policy), and it must never leak the admin-only "who viewed this"
// UI onto that public page.

test.describe("public devotionals — anonymous visitor", () => {
  test("the library lists published devotionals and each one opens without requiring login", async ({ page }) => {
    await page.goto("/es/devocionales");
    await expect(page.getByRole("heading", { name: "Biblioteca de Devocionales" })).toBeVisible();

    const firstLink = page.getByRole("link", { name: "Leer" }).first();
    const count = await page.getByRole("link", { name: "Leer" }).count();
    test.skip(count === 0, "No published devotionals in this environment to open — nothing more to verify.");

    await firstLink.click();
    await expect(page).toHaveURL(/\/es\/devocionales\/[^/]+$/);
    // Still on the read page, not bounced to /login — anonymous reading
    // is not gated (unlike (protected) routes, this path isn't in
    // PROTECTED_PATHS on purpose).
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("link", { name: "Volver a Devocionales" })).toBeVisible();
  });

  test("CRITICAL: the public read page never shows the admin-only viewer stats UI", async ({ page }) => {
    await page.goto("/es/devocionales");
    const count = await page.getByRole("link", { name: "Leer" }).count();
    test.skip(count === 0, "No published devotionals in this environment to open — nothing more to verify.");

    await page.getByRole("link", { name: "Leer" }).first().click();
    await expect(page).toHaveURL(/\/es\/devocionales\/[^/]+$/);

    await expect(page.getByRole("button", { name: "Ver quiénes lo vieron" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Quiénes vieron este devocional" })).toHaveCount(0);
    await expect(page.getByText(/personas vieron este devocional|persona vio este devocional/)).toHaveCount(0);
  });

  test("a nonexistent devotional id 404s cleanly, not a crash", async ({ page }) => {
    const res = await page.goto("/es/devocionales/00000000-0000-0000-0000-000000000000");
    expect(res?.status()).toBe(404);
  });
});
