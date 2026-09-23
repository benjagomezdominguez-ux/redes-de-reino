import type { Variants, Transition } from "motion/react";

// One shared rhythm for the whole site — every entrance animation uses
// the same easing/duration family so motion feels like one coherent
// system rather than a grab-bag of effects per component. Values are
// tuned toward "premium but calm": long enough to read as considered,
// short enough to never make anyone wait.
export const easeOut: Transition["ease"] = [0.16, 1, 0.3, 1];

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeOut },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8, ease: easeOut } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.7, ease: easeOut },
  },
};

// Container for any grid/list whose children should reveal in sequence
// rather than all at once — the difference between a page that "arrives"
// and one that just pops in.
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

export const staggerItem: Variants = fadeInUp;
