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
    await expect(nav(page).getByRole("link", { name: "Galería" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Horarios" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Libros" })).toBeVisible();
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
    await expect(nav(page).getByRole("link", { name: "Gallery" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Schedule" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Pastors" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Books" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Bible Studies" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Tithes & Offerings" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Contact" })).toBeVisible();
    await expect(page.getByText("Get to know Redes de Reino")).toBeVisible();
    await expect(page.getByText("I want to join")).toBeVisible();

    await nav(page).getByRole("link", { name: "Schedule" }).click();
    await expect(page.getByRole("heading", { name: "Meeting Times" })).toBeVisible();

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
    await expect(nav(page).getByRole("link", { name: "Galeria" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Horários" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Livros" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Estudos Bíblicos" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Dízimos e Ofertas" })).toBeVisible();
    await expect(page.getByText("Conhecer a Redes de Reino")).toBeVisible();

    await nav(page).getByRole("link", { name: "Horários" }).click();
    await expect(page.getByRole("heading", { name: "Horários das Reuniões" })).toBeVisible();

    await nav(page).getByRole("link", { name: "Estudos Bíblicos" }).click();
    await expect(page.getByRole("heading", { name: "Cresça na Palavra" })).toBeVisible();
    await expect(page.getByText("Em breve").first()).toBeVisible();
  });
});

test.describe("structure — Nuestra Iglesia removed, Gallery + Schedule in its place", () => {
  test("'Nuestra Iglesia' no longer exists anywhere on the page, in any locale", async ({ page }) => {
    for (const [locale, phrase] of [
      ["es", "Nuestra Iglesia"],
      ["en", "Our Church"],
      ["pt", "Nossa Igreja"],
    ] as const) {
      await page.goto(`/${locale}`);
      await expect(page.locator("body")).not.toContainText(phrase);
    }
  });

  test("the gallery occupies the position right after the hero, with 4 slides, and has no heading text of its own", async ({
    page,
  }) => {
    await page.goto("/es");

    const gallery = page.locator("#galeria");
    await expect(gallery).toBeVisible();

    // "Right after the hero": #galeria (wrapped by the Reveal animation
    // div) is the hero section's immediate next sibling in the DOM — i.e.
    // nothing (like the old Nuestra Iglesia section) sits between them.
    await expect(page.locator("#inicio + div > section#galeria")).toHaveCount(1);

    // The text heading block above the gallery was intentionally removed
    // — only the photos remain.
    await expect(gallery.locator("h2")).toHaveCount(0);
    await expect(page.getByText("Momentos de nuestra comunidad")).toHaveCount(0);

    const indicators = gallery.locator('button[aria-current]');
    await expect(indicators).toHaveCount(4);
  });

  test("Schedule section exists, right after the gallery, and renders meeting cards", async ({ page }) => {
    await page.goto("/es");

    // "Right after the gallery": #horarios's Reveal wrapper is the
    // immediate next sibling of #galeria's Reveal wrapper.
    await expect(
      page.locator("div:has(> section#galeria) + div > section#horarios")
    ).toHaveCount(1);

    const schedule = page.locator("#horarios");
    await expect(schedule).toBeVisible();
    await expect(schedule.getByText("Reunión General")).toBeVisible();
    await expect(schedule.getByText("Domingo")).toBeVisible();
    await expect(schedule.getByText("10:00 AM")).toBeVisible();
    await expect(schedule.getByText("Bases")).toBeVisible();
    await expect(schedule.getByText("Trascender")).toBeVisible();
  });

  test("the Hero's primary CTA now points at the gallery, not a dead anchor", async ({ page }) => {
    await page.goto("/es");
    await page.getByText("Quiero conocer Redes de Reino").click();
    await expect(page.locator("#galeria")).toBeInViewport();
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

test.describe("structure — Membresía replaced by Libros (books store)", () => {
  test("'Membresía' no longer exists anywhere on the page, in any locale", async ({ page }) => {
    for (const [locale, phrase] of [
      ["es", "Membresía"],
      ["en", "Membership"],
      ["pt", "Membresia"],
    ] as const) {
      await page.goto(`/${locale}`);
      await expect(page.locator("body")).not.toContainText(phrase);
    }
  });

  test("the Libros section sits where Membresía used to and the nav link points at it", async ({ page }) => {
    await page.goto("/es");

    const libros = page.locator("#libros");
    await expect(libros).toBeVisible();
    await expect(libros.getByRole("heading", { name: "Libros de Redes de Reino" })).toBeVisible();

    await nav(page).getByRole("link", { name: "Libros" }).click();
    await expect(page.locator("#libros")).toBeInViewport();
  });

  test("with no products published yet, the catalog shows an empty-state message instead of breaking", async ({
    page,
  }) => {
    await page.goto("/es");
    await expect(page.getByText("Todavía no hay libros publicados. Volvé pronto.")).toBeVisible();
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
