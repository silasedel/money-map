/** Derived financial figures. Everything recomputes from transactions. */

import { groupTransactions, type Group } from './grouping'
import { isoOf, monthKey } from './format'
import type { Goal, Transaction } from './types'

export interface Totals {
  savings: number
  earned: number
  spent: number
  /** Income booked in the current calendar month. */
  monthlyIncome: number
  /** Current month income − current month spend. */
  netProfit: number
  /** Month-over-month change, as a ratio. `null` when there's no baseline. */
  monthlyIncomeDelta: number | null
  netProfitDelta: number | null
  spentDelta: number | null
}

export interface MonthPoint {
  key: string
  income: number
  expense: number
  net: number
}

export function currentMonthKey(): string {
  return isoOf(new Date()).slice(0, 7)
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`
}

export function computeTotals(txs: Transaction[]): Totals {
  const now = currentMonthKey()
  const prev = shiftMonth(now, -1)

  let earned = 0
  let spent = 0
  let mIncome = 0
  let mSpend = 0
  let pIncome = 0
  let pSpend = 0

  for (const t of txs) {
    const mk = monthKey(t.date)
    if (t.kind === 'income') {
      earned += t.amount
      if (mk === now) mIncome += t.amount
      else if (mk === prev) pIncome += t.amount
    } else {
      spent += t.amount
      if (mk === now) mSpend += t.amount
      else if (mk === prev) pSpend += t.amount
    }
  }

  return {
    savings: earned - spent,
    earned,
    spent,
    monthlyIncome: mIncome,
    netProfit: mIncome - mSpend,
    monthlyIncomeDelta: ratio(mIncome, pIncome),
    netProfitDelta: ratio(mIncome - mSpend, pIncome - pSpend),
    spentDelta: ratio(mSpend, pSpend),
  }
}

function ratio(current: number, base: number): number | null {
  if (base === 0) return null
  return (current - base) / Math.abs(base)
}

/** A contiguous month series — gaps filled with zeroes so the chart is honest. */
export function monthlySeries(txs: Transaction[], maxMonths = 8): MonthPoint[] {
  if (!txs.length) return []

  const byMonth = new Map<string, MonthPoint>()
  for (const t of txs) {
    const key = monthKey(t.date)
    let p = byMonth.get(key)
    if (!p) {
      p = { key, income: 0, expense: 0, net: 0 }
      byMonth.set(key, p)
    }
    if (t.kind === 'income') p.income += t.amount
    else p.expense += t.amount
    p.net = p.income - p.expense
  }

  const keys = [...byMonth.keys()].sort()
  const first = keys[0]
  const last = currentMonthKey() > keys[keys.length - 1]
    ? currentMonthKey()
    : keys[keys.length - 1]

  const filled: MonthPoint[] = []
  let cursor = first
  // Guard against a pathological date range running away.
  for (let i = 0; i < 240 && cursor <= last; i++) {
    filled.push(byMonth.get(cursor) ?? { key: cursor, income: 0, expense: 0, net: 0 })
    cursor = shiftMonth(cursor, 1)
  }

  return filled.slice(-maxMonths)
}

export interface Breakdown {
  income: Group[]
  expense: Group[]
}

export function breakdown(txs: Transaction[]): Breakdown {
  return {
    income: groupTransactions(txs.filter((t) => t.kind === 'income')),
    expense: groupTransactions(txs.filter((t) => t.kind === 'expense')),
  }
}

/** Resolve a goal's live value — money goals track transactions automatically. */
export function goalCurrent(goal: Goal, totals: Totals): number {
  switch (goal.metric) {
    case 'savings':
      return totals.savings
    case 'earned':
      return totals.earned
    case 'spent':
      return totals.spent
    case 'monthlyIncome':
      return totals.monthlyIncome
    default:
      return goal.current
  }
}

export const isDerived = (g: Goal) => g.metric !== 'manual'

/* ── Month slices ─────────────────────────────────────── */

export interface MonthTotals {
  key: string
  income: number
  expense: number
  net: number
  count: number
}

export function monthTotals(txs: Transaction[], key: string): MonthTotals {
  const out: MonthTotals = { key, income: 0, expense: 0, net: 0, count: 0 }
  for (const t of txs) {
    if (monthKey(t.date) !== key) continue
    out.count++
    if (t.kind === 'income') out.income += t.amount
    else out.expense += t.amount
  }
  out.net = out.income - out.expense
  return out
}

/** The last `n` month keys ending at the current month, oldest first. */
export function recentMonthKeys(n: number, end = currentMonthKey()): string[] {
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) keys.push(shiftMonth(end, -i))
  return keys
}

/**
 * Per-group spend across a window of months, for trend sparklines. Groups are
 * derived from the whole expense ledger so a category keeps its identity
 * across the window rather than being re-clustered month by month.
 */
export interface GroupTrend {
  key: string
  label: string
  points: number[]
  total: number
  avg: number
  /** Last month vs the average of the ones before it. `null` without a baseline. */
  delta: number | null
}

export function groupTrends(txs: Transaction[], months = 6): GroupTrend[] {
  const keys = recentMonthKeys(months)
  const index = new Map(keys.map((k, i) => [k, i]))
  const groups = groupTransactions(txs.filter((t) => t.kind === 'expense'))

  return groups
    .map((g) => {
      const points = new Array<number>(keys.length).fill(0)
      for (const t of g.transactions) {
        const i = index.get(monthKey(t.date))
        if (i !== undefined) points[i] += t.amount
      }
      const total = points.reduce((s, v) => s + v, 0)
      const last = points[points.length - 1]
      const prior = points.slice(0, -1)
      const priorAvg = prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : 0
      return {
        key: g.key,
        label: g.label,
        points,
        total,
        avg: total / keys.length,
        delta: priorAvg > 0 ? (last - priorAvg) / priorAvg : null,
      }
    })
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total)
}

/* ── Tax year ─────────────────────────────────────────── */

export interface TaxSummary {
  year: number
  deductible: number
  deductibleCount: number
  business: number
  businessCount: number
  /** Deductible spend by quarter, Q1–Q4. */
  quarters: number[]
  byGroup: Group[]
  entries: Transaction[]
  /** Income that carried the business tag — a rough taxable figure. */
  businessIncome: number
}

export function taxSummary(txs: Transaction[], year: number): TaxSummary {
  const prefix = `${year}-`
  const inYear = txs.filter((t) => t.date.startsWith(prefix))
  const has = (t: Transaction, tag: string) => t.tags?.includes(tag)

  const entries = inYear
    .filter((t) => t.kind === 'expense' && has(t, 'deductible'))
    .sort((a, b) => b.date.localeCompare(a.date))

  const quarters = [0, 0, 0, 0]
  for (const t of entries) {
    const m = Number(t.date.slice(5, 7))
    quarters[Math.floor((m - 1) / 3)] += t.amount
  }

  const business = inYear.filter((t) => t.kind === 'expense' && has(t, 'business'))

  return {
    year,
    deductible: entries.reduce((s, t) => s + t.amount, 0),
    deductibleCount: entries.length,
    business: business.reduce((s, t) => s + t.amount, 0),
    businessCount: business.length,
    quarters,
    byGroup: groupTransactions(entries),
    entries,
    businessIncome: inYear
      .filter((t) => t.kind === 'income' && has(t, 'business'))
      .reduce((s, t) => s + t.amount, 0),
  }
}

/** Every year with at least one entry, newest first — always including this one. */
export function yearsInLedger(txs: Transaction[]): number[] {
  const years = new Set<number>([new Date().getFullYear()])
  for (const t of txs) years.add(Number(t.date.slice(0, 4)))
  return [...years].sort((a, b) => b - a)
}

/** A plain CSV of entries — what an accountant actually wants. */
export function toCSV(txs: Transaction[]): string {
  const esc = (v: string | number | undefined) => {
    const s = v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const rows = [
    ['date', 'kind', 'title', 'amount', 'group', 'tags', 'note'].join(','),
    ...txs
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((t) =>
        [
          t.date,
          t.kind,
          esc(t.title),
          t.amount.toFixed(2),
          esc(t.group ?? ''),
          esc((t.tags ?? []).join(' ')),
          esc(t.note ?? ''),
        ].join(','),
      ),
  ]
  return rows.join('\n')
}
