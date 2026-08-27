import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "../../../messages/es.json";
import { Navbar } from "./Navbar";

function renderNavbar() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <Navbar />
    </NextIntlClientProvider>
  );
}

describe("Navbar", () => {
  it("opens and closes the mobile menu on toggle", async () => {
    const user = userEvent.setup();
    renderNavbar();

    expect(document.getElementById("mobile-menu")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    const mobileMenu = document.getElementById("mobile-menu");
    expect(mobileMenu).not.toBeNull();
    expect(
      within(mobileMenu!).getByRole("link", { name: "Contacto" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cerrar menú" }));
    expect(document.getElementById("mobile-menu")).toBeNull();
  });

  it("offers all three languages in the mobile menu's language switcher", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    const mobileMenu = document.getElementById("mobile-menu")!;

    expect(within(mobileMenu).getByRole("link", { name: /Español/ })).toBeInTheDocument();
    expect(within(mobileMenu).getByRole("link", { name: /English/ })).toBeInTheDocument();
    expect(within(mobileMenu).getByRole("link", { name: /Português/ })).toBeInTheDocument();
  });

  it("offers all three languages in the desktop language switcher", async () => {
    const user = userEvent.setup();
    renderNavbar();

    await user.click(screen.getByRole("button", { name: "Idioma" }));

    const listbox = screen.getByRole("listbox", { name: "Idioma" });
    expect(within(listbox).getByRole("option", { name: /Español/ })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: /English/ })).toBeInTheDocument();
    expect(within(listbox).getByRole("option", { name: /Português/ })).toBeInTheDocument();
  });
});
