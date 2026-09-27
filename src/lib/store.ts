import { useRef, useSyncExternalStore } from 'react'
import type {
  AppState,
  Budget,
  Goal,
  MindNode,
  PageId,
  Settings,
  Subscription,
  Transaction,
  Viewport,
} from './types'
import { uid } from './id'
import { setCurrency, todayISO } from './format'
import { advanceDate } from './subscriptions'

/* The storage key is deliberately unchanged across versions — the inline
   theme script in index.html reads it before React loads. Versioning lives
   inside the payload and `migrate` walks old shapes forward. */
const KEY = 'money-map-os/v1'
const VERSION = 3

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  motion: 'full',
  currency: 'USD',
}

const initial: AppState = {
  version: VERSION,
  page: 'overview',
  sidebarCollapsed: false,
  settings: DEFAULT_SETTINGS,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  transactions: [],
  budgets: [],
  subscriptions: [],
  goals: [],
}

const VALID_PAGES = new Set<PageId>([
  'overview', 'ledger', 'spending', 'subscriptions', 'taxes', 'summary', 'goals', 'mindmap',
])

/**
 * Bring any stored payload up to the current shape. Each step is small and
 * additive, so an old backup restores cleanly instead of being thrown away.
 */
function migrate(raw: Partial<AppState> & { page?: string }): AppState {
  const p: Record<string, unknown> = { ...raw }
  let v = typeof p.version === 'number' ? p.version : 1

  if (v < 2) {
    // v1 → v2: the Income page became Ledger; budgets and subscriptions arrive.
    if (p.page === 'income') p.page = 'ledger'
    if (!Array.isArray(p.budgets)) p.budgets = []
    if (!Array.isArray(p.subscriptions)) p.subscriptions = []
    v = 2
  }

  if (v < 3) {
    // v2 → v3: Outlook folded into Summary.
    if (p.page === 'outlook') p.page = 'summary'
    v = 3
  }

  const page = VALID_PAGES.has(p.page as PageId) ? (p.page as PageId) : initial.page

  // Merge over defaults so a partial payload can't leave holes — settings
  // nest, so they need merging a level deeper.
  return {
    ...initial,
    ...(p as Partial<AppState>),
    version: VERSION,
    page,
    settings: { ...DEFAULT_SETTINGS, ...((p.settings as Partial<Settings>) ?? {}) },
    nodes: Array.isArray(p.nodes) ? (p.nodes as AppState['nodes']) : [],
    edges: Array.isArray(p.edges) ? (p.edges as AppState['edges']) : [],
    transactions: Array.isArray(p.transactions) ? (p.transactions as Transaction[]) : [],
    budgets: Array.isArray(p.budgets) ? (p.budgets as Budget[]) : [],
    subscriptions: Array.isArray(p.subscriptions) ? (p.subscriptions as Subscription[]) : [],
    goals: Array.isArray(p.goals) ? (p.goals as Goal[]) : [],
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initial
    return migrate(JSON.parse(raw) as Partial<AppState>)
  } catch {
    return initial
  }
}

let state: AppState = load()
const listeners = new Set<() => void>()

/* The formatter is module state, so it has to be current *before* anything
   renders — doing this in an effect would leave one paint showing the old
   symbol. */
setCurrency(state.settings.currency)

let saveTimer: number | undefined
function persist() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* quota or private mode — the session still works, just won't survive reload */
    }
  }, 220)
}

function set(updater: (s: AppState) => AppState) {
  const next = updater(state)
  if (next === state) return
  state = next
  persist()
  listeners.forEach((l) => l())
}

const getState = () => state

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Read a slice of state. The whole snapshot is immutable and swapped on every
 * write, so selectors stay cheap; `isEqual` keeps derived arrays/objects from
 * churning identity on unrelated updates.
 */
