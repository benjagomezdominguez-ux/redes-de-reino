import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "../../../messages/es.json";
import { ResendConfirmationButton } from "./ResendConfirmationButton";

const resendConfirmationEmailMock = vi.fn();

vi.mock("@/lib/actions/auth", () => ({
  resendConfirmationEmail: (...args: unknown[]) => resendConfirmationEmailMock(...args),
}));

function renderButton(email = "a@b.com") {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <ResendConfirmationButton email={email} />
    </NextIntlClientProvider>
  );
}

describe("ResendConfirmationButton", () => {
  beforeEach(() => {
    resendConfirmationEmailMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("CRITICAL: submits the exact email it was given, via Supabase's real resend action, and shows success", async () => {
    resendConfirmationEmailMock.mockResolvedValue({ status: "success" });
    renderButton("someone@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Reenviar correo de confirmación" }));

    await waitFor(() => expect(resendConfirmationEmailMock).toHaveBeenCalled());
    const [, formData] = resendConfirmationEmailMock.mock.calls[0];
    expect((formData as FormData).get("email")).toBe("someone@example.com");

    await waitFor(() =>
      expect(screen.getByText("Te reenviamos el correo. Revisá tu bandeja de entrada (y la carpeta de spam).")).toBeInTheDocument()
    );
  });

  it("shows the real error message when Supabase's rate limit is hit, not a fake success", async () => {
    resendConfirmationEmailMock.mockResolvedValue({ status: "error", errorKey: "rateLimited" });
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Reenviar correo de confirmación" }));

    await waitFor(() =>
      expect(
        screen.getByText("Se enviaron demasiados emails en poco tiempo. Esperá unos minutos y probá de nuevo.")
      ).toBeInTheDocument()
    );
    expect(screen.queryByText(/Te reenviamos el correo/)).not.toBeInTheDocument();
  });

  it("CRITICAL: starts a cooldown after any attempt (success or error) so it can't be spammed, disabling the button", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resendConfirmationEmailMock.mockResolvedValue({ status: "success" });
    renderButton();

    fireEvent.click(screen.getByRole("button"));
    await act(async () => {
      await vi.waitFor(() => expect(resendConfirmationEmailMock).toHaveBeenCalledTimes(1));
    });

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button.textContent).toMatch(/60s/);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(button.textContent).toMatch(/55s/);

    act(() => {
      vi.advanceTimersByTime(55000);
    });
    expect(button).not.toBeDisabled();
    expect(button.textContent).toBe("Reenviar correo de confirmación");
  });

  it("even a failed attempt starts the cooldown — doesn't let someone hammer an already-exhausted rate limit", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    resendConfirmationEmailMock.mockResolvedValue({ status: "error", errorKey: "rateLimited" });
    renderButton();

    fireEvent.click(screen.getByRole("button"));
    await act(async () => {
      await vi.waitFor(() => expect(resendConfirmationEmailMock).toHaveBeenCalledTimes(1));
    });

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
