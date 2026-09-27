/**
 * Ephemeral interface state — things every page can reach but nothing should
 * remember across reloads: the entry composer, and a filter handed to the
 * ledger when another page sends you there ("show me Groceries").
 */

import { useSyncExternalStore } from 'react'
import type { Transaction, TxKind } from './types'
import { actions } from './store'

export interface ComposerPreset {
  kind?: TxKind
  title?: string
  amount?: number
  tags?: string[]
  group?: string
  categoryId?: string
  subscriptionId?: string
  date?: string
}

export interface LedgerFilter {
  q?: string
  kind?: TxKind | 'all'
  tag?: string
  group?: string
  categoryId?: string
  /** `YYYY-MM`, or 'all'. */
  month?: string
}

interface UIState {
  composer: { open: boolean; editing: Transaction | null; preset: ComposerPreset | null }
  /** Consumed by the ledger on arrival, then cleared. */
  ledgerFilter: LedgerFilter | null
}

let state: UIState = {
  composer: { open: false, editing: null, preset: null },
  ledgerFilter: null,
}
const listeners = new Set<() => void>()

function set(next: UIState) {
  state = next
  listeners.forEach((l) => l())
}
const get = () => state
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useUI<T>(selector: (s: UIState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(get()), () => selector(get()))
}

export const ui = {
  openComposer: (opts: { editing?: Transaction | null; preset?: ComposerPreset } = {}) =>
    set({
      ...state,
      composer: { open: true, editing: opts.editing ?? null, preset: opts.preset ?? null },
    }),

  closeComposer: () => set({ ...state, composer: { ...state.composer, open: false } }),

  /** Jump to the ledger with a filter applied. */
  showInLedger: (filter: LedgerFilter) => {
    set({ ...state, ledgerFilter: filter })
    actions.setPage('ledger')
  },

  takeLedgerFilter: (): LedgerFilter | null => {
    const f = state.ledgerFilter
    if (f) set({ ...state, ledgerFilter: null })
    return f
  },
}
