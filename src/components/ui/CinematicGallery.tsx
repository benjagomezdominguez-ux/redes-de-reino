"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { GalleryImage } from "@/lib/site-config";
import { site } from "@/lib/site-config";

// Centralized so the timing/feel can be tuned from one place.
export const AUTOPLAY_INTERVAL_MS = 10_000;
export const TRANSITION_DURATION_MS = 1200;

export function CinematicGallery({ images }: { images: GalleryImage[] }) {
  const t = useTranslations("gallery");
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused || images.length <= 1) return;

    const id = setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, AUTOPLAY_INTERVAL_MS);

    return () => clearInterval(id);
  }, [paused, images.length]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative h-[70vh] max-h-[820px] min-h-[420px] w-full overflow-hidden rounded-2xl bg-primary-900 shadow-lifted"
    >
      {images.map((image, index) => {
        const isActive = index === activeIndex;
        return (
          <div
            key={index}
            aria-hidden={!isActive}
            className="absolute inset-0 transition-opacity ease-in-out motion-reduce:transition-none"
            style={{
              opacity: isActive ? 1 : 0,
              transitionDuration: `${TRANSITION_DURATION_MS}ms`,
              zIndex: isActive ? 1 : 0,
            }}
          >
            {image.src ? (
              <Image
                src={image.src}
                alt={t("imageAlt", { index: index + 1, name: site.name })}
                fill
                sizes="100vw"
                priority={index === 0}
                className="object-cover"
                style={{ objectPosition: image.objectPosition ?? "center" }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,_var(--color-primary-700)_0%,_transparent_55%)]">
                <span className="text-sm font-medium uppercase tracking-[0.18em] text-white/50">
                  {t("pending")}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {images.length > 1 ? (
        <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={t("goToSlide", { index: index + 1 })}
              aria-current={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={`h-2 w-2 rounded-full transition-colors duration-200 ${
                index === activeIndex ? "bg-secondary-400" : "bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
