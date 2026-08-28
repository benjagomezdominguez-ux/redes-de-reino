import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "../../../messages/es.json";
import {
  CinematicGallery,
  AUTOPLAY_INTERVAL_MS,
  TRANSITION_DURATION_MS,
} from "./CinematicGallery";
import type { GalleryImage } from "@/lib/site-config";

const fourImages: GalleryImage[] = [
  { src: "/gallery-1.jpg" },
  { src: "/gallery-2.jpg" },
  { src: "/gallery-3.jpg" },
  { src: "/gallery-4.jpg" },
];

function renderGallery(images: GalleryImage[]) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <CinematicGallery images={images} />
    </NextIntlClientProvider>
  );
}

function activeSlideIndex(container: HTMLElement) {
  const dots = container.querySelectorAll('button[aria-current]');
  return Array.from(dots).findIndex((dot) => dot.getAttribute("aria-current") === "true");
}

describe("CinematicGallery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the first image on mount", () => {
    const { container } = renderGallery(fourImages);
    expect(activeSlideIndex(container)).toBe(0);
  });

  it("advances 1 -> 2 -> 3 -> 4 -> 1 every AUTOPLAY_INTERVAL_MS, indefinitely", () => {
    const { container } = renderGallery(fourImages);

    const expected = [1, 2, 3, 0, 1, 2]; // two full cycles, confirms it keeps going
    for (const expectedIndex of expected) {
      act(() => {
        vi.advanceTimersByTime(AUTOPLAY_INTERVAL_MS);
      });
      expect(activeSlideIndex(container)).toBe(expectedIndex);
    }
  });

  it("renders without throwing across several autoplay transitions", () => {
    expect(() => {
      renderGallery(fourImages);
      act(() => {
        vi.advanceTimersByTime(AUTOPLAY_INTERVAL_MS * 6);
      });
    }).not.toThrow();
  });

  it("clicking an indicator jumps directly to that slide", async () => {
    vi.useRealTimers();
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    const { container } = renderGallery(fourImages);

    const dots = container.querySelectorAll('button[aria-current]');
    await user.click(dots[2]);
    expect(activeSlideIndex(container)).toBe(2);
  });

  it("renders a labeled placeholder when a slide has no photo yet", () => {
    renderGallery([{ src: null }, { src: null }, { src: null }, { src: null }]);
    expect(screen.getAllByText("Fotografía próximamente").length).toBeGreaterThan(0);
  });

  it("uses a full-width, viewport-height-based container instead of a fixed pixel width, avoiding horizontal overflow", () => {
    const { container } = renderGallery(fourImages);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/w-full/);
    expect(root.className).toMatch(/h-\[70vh\]/);
  });

  it("disables the crossfade transition under prefers-reduced-motion while still cycling images", () => {
    const { container } = renderGallery(fourImages);
    const slides = container.querySelectorAll(":scope > div > div[aria-hidden]");
    for (const slide of slides) {
      expect(slide.className).toMatch(/motion-reduce:transition-none/);
    }

    // The interval itself doesn't depend on motion preference — only the
    // CSS transition does — so slides still advance.
    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_INTERVAL_MS);
    });
    expect(activeSlideIndex(container)).toBe(1);
  });

  it("transition duration matches the centralized TRANSITION_DURATION_MS constant", () => {
    const { container } = renderGallery(fourImages);
    const activeSlide = container.querySelector('div[aria-hidden="false"]') as HTMLElement;
    expect(activeSlide.style.transitionDuration).toBe(`${TRANSITION_DURATION_MS}ms`);
  });
});
