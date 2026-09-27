/** Domain model for Money Map. */

export type PageId =
  | 'overview'
  | 'ledger'
  | 'spending'
  | 'subscriptions'
  | 'taxes'
  | 'summary'
  | 'goals'
  | 'mindmap'

/* ── Mind Map ─────────────────────────────────────────── */

export type BubbleColor =
  | 'sand'
  | 'sage'
  | 'sky'
  | 'blush'
  | 'lilac'
  | 'mist'

export interface MindNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  text: string
  color: BubbleColor
  createdAt: number
}

export interface MindEdge {
  id: string
  from: string
  to: string
  /**
   * The shape you drew, distilled to two numbers: how far the line bows off
   * the straight run between the two bubbles (in world units, signed by side)
   * and where along the run that bow peaks (0–1). A scribble becomes a clean
   * curve that still goes the way you drew it.
   */
  bow?: number
  bowAt?: number
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

/* ── Ledger ───────────────────────────────────────────── */

export type TxKind = 'income' | 'expense'

/**
 * Tags are the one axis that cuts across groups. A group says *what* an entry
 * was (Groceries, Software); a tag says something *about* it — that it's
 * deductible, that it was for the business, that someone owes you half.
 * Built-in tags have ids the app understands (`deductible` drives the Taxes
 * page); anything else is a free string you typed, kept as-is.
 */
export type TagId = string

export interface Transaction {
  id: string
  kind: TxKind
  title: string
  amount: number
  note?: string
  /** ISO date, `YYYY-MM-DD`. */
  date: string
  createdAt: number
  /**
   * Set only when you disagree with where the app filed something. Grouping
   * stays automatic; this is the correction, and it applies to every entry
   * with the same title so you only ever have to make it once.
   */
  group?: string
  tags?: TagId[]
  /** Set when this entry was logged against a tracked subscription. */
  subscriptionId?: string
}

/* ── Budgets ──────────────────────────────────────────── */

export type BudgetPeriod = 'monthly' | 'yearly'

export interface Budget {
  id: string
  /**
   * The group this budget watches, matched case-insensitively against the
   * derived group labels. Undefined means the whole month — every expense.
   */
  group?: string
  limit: number
  period: BudgetPeriod
  createdAt: number
}

/* ── Subscriptions ────────────────────────────────────── */

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled'

/**
 * Something you've committed to paying (or being paid) on a schedule. Declared
 * up front rather than inferred, so rent is known on day one — the Outlook
 * page still detects rhythms on its own, and offers them here to be tracked.
 */
export interface Subscription {
  id: string
  title: string
  amount: number
  kind: TxKind
  cadence: Cadence
  /** The next date it's expected, ISO. Advances each time a payment is logged. */
  nextDate: string
  status: SubscriptionStatus
  note?: string
  tags?: TagId[]
  /** Grouping override carried onto every payment logged from it. */
  group?: string
  createdAt: number
}

/* ── Goals ────────────────────────────────────────────── */

/**
 * How a goal's current value is sourced.
 * Everything but `manual` is derived live from transactions.
 */
export type GoalMetric =
  | 'manual'
  | 'savings'
  | 'earned'
  | 'spent'
  | 'monthlyIncome'

export interface Goal {
  id: string
  title: string
  target: number
  /** Only meaningful when metric === 'manual'. */
  current: number
  metric: GoalMetric
  /** Shown before the number, e.g. `$`. */
  prefix?: string
  /** Shown after the number, e.g. ` subscribers`. */
  suffix?: string
  accent: 'sage' | 'dusk' | 'clay' | 'amber'
  createdAt: number
}

/* ── Settings ─────────────────────────────────────────── */

/** `system` follows the OS and keeps following it as it changes. */
export type ThemeChoice = 'light' | 'dark' | 'system'

export type MotionChoice = 'full' | 'reduced'

export interface Settings {
  theme: ThemeChoice
  motion: MotionChoice
  /** ISO 4217. Everything money-shaped formats through this. */
  currency: string
}

/* ── Root ─────────────────────────────────────────────── */

export interface AppState {
  version: number
  page: PageId
  sidebarCollapsed: boolean
  settings: Settings
  nodes: MindNode[]
  edges: MindEdge[]
  viewport: Viewport
  transactions: Transaction[]
  budgets: Budget[]
  subscriptions: Subscription[]
  goals: Goal[]
}
