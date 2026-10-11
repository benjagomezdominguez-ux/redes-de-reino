import { describe, expect, it, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "../../../messages/es.json";
import { InstallGuide } from "./InstallGuide";

function setUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
}

function renderGuide() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <InstallGuide />
    </NextIntlClientProvider>
  );
}

const REAL_UA = navigator.userAgent;

describe("InstallGuide", () => {
  afterEach(() => {
    setUserAgent(REAL_UA);
  });

  it("renders all three device cards (iOS, Android, desktop)", () => {
    renderGuide();

    expect(screen.getByText("Cómo instalar Redes de Reino en iPhone")).toBeInTheDocument();
    expect(screen.getByText("Cómo instalar Redes de Reino en Android")).toBeInTheDocument();
    expect(screen.getByText("Cómo instalar Redes de Reino en una computadora")).toBeInTheDocument();
  });

  it("CRITICAL: the Android card shows the security-warning guidance — stop, don't disable protections, and that this is a website, not a separate .apk", () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/119.0 Mobile Safari/537.36");
    renderGuide();

    const note = screen.getByText(/no un archivo \.apk para descargar/);
    expect(note.textContent).toContain("detené la instalación");
    expect(note.textContent).toContain("no la ignores ni desactives las protecciones");
  });

  it("the iOS and desktop cards keep their own existing notes, unaffected by the Android note addition", () => {
    renderGuide();

    expect(
      screen.getByText("Una vez instalada, Redes de Reino aparecerá en tu pantalla de inicio como una aplicación.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/En navegadores compatibles \(Chrome, Edge\) puede aparecer directamente/)
    ).toBeInTheDocument();
  });
});
