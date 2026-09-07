import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "../../../messages/es.json";
import { PushPermissionBanner } from "./PushPermissionBanner";

// Regression test for the real, live-reproduced bug: two
// PushPermissionBanner instances mounted on the same page (its own
// instance + GlobalPushPrompt's floating one, both present on /account
// and /admin/chat) each independently called pushManager.subscribe() on
// mount whenever permission was already "granted" — two concurrent
// subscribe() calls on the same registration raced each other in Chrome
// and neither ever settled, until a 10s timeout reported it as a
// failure. A module-level in-flight lock (see PushPermissionBanner.tsx)
// fixes it: every mounted instance must share the same underlying
// subscribe attempt.

const subscribeToPushMock = vi.fn();
vi.mock("@/lib/actions/push", () => ({
  subscribeToPush: (...args: unknown[]) => subscribeToPushMock(...args),
}));

// PushPermissionBanner pulls in @/i18n/navigation's Link (for the
// "needs-install" state) — that transitively needs next-intl's
// createNavigation, which needs next/navigation, which doesn't resolve
// under Vitest/jsdom (same reasoning as Navbar.test.tsx's mocks). None of
// this test's scenarios render that state, so a plain stub is enough.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

const FAKE_SUBSCRIPTION = {
  endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
  toJSON: () => ({
    endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
    keys: { p256dh: "test-p256dh", auth: "test-auth" },
  }),
};

function mockGrantedPushEnvironment({ subscribeDelayMs = 0 } = {}) {
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: { permission: "granted", requestPermission: vi.fn().mockResolvedValue("granted") },
  });
  Object.defineProperty(window, "PushManager", { configurable: true, value: function PushManager() {} });

  const subscribeMock = vi.fn().mockImplementation(
    () =>
      new Promise((resolve) => {
        setTimeout(() => resolve(FAKE_SUBSCRIPTION), subscribeDelayMs);
      })
  );
  const getSubscriptionMock = vi.fn().mockResolvedValue(null);
  const registration = { pushManager: { getSubscription: getSubscriptionMock, subscribe: subscribeMock } };

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  });

  return { subscribeMock, getSubscriptionMock };
}

function renderBanner(namespace: string) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <PushPermissionBanner namespace={namespace} />
    </NextIntlClientProvider>
  );
}

describe("PushPermissionBanner — concurrent-mount push subscribe race", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public-key");
    subscribeToPushMock.mockReset();
    subscribeToPushMock.mockResolvedValue({ ok: true });
    try {
      window.localStorage.clear();
    } catch {
      // jsdom always supports localStorage; nothing to guard here in practice.
    }
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("CRITICAL: two simultaneously-mounted instances share ONE subscribe() call, not two racing ones", async () => {
    const { subscribeMock } = mockGrantedPushEnvironment({ subscribeDelayMs: 20 });

    // Mirrors the real page structure: the page's own banner + the
    // global floating one, both mounted at once.
    renderBanner("notifications.push");
    renderBanner("notifications.push");

    await waitFor(() => expect(subscribeToPushMock).toHaveBeenCalledTimes(1));

    // Both instances independently call registerPushSubscription(), but
    // the module-level lock means they share the exact same underlying
    // attempt — one pushManager.subscribe() call and one subscribeToPush()
    // Server Action call, not two colliding pairs of each.
    expect(subscribeMock).toHaveBeenCalledTimes(1);
  });

  it("a single mounted instance still subscribes normally", async () => {
    const { subscribeMock } = mockGrantedPushEnvironment();
    renderBanner("notifications.push");

    await waitFor(() => expect(subscribeToPushMock).toHaveBeenCalledTimes(1));
    expect(subscribeMock).toHaveBeenCalledTimes(1);
  });
});
