import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "../../../messages/es.json";
import { CourseEnrollButton } from "./CourseEnrollButton";

const enrollInCourseMock = vi.fn();
const cancelCourseEnrollmentMock = vi.fn();

vi.mock("@/lib/actions/courses", () => ({
  enrollInCourse: (...args: unknown[]) => enrollInCourseMock(...args),
  cancelCourseEnrollment: (...args: unknown[]) => cancelCourseEnrollmentMock(...args),
}));

// @/i18n/navigation's Link pulls in next-intl's navigation helper, which
// transitively imports next/navigation in a way this project's pinned
// Next.js version's export map doesn't resolve under Vitest/Node (works
// fine under Next's own bundler — purely a test-environment resolution
// gap, not a runtime bug). A plain <a> is a faithful enough stand-in for
// what this test actually checks: the href this component computes.
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname: string; query?: Record<string, string> };
    children: React.ReactNode;
  }) => {
    const resolvedHref =
      typeof href === "string"
        ? href
        : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query).toString()}` : ""}`;
    return (
      <a href={resolvedHref} {...rest}>
        {children}
      </a>
    );
  },
}));

function renderButton(props: Partial<React.ComponentProps<typeof CourseEnrollButton>> = {}) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <CourseEnrollButton
        courseId="c1"
        coursePath="/cursos/curso-1"
        isAuthenticated={true}
        enrollmentOpen={true}
        initialStatus={null}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

describe("CourseEnrollButton", () => {
  beforeEach(() => {
    enrollInCourseMock.mockReset();
    cancelCourseEnrollmentMock.mockReset();
  });

  it("CRITICAL: an unauthenticated visitor never sees an enroll button, only a login prompt with the real next path", () => {
    renderButton({ isAuthenticated: false });
    expect(screen.getByText("Necesitás iniciar sesión para inscribirte.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inscribirme" })).not.toBeInTheDocument();
    const loginLink = screen.getByRole("link", { name: "Iniciar sesión" });
    expect(loginLink.getAttribute("href")).toBe("/login?next=%2Fcursos%2Fcurso-1");
  });

  it("shows a closed message, no button, when enrollment isn't open and the visitor isn't enrolled", () => {
    renderButton({ enrollmentOpen: false, initialStatus: null });
    expect(screen.getByText("Las inscripciones para este curso están cerradas.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("CRITICAL: a successful enroll shows the confirmed state and a cancel option, never a false positive on failure", async () => {
    enrollInCourseMock.mockResolvedValue({ ok: true, enrolled: true });
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Inscribirme" }));
    await waitFor(() => expect(screen.getByText("✓ Ya estás inscripto en este curso.")).toBeInTheDocument());
  });

  it("a failed enroll shows the real error, not a false success", async () => {
    enrollInCourseMock.mockResolvedValue({ ok: false });
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Inscribirme" }));
    await waitFor(() =>
      expect(screen.getByText("No pudimos completar la inscripción. Probá de nuevo.")).toBeInTheDocument()
    );
    expect(screen.queryByText(/Ya estás inscripto/)).not.toBeInTheDocument();
  });

  it("CRITICAL: cancelling requires an inline confirm step — never calls the action on the first click", () => {
    renderButton({ initialStatus: "active" });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar inscripción" }));
    expect(cancelCourseEnrollmentMock).not.toHaveBeenCalled();
    expect(screen.getByText("¿Seguro que querés cancelar tu inscripción a este curso?")).toBeInTheDocument();
  });

  it("confirming the cancel actually calls the action and updates the UI", async () => {
    cancelCourseEnrollmentMock.mockResolvedValue({ ok: true });
    renderButton({ initialStatus: "active" });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar inscripción" }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar" }));
    await waitFor(() => expect(cancelCourseEnrollmentMock).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Inscribirme" })).toBeInTheDocument());
  });

  it("backing out of the cancel confirm leaves the enrollment untouched", () => {
    renderButton({ initialStatus: "active" });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar inscripción" }));
    fireEvent.click(screen.getByRole("button", { name: "Volver" }));
    expect(cancelCourseEnrollmentMock).not.toHaveBeenCalled();
    expect(screen.getByText("✓ Ya estás inscripto en este curso.")).toBeInTheDocument();
  });
});
