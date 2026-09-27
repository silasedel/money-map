/**
 * Forward-looking figures.
 *
 * Nothing here asks for new input. Runway, committed costs and the month-end
 * projection all fall out of entries that already exist — the point is to turn
 * a record of what happened into a read on what happens next. Declared
 * subscriptions are the one exception: you told the app about those, so they
 * take precedence over anything it merely inferred.
 */

import { groupTransactions } from './grouping'
import { isoOf, parseISO } from './format'
import type { Cadence, Subscription, Transaction } from './types'
import { currentMonthKey, type Totals } from './finance'
import {
  CADENCES,
  advanceDate,
  cadenceLabel as cadenceLabelOf,
  coveredBy,
  nextDue,
  perMonth,
} from './subscriptions'

export type { Cadence }

/* ── Recurring detection ──────────────────────────────── */

const BANDS: Record<Cadence, { lo: number; hi: number }> = {
  weekly: { lo: 6, hi: 8.5 },
  biweekly: { lo: 12, hi: 17 },
  monthly: { lo: 25, hi: 38 },
  quarterly: { lo: 80, hi: 100 },
  yearly: { lo: 330, hi: 400 },
}

export interface Recurring {
  key: string
  label: string
  /** The most-typed raw title in the group — what a tracked subscription is named. */
  title: string
  kind: 'income' | 'expense'
  cadence: Cadence
  /** The typical amount, as a median — one odd month can't skew it. */
  typical: number
  /** Normalised to a monthly figure so different cadences can be summed. */
  perMonth: number
  nextDate: string
  occurrences: number
  /** How tightly the amounts agree, 0–1. */
  confidence: number
  /** Where this came from: declared by you, or spotted in the ledger. */
  source: 'subscription' | 'detected'
  subscription?: Subscription
}

const DAY = 86_400_000

function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * A group is recurring when its entries land at a consistent interval. Two
 * occurrences are enough to suspect it; three make it reliable, so anything
 * with only two has to agree closely on both timing and amount.
 */
export function detectRecurring(transactions: Transaction[]): Recurring[] {
  const out: Recurring[] = []

  for (const kind of ['income', 'expense'] as const) {
    const groups = groupTransactions(transactions.filter((t) => t.kind === kind))

    for (const g of groups) {
      if (g.count < 2) continue

      const dates = g.transactions
        .map((t) => parseISO(t.date).getTime())
        .sort((a, b) => a - b)

      const gaps: number[] = []
      for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / DAY)
      const gap = median(gaps)

      const cadence = CADENCES.find((c) => gap >= BANDS[c.name].lo && gap <= BANDS[c.name].hi)
      if (!cadence) continue
      const band = BANDS[cadence.name]

      // Every gap has to be in the same band — a couple of coincidental
      // same-month purchases shouldn't read as a subscription.
      const consistent = gaps.every((d) => d >= band.lo * 0.75 && d <= band.hi * 1.25)
      if (!consistent) continue

      const amounts = g.transactions.map((t) => t.amount)
      const typical = median(amounts)
      if (typical <= 0) continue

      const spread =
        amounts.reduce((sum, a) => sum + Math.abs(a - typical), 0) /
        (amounts.length * typical)
      const confidence = Math.max(0, Math.min(1, 1 - spread * 1.6))

      // Two data points and shaky amounts is a guess, not a pattern.
      if (g.count === 2 && confidence < 0.72) continue
      if (confidence < 0.42) continue

      const last = dates[dates.length - 1]
      const counts = new Map<string, number>()
      for (const t of g.transactions) counts.set(t.title.trim(), (counts.get(t.title.trim()) ?? 0) + 1)
      const title = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? g.label
      out.push({
        key: g.key,
        label: g.label,
        title,
        kind,
        cadence: cadence.name,
        typical,
        perMonth: (typical * cadence.perYear) / 12,
        nextDate: isoOf(new Date(last + cadence.days * DAY)),
        occurrences: g.count,
        confidence,
        source: 'detected',
      })
    }
  }

  return out.sort((a, b) => b.perMonth - a.perMonth)
}

/**
 * Everything that repeats: tracked subscriptions first, then any detected
 * rhythm that isn't already one of them. This is the list Outlook projects
 * from and the list Subscriptions offers to track.
 */
export function commitments(
  transactions: Transaction[],
  subscriptions: Subscription[],
): Recurring[] {
  const declared: Recurring[] = subscriptions
    .filter((s) => s.status === 'active')
    .map((s) => ({
      key: `sub:${s.id}`,
      label: s.title,
      title: s.title,
      kind: s.kind,
      cadence: s.cadence,
      typical: s.amount,
      perMonth: perMonth(s.amount, s.cadence),
      nextDate: nextDue(s),
      occurrences: 0,
      confidence: 1,
      source: 'subscription',
      subscription: s,
    }))

  const detected = detectRecurring(transactions).filter((r) => !tracked(subscriptions, r))

  return [...declared, ...detected].sort((a, b) => b.perMonth - a.perMonth)
}

