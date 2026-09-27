/** Number + date formatting. Kept in one place so figures agree everywhere. */

/* ── Currency ─────────────────────────────────────────────
   Held as module state rather than threaded through every component: the
   formatters are pure functions called from dozens of places, and the choice
   changes about once in an app's lifetime. `setCurrency` is called from the
   store subscription in App, so a change re-renders the tree anyway. */

export const CURRENCIES = [
  { code: 'USD', label: 'US dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British pound', symbol: '£' },
  { code: 'CAD', label: 'Canadian dollar', symbol: '$' },
  { code: 'AUD', label: 'Australian dollar', symbol: '$' },
  { code: 'JPY', label: 'Japanese yen', symbol: '¥' },
  { code: 'INR', label: 'Indian rupee', symbol: '₹' },
  { code: 'BRL', label: 'Brazilian real', symbol: 'R$' },
  { code: 'MXN', label: 'Mexican peso', symbol: '$' },
  { code: 'SEK', label: 'Swedish krona', symbol: 'kr' },
] as const

let code = 'USD'
let whole = build(0)
let cents = build(2)

function build(digits: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function setCurrency(next: string) {
  if (next === code) return
  try {
    code = next
    whole = build(0)
    cents = build(2)
  } catch {
    code = 'USD' // an unknown code shouldn't take the app down
    whole = build(0)
    cents = build(2)
  }
}

export const currencyCode = () => code

/** The bare symbol, for input prefixes where a full format would be noise. */
export function currencySymbol(): string {
  const parts = whole.formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? '$'
}

const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** `$1,240` — whole units unless there are meaningful fractions. */
export function money(n: number): string {
  const abs = Math.abs(n)
  if (abs < 1000 && !Number.isInteger(n)) return cents.format(n)
  return whole.format(n)
}

/** Compact for tight spots: `$12.4k`, `$1.2M`. */
export function moneyCompact(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const s = currencySymbol()
  if (abs >= 1_000_000) return `${sign}${s}${trim(abs / 1_000_000)}M`
  if (abs >= 1_000) return `${sign}${s}${trim(abs / 1_000)}k`
  return `${sign}${s}${Math.round(abs)}`
}

export function numberCompact(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}M`
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}k`
  return `${sign}${plain.format(abs)}`
}

function trim(v: number): string {
  const s = v < 10 ? v.toFixed(1) : Math.round(v).toString()
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export const pct = (v: number) => `${Math.round(v * 100)}%`

/* ── Dates ────────────────────────────────────────────── */

/** Today as `YYYY-MM-DD` in local time (not UTC — avoids off-by-one). */
export function todayISO(): string {
  const d = new Date()
  return isoOf(d)
}

export function isoOf(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Parse `YYYY-MM-DD` as a *local* date. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** `2026-08` → `Aug` (with year appended when it isn't the current one). */
export function monthLabel(key: string, withYear = false): string {
  const [y, m] = key.split('-').map(Number)
  const label = MONTHS[(m ?? 1) - 1] ?? ''
  return withYear ? `${label} ’${`${y}`.slice(2)}` : label
}

/** `Aug 14` / `Aug 14, 2025` when the year differs from now. */
export function dayLabel(iso: string): string {
  const d = parseISO(iso)
  const now = new Date()
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return d.getFullYear() === now.getFullYear()
    ? base
    : `${base}, ${d.getFullYear()}`
}

export function relativeDay(iso: string): string {
  const d = parseISO(iso)
  const now = new Date()
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      d.getTime()) /
      86_400_000,
  )
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days === -1) return 'Tomorrow'
  if (days > 1 && days < 7) return `${days} days ago`
  return dayLabel(iso)
}
