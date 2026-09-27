/**
 * Tags.
 *
 * Groups answer "what was this?"; tags say something *about* it. There are
 * only three built in, and the app acts on each: `deductible` (shown as
 * Write-off) and `business` feed the Taxes page, `one-off` keeps a purchase
 * out of the recurring detector. Anything else you type is kept verbatim as
 * a custom tag.
 */

import type { TagId, Transaction } from './types'

export type TagTone = 'sage' | 'dusk' | 'clay' | 'amber' | 'ink'

export interface TagDef {
  id: TagId
  label: string
  blurb: string
  tone: TagTone
}

export const BUILTIN_TAGS: TagDef[] = [
  { id: 'deductible', label: 'Write-off', blurb: 'Tax deductible — counts on the Taxes page', tone: 'amber' },
  { id: 'business', label: 'Business', blurb: 'For the work, not for you', tone: 'dusk' },
  { id: 'one-off', label: 'One-off', blurb: "Won't happen again", tone: 'ink' },
]

/** The id behind "Write-off" — one name in the interface, one id in the data. */
export const WRITE_OFF: TagId = 'deductible'

const byId = new Map(BUILTIN_TAGS.map((t) => [t.id, t]))

export const isBuiltinTag = (id: TagId) => byId.has(id)

export function tagDef(id: TagId): TagDef {
  return (
    byId.get(id) ?? {
      id,
      label: id.replace(/\b[a-z]/g, (c) => c.toUpperCase()),
      blurb: 'Your own tag',
      tone: 'ink',
    }
  )
}

export const tagLabel = (id: TagId) => tagDef(id).label

/** Custom tags are lower-cased and squashed so "Tax Prep" and "tax prep" agree. */
export function normalizeTag(raw: string): TagId {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 32)
}

export const hasTag = (tx: Transaction, id: TagId) => Boolean(tx.tags?.includes(id))

/** Every tag in use, built-ins first in their canonical order, then customs alphabetically. */
export function tagsInUse(txs: Transaction[]): TagId[] {
  const seen = new Set<TagId>()
  for (const t of txs) t.tags?.forEach((tag) => seen.add(tag))
  const builtins = BUILTIN_TAGS.map((t) => t.id).filter((id) => seen.has(id))
  const customs = [...seen].filter((id) => !byId.has(id)).sort()
  return [...builtins, ...customs]
}

export interface TagTotal {
  id: TagId
  label: string
  tone: TagTone
  count: number
  spent: number
  earned: number
}

export function tagTotals(txs: Transaction[]): TagTotal[] {
  const acc = new Map<TagId, TagTotal>()
  for (const t of txs) {
    for (const id of t.tags ?? []) {
      let row = acc.get(id)
      if (!row) {
        const def = tagDef(id)
        row = { id, label: def.label, tone: def.tone, count: 0, spent: 0, earned: 0 }
        acc.set(id, row)
      }
      row.count++
      if (t.kind === 'income') row.earned += t.amount
      else row.spent += t.amount
    }
  }
  return [...acc.values()].sort((a, b) => b.spent + b.earned - (a.spent + a.earned))
}
