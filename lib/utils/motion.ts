import { Transition, Variants } from 'framer-motion';

/**
 * Standardized Spring Physics Presets
 * Linear / Stripe standard animations (snappy, responsive, zero wobble)
 */
export const springSmooth: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 30,
};

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 450,
  damping: 35,
};

export const tabIndicatorTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 32,
};

/**
 * Modal Backdrop Fade In / Out
 */
export const modalBackdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: 'easeIn' } },
};

/**
 * Modal Content Spring Scale & Slide Up
 */
export const modalContentVariants: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: springSmooth,
  },
  exit: { 
    opacity: 0, 
    scale: 0.96, 
    y: 8,
    transition: { duration: 0.12, ease: 'easeIn' },
  },
};

/**
 * Slide-in Drawer (from Right edge)
 */
export const drawerVariants: Variants = {
  initial: { opacity: 0, x: '100%' },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: springSmooth,
  },
  exit: { 
    opacity: 0, 
    x: '100%',
    transition: { duration: 0.18, ease: 'easeInOut' },
  },
};

/**
 * Staggered Feed / List Container
 */
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

/**
 * Individual Staggered Feed Item
 */
export const staggerItemVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.22, ease: 'easeOut' },
  },
};
