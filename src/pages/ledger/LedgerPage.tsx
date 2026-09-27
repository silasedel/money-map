import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { MonthPicker } from '@/components/MonthPicker'
import { TagChip } from '@/components/Tags'
import { QuickAdd } from '@/components/QuickAdd'
import { Icon } from '@/components/Icon'
import { shallowArray, useStore } from '@/lib/store'
import { ui, type LedgerFilter } from '@/lib/ui'
import type { Transaction, TxKind } from '@/lib/types'
import { groupTransactions } from '@/lib/grouping'
import { money, monthLabel } from '@/lib/format'
import { tagsInUse } from '@/lib/tags'
import { spring, easeQuick } from '@/lib/motion'
import { TransactionList } from './TransactionList'
import './ledger.css'

type KindFilter = TxKind | 'all'

export function LedgerPage() {
  const transactions = useStore((s) => s.transactions, shallowArray)

  const [month, setMonth] = useState<string>('all')
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [tag, setTag] = useState<string | null>(null)
  const [group, setGroup] = useState<string | null>(null)

  /* Another page may have sent us here with a filter in hand. */
  useEffect(() => {
    const f: LedgerFilter | null = ui.takeLedgerFilter()
    if (!f) return
    if (f.month) setMonth(f.month)
    if (f.q !== undefined) setQ(f.q)
    if (f.kind) setKind(f.kind)
    if (f.tag !== undefined) setTag(f.tag ?? null)
    if (f.group !== undefined) setGroup(f.group ?? null)
  }, [])

  /* Group labels come from the whole ledger, so filtering a month doesn't
     re-cluster its entries into different buckets than the year uses. */
  const groupOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const k of ['income', 'expense'] as const) {
      for (const g of groupTransactions(transactions.filter((t) => t.kind === k))) {
        for (const t of g.transactions) map.set(t.id, g.label)
      }
    }
    return map
  }, [transactions])

  const tags = useMemo(() => tagsInUse(transactions), [transactions])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const gk = group?.toLowerCase()
    return transactions.filter((t) => {
      if (month !== 'all' && !t.date.startsWith(month)) return false
      if (kind !== 'all' && t.kind !== kind) return false
      if (tag && !t.tags?.includes(tag)) return false
      if (gk && (groupOf.get(t.id) ?? '').toLowerCase() !== gk) return false
      if (needle) {
        const hay = `${t.title} ${t.note ?? ''} ${groupOf.get(t.id) ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [transactions, month, kind, tag, group, q, groupOf])

  const sums = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of filtered) {
      if (t.kind === 'income') income += t.amount
      else expense += t.amount
    }
    return { income, expense, net: income - expense }
  }, [filtered])

  const anyFilter = q.trim() || kind !== 'all' || tag || group
  const clear = () => {
    setQ('')
    setKind('all')
    setTag(null)
    setGroup(null)
  }

  const scopeLabel = month === 'all' ? 'All time' : monthLabel(month, true)

  return (
    <PageShell
      title="Ledger"
      subtitle={
        transactions.length
          ? `${transactions.length} entr${transactions.length === 1 ? 'y' : 'ies'} · click any to edit`
          : 'Every entry, in one place'
      }
      actions={
        <>
          <MonthPicker value={month} onChange={setMonth} allowAll />
          <Button variant="primary" icon="plus" onClick={() => ui.openComposer()}>
            Add entry
          </Button>
        </>
      }
    >
      <QuickAdd />

      {transactions.length === 0 ? (
        <motion.div
          className="card lg__blank"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.calm}
        >
          <div className="empty">
            <span className="empty__mark">
              <Icon name="ledger" size={20} />
            </span>
            <h2 className="empty__title">Nothing logged yet</h2>
            <p className="empty__text">
              Type what it was and how much in the bar above and press Enter.
              Money Map groups similar entries on its own, so the charts fill
              in as you go — you never make a category.
            </p>
          </div>
        </motion.div>
      ) : (
        <>
          {/* ── Filter bar ────────────────────────────── */}
          <motion.div
            className="lg__bar"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.calm, delay: 0.05 }}
          >
            <label className="lg__search">
              <Icon name="search" size={15} strokeWidth={1.9} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search titles, notes, groups"
                spellCheck={false}
              />
              {q && (
                <button className="lg__searchX" onClick={() => setQ('')} aria-label="Clear search">
                  <Icon name="close" size={11} strokeWidth={2.3} />
                </button>
              )}
            </label>

            <div className="lg__kinds">
              {(
                [
                  ['all', 'All'],
                  ['income', 'In'],
                  ['expense', 'Out'],
                ] as [KindFilter, string][]
              ).map(([k, label]) => (
                <button
                  key={k}
                  className={`lg__kind lg__kind--${k} ${kind === k ? 'is-on' : ''}`}
                  onClick={() => setKind(k)}
                >
                  {kind === k && (
                    <motion.span layoutId="lg-kind" className="lg__kindThumb" transition={spring.body} />
                  )}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {tags.length > 0 && (
              <div className="lg__tags">
                {tags.map((id) => (
                  <TagChip
                    key={id}
                    id={id}
                    active={tag === id}
                    onClick={() => setTag(tag === id ? null : id)}
                  />
                ))}
              </div>
            )}
          </motion.div>

          {/* ── Active scope ──────────────────────────── */}
          <AnimatePresence initial={false}>
            {(group || anyFilter) && (
              <motion.div
                className="lg__scope"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={easeQuick}
              >
                <span className="lg__scopeText">
                  Showing {filtered.length} of{' '}
                  {month === 'all'
                    ? transactions.length
                    : transactions.filter((t) => t.date.startsWith(month)).length}
                  {group && (
                    <>
                      {' '}
                      in <strong>{group}</strong>
                      <button className="lg__scopeX" onClick={() => setGroup(null)} aria-label="Clear group">
                        <Icon name="close" size={10} strokeWidth={2.4} />
                      </button>
                    </>
                  )}
                </span>
                <button className="lg__clear" onClick={clear}>
                  Clear filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Sums for what's on screen ─────────────── */}
          <div className="lg__sums">
            <Sum label={`In · ${scopeLabel}`} value={sums.income} tone="in" />
            <Sum label={`Out · ${scopeLabel}`} value={sums.expense} tone="out" />
            <Sum label="Net" value={sums.net} tone={sums.net < 0 ? 'neg' : 'net'} signed />
          </div>

          <TransactionList
            transactions={filtered}
            groupOf={groupOf}
            onGroupClick={(label) => setGroup(label)}
            emptyText={
              anyFilter
                ? 'Nothing matches those filters.'
                : `Nothing logged in ${scopeLabel}.`
            }
          />
        </>
      )}
    </PageShell>
  )
}

function Sum({
  label,
  value,
  tone,
  signed,
}: {
  label: string
  value: number
  tone: 'in' | 'out' | 'net' | 'neg'
  signed?: boolean
}) {
  return (
    <div className={`lg__sum lg__sum--${tone}`}>
      <span className="lg__sumLabel">{label}</span>
      <span className="lg__sumValue num">
        {signed && value !== 0 ? (value > 0 ? '+' : '−') : ''}
        {money(Math.abs(value))}
      </span>
    </div>
  )
}

export type { Transaction }
