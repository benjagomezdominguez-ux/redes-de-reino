import "@testing-library/jest-dom/vitest";

// jsdom has no IntersectionObserver. Components that use it (e.g. Reveal)
// only need it to exist and be inert for rendering tests.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// @ts-expect-error -- minimal test stub, not a spec-complete implementation
globalThis.IntersectionObserver = IntersectionObserverStub;
