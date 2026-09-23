import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";

// Regression coverage for the proactive half of the stale-PWA-version
// fix (see src/app/[locale]/error.test.tsx for the reactive half): an
// already-open PWA/tab that's been controlled by a previous service
// worker for a while should reload exactly once when a NEW one takes
// over, so it picks up the current deployment's JS before the user ever
// submits a form (login included) with a stale Server Action id. A
// brand-new visitor (no prior controller yet) must never be force-
// reloaded by this — that would just be an unnecessary flicker on
// every first-ever visit.
//
// Also covers a real gap found while investigating a report that a
// fix wasn't visible in production for some users: the browser only
// checks for a new SW version on navigation — a PWA resumed from the
// app switcher (not relaunched) never navigates at all, so it can
// silently keep running arbitrarily old JS. registration.update()
// forces that check on demand instead of waiting for it to happen on
// its own.
function mockServiceWorkerContainer({ hasController }: { hasController: boolean }) {
  const listeners: Record<string, Array<() => void>> = {};
  const updateMock = vi.fn().mockResolvedValue(undefined);
  const registration = { update: updateMock };
  const container = {
    controller: hasController ? {} : null,
    register: vi.fn().mockResolvedValue(registration),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      (listeners[event] ??= []).push(handler);
    }),
  };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: container });
  return {
    container,
    updateMock,
    fireControllerChange: () => listeners["controllerchange"]?.forEach((h) => h()),
  };
}

describe("ServiceWorkerRegistration — safe update reload", () => {
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadMock },
    });
  });

  it("CRITICAL: reloads exactly once when a new service worker takes over an already-controlled page", async () => {
    const { container, fireControllerChange } = mockServiceWorkerContainer({ hasController: true });

    render(<ServiceWorkerRegistration />);
    await waitFor(() => expect(container.register).toHaveBeenCalledWith("/sw.js"));
    await waitFor(() => expect(container.addEventListener).toHaveBeenCalledWith("controllerchange", expect.any(Function)));

    fireControllerChange();
    // A second SW taking over later (or a duplicate event) must never
    // trigger a second reload.
    fireControllerChange();

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("never attaches a reload listener on a brand-new visit with no prior controller", async () => {
    const { container } = mockServiceWorkerContainer({ hasController: false });

    render(<ServiceWorkerRegistration />);
    await waitFor(() => expect(container.register).toHaveBeenCalledWith("/sw.js"));

    expect(container.addEventListener).not.toHaveBeenCalled();
  });

  it("CRITICAL: proactively checks for an update on mount, not just reactively after one is found", async () => {
    const { updateMock } = mockServiceWorkerContainer({ hasController: true });

    render(<ServiceWorkerRegistration />);

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
  });

  it("CRITICAL: re-checks for an update whenever the page regains visibility (a PWA resumed from the background never navigates, so nothing else would trigger this)", async () => {
    const { updateMock } = mockServiceWorkerContainer({ hasController: true });

    render(<ServiceWorkerRegistration />);
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(2));
  });

  it("does not check for an update when the page becomes hidden", async () => {
    const { updateMock } = mockServiceWorkerContainer({ hasController: true });

    render(<ServiceWorkerRegistration />);
    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
