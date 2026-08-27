import { test, expect, devices } from "@playwright/test";

// Nav labels are intentionally repeated in the footer, so scope link
// lookups to the header's nav landmark to avoid strict-mode ambiguity.
function nav(page: import("@playwright/test").Page) {
  return page.getByRole("navigation");
}

test.describe("i18n — Spanish (default)", () => {
  test("loads with correct lang attribute and Spanish copy throughout", async ({ page }) => {
    await page.goto("/es");

    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("heading", { name: "Redes de Reino", level: 1 })).toBeVisible();
    await expect(page.getByText("Quiero conocer Redes de Reino")).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Nuestra Iglesia" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Estudios Bíblicos" })).toBeVisible();
  });

  test("a visitor whose browser doesn't match any supported language falls back to Spanish", async ({
    browser,
  }) => {
    // Accept-Language: de-DE matches none of es/en/pt, so this exercises
    // the priority-4 fallback from rule 13 rather than accept-language
    // negotiation (covered by the English test below via en-US).
    const context = await browser.newContext({ locale: "de-DE" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/es$/);
    await context.close();
  });

  test("a visitor whose browser prefers English is detected on first visit", async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await context.close();
  });
});

test.describe("i18n — English", () => {
  test("every section renders translated content, no Spanish leaking through", async ({ page }) => {
    await page.goto("/en");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(nav(page).getByRole("link", { name: "Home" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Our Church" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Pastors" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Membership" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Bible Studies" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Tithes & Offerings" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Contact" })).toBeVisible();
    await expect(page.getByText("Get to know Redes de Reino")).toBeVisible();
    await expect(page.getByText("I want to join")).toBeVisible();

    await nav(page).getByRole("link", { name: "Pastors" }).click();
    await expect(page.getByRole("heading", { name: "Our Pastors" })).toBeVisible();
    await expect(page.getByText("Ariel Gómez")).toBeVisible();

    await nav(page).getByRole("link", { name: "Contact" }).click();
    await expect(page.getByRole("heading", { name: "We're here for you" })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
  });
});

test.describe("i18n — Portuguese", () => {
  test("every section renders translated content, no Spanish leaking through", async ({ page }) => {
    await page.goto("/pt");

    await expect(page.locator("html")).toHaveAttribute("lang", "pt");
    await expect(nav(page).getByRole("link", { name: "Início" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Nossa Igreja" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Membresia" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Estudos Bíblicos" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Dízimos e Ofertas" })).toBeVisible();
    await expect(page.getByText("Conhecer a Redes de Reino")).toBeVisible();

    await nav(page).getByRole("link", { name: "Estudos Bíblicos" }).click();
    await expect(page.getByRole("heading", { name: "Cresça na Palavra" })).toBeVisible();
    await expect(page.getByText("Em breve").first()).toBeVisible();
  });
});

test.describe("i18n — language switcher", () => {
  test("desktop: switching language navigates and the choice persists across a fresh visit", async ({
    page,
    context,
  }) => {
    await page.goto("/es");

    await page.getByRole("button", { name: "Idioma" }).click();
    await page.getByRole("option", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByText("Get to know Redes de Reino")).toBeVisible();

    // Persistence: a fresh navigation to "/" (as if the visitor came back
    // later) must honor the saved choice, not silently reset to Spanish.
    const secondPage = await context.newPage();
    await secondPage.goto("/");
    await expect(secondPage).toHaveURL(/\/en$/);
  });

  test("mobile: language switcher lives inside the hamburger menu and works", async ({ page }) => {
    await page.setViewportSize(devices["iPhone 13"].viewport);
    await page.goto("/es");

    await page.getByRole("button", { name: "Abrir menú" }).click();
    const mobileMenu = page.locator("#mobile-menu");
    await expect(mobileMenu.getByText("Português")).toBeVisible();

    await mobileMenu.getByRole("link", { name: "Português" }).click();
    await expect(page).toHaveURL(/\/pt$/);
    await expect(page.getByText("Conhecer a Redes de Reino")).toBeVisible();
  });
});

test.describe("i18n — fallback safety", () => {
  test("an unsupported locale path 404s cleanly instead of crashing", async ({ page }) => {
    const response = await page.goto("/fr");
    expect(response?.status()).toBe(404);
    // No unhandled exception page, no raw stack trace, no blank screen.
    await expect(page.locator("body")).not.toContainText("undefined");
    await expect(page.locator("body")).not.toContainText("MISSING_MESSAGE");
  });
});
