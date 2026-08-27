import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// RTL doesn't auto-cleanup under Vitest the way it does under Jest —
// without this, DOM from one test leaks into the next `render()` call
// within the same file, breaking any query that expects a single match.
afterEach(cleanup);

// jsdom has no IntersectionObserver. Components that use it (e.g. Reveal)
// only need it to exist and be inert for rendering tests.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// @ts-expect-error -- minimal test stub, not a spec-complete implementation
globalThis.IntersectionObserver = IntersectionObserverStub;
