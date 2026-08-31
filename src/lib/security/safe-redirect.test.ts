import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("accepts a plain relative path", () => {
    expect(safeRedirectPath("/admin")).toBe("/admin");
    expect(safeRedirectPath("/account/orders")).toBe("/account/orders");
  });

  it("rejects an absolute URL to another host", () => {
    expect(safeRedirectPath("https://evil.example/phish")).toBeNull();
    expect(safeRedirectPath("http://evil.example")).toBeNull();
  });

  it("rejects a protocol-relative URL", () => {
    expect(safeRedirectPath("//evil.example")).toBeNull();
  });

  it("rejects a javascript: URI", () => {
    expect(safeRedirectPath("javascript:alert(1)")).toBeNull();
  });

  it("rejects a path that doesn't start with /", () => {
    expect(safeRedirectPath("admin")).toBeNull();
  });

  it("returns null for empty/missing input", () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath("")).toBeNull();
  });
});
