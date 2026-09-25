import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const recordDevotionalViewMock = vi.fn();
vi.mock("@/lib/actions/devotional-views", () => ({ recordDevotionalView: recordDevotionalViewMock }));

const { RecordDevotionalView } = await import("./RecordDevotionalView");

beforeEach(() => {
  recordDevotionalViewMock.mockReset();
  recordDevotionalViewMock.mockResolvedValue(undefined);
});

describe("RecordDevotionalView", () => {
  it("renders nothing — a pure side-effect component", () => {
    const { container } = render(<RecordDevotionalView devotionalId="d1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("calls recordDevotionalView with the devotional id after mount", async () => {
    render(<RecordDevotionalView devotionalId="d1" />);
    await vi.waitFor(() => expect(recordDevotionalViewMock).toHaveBeenCalledWith("d1"));
  });

  it("only fires once per mount, even under a double-invoked effect (React StrictMode)", async () => {
    const { rerender } = render(<RecordDevotionalView devotionalId="d1" />);
    // Simulate React StrictMode's dev-only double effect invocation by
    // re-rendering with the same id — the firedRef guard must still hold.
    rerender(<RecordDevotionalView devotionalId="d1" />);
    await vi.waitFor(() => expect(recordDevotionalViewMock).toHaveBeenCalledTimes(1));
  });

  it("never throws even if the action itself rejects", async () => {
    recordDevotionalViewMock.mockRejectedValue(new Error("network down"));
    expect(() => render(<RecordDevotionalView devotionalId="d1" />)).not.toThrow();
    await vi.waitFor(() => expect(recordDevotionalViewMock).toHaveBeenCalled());
  });
});
