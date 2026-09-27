/**
 * Chart colour.
 *
 * These six hues are not hand-picked to taste — they were run through the
 * palette validator against this app's card surface (#FBF8F3) and clear the
 * lightness band, the chroma floor, colour-vision separation (worst adjacent
 * pair ΔE 17.3 protan) and the normal-vision floor (ΔE 26.7). They are more
 * saturated than the interface accents on purpose: they only ever appear as
 * thin ribbons and small legend dots, never as large blocks, so the page stays
 * warm and quiet while the marks stay tellable apart.
 *
 * Three slots sit under 3:1 contrast on the light surface, which is allowed
 * only because every segment carries a visible direct label and the page also
 * ships the full transaction table.
 *
 * Dark mode is a separate set of steps, re-validated against the dark surface
 * rather than lightened from these — see `tokens.css`. Both are expressed as
 * custom properties, so the marks re-theme without a single component knowing
 * which theme is on.
 */

import type { Group } from '@/lib/grouping'

export const CATEGORICAL = [
  'var(--cat-1)', // green
  'var(--cat-2)', // gold
  'var(--cat-3)', // blue
  'var(--cat-4)', // terracotta
  'var(--cat-5)', // violet
  'var(--cat-6)', // teal
] as const

/** The tail bucket. Deliberately neutral — "Other" is not an identity. */
export const OTHER = 'var(--cat-other)'

/** Polarity pair for the cash-flow chart. Direction from the baseline is the
 *  primary encoding; colour is the secondary one. */
export const INFLOW = 'var(--inflow)'
export const OUTFLOW = 'var(--outflow)'

export const MAX_SLICES = 6

export interface Slice {
  key: string
  label: string
  total: number
  share: number
  color: string
  count: number
  isOther: boolean
}

/**
 * Rank groups by size for reading order, but assign colour by *age* so a
 * category keeps its hue when the amounts move. Only a change in which
 * categories are visible at all can repaint anything.
 *
 * `offset` rotates the starting slot. The two panels sit side by side, so
 * spending starts three hues along and the reader never has to wonder whether
 * the green on the left means the same thing as the green on the right. The
 * rotated order was re-validated: worst adjacent pair ΔE 17.3 protan.
 */
export function toSlices(groups: Group[], offset = 0): Slice[] {
  if (!groups.length) return []

  const ranked = [...groups].sort((a, b) => b.total - a.total)
  const head = ranked.slice(0, MAX_SLICES)
  const tail = ranked.slice(MAX_SLICES)

  const byAge = [...head].sort((a, b) => a.firstSeen - b.firstSeen)
  const slot = new Map(byAge.map((g, i) => [g.key, i]))

  const grand = ranked.reduce((sum, g) => sum + g.total, 0) || 1

  const slices: Slice[] = head.map((g) => ({
    key: g.key,
    label: g.label,
    total: g.total,
    share: g.total / grand,
    color: CATEGORICAL[((slot.get(g.key) ?? 0) + offset) % CATEGORICAL.length],
    count: g.count,
    isOther: false,
  }))

  if (tail.length) {
    const total = tail.reduce((sum, g) => sum + g.total, 0)
    slices.push({
      key: '__other',
      label: `${tail.length} more`,
      total,
      share: total / grand,
      color: OTHER,
      count: tail.reduce((sum, g) => sum + g.count, 0),
      isOther: true,
    })
  }

  return slices
}
