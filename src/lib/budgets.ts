/**
 * Budgets.
 *
 * A budget is a limit on a derived group — nothing new to categorise, you just
 * put a ceiling on something the ledger already knows about. Everything here
 * is recomputed from entries on every read, so a budget can't fall out of
 * sync with the spending it watches.
 */

import { groupTransactions } from './grouping'
import { isoOf, todayISO } from './format'
import type { Budget, Transaction } from './types'

export type BudgetState = 'ok' | 'ahead' | 'warn' | 'over'

export interface BudgetStatus {
  budget: Budget
  label: string
  spent: number
  limit: number
  remaining: number
  /** spent / limit, unclamped. */
  ratio: number
  /** How far through the period we are, 0–1. */
  elapsed: number
  /** What you'd have spent by now at an even pace. */
  expected: number
  state: BudgetState
  count: number
  /** Spend per remaining day that would land exactly on the limit. */
  dailyAllowance: number
  daysLeft: number
}

export const ALL_LABEL = 'Everything'

const keyOf = (s: string | undefined) => (s ?? '').trim().toLowerCase()

/**
 * Window for a budget: the month (`YYYY-MM`) or the year (`YYYY`) that holds
 * `on`. Monthly budgets are judged in a month; yearly ones across the year.
 */
function windowOf(period: Budget['period'], on: string) {
  const [y, m] = on.split('-').map(Number)
  if (period === 'yearly') {
    return {
      prefix: `${y}`,
      start: `${y}-01-01`,
      end: `${y}-12-31`,
      days: isLeap(y) ? 366 : 365,
    }
  }
  const days = new Date(y, m, 0).getDate()
  return {
    prefix: on.slice(0, 7),
    start: `${on.slice(0, 7)}-01`,
    end: `${on.slice(0, 7)}-${`${days}`.padStart(2, '0')}`,
    days,
  }
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

function dayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(new Date(y, m - 1, d).getTime() / 86_400_000)
}

/**
 * Evaluate every budget against the window that contains `on` (today by
 * default — pass another month to look back). `elapsed` only advances while
 * the window is current: a past month is 100% elapsed, a future one 0%.
 */
export function budgetStatuses(
  budgets: Budget[],
  txs: Transaction[],
  on = todayISO(),
): BudgetStatus[] {
  if (!budgets.length) return []
  const today = todayISO()

  return budgets
    .map((b) => {
      const win = windowOf(b.period, on)
      const inWindow = txs.filter(
        (t) => t.kind === 'expense' && t.date.startsWith(win.prefix),
      )

      let matched: Transaction[]
      let label: string
      if (!b.group) {
        matched = inWindow
        label = ALL_LABEL
      } else {
        const want = keyOf(b.group)
        // Groups are derived from the whole ledger so a month with one entry
        // still files it where the rest of the year does.
        const groups = groupTransactions(txs.filter((t) => t.kind === 'expense'))
        const g = groups.find((x) => keyOf(x.label) === want)
        const ids = new Set(g?.transactions.map((t) => t.id) ?? [])
        matched = inWindow.filter((t) => ids.has(t.id))
        label = g?.label ?? b.group
      }

      const spent = matched.reduce((s, t) => s + t.amount, 0)
      const limit = b.limit
      const ratio = limit > 0 ? spent / limit : 0

      let elapsed: number
      let daysLeft: number
      if (today < win.start) {
        elapsed = 0
        daysLeft = win.days
      } else if (today > win.end) {
        elapsed = 1
        daysLeft = 0
      } else {
        const gone = dayIndex(today) - dayIndex(win.start) + 1
        elapsed = gone / win.days
        daysLeft = win.days - gone + 1
      }

      const expected = limit * elapsed
      const remaining = limit - spent

      let state: BudgetState = 'ok'
      if (ratio >= 1) state = 'over'
      else if (ratio >= 0.85) state = 'warn'
      else if (elapsed > 0.15 && spent > expected * 1.15) state = 'ahead'

      return {
        budget: b,
        label,
        spent,
        limit,
        remaining,
        ratio,
        elapsed,
        expected,
        state,
        count: matched.length,
        dailyAllowance: daysLeft > 0 ? Math.max(remaining, 0) / daysLeft : 0,
        daysLeft,
      }
    })
    .sort((a, b) => {
      // Trouble first, then by how much of the limit is gone.
      const rank = (s: BudgetState) => (s === 'over' ? 0 : s === 'warn' ? 1 : s === 'ahead' ? 2 : 3)
      return rank(a.state) - rank(b.state) || b.ratio - a.ratio
    })
}

/** Expense groups from the last few months with no budget yet — the offer. */
export function unbudgetedGroups(
  budgets: Budget[],
  txs: Transaction[],
  months = 3,
): { label: string; avg: number; count: number }[] {
  const have = new Set(budgets.map((b) => keyOf(b.group)).filter(Boolean))
  const since = new Date()
  since.setMonth(since.getMonth() - (months - 1))
  since.setDate(1)
  const cutoff = isoOf(since)

  const recent = txs.filter((t) => t.kind === 'expense' && t.date >= cutoff)
  const observed = new Set(recent.map((t) => t.date.slice(0, 7))).size || 1

  return groupTransactions(recent)
    .filter((g) => !have.has(keyOf(g.label)))
    .map((g) => ({ label: g.label, avg: g.total / observed, count: g.count }))
    .sort((a, b) => b.avg - a.avg)
}

export function monthShift(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`
}
