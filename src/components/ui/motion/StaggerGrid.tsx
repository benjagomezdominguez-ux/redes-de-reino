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
export function StaggerGrid({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & Record<`data-${string}`, string>) {
  const reduceMotion = useSafeReducedMotion();

  if (reduceMotion) {
    return (
      <div className={className} {...rest}>
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
      {...rest}
    >
      {Children.map(children, (child) => (
        // flex + h-full: a grid item stretches to the row's height by
        // default, but that stretch would otherwise stop at this
        // wrapper — cards that rely on filling their cell (BookCard's
        // mt-auto-pinned buy button) need the actual card to inherit
        // that height too, not just the wrapper around it.
        <motion.div variants={staggerItem} className="flex h-full">
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
