import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home page", () => {
  it("renders every required section", () => {
    render(<Home />);

    expect(
      screen.getAllByText(/Redes de Reino/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Nuestros Pastores")).toBeInTheDocument();
    expect(screen.getByText("Ariel Gómez")).toBeInTheDocument();
    expect(screen.getByText("Gabriela de Gómez")).toBeInTheDocument();
    expect(screen.getByText("Sé parte de Redes de Reino")).toBeInTheDocument();
    expect(screen.getByText("Crecé en la Palabra")).toBeInTheDocument();
    expect(screen.getByText("Viví la comunidad")).toBeInTheDocument();
    expect(
      screen.getByText("Generosidad que sostiene el Reino")
    ).toBeInTheDocument();
    expect(screen.getByText("Estamos para vos")).toBeInTheDocument();
  });

  it("exposes an anchor-based nav target for every navbar link", () => {
    render(<Home />);
    const anchors = [
      "inicio",
      "nuestra-iglesia",
      "pastores",
      "membresia",
      "estudios-biblicos",
      "diezmos-y-ofrendas",
      "contacto",
    ];
    for (const id of anchors) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });
});
