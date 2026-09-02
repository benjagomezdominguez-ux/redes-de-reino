import { describe, expect, it } from "vitest";
import { isChatAdmin } from "./is-chat-admin";

const ARIEL = { role: "admin" as const, status: "active" as const, firstName: "Ariel", lastName: "Gomez" };

describe("isChatAdmin", () => {
  it("returns true for Ariel Gómez, active admin", () => {
    expect(isChatAdmin(ARIEL)).toBe(true);
  });

  it("is case/accent-tolerant (real stored data is lowercase, no accents)", () => {
    expect(isChatAdmin({ ...ARIEL, firstName: "ariel", lastName: "gomez" })).toBe(true);
    expect(isChatAdmin({ ...ARIEL, firstName: "ARIEL", lastName: "GÓMEZ".replace("Ó", "O") })).toBe(true);
  });

  it("CRITICAL: returns false for a different real admin, even with the exact admin role/status", () => {
    expect(isChatAdmin({ role: "admin", status: "active", firstName: "Benjamin", lastName: "Gomez" })).toBe(false);
  });

  it("returns false for a non-admin named Ariel Gomez", () => {
    expect(isChatAdmin({ role: "user", status: "active", firstName: "Ariel", lastName: "Gomez" })).toBe(false);
  });

  it("returns false for a deactivated Ariel Gomez account", () => {
    expect(isChatAdmin({ ...ARIEL, status: "inactive" })).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isChatAdmin(null)).toBe(false);
    expect(isChatAdmin(undefined)).toBe(false);
  });

  it("returns false when first/last name is missing entirely", () => {
    expect(isChatAdmin({ role: "admin", status: "active", firstName: null, lastName: null })).toBe(false);
  });
});
