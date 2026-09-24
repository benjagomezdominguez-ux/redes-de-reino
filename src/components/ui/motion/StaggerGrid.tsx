"use client";

import { Children } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { staggerContainer, staggerItem } from "@/lib/motion/variants";
import { useSafeReducedMotion } from "@/lib/motion/use-safe-reduced-motion";

// Wraps an already-rendered grid of cards (Server Components — Pastors,
// MeetingSchedule, BookCard, InstallGuide's device cards) so each one
// enters in sequence on scroll, without touching the cards' own markup.
// Each top-level child becomes its own animated item; the grid/flex
// classes that used to sit on the plain wrapper move here unchanged.
//
// data-avoid-fab defaults to "true" here (not opt-in per section): every
// StaggerGrid is, by definition, a grid of cards a visitor scrolls
// through, which is exactly the content PastorChatFloatingButton.tsx
// needs to avoid covering. Marking it per-consumer instead once let the
// Libros grid go unmarked and get missed — the button visibly sat on a
// book cover there while Horarios/Pastores were already fixed. Callers
// can still pass their own `data-avoid-fab` to override.
export function StaggerGrid({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & Record<`data-${string}`, string>) {
  const reduceMotion = useSafeReducedMotion();
  const props = { "data-avoid-fab": "true", ...rest };

  if (reduceMotion) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      {...props}
    >
      {Children.map(children, (child) => (
        // flex + h-full stretches this wrapper to the grid row's full
        // height (a CSS Grid item's cross-axis default) — but the actual
        // card inside it is a flex ITEM of this wrapper's row-direction
        // flex container, and a flex item's *main* axis (width, here)
        // does NOT stretch by default the way the cross axis (height)
        // does: with flex-grow:0 and no explicit width, a card sizes to
        // its own content instead of filling the column. That was a real,
        // previously-undetected bug — none of Horarios/Pastores/
        // InstallGuide's card components set `w-full` themselves, so
        // e.g. a short "Bases" card rendered visibly narrower than a
        // long "Reunión General" one in the very same 3-column row
        // (measured live: 182px vs 241px in a 272px column). Libros
        // happened to look fine only by accident — a cover photo's own
        // large intrinsic width forced the shrink-to-fit calculation up
        // to the column's full width anyway.
        //
        // [&>*]:w-full forces the direct child (whatever card component
        // it is) to 100% width here, at the one shared wrapper, rather
        // than requiring every current and future StaggerGrid consumer
        // to remember `w-full` on its own card markup.
        <motion.div variants={staggerItem} className="flex h-full [&>*]:w-full">
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
