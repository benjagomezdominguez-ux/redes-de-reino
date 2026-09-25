import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "../../../messages/es.json";
import type { DevotionalViewerRow } from "@/lib/admin/devotional-view-queries";

const getDevotionalViewersMock = vi.fn();
vi.mock("@/lib/actions/admin-devotional-views", () => ({ getDevotionalViewers: getDevotionalViewersMock }));

// Dynamic import, after vi.mock() — a static top-level import of the
// component would itself be hoisted above getDevotionalViewersMock's
// declaration (same reason every Server Action test in this project
// dynamically imports the module under test instead of a static
// import), and DevotionalViewersPanel imports admin-devotional-views.ts
// directly.
const { DevotionalViewersPanel } = await import("./DevotionalViewersPanel");

function renderPanel(props: Partial<{ devotionalId: string; devotionalTitle: string; initialCount: number }> = {}) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages} timeZone="America/Argentina/Buenos_Aires">
      <DevotionalViewersPanel
        devotionalId={props.devotionalId ?? "d1"}
        devotionalTitle={props.devotionalTitle ?? "El Origen"}
        initialCount={props.initialCount ?? 0}
      />
    </NextIntlClientProvider>
  );
}

function viewer(overrides: Partial<DevotionalViewerRow> = {}): DevotionalViewerRow {
  return {
    userId: "user-1",
    displayName: "Juan Perez",
    firstViewedAt: "2026-01-01T10:00:00.000Z",
    lastViewedAt: "2026-01-01T10:00:00.000Z",
    viewCount: 1,
    ...overrides,
  };
}

beforeEach(() => {
  getDevotionalViewersMock.mockReset();
  document.body.style.overflow = "";
});

