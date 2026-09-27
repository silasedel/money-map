/**
 * Subscriptions and other commitments.
 *
 * A subscription is declared, not inferred: you say "Netflix, $15.49, monthly,
 * next on the 12th" and the app holds you to it. Payments are still ordinary
 * ledger entries — logging one from a subscription just fills the form in and
 * advances the next date — so every chart keeps reading from one record.
 */

import { isoOf, parseISO, todayISO } from './format'
import { normalize, similarity } from './grouping'
import type { Cadence, Subscription, Transaction, TxKind } from './types'

export const CADENCES: {
  name: Cadence
  label: string
  short: string
  days: number
  perYear: number
}[] = [
  { name: 'weekly', label: 'Weekly', short: '/wk', days: 7, perYear: 52 },
  { name: 'biweekly', label: 'Every 2 weeks', short: '/2wk', days: 14, perYear: 26 },
  { name: 'monthly', label: 'Monthly', short: '/mo', days: 30.4, perYear: 12 },
  { name: 'quarterly', label: 'Quarterly', short: '/qtr', days: 91, perYear: 4 },
  { name: 'yearly', label: 'Yearly', short: '/yr', days: 365, perYear: 1 },
]

const cadenceOf = (c: Cadence) => CADENCES.find((x) => x.name === c) ?? CADENCES[2]

export const cadenceLabel = (c: Cadence) => cadenceOf(c).label
export const cadenceShort = (c: Cadence) => cadenceOf(c).short

/** Normalise any cadence to a monthly figure so different ones can be summed. */
export const perMonth = (amount: number, c: Cadence) => (amount * cadenceOf(c).perYear) / 12
export const perYear = (amount: number, c: Cadence) => amount * cadenceOf(c).perYear

/**
 * Step a date forward by one cadence. Month-based cadences stay on the same
 * day of month (clamped, so the 31st becomes the 30th in a shorter month)
 * rather than drifting by 30.4 days.
 */
export function advanceDate(iso: string, c: Cadence, steps = 1): string {
  const d = parseISO(iso)
  switch (c) {
    case 'weekly':
      d.setDate(d.getDate() + 7 * steps)
      break
    case 'biweekly':
      d.setDate(d.getDate() + 14 * steps)
      break
    case 'monthly':
    case 'quarterly':
    case 'yearly': {
      const months = c === 'monthly' ? 1 : c === 'quarterly' ? 3 : 12
      const day = d.getDate()
      d.setDate(1)
      d.setMonth(d.getMonth() + months * steps)
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      d.setDate(Math.min(day, last))
    }
  }
  return isoOf(d)
}

/** The next occurrence on or after today — a stale anchor is walked forward. */
export function nextDue(sub: Subscription, today = todayISO()): string {
  let at = sub.nextDate
  let guard = 0
  while (at < today && guard++ < 600) at = advanceDate(at, sub.cadence)
  return at
}

/** Whole days until the next occurrence. Negative when overdue. */
export function daysUntil(iso: string, today = todayISO()): number {
  return Math.round((parseISO(iso).getTime() - parseISO(today).getTime()) / 86_400_000)
}

/* ── Matching payments ────────────────────────────────── */

const MATCH = 0.58

/** Entries that look like payments of this subscription, newest first. */
export function paymentsOf(sub: Subscription, txs: Transaction[]): Transaction[] {
  const seed = normalize(sub.title)
  return txs
    .filter(
      (t) =>
        t.kind === sub.kind &&
        (t.subscriptionId === sub.id ||
          (!t.subscriptionId && similarity(normalize(t.title), seed) >= MATCH)),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function lastPaid(sub: Subscription, txs: Transaction[]): Transaction | undefined {
  return paymentsOf(sub, txs)[0]
}

/* ── Rollups ──────────────────────────────────────────── */

export interface SubscriptionTotals {
  active: number
  paused: number
  /** Monthly-equivalent outflow across active expense subscriptions. */
  monthlyOut: number
  monthlyIn: number
  yearlyOut: number
  yearlyIn: number
}

export function subscriptionTotals(subs: Subscription[]): SubscriptionTotals {
  const out: SubscriptionTotals = {
    active: 0,
    paused: 0,
    monthlyOut: 0,
    monthlyIn: 0,
    yearlyOut: 0,
    yearlyIn: 0,
  }
  for (const s of subs) {
    if (s.status === 'cancelled') continue
    if (s.status === 'paused') {
      out.paused++
      continue
    }
    out.active++
    const m = perMonth(s.amount, s.cadence)
    const y = perYear(s.amount, s.cadence)
    if (s.kind === 'expense') {
      out.monthlyOut += m
      out.yearlyOut += y
    } else {
      out.monthlyIn += m
      out.yearlyIn += y
    }
  }
  return out
}

export interface Upcoming {
  sub: Subscription
  date: string
  days: number
}

/** Every active occurrence in the next `days` days, soonest first. */
export function upcoming(subs: Subscription[], days = 30, today = todayISO()): Upcoming[] {
  const horizon = parseISO(today)
  horizon.setDate(horizon.getDate() + days)
  const limit = isoOf(horizon)

  const out: Upcoming[] = []
  for (const s of subs) {
    if (s.status !== 'active') continue
    let at = nextDue(s, today)
    let guard = 0
    while (at <= limit && guard++ < 12) {
      out.push({ sub: s, date: at, days: daysUntil(at, today) })
      at = advanceDate(at, s.cadence)
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || b.sub.amount - a.sub.amount)
}

/**
 * Committed money still to come between today and the end of the month —
 * what the Outlook projection adds to what has already happened.
 */
export function dueThisMonth(
  subs: Subscription[],
  today = todayISO(),
): { income: number; expense: number } {
  const d = parseISO(today)
  const end = isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0))
  let income = 0
  let expense = 0
  for (const s of subs) {
    if (s.status !== 'active') continue
    let at = nextDue(s, today)
    let guard = 0
    while (at <= end && guard++ < 8) {
      if (at > today) {
        if (s.kind === 'income') income += s.amount
        else expense += s.amount
      }
      at = advanceDate(at, s.cadence)
    }
  }
  return { income, expense }
}

/** Whether a detected recurring pattern is already covered by a tracked subscription. */
export function coveredBy(
  subs: Subscription[],
  label: string,
  kind: TxKind,
): Subscription | undefined {
  const seed = normalize(label)
  return subs.find(
    (s) => s.status !== 'cancelled' && s.kind === kind && similarity(normalize(s.title), seed) >= MATCH,
  )
}
