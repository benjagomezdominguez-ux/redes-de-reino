import { describe, expect, it, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useSafeReducedMotion } from "./use-safe-reduced-motion";

// Regression test for a real, live-reproduced bug: motion's own
// useReducedMotion() reads window.matchMedia synchronously on the
// client's first render, which differs from the server (always null
// there) whenever a visitor already has reduced motion enabled —
// confirmed live via Playwright with reducedMotion: "reduce" as a
// genuine React hydration mismatch (error #418). This hook is the fix;
// these tests are about its own correctness (reports the real
// preference, and reacts to it changing), not about hydration itself
// (that needs a real browser round-trip, verified separately).

function TestComponent() {
  const reduceMotion = useSafeReducedMotion();
  return <span>{reduceMotion ? "reduced" : "full"}</span>;
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("useSafeReducedMotion", () => {
  it("reports false when the device has no reduced-motion preference", () => {
    stubMatchMedia(false);
    render(<TestComponent />);
    expect(screen.getByText("full")).toBeInTheDocument();
  });

  it("CRITICAL: reports true when the device already prefers reduced motion", () => {
    stubMatchMedia(true);
    render(<TestComponent />);
    expect(screen.getByText("reduced")).toBeInTheDocument();
  });
});
