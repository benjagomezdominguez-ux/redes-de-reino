import { describe, expect, it, vi, beforeEach } from "vitest";

const getAuthProfileMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("./get-profile", () => ({
  getAuthProfile: getAuthProfileMock,
}));

vi.mock("@/i18n/navigation", () => ({
  // A real redirect() never returns — throwing here (like Next's actual
  // NEXT_REDIRECT signal) is what proves requireUser()/requireAdmin()
  // never fall through to "access granted" logic afterwards.
  redirect: vi.fn((...args: unknown[]) => {
    redirectMock(...args);
    throw new Error("REDIRECT");
  }),
}));

vi.mock("next-intl/server", () => ({
  getLocale: async () => "es",
}));

const { requireUser, requireAdmin, requireChatAdmin } = await import("./require-auth");

const ACTIVE_USER = {
  id: "user-1",
  email: "user@example.com",
  firstName: "Ana",
  lastName: "Gómez",
  role: "user" as const,
  status: "active" as const,
};

const ACTIVE_ADMIN = { ...ACTIVE_USER, id: "admin-1", role: "admin" as const };
const INACTIVE_USER = { ...ACTIVE_USER, status: "inactive" as const };
const ARIEL_ADMIN = { ...ACTIVE_USER, id: "ariel-1", firstName: "Ariel", lastName: "Gomez", role: "admin" as const };

describe("requireUser", () => {
  beforeEach(() => {
    getAuthProfileMock.mockReset();
    redirectMock.mockReset();
  });

  it("redirects to /login when there's no session", async () => {
    getAuthProfileMock.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith({ href: "/login", locale: "es" });
  });

  it("redirects to /login when the account is deactivated", async () => {
    getAuthProfileMock.mockResolvedValue(INACTIVE_USER);

    await expect(requireUser()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith({ href: "/login", locale: "es" });
  });

  it("returns the profile without redirecting for an active session", async () => {
    getAuthProfileMock.mockResolvedValue(ACTIVE_USER);

    const result = await requireUser();

    expect(result).toEqual(ACTIVE_USER);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    getAuthProfileMock.mockReset();
    redirectMock.mockReset();
  });

  it("redirects to /login when there's no session", async () => {
    getAuthProfileMock.mockResolvedValue(null);

    await expect(requireAdmin()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith({ href: "/login", locale: "es" });
  });

  it("CRITICAL: redirects a logged-in non-admin to /403, not /login", async () => {
    getAuthProfileMock.mockResolvedValue(ACTIVE_USER);

    await expect(requireAdmin()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith({ href: "/403", locale: "es" });
    expect(redirectMock).not.toHaveBeenCalledWith({ href: "/login", locale: "es" });
  });

  it("returns the profile without redirecting for an active admin", async () => {
    getAuthProfileMock.mockResolvedValue(ACTIVE_ADMIN);

    const result = await requireAdmin();

    expect(result).toEqual(ACTIVE_ADMIN);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("requireChatAdmin", () => {
  beforeEach(() => {
    getAuthProfileMock.mockReset();
    redirectMock.mockReset();
  });

  it("redirects to /login when there's no session", async () => {
    getAuthProfileMock.mockResolvedValue(null);

    await expect(requireChatAdmin()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith({ href: "/login", locale: "es" });
  });

  it("CRITICAL: redirects a real, different admin (not Ariel) to /403 — the chat is private to Ariel specifically, not any admin", async () => {
    getAuthProfileMock.mockResolvedValue(ACTIVE_ADMIN);

    await expect(requireChatAdmin()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith({ href: "/403", locale: "es" });
  });

  it("redirects a non-admin to /403", async () => {
    getAuthProfileMock.mockResolvedValue(ACTIVE_USER);

    await expect(requireChatAdmin()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith({ href: "/403", locale: "es" });
  });

  it("returns the profile without redirecting for Ariel Gómez", async () => {
    getAuthProfileMock.mockResolvedValue(ARIEL_ADMIN);

    const result = await requireChatAdmin();

    expect(result).toEqual(ARIEL_ADMIN);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
