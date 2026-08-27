import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "./Navbar";

describe("Navbar", () => {
  it("opens and closes the mobile menu on toggle", async () => {
    const user = userEvent.setup();
    render(<Navbar />);

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
});
