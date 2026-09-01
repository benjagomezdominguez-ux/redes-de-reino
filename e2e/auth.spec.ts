import { test, expect } from "@playwright/test";

// These cover what's provable without a real Supabase test account: the
// server-side redirect gate (rule 12/38) for every protected/admin route,
// and that the new auth pages render their required fields (rule 4/5/6/37).
// The role-based (admin vs. normal user) authorization behavior itself is
// enforced by requireAdmin() + RLS and is covered by
// src/lib/supabase/require-auth.test.ts plus a manual live verification
// pass documented in the final report — it isn't re-tested here because
// it needs a real authenticated session this suite doesn't have.

const PROTECTED_PATHS = [
  "/es/account",
  "/es/pedidos",
  "/es/biblioteca",
  "/es/libros/checkout",
  "/es/admin",
  "/es/admin/users",
  "/es/admin/orders",
  "/es/admin/books",
  "/es/admin/books/new",
  "/es/admin/whatsapp",
  "/es/admin/whatsapp/groups",
  "/es/admin/whatsapp/groups/new",
];

test.describe("route protection — unauthenticated visitor", () => {
  for (const path of PROTECTED_PATHS) {
    test(`${path} redirects to /login with a next param`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/es/login\\?next=${encodeURIComponent(path)}`));
    });
  }

  test("logging in from a protected-route redirect returns to that page (safe next)", async ({ page }) => {
    await page.goto("/es/account");
    await expect(page).toHaveURL(/\/es\/login\?next=%2Fes%2Faccount/);
    // The next param must be present as a hidden field so a successful
    // login can honor it — verified structurally rather than by actually
    // authenticating (no seeded test account in this suite).
    await expect(page.locator('input[name="next"]')).toHaveValue("/es/account");
  });
});

test.describe("login page", () => {
  test("renders email, password, show/hide toggle, forgot-password link, and signup link", async ({ page }) => {
    await page.goto("/es/login");

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mostrar contraseña" })).toBeVisible();
    await expect(page.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Creá una" })).toBeVisible();

    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Mostrar contraseña" }).click();
    await expect(passwordInput).toHaveAttribute("type", "text");
  });

  test("shows an error for invalid credentials without leaking whether the email exists", async ({ page }) => {
    await page.goto("/es/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Contraseña", { exact: true }).fill("wrongpassword");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
  });
});

test.describe("signup page", () => {
  test("renders first name, last name, email, password, and confirm password", async ({ page }) => {
    await page.goto("/es/signup");

    await expect(page.getByLabel("Nombre")).toBeVisible();
    await expect(page.getByLabel("Apellido")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirmar contraseña")).toBeVisible();
  });

  test("rejects a mismatched password confirmation client-side validation round trip", async ({ page }) => {
    await page.goto("/es/signup");
    await page.getByLabel("Nombre").fill("Ana");
    await page.getByLabel("Apellido").fill("Gómez");
    await page.getByLabel("Email").fill(`test-${Date.now()}@example.com`);
    await page.getByLabel("Contraseña", { exact: true }).fill("password1");
    await page.getByLabel("Confirmar contraseña").fill("different1");
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
  });
});

test.describe("forgot-password page", () => {
  test("always shows the same generic success message, regardless of whether the email exists", async ({
    page,
  }) => {
    await page.goto("/es/forgot-password");
    await page.getByLabel("Email").fill("whoever@example.com");
    await page.getByRole("button", { name: "Enviar instrucciones" }).click();

    await expect(
      page.getByText("Si ese email tiene una cuenta, te enviamos instrucciones para recuperar tu contraseña.")
    ).toBeVisible();
  });
});

test.describe("reset-password page", () => {
  test("shows an expired-link message (not the form) without an active recovery session", async ({ page }) => {
    await page.goto("/es/reset-password");

    await expect(page.getByText("Este enlace ya no es válido o expiró. Pedí uno nuevo.")).toBeVisible();
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
  });
});

test.describe("403 page", () => {
  test("renders directly without crashing", async ({ page }) => {
    await page.goto("/es/403");

    await expect(page.getByText("403")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Acceso denegado" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toBeVisible();
  });
});

test.describe("admin routes are not indexable", () => {
  test("robots.txt disallows /es/admin", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    const body = await response!.text();
    expect(body).toContain("Disallow: /es/admin");
  });
});

test.describe("payments webhook — honest about not being configured", () => {
  test("returns 503, never a fake success, when no payment provider is configured", async ({ request }) => {
    // Rule 51: never invent a payment integration. No PAYMENT_PROVIDER is
    // set in this project, so this must stay a real, explicit "not
    // configured" response — not a silent 200 that would look like a
    // working webhook to whoever eventually points a real gateway at it.
    const response = await request.post("/api/webhooks/payments", { data: {} });
    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body.error).toBe("no_payment_provider_configured");
  });
});

test.describe("tiendanube oauth — never reachable by a non-admin", () => {
  test("/api/tiendanube/oauth/start redirects an unauthenticated visitor to login instead of starting OAuth", async ({ request }) => {
    const response = await request.get("/api/tiendanube/oauth/start", { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers()["location"]).toContain("/es/login");
  });

  test("/api/tiendanube/oauth/callback redirects an unauthenticated visitor to login even with code/state present, never attempts a token exchange", async ({
    request,
  }) => {
    const response = await request.get("/api/tiendanube/oauth/callback?code=fake&state=fake", { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers()["location"]).toContain("/es/login");
  });
});

test.describe("whatsapp cron endpoint — never triggerable by an outsider", () => {
  test("refuses a request without the cron secret", async ({ request }) => {
    const response = await request.get("/api/cron/whatsapp");
    expect([401, 503]).toContain(response.status());
  });

  test("refuses a request with the wrong bearer token", async ({ request }) => {
    const response = await request.get("/api/cron/whatsapp", {
      headers: { authorization: "Bearer not-the-real-secret" },
    });
    expect([401, 503]).toContain(response.status());
  });
});
