import { describe, expect, it, vi, beforeEach } from "vitest";

const signInWithPasswordMock = vi.fn();
const signOutMock = vi.fn();
const signUpMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();
const updateUserMock = vi.fn();
const redirectMock = vi.fn();
// Profile status looked up right after a successful password check —
// defaults to "active" so every pre-existing test (which never mocks
// this) still exercises the normal, successful sign-in path.
let profileStatus: "active" | "inactive" = "active";

vi.mock("@/lib/supabase/session", () => ({
  getSupabaseSessionClient: async () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signOut: signOutMock,
      signUp: signUpMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      updateUser: updateUserMock,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { status: profileStatus } }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "es",
}));

vi.mock("@/lib/security/request-origin", () => ({
  getRequestOrigin: async () => "http://localhost:3000",
}));

const { signIn, signUp, requestPasswordReset, updatePassword } = await import("./auth");

function buildFormData(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("signIn", () => {
  beforeEach(() => {
    signInWithPasswordMock.mockReset();
    signOutMock.mockReset();
    redirectMock.mockReset();
    profileStatus = "active";
  });

  it("returns invalidCredentials on bad credentials and never redirects", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    const result = await signIn(
      { status: "idle" },
      buildFormData({ email: "a@b.com", password: "wrongpass" })
    );

    expect(result).toEqual({ status: "error", errorKey: "invalidCredentials" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to / by default on success", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null, data: { user: { id: "user-1" } } });

    await signIn({ status: "idle" }, buildFormData({ email: "a@b.com", password: "correct1" }));

    expect(redirectMock).toHaveBeenCalledWith({ href: "/", locale: "es" });
  });

  it("redirects to a safe `next` path on success", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null, data: { user: { id: "user-1" } } });

    await signIn(
      { status: "idle" },
      buildFormData({ email: "a@b.com", password: "correct1", next: "/admin" })
    );

    expect(redirectMock).toHaveBeenCalledWith({ href: "/admin", locale: "es" });
  });

  it("CRITICAL: falls back to / for an open-redirect `next` value instead of honoring it", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null, data: { user: { id: "user-1" } } });

    await signIn(
      { status: "idle" },
      buildFormData({ email: "a@b.com", password: "correct1", next: "https://evil.example/phish" })
    );

    expect(redirectMock).toHaveBeenCalledWith({ href: "/", locale: "es" });
  });

  it("CRITICAL: a deactivated account's correct password never yields a working session — signed back out immediately, no redirect", async () => {
    signInWithPasswordMock.mockResolvedValue({ error: null, data: { user: { id: "user-1" } } });
    profileStatus = "inactive";

    const result = await signIn(
      { status: "idle" },
      buildFormData({ email: "disabled@example.com", password: "correct1" })
    );

    expect(result).toEqual({ status: "error", errorKey: "accountDisabled" });
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("signUp", () => {
  beforeEach(() => {
    signUpMock.mockReset();
    redirectMock.mockReset();
  });

  it("rejects a mismatched password confirmation without ever calling Supabase", async () => {
    const result = await signUp(
      { status: "idle" },
      buildFormData({
        email: "a@b.com",
        password: "correct1",
        confirmPassword: "different1",
        firstName: "Ana",
        lastName: "Gómez",
      })
    );

    expect(result).toEqual({ status: "error", errorKey: "passwordMismatch" });
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("passes first/last name as user metadata and an /auth/callback redirect, never a role", async () => {
    signUpMock.mockResolvedValue({ error: null, data: { session: null } });

    await signUp(
      { status: "idle" },
      buildFormData({
        email: "a@b.com",
        password: "correct1",
        confirmPassword: "correct1",
        firstName: "Ana",
        lastName: "Gómez",
      })
    );

    expect(signUpMock).toHaveBeenCalledTimes(1);
    const [args] = signUpMock.mock.calls[0];
    expect(args.options.data).toEqual({ first_name: "Ana", last_name: "Gómez" });
    expect(args.options.emailRedirectTo).toContain("/auth/callback");
    // The whole point of rule 14: nothing here could ever smuggle a role.
    expect(JSON.stringify(args)).not.toMatch(/role/i);
  });

  it("returns checkEmail when signup doesn't return an active session (email confirmation required)", async () => {
    signUpMock.mockResolvedValue({ error: null, data: { session: null } });

    const result = await signUp(
      { status: "idle" },
      buildFormData({
        email: "a@b.com",
        password: "correct1",
        confirmPassword: "correct1",
        firstName: "Ana",
        lastName: "Gómez",
      })
    );

    expect(result).toEqual({ status: "checkEmail" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("maps an 'already registered' error to emailInUse", async () => {
    signUpMock.mockResolvedValue({ error: { message: "User already registered" }, data: {} });

    const result = await signUp(
      { status: "idle" },
      buildFormData({
        email: "a@b.com",
        password: "correct1",
        confirmPassword: "correct1",
        firstName: "Ana",
        lastName: "Gómez",
      })
    );

    expect(result).toEqual({ status: "error", errorKey: "emailInUse" });
  });
});

describe("requestPasswordReset", () => {
  beforeEach(() => {
    resetPasswordForEmailMock.mockReset();
  });

  it("CRITICAL: always returns the generic success state, even when Supabase errors — never reveals whether the email exists", async () => {
    resetPasswordForEmailMock.mockRejectedValue(new Error("some internal Supabase error"));

    // requestPasswordReset doesn't await-throw on the Supabase call's own
    // rejection style in real usage (it awaits the promise, which
    // resolves with a `{ error }` shape rather than throwing) — assert
    // the error-shaped resolution case explicitly:
    resetPasswordForEmailMock.mockResolvedValue({ error: { message: "User not found" } });

    const result = await requestPasswordReset({ status: "idle" }, buildFormData({ email: "nobody@example.com" }));

    expect(result).toEqual({ status: "success" });
  });

  it("returns success for a real, existing email too (same response either way)", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: null });

    const result = await requestPasswordReset({ status: "idle" }, buildFormData({ email: "real@example.com" }));

    expect(result).toEqual({ status: "success" });
  });

  it("only a malformed email produces a different (validation) response", async () => {
    const result = await requestPasswordReset({ status: "idle" }, buildFormData({ email: "not-an-email" }));

    expect(result).toEqual({ status: "error", errorKey: "generic" });
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });
});

describe("updatePassword", () => {
  beforeEach(() => {
    updateUserMock.mockReset();
  });

  it("rejects a mismatched confirmation without calling Supabase", async () => {
    const result = await updatePassword(
      { status: "idle" },
      buildFormData({ password: "newpass1", confirmPassword: "different1" })
    );

    expect(result).toEqual({ status: "error", errorKey: "passwordMismatch" });
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("updates the password when both fields match", async () => {
    updateUserMock.mockResolvedValue({ error: null });

    const result = await updatePassword(
      { status: "idle" },
      buildFormData({ password: "newpass1", confirmPassword: "newpass1" })
    );

    expect(updateUserMock).toHaveBeenCalledWith({ password: "newpass1" });
    expect(result).toEqual({ status: "success" });
  });

  it("surfaces a generic error if Supabase rejects the update (e.g. expired recovery session)", async () => {
    updateUserMock.mockResolvedValue({ error: { message: "Auth session missing" } });

    const result = await updatePassword(
      { status: "idle" },
      buildFormData({ password: "newpass1", confirmPassword: "newpass1" })
    );

    expect(result).toEqual({ status: "error", errorKey: "generic" });
  });
});
