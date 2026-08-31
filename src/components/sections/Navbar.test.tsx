import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "../../../messages/es.json";
import { CartProvider } from "@/lib/cart/CartContext";
import { Navbar } from "./Navbar";

// Navbar imports the signOut server action for the account menu's logout
// form. In real Next.js the client bundle only gets a reference to it, but
// Vitest has no "use server" transform, so it would otherwise pull in the
// real module (and, transitively, next/navigation) into this jsdom test.
vi.mock("@/lib/actions/auth", () => ({
  signOut: async () => {},
}));

function renderNavbar() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <CartProvider>
        <Navbar />
      </CartProvider>
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
      within(mobileMenu!).getByRole("link", { name: "Libros" })
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
