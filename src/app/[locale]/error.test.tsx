import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "../../../messages/es.json";
import LocaleError from "./error";

// Regression test for a real, live-reproduced production bug: a Server
// Action invoked from JS loaded before a newer deploy went out fails
// with "Server Action ... was not found on the server" — confirmed live
// against production (a mismatched action id gets a 404 with
// x-nextjs-action-not-found, and Next.js's client runtime throws
// UnrecognizedActionError for it). This app never caught that error
// anywhere, so it surfaced as a raw, unexplained crash — hitting
// hardest for PWA users whose JS can keep running across many deploys
// without ever reloading. This boundary is the fix: detect that one
// error shape specifically and reload once; anything else still gets a
// normal, visible fallback.
const isUnrecognizedActionErrorMock = vi.fn();
vi.mock("next/navigation", () => ({
  unstable_isUnrecognizedActionError: (...args: unknown[]) => isUnrecognizedActionErrorMock(...args),
}));

function renderError(error: Error) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <LocaleError error={error} />
    </NextIntlClientProvider>
  );
}

describe("LocaleError (root error boundary)", () => {
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isUnrecognizedActionErrorMock.mockReset().mockReturnValue(false);
    reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadMock },
    });
  });

  it("CRITICAL: an UnrecognizedActionError (stale deploy) reloads automatically instead of showing a dead end", () => {
    isUnrecognizedActionErrorMock.mockReturnValue(true);

    renderError(Object.assign(new Error('Server Action "abc123" was not found on the server.'), { name: "UnrecognizedActionError" }));

    expect(screen.getByText(/nueva versión/i)).toBeInTheDocument();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("any other error shows the generic fallback with a manual reload button, and never auto-reloads", () => {
    isUnrecognizedActionErrorMock.mockReturnValue(false);

    renderError(new Error("something unrelated broke"));

    expect(screen.getByText("Algo salió mal")).toBeInTheDocument();
    expect(reloadMock).not.toHaveBeenCalled();

    screen.getByRole("button", { name: "Recargar página" }).click();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
