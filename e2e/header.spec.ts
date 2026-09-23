import { test, expect } from "@playwright/test";

// Regression coverage for a real, live-reproduced bug: the sticky
// header used a semi-transparent background + backdrop-filter (a
// "frosted glass" effect) so content scrolled underneath it would show
// through, blurred. In WebKit specifically (not Chromium — confirmed
// with identical DOM, CSS, and scroll geometry in both engines, only
// the paint differed) the blur silently failed to apply while the
// transparency still did, so section headings scrolled up to sit under
// the header showed through crisp and readable instead of hidden —
// this is exactly why only Chromium being covered by e2e let it ship
// unnoticed (see playwright.config.ts for the added webkit project).
// The fix removed the transparency/blur combination entirely in favor
// of a fully opaque header background, which cannot exhibit this
// failure mode in any engine — this test locks that choice in, rather
// than re-testing a specific browser's own blur implementation.
test("sticky header background is fully opaque — no backdrop-filter transparency to fail silently in any browser", async ({ page }) => {
  await page.goto("/es");
  const header = page.locator("header").first();
  await expect(header).toBeVisible();

  const { backgroundColor, backdropFilter } = await header.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { backgroundColor: cs.backgroundColor, backdropFilter: cs.backdropFilter };
  });

  // rgb(r,g,b) (no 4th component at all) or rgba(r,g,b,1) are both fully
  // opaque — anything else reopens the exact bleed-through risk this
  // guards. Only rgba(...) with exactly 4 components carries a real
  // alpha; matching a trailing number generically would wrongly treat
  // rgb(250,247,240)'s blue channel as an alpha of 240.
  const rgbaMatch = backgroundColor.match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/);
  const alpha = rgbaMatch ? Number(rgbaMatch[1]) : 1;
  expect(alpha).toBe(1);
  expect(backdropFilter).toBe("none");
});