/** Detected rhythms not yet tracked — the Subscriptions page's suggestions. */
export function suggestions(
  transactions: Transaction[],
  subscriptions: Subscription[],
): Recurring[] {
  return detectRecurring(transactions).filter((r) => !tracked(subscriptions, r))
}

/** A detected rhythm is covered if a subscription matches its title or its group. */
function tracked(subs: Subscription[], r: Recurring): boolean {
  return Boolean(coveredBy(subs, r.title, r.kind) || coveredBy(subs, r.label, r.kind))
}

/* ── Month-to-date pace ───────────────────────────────── */

export interface Pace {
  dayOfMonth: number
  daysInMonth: number
  income: number
  spend: number
  projectedIncome: number
  projectedSpend: number
  projectedNet: number
  /** Committed but not yet paid this month. */
  dueIn: number
  dueOut: number
  /** How the projection was reached — the page says which, because they differ. */
  basis: 'scheduled' | 'straight-line'
}

/**
 * Project the month.
 *
 * Straight-line extrapolation is wrong for most people's money: income arrives
 * in a few lumps rather than trickling in daily, so on the 14th a salary that
 * landed on the 4th would project to two salaries. Instead we take what has
 * actually happened and add only what is still genuinely due — the recurring
 * items whose next occurrence falls in the remainder of this month. Straight
 * line is the fallback for when nothing has established a rhythm yet.
 */
export function monthPace(
  transactions: Transaction[],
  recurring: Recurring[] = [],
): Pace {
  const now = new Date()
  const key = currentMonthKey()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const monthEnd = isoOf(new Date(now.getFullYear(), now.getMonth(), daysInMonth))
  const today = isoOf(now)

  let income = 0
  let spend = 0
  for (const t of transactions) {
    if (t.date.slice(0, 7) !== key) continue
    if (t.kind === 'income') income += t.amount
    else spend += t.amount
  }

  let dueIn = 0
  let dueOut = 0
  for (const r of recurring) {
    // Walk forward from the next expected date, catching weekly items that
    // still have several occurrences left before the month is out.
    let at = r.nextDate
    let guard = 0
    while (at <= monthEnd && guard++ < 8) {
      if (at > today) {
        if (r.kind === 'income') dueIn += r.typical
        else dueOut += r.typical
      }
      at = advanceDate(at, r.cadence)
    }
  }

  const useSchedule = recurring.length > 0
  const scale = daysInMonth / Math.max(dayOfMonth, 1)

  const projectedIncome = useSchedule ? income + dueIn : income * scale
  const projectedSpend = useSchedule ? spend + dueOut : spend * scale

  return {
    dayOfMonth,
    daysInMonth,
    income,
    spend,
    projectedIncome,
    projectedSpend,
    projectedNet: projectedIncome - projectedSpend,
    dueIn,
    dueOut,
    basis: useSchedule ? 'scheduled' : 'straight-line',
  }
}

/* ── Runway & savings rate ────────────────────────────── */

export interface Outlook {
  /** Average monthly spend over the observed months. */
  burn: number
  /** Months of savings at that burn. `Infinity` when nothing is going out. */
  runwayMonths: number
  /** When savings would reach zero, ISO — null if that never happens. */
  runsOutOn: string | null
  /** Share of income kept, 0–1. */
  savingsRate: number
  monthsObserved: number
}

export function computeOutlook(
  transactions: Transaction[],
  totals: Totals,
): Outlook {
  const months = new Set<string>()
  for (const t of transactions) months.add(t.date.slice(0, 7))
  const monthsObserved = Math.max(months.size, 1)

  const burn = totals.spent / monthsObserved
  const runwayMonths = burn > 0 ? totals.savings / burn : Infinity

  let runsOutOn: string | null = null
  if (Number.isFinite(runwayMonths) && runwayMonths > 0) {
    const d = new Date()
    d.setMonth(d.getMonth() + Math.floor(runwayMonths))
    d.setDate(d.getDate() + Math.round((runwayMonths % 1) * 30))
    runsOutOn = isoOf(d)
  }

  return {
    burn,
    runwayMonths,
    runsOutOn,
    savingsRate: totals.earned > 0 ? totals.savings / totals.earned : 0,
    monthsObserved,
  }
}

export const cadenceLabel = cadenceLabelOf
