import { describe, expect, it, vi, beforeEach } from "vitest";

const getAuthProfileMock = vi.fn();

vi.mock("./get-profile", () => ({
  getAuthProfile: getAuthProfileMock,
}));

const { getAdminUserOrNull } = await import("./require-admin-api");

describe("getAdminUserOrNull", () => {
  beforeEach(() => {
    getAuthProfileMock.mockReset();
  });

  it("returns null with no session", async () => {
    getAuthProfileMock.mockResolvedValue(null);
    expect(await getAdminUserOrNull()).toBeNull();
  });

  it("returns null for a regular user, never granting API-route admin access by mistake", async () => {
    getAuthProfileMock.mockResolvedValue({ id: "user-1", role: "user", status: "active" });
    expect(await getAdminUserOrNull()).toBeNull();
  });

  it("returns null for a deactivated admin account", async () => {
    getAuthProfileMock.mockResolvedValue({ id: "admin-1", role: "admin", status: "inactive" });
    expect(await getAdminUserOrNull()).toBeNull();
  });

  it("returns the user id for an active admin", async () => {
    getAuthProfileMock.mockResolvedValue({ id: "admin-1", role: "admin", status: "active" });
    expect(await getAdminUserOrNull()).toEqual({ id: "admin-1" });
  });
});