export function useStore<T>(
  selector: (s: AppState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const snapshot = useSyncExternalStore(subscribe, getState, getState)
  const ref = useRef<{ v: T } | null>(null)
  const next = selector(snapshot)
  if (ref.current === null || !isEqual(ref.current.v, next)) {
    ref.current = { v: next }
  }
  return ref.current.v
}

export const shallowArray = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((v, i) => Object.is(v, b[i]))

/* ─────────────────────────────────────────────────────────
   Actions
   ───────────────────────────────────────────────────────── */

export const actions = {
  /* ── Shell ── */
  setPage: (page: PageId) => set((s) => (s.page === page ? s : { ...s, page })),

  toggleSidebar: () =>
    set((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed })),

  /* ── Settings ── */
  updateSettings: (patch: Partial<Settings>) => {
    // Applied before listeners fire, so the very next render formats correctly.
    if (patch.currency) setCurrency(patch.currency)
    set((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  },

  /** Wipe everything but keep the current settings — resetting your data
   *  shouldn't also throw you back into the wrong theme. */
  resetData: () =>
    set((s) => ({
      ...initial,
      settings: s.settings,
      page: s.page,
      sidebarCollapsed: s.sidebarCollapsed,
    })),

  /** Restore from an exported backup, defensively. */
  importState: (raw: unknown): boolean => {
    if (!raw || typeof raw !== 'object') return false
    const p = raw as Partial<AppState>
    if (!Array.isArray(p.nodes) || !Array.isArray(p.transactions)) return false
    set((s) => ({
      ...migrate(p),
      // Never let a file yank the interface out from under the user.
      settings: s.settings,
      page: s.page,
      sidebarCollapsed: s.sidebarCollapsed,
    }))
    return true
  },

  /* ── Mind map ── */
  setViewport: (v: Viewport) => set((s) => ({ ...s, viewport: v })),

  addNode: (node: Omit<MindNode, 'id' | 'createdAt'>) => {
    const id = uid('n')
    set((s) => ({
      ...s,
      nodes: [...s.nodes, { ...node, id, createdAt: Date.now() }],
    }))
    return id
  },

  updateNode: (id: string, patch: Partial<MindNode>) =>
    set((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    })),

  removeNode: (id: string) =>
    set((s) => ({
      ...s,
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.from !== id && e.to !== id),
    })),

  /** Raise a node to the top of the paint order. */
  bringToFront: (id: string) =>
    set((s) => {
      const i = s.nodes.findIndex((n) => n.id === id)
      if (i === -1 || i === s.nodes.length - 1) return s
      const next = s.nodes.slice()
      const [node] = next.splice(i, 1)
      next.push(node)
      return { ...s, nodes: next }
    }),

  connect: (from: string, to: string, bow?: number, bowAt?: number) =>
    set((s) => {
      if (from === to) return s
      const exists = s.edges.some(
        (e) =>
          (e.from === from && e.to === to) || (e.from === to && e.to === from),
      )
      if (exists) return s
      return { ...s, edges: [...s.edges, { id: uid('e'), from, to, bow, bowAt }] }
    }),

  removeEdge: (id: string) =>
    set((s) => ({ ...s, edges: s.edges.filter((e) => e.id !== id) })),

  /* ── Transactions ── */
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const id = uid('t')
    set((s) => ({
      ...s,
      transactions: [...s.transactions, { ...tx, id, createdAt: Date.now() }],
    }))
    return id
  },

  updateTransaction: (id: string, patch: Partial<Transaction>) =>
    set((s) => ({
      ...s,
      transactions: s.transactions.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    })),

  /** Flip one tag on one entry — the ledger's inline toggle. */
  toggleTag: (id: string, tag: string) =>
    set((s) => ({
      ...s,
      transactions: s.transactions.map((t) => {
        if (t.id !== id) return t
        const has = t.tags?.includes(tag)
        const tags = has ? (t.tags ?? []).filter((x) => x !== tag) : [...(t.tags ?? []), tag]
        return { ...t, tags: tags.length ? tags : undefined }
      }),
    })),

  /**
   * Apply a grouping correction to every entry sharing this title, so fixing
   * one misfiled brand deal fixes all of them — past and future.
   */
  regroupByTitle: (title: string, group: string | undefined) =>
    set((s) => {
      const key = title.trim().toLowerCase()
      return {
        ...s,
        transactions: s.transactions.map((t) =>
          t.title.trim().toLowerCase() === key ? { ...t, group } : t,
        ),
      }
    }),

  removeTransaction: (id: string) =>
    set((s) => ({
      ...s,
      transactions: s.transactions.filter((t) => t.id !== id),
    })),

  /* ── Budgets ── */
  addBudget: (b: Omit<Budget, 'id' | 'createdAt'>) =>
    set((s) => ({
      ...s,
      budgets: [...s.budgets, { ...b, id: uid('b'), createdAt: Date.now() }],
    })),

  updateBudget: (id: string, patch: Partial<Budget>) =>
    set((s) => ({
      ...s,
      budgets: s.budgets.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })),

  removeBudget: (id: string) =>
    set((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== id) })),

  /* ── Subscriptions ── */
  addSubscription: (sub: Omit<Subscription, 'id' | 'createdAt'>) => {
    const id = uid('s')
    set((s) => ({
      ...s,
      subscriptions: [...s.subscriptions, { ...sub, id, createdAt: Date.now() }],
    }))
    return id
  },

  updateSubscription: (id: string, patch: Partial<Subscription>) =>
    set((s) => ({
      ...s,
      subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    })),

  removeSubscription: (id: string) =>
    set((s) => ({
      ...s,
      subscriptions: s.subscriptions.filter((x) => x.id !== id),
      // Payments stay in the ledger; they just stop pointing at anything.
      transactions: s.transactions.map((t) =>
        t.subscriptionId === id ? { ...t, subscriptionId: undefined } : t,
      ),
    })),

  /**
   * Record one payment of a subscription as an ordinary ledger entry and move
   * the subscription's next date forward past it.
   */
  logSubscriptionPayment: (id: string, on = todayISO(), amount?: number) =>
    set((s) => {
      const sub = s.subscriptions.find((x) => x.id === id)
      if (!sub) return s
      const tx: Transaction = {
        id: uid('t'),
        kind: sub.kind,
        title: sub.title,
        amount: amount ?? sub.amount,
        date: on,
        createdAt: Date.now(),
        group: sub.group,
        tags: sub.tags?.length ? [...sub.tags] : undefined,
        subscriptionId: sub.id,
      }
      // Advance until the anchor is strictly after the payment we just logged.
      let next = sub.nextDate
      let guard = 0
      while (next <= on && guard++ < 600) next = advanceDate(next, sub.cadence)
      return {
        ...s,
        transactions: [...s.transactions, tx],
        subscriptions: s.subscriptions.map((x) =>
          x.id === id ? { ...x, nextDate: next } : x,
        ),
      }
    }),

  /* ── Goals ── */
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) =>
    set((s) => ({
      ...s,
      goals: [...s.goals, { ...goal, id: uid('g'), createdAt: Date.now() }],
    })),

  updateGoal: (id: string, patch: Partial<Goal>) =>
    set((s) => ({
      ...s,
      goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    })),

  removeGoal: (id: string) =>
    set((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })),
}

/** Escape hatch for non-React reads (drag loops, imperative handlers). */
export const snapshot = getState
