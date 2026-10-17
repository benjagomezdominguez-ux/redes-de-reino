import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "../../../messages/es.json";
import { CourseAttendanceButton } from "./CourseAttendanceButton";

const recordCourseAttendanceMock = vi.fn();

vi.mock("@/lib/actions/courses", () => ({
  recordCourseAttendance: (...args: unknown[]) => recordCourseAttendanceMock(...args),
}));

function renderButton(props: Partial<React.ComponentProps<typeof CourseAttendanceButton>> = {}) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <CourseAttendanceButton
        meetingId="m1"
        attendanceAvailable={true}
        initiallyRecorded={false}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

async function submitPassword(password: string) {
  fireEvent.click(screen.getByRole("button", { name: "Registrar asistencia" }));
  fireEvent.change(screen.getByPlaceholderText("La contraseña que te dio Ariel"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar asistencia" }));
}

describe("CourseAttendanceButton", () => {
  beforeEach(() => {
    recordCourseAttendanceMock.mockReset();
  });

  it("shows a checkmark immediately when already recorded — no button, nothing to click", () => {
    renderButton({ initiallyRecorded: true });
    expect(screen.getByText("✓ ¡Asistencia registrada!")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a closed message, no interactive control, when attendance isn't available", () => {
    renderButton({ attendanceAvailable: false });
    expect(screen.getByText("La asistencia para este encuentro no está habilitada.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("CRITICAL: a wrong password shows the real error, never a false success checkmark", async () => {
    recordCourseAttendanceMock.mockResolvedValue("wrong_password");
    renderButton();
    await submitPassword("incorrecta");
    await waitFor(() => expect(screen.getByText("La contraseña no es correcta.")).toBeInTheDocument());
    expect(screen.queryByText(/¡Asistencia registrada!/)).not.toBeInTheDocument();
  });

  it("CRITICAL: a correct password shows success and replaces the form with a checkmark", async () => {
    recordCourseAttendanceMock.mockResolvedValue("recorded");
    renderButton();
    await submitPassword("correcta");
    await waitFor(() => expect(screen.getByText("✓ ¡Asistencia registrada!")).toBeInTheDocument());
  });

  it("already_recorded also settles into the success state (idempotent UI, matches the idempotent RPC)", async () => {
    recordCourseAttendanceMock.mockResolvedValue("already_recorded");
    renderButton();
    await submitPassword("correcta");
    await waitFor(() => expect(screen.getByText("✓ ¡Asistencia registrada!")).toBeInTheDocument());
  });

  it("locked shows the rate-limit message, not a generic error", async () => {
    recordCourseAttendanceMock.mockResolvedValue("locked");
    renderButton();
    await submitPassword("x");
    await waitFor(() =>
      expect(screen.getByText("Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.")).toBeInTheDocument()
    );
  });

  it("not_enrolled shows that specific message", async () => {
    recordCourseAttendanceMock.mockResolvedValue("not_enrolled");
    renderButton();
    await submitPassword("x");
    await waitFor(() =>
      expect(screen.getByText("Necesitás estar inscripto en el curso para registrar asistencia.")).toBeInTheDocument()
    );
  });

  it("cancel closes the form without submitting anything", () => {
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Registrar asistencia" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(recordCourseAttendanceMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Registrar asistencia" })).toBeInTheDocument();
  });
});
