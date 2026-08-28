import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MeetingSchedule } from "./MeetingSchedule";
import type { Meeting } from "@/lib/site-config";

const dayLabels = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

describe("MeetingSchedule", () => {
  it("renders one card per meeting, in the given (day-ordered) sequence", () => {
    const meetings: Meeting[] = [
      { dayKey: "lunes", title: "Reunión", time: "19:00 hs", description: null },
      { dayKey: "miercoles", title: "Estudio Bíblico", time: "20:00 hs", description: null },
      { dayKey: "domingo", title: "Reunión General", time: "10:00 hs", description: null },
    ];

    render(
      <MeetingSchedule meetings={meetings} dayLabels={dayLabels} pendingLabel="[PENDIENTE]" />
    );

    const days = screen.getAllByText(/Lunes|Miércoles|Domingo/);
    expect(days.map((el) => el.textContent)).toEqual(["Lunes", "Miércoles", "Domingo"]);
    expect(screen.getByText("19:00 hs")).toBeInTheDocument();
    expect(screen.getByText("20:00 hs")).toBeInTheDocument();
    expect(screen.getByText("10:00 hs")).toBeInTheDocument();
  });

  it("shows the pending label for any field that has no real data yet, never blank/undefined", () => {
    const meetings: Meeting[] = [{ dayKey: null, title: null, time: null, description: null }];

    render(
      <MeetingSchedule meetings={meetings} dayLabels={dayLabels} pendingLabel="[PENDIENTE]" />
    );

    expect(screen.getAllByText("[PENDIENTE]").length).toBe(3); // day, title, time
    expect(screen.queryByText("undefined")).not.toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });

  it("changing the data doesn't require touching the component (data-driven by design)", () => {
    const meetings: Meeting[] = [
      { dayKey: "viernes", title: "Célula de jóvenes", time: "20:30 hs", description: "En casa de familia" },
    ];

    render(
      <MeetingSchedule meetings={meetings} dayLabels={dayLabels} pendingLabel="[PENDIENTE]" />
    );

    expect(screen.getByText("Viernes")).toBeInTheDocument();
    expect(screen.getByText("Célula de jóvenes")).toBeInTheDocument();
    expect(screen.getByText("20:30 hs")).toBeInTheDocument();
    expect(screen.getByText("En casa de familia")).toBeInTheDocument();
  });

  it("uses a responsive grid (1 column on mobile via base classes, 3 on larger screens)", () => {
    const meetings: Meeting[] = [{ dayKey: "domingo", title: "X", time: "10:00", description: null }];
    const { container } = render(
      <MeetingSchedule meetings={meetings} dayLabels={dayLabels} pendingLabel="[PENDIENTE]" />
    );
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).toMatch(/sm:grid-cols-3/);
  });
});
