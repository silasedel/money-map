import { useReducedMotion } from 'framer-motion'
import type { Transition } from 'framer-motion'
import { useStore } from './store'

/**
 * One vocabulary of springs for the whole app. Reusing these is what makes
 * unrelated surfaces feel like they belong to the same physical world.
 */
export const spring = {
  /** Buttons, hovers, small state flips. Quick, barely overshoots. */
  snap: { type: 'spring', stiffness: 520, damping: 32, mass: 0.6 },
  /** Panels, page transitions, layout shifts. Calm and settled. */
  calm: { type: 'spring', stiffness: 280, damping: 30, mass: 0.9 },
  /** Things that should feel weighted and physical — bubbles, cards. */
  body: { type: 'spring', stiffness: 380, damping: 26, mass: 0.85 },
  /** Deliberate overshoot. Use sparingly: entrances, drops, celebrations. */
  bouncy: { type: 'spring', stiffness: 440, damping: 17, mass: 0.9 },
  /** Long travel that shouldn't wobble — progress bars, sheets. */
  glide: { type: 'spring', stiffness: 160, damping: 24, mass: 1 },
} satisfies Record<string, Transition>

export const easeOut: Transition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
export const easeQuick: Transition = { duration: 0.16, ease: [0.22, 1, 0.36, 1] }

/** Standard entrance for stacked content: settle upward, never slide far. */
export const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

export const popIn = {
  initial: { opacity: 0, scale: 0.94, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 2 },
}

/** Stagger helper — index-based delay that tapers so long lists stay snappy. */
export const stagger = (i: number, step = 0.035, cap = 8) =>
  Math.min(i, cap) * step

/**
 * Whether motion should be calmed.
 *
 * `MotionConfig` covers everything framer animates, but the mind map runs two
 * springs of its own — the bubble tilt and the elastic on connections — and
 * those would keep bouncing for someone who asked for stillness. Anything
 * hand-rolled has to consult this.
 *
 * Choosing "Full" defers to the OS rather than overriding it; only an explicit
 * "Reduced" forces the issue.
 */
export function useCalmMotion(): boolean {
  const choice = useStore((s) => s.settings.motion)
  const system = useReducedMotion()
  return choice === 'reduced' || Boolean(system)
}