describe("DevotionalViewersPanel — collapsed row (list page)", () => {
  it("shows the unique-viewer count and the trigger button; the panel isn't in the DOM until opened", () => {
    renderPanel({ initialCount: 24 });
    expect(screen.getByText("24 personas vieron este devocional")).toBeInTheDocument();
    expect(screen.getByText("👁")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver quiénes lo vieron" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Never fetches anything before the admin actually asks for it.
    expect(getDevotionalViewersMock).not.toHaveBeenCalled();
  });

  it("the empty-count phrasing reads naturally (zero, not '0 personas')", () => {
    renderPanel({ initialCount: 0 });
    expect(screen.getByText("Nadie vio este devocional todavía")).toBeInTheDocument();
  });

  it("singular phrasing for exactly one viewer", () => {
    renderPanel({ initialCount: 1 });
    expect(screen.getByText("1 persona vio este devocional")).toBeInTheDocument();
  });
});

describe("DevotionalViewersPanel — opening the panel", () => {
  it("CRITICAL: fetches page 1 only the first time it opens, in a loading state until the data arrives", async () => {
    let resolveFetch!: (v: unknown) => void;
    getDevotionalViewersMock.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));

    renderPanel({ initialCount: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Ver quiénes lo vieron" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(getDevotionalViewersMock).toHaveBeenCalledWith("d1", { page: 1, search: "" });
    expect(getDevotionalViewersMock).toHaveBeenCalledTimes(1);

    resolveFetch({ ok: true, data: { rows: [viewer()], total: 1, page: 1, pageSize: 20 } });
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
  });

  it("reopening the panel does not re-fetch page 1 again", async () => {
    getDevotionalViewersMock.mockResolvedValue({ ok: true, data: { rows: [viewer()], total: 1, page: 1, pageSize: 20 } });
    renderPanel({ initialCount: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Ver quiénes lo vieron" }));
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver quiénes lo vieron" }));

    expect(screen.getByText("Juan Perez")).toBeInTheDocument();
    expect(getDevotionalViewersMock).toHaveBeenCalledTimes(1);
  });

  it("locks page scroll while open and restores it on close", async () => {
    getDevotionalViewersMock.mockResolvedValue({ ok: true, data: { rows: [], total: 0, page: 1, pageSize: 20 } });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Ver quiénes lo vieron" }));
    await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(document.body.style.overflow).toBe("");
  });
});

describe("DevotionalViewersPanel — states", () => {
  it("shows an explanatory empty state, not a blank panel, when there are truly no views", async () => {
    getDevotionalViewersMock.mockResolvedValue({ ok: true, data: { rows: [], total: 0, page: 1, pageSize: 20 } });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Ver quiénes lo vieron" }));
    await waitFor(() => expect(screen.getByText("Este devocional todavía no tiene visualizaciones.")).toBeInTheDocument());
  });

  it("CRITICAL: shows an error state with a retry action on failure — never a silent blank panel", async () => {
    getDevotionalViewersMock.mockResolvedValueOnce({ ok: false });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Ver quiénes lo vieron" }));
    await waitFor(() => expect(screen.getByText("No pudimos cargar las visualizaciones. Intentá nuevamente.")).toBeInTheDocument());

    getDevotionalViewersMock.mockResolvedValueOnce({ ok: true, data: { rows: [viewer()], total: 1, page: 1, pageSize: 20 } });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
  });

  it("a devotional's read page never breaks alongside this — the panel is fully self-contained (smoke check: renders without throwing while the action is still pending)", () => {
    getDevotionalViewersMock.mockReturnValue(new Promise(() => {}));
    expect(() => {
      renderPanel({ initialCount: 5 });
      fireEvent.click(screen.getByRole("button", { name: "Ver quiénes lo vieron" }));
    }).not.toThrow();
  });
});

describe("DevotionalViewersPanel — pagination", () => {
  it("shows a 'load more' control only while there are more rows, and appends without duplicating", async () => {
    getDevotionalViewersMock.mockResolvedValueOnce({
      ok: true,
      data: { rows: [viewer({ userId: "u1", displayName: "Uno" })], total: 2, page: 1, pageSize: 20 },
    });
    renderPanel({ initialCount: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Ver quiénes lo vieron" }));
    await waitFor(() => expect(screen.getByText("Uno")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Cargar más" })).toBeInTheDocument();

    getDevotionalViewersMock.mockResolvedValueOnce({
      ok: true,
      data: { rows: [viewer({ userId: "u2", displayName: "Dos" })], total: 2, page: 2, pageSize: 20 },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));

    await waitFor(() => expect(screen.getByText("Dos")).toBeInTheDocument());
    expect(screen.getByText("Uno")).toBeInTheDocument(); // still there — appended, not replaced
    expect(getDevotionalViewersMock).toHaveBeenLastCalledWith("d1", { page: 2, search: "" });
    // All rows loaded — the control disappears rather than offering an empty next page.
    expect(screen.queryByRole("button", { name: "Cargar más" })).not.toBeInTheDocument();
  });
});

describe("DevotionalViewersPanel — search", () => {
  it("debounces typing, then re-fetches page 1 under the new term (replacing, not appending, rows)", async () => {
    getDevotionalViewersMock.mockResolvedValueOnce({
      ok: true,
      data: { rows: [viewer({ userId: "u1", displayName: "Juan Perez" })], total: 1, page: 1, pageSize: 20 },
    });
    renderPanel({ initialCount: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Ver quiénes lo vieron" }));
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());

    getDevotionalViewersMock.mockResolvedValueOnce({
      ok: true,
      data: { rows: [viewer({ userId: "u2", displayName: "Maria Gonzalez" })], total: 1, page: 1, pageSize: 20 },
    });
    fireEvent.change(screen.getByPlaceholderText("Buscar persona…"), { target: { value: "maria" } });

    await waitFor(
      () => expect(getDevotionalViewersMock).toHaveBeenLastCalledWith("d1", { page: 1, search: "maria" }),
      { timeout: 1000 }
    );
    await waitFor(() => expect(screen.getByText("Maria Gonzalez")).toBeInTheDocument());
    expect(screen.queryByText("Juan Perez")).not.toBeInTheDocument(); // replaced, not appended
  });
});

describe("DevotionalViewersPanel — closing", () => {
  it("Escape closes the panel and returns focus to the trigger", async () => {
    getDevotionalViewersMock.mockResolvedValue({ ok: true, data: { rows: [], total: 0, page: 1, pageSize: 20 } });
    renderPanel();
    const trigger = screen.getByRole("button", { name: "Ver quiénes lo vieron" });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("clicking the backdrop closes the panel", async () => {
    getDevotionalViewersMock.mockResolvedValue({ ok: true, data: { rows: [], total: 0, page: 1, pageSize: 20 } });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Ver quiénes lo vieron" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("devotional-viewers-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("DevotionalViewersPanel — privacy", () => {
  it("never renders the raw userId (a Supabase UUID) as visible text — only the resolved display name", async () => {
    getDevotionalViewersMock.mockResolvedValue({
      ok: true,
      data: { rows: [viewer({ userId: "550e8400-e29b-41d4-a716-446655440000", displayName: "Juan Perez" })], total: 1, page: 1, pageSize: 20 },
    });
    renderPanel({ initialCount: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Ver quiénes lo vieron" }));
    await waitFor(() => expect(screen.getByText("Juan Perez")).toBeInTheDocument());
    expect(screen.queryByText(/550e8400/)).not.toBeInTheDocument();
  });

  it("shows the view count badge only when a person opened it more than once", async () => {
    getDevotionalViewersMock.mockResolvedValue({
      ok: true,
      data: {
        rows: [
          viewer({ userId: "u1", displayName: "Una vez", viewCount: 1 }),
          viewer({ userId: "u2", displayName: "Varias veces", viewCount: 3 }),
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    });
    renderPanel({ initialCount: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Ver quiénes lo vieron" }));
    await waitFor(() => expect(screen.getByText("Varias veces")).toBeInTheDocument());

    expect(screen.getByText("Visto 3 veces")).toBeInTheDocument();
    expect(screen.queryByText("Visto 1 vez")).not.toBeInTheDocument();
  });
});
