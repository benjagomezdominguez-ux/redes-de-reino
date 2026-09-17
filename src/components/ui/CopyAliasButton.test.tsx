import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "../../../messages/es.json";
import { CopyAliasButton } from "./CopyAliasButton";

// Deliberately uses fireEvent, not @testing-library/user-event — userEvent's
// setup() installs its own navigator.clipboard stub for paste-event
// testing, which silently clobbers the mock set up below (confirmed live:
// writeTextMock saw 0 calls while the component still reported success,
// because it was actually talking to userEvent's stub instead).

const ALIAS = "redeslibros.mp";

function renderButton() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <CopyAliasButton alias={ALIAS} />
    </NextIntlClientProvider>
  );
}

describe("CopyAliasButton", () => {
  let writeTextMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: writeTextMock },
    });
  });

  it("CRITICAL: copies exactly the alias to the clipboard and shows a confirmation", async () => {
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Copiar alias" }));

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith("redeslibros.mp"));
    await waitFor(() => expect(screen.getByText("Alias copiado")).toBeInTheDocument());
  });

  it("the button works again on a second click", async () => {
    renderButton();
    const button = screen.getByRole("button", { name: "Copiar alias" });

    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText("Alias copiado")).toBeInTheDocument());

    fireEvent.click(button);
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("Alias copiado")).toBeInTheDocument());
  });

  it("falls back to selecting the alias text when the Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Copiar alias" }));

    await waitFor(() => expect(screen.getByText(/Seleccionamos el alias por vos/)).toBeInTheDocument());
    expect(window.getSelection()?.toString()).toBe(ALIAS);
  });

  it("falls back the same way when writeText throws (e.g. denied permission)", async () => {
    writeTextMock.mockRejectedValue(new Error("denied"));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Copiar alias" }));

    await waitFor(() => expect(screen.getByText(/Seleccionamos el alias por vos/)).toBeInTheDocument());
  });

  it("renders exactly the alias text visibly, with no CBU label anywhere", () => {
    renderButton();
    expect(screen.getByText(ALIAS)).toBeInTheDocument();
    expect(screen.queryByText(/CBU/i)).toBeNull();
  });
});
