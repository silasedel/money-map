import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { Donut } from '@/components/Donut'
import { CategoryChip } from '@/components/Categories'
import { shallowArray, useStore } from '@/lib/store'
import { ui } from '@/lib/ui'
import type { Category } from '@/lib/types'
import { breakdown, currentMonthKey, monthTotals, monthlySeries } from '@/lib/finance'
import { monthShift } from '@/lib/budgets'
import { groupTransactions } from '@/lib/grouping'
import { money, monthLabel } from '@/lib/format'
import { spring, stagger } from '@/lib/motion'
import { FlowChart } from '../ledger/FlowChart'
import { TransactionList } from '../ledger/TransactionList'
import { INFLOW, OUTFLOW, toSlices, type Slice } from '../ledger/palette'
import { CategoryModal } from './CategoryModal'
import '../ledger/ledger.css'
import './categories.css'

export function CategoriesPage() {
  const categories = useStore((s) => s.categories, shallowArray)
  const transactions = useStore((s) => s.transactions, shallowArray)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ open: boolean; editing: Category | null }>({ open: false, editing: null })

  /* Keep something selected whenever there is something to select. */
  useEffect(() => {
    if (!categories.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !categories.some((c) => c.id === selectedId)) setSelectedId(categories[0].id)
  }, [categories, selectedId])

  const selected = categories.find((c) => c.id === selectedId) ?? null

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of transactions) if (t.categoryId) m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1)
    return m
  }, [transactions])

  const mine = useMemo(
    () => (selected ? transactions.filter((t) => t.categoryId === selected.id) : []),
    [transactions, selected],
  )

  const report = useMemo(() => {
    let earned = 0
    let spent = 0
    for (const t of mine) {
      if (t.kind === 'income') earned += t.amount
      else spent += t.amount
    }
    const now = currentMonthKey()
    const thisMonth = monthTotals(mine, now)
    const lastMonth = monthTotals(mine, monthShift(now, -1))
    const months = new Set(mine.map((t) => t.date.slice(0, 7))).size || 1
    const first = mine.length ? [...mine].sort((a, b) => a.date.localeCompare(b.date))[0].date : null
    return {
      earned,
      spent,
      net: earned - spent,
      thisMonth,
      lastMonth,
      months,
      avgIn: earned / months,
      avgOut: spent / months,
      first,
      margin: earned > 0 ? (earned - spent) / earned : null,
    }
  }, [mine])

  const series = useMemo(() => monthlySeries(mine, 12), [mine])
  const groups = useMemo(() => breakdown(mine), [mine])
  const inSlices = useMemo(() => toSlices(groups.income), [groups.income])
  const outSlices = useMemo(() => toSlices(groups.expense, 3), [groups.expense])

  /** Earned vs spent as one two-slice ring — the shape of the whole thing. */
  const balanceSlices = useMemo<Slice[]>(() => {
    const total = report.earned + report.spent || 1
    const out: Slice[] = []
    if (report.earned > 0)
      out.push({ key: 'in', label: 'Earned', total: report.earned, share: report.earned / total, color: INFLOW, count: 0, isOther: false })
    if (report.spent > 0)
      out.push({ key: 'out', label: 'Spent', total: report.spent, share: report.spent / total, color: OUTFLOW, count: 0, isOther: false })
    return out
  }, [report.earned, report.spent])

  const groupOf = useMemo(() => {
    const map = new Map<string, string>()
    for (const k of ['income', 'expense'] as const) {
      for (const g of groupTransactions(transactions.filter((t) => t.kind === k))) {
        for (const t of g.transactions) map.set(t.id, g.label)
      }
    }
    return map
  }, [transactions])

  const openNew = () => setModal({ open: true, editing: null })
  const openEdit = (c: Category) => setModal({ open: true, editing: c })

  return (
    <>
      <PageShell
        title="Categories"
        subtitle={
          categories.length
            ? 'Your own buckets — a project, a channel, a side of life — each with its own report'
            : 'File money under things that matter to you'
        }
        actions={
          <Button variant="primary" icon="plus" onClick={openNew}>
            New category
          </Button>
        }
      >
        {categories.length === 0 ? (
          <motion.div
            className="card ct__blank"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.calm}
          >
            <div className="empty">
              <span className="empty__mark">
                <Icon name="tag" size={20} />
              </span>
              <h2 className="empty__title">No categories yet</h2>
              <p className="empty__text">
                Make one for anything you want to see on its own — a business,
                a YouTube channel, a trip. Anything you earn or spend can be
                filed under it, and this page shows that category's finances
                by themselves.
              </p>
              <div style={{ marginTop: 18 }}>
                <Button variant="primary" icon="plus" onClick={openNew}>
                  Create your first
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            {/* ── Strip ───────────────────────────────── */}
            <div className="ct__strip">
              {categories.map((c) => (
                <CategoryChip
                  key={c.id}
                  category={c}
                  size="md"
                  active={c.id === selectedId}
                  count={counts.get(c.id) ?? 0}
                  onClick={() => setSelectedId(c.id)}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              {selected && (
                <motion.div
                  key={selected.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
                  transition={spring.calm}
                >
                  {/* ── Head ──────────────────────────── */}
                  <div className="ct__head" style={{ '--cat-color': `var(--${selected.color})` } as React.CSSProperties}>
                    <span className="ct__swatch" />
                    <div className="ct__titles">
                      <h2 className="ct__name">{selected.name}</h2>
                      <span className="ct__meta">
                        {mine.length
                          ? `${mine.length} entr${mine.length === 1 ? 'y' : 'ies'} since ${monthLabel(report.first!.slice(0, 7), true)}`
                          : 'Nothing filed here yet'}
                      </span>
                    </div>
                    <div className="ct__tools">
                      <Button
                        size="sm"
                        variant="soft"
                        icon="plus"
                        onClick={() => ui.openComposer({ preset: { categoryId: selected.id } })}
                      >
                        Add to {selected.name}
                      </Button>
                      <Button size="sm" variant="ghost" icon="pencil" onClick={() => openEdit(selected)}>
                        Edit
                      </Button>
                    </div>
                  </div>

                  {mine.length === 0 ? (
                    <div className="card ct__none">
                      <p>
                        Pick <strong>{selected.name}</strong> as the category when you log something and
                        it shows up here. You can also set it on any past entry from the ledger.
                      </p>
                      <Button size="sm" variant="primary" icon="plus" onClick={() => ui.openComposer({ preset: { categoryId: selected.id } })}>
                        Log something
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* ── Figures ──────────────────── */}
                      <div className="ct__tiles">
                        <Tile label="Net" value={report.net} hero signed note={
                          report.margin !== null ? `${Math.round(report.margin * 100)}% of what it earned, kept` : 'Spent, nothing earned yet'
                        } delay={0} />
                        <Tile label="Earned" value={report.earned} tone="in" note={`≈ ${money(report.avgIn)} a month`} delay={0.04} />
                        <Tile label="Spent" value={report.spent} note={`≈ ${money(report.avgOut)} a month`} delay={0.08} />
                        <Tile
                          label={`${monthLabel(currentMonthKey())} net`}
                          value={report.thisMonth.net}
                          signed
                          note={`${money(report.thisMonth.income)} in · ${money(report.thisMonth.expense)} out`}
                          delay={0.12}
                        />
                      </div>

                      {/* ── Shape + month by month ───── */}
                      <div className="ct__row">
                        <motion.section
                          className="card ct__balance"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...spring.calm, delay: 0.14 }}
                        >
                          <div className="card__head">
                            <h3 className="card__title">Earned vs spent</h3>
                            <span className="card__note">All time</span>
                          </div>
                          <Donut slices={balanceSlices} total={report.earned + report.spent} label="moved" size={150} />
                        </motion.section>

                        <motion.section
                          className="card inc__flow ct__flow"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...spring.calm, delay: 0.18 }}
                        >
                          <div className="card__head">
                            <h3 className="card__title">Month by month</h3>
                            <div className="inc__legend">
                              <span className="inc__legendItem">
                                <span className="inc__legendDot" style={{ background: INFLOW }} />
                                In
                              </span>
                              <span className="inc__legendItem">
                                <span className="inc__legendDot" style={{ background: OUTFLOW }} />
                                Out
                              </span>
                            </div>
                          </div>
                          <FlowChart data={series} />
                        </motion.section>
                      </div>

                      {/* ── Where ────────────────────── */}
                      <div className="ct__row ct__row--even">
                        <motion.section
                          className="card"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...spring.calm, delay: 0.22 }}
                        >
                          <div className="card__head">
                            <h3 className="card__title">Where it comes from</h3>
                            <span className="card__note num">{money(report.earned)}</span>
                          </div>
                          <Donut slices={inSlices} total={report.earned} label="earned" size={140} empty="No income filed here." />
                        </motion.section>
                        <motion.section
                          className="card"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...spring.calm, delay: 0.26 }}
                        >
                          <div className="card__head">
                            <h3 className="card__title">Where it goes</h3>
                            <span className="card__note num">{money(report.spent)}</span>
                          </div>
                          <Donut slices={outSlices} total={report.spent} label="spent" size={140} empty="No spending filed here." />
                        </motion.section>
                      </div>

                      {/* ── Entries ──────────────────── */}
                      <div className="sec">
                        <h2 className="sec__title">Everything in {selected.name}</h2>
                        <button className="sec__link" onClick={() => ui.showInLedger({ categoryId: selected.id, month: 'all' })}>
                          Open in ledger <Icon name="arrowRight" size={12} strokeWidth={2.2} />
                        </button>
                      </div>
                      <TransactionList transactions={mine} groupOf={groupOf} />
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </PageShell>

      <CategoryModal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        editing={modal.editing}
        onCreated={(id) => setSelectedId(id)}
      />
    </>
  )
}

function Tile({
  label,
  value,
  note,
  hero,
  signed,
  tone,
  delay,
}: {
  label: string
  value: number
  note: string
  hero?: boolean
  signed?: boolean
  tone?: 'in'
  delay: number
}) {
  const neg = value < 0
  return (
    <motion.div
      className={`tile ${hero ? 'tile--hero' : ''}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.calm, delay: stagger(0) + delay }}
    >
      <span className="tile__label">{label}</span>
      <span className={`tile__value num ${neg ? 'is-neg' : ''} ${tone === 'in' ? 'ct__in' : ''}`}>
        {signed && value !== 0 ? (neg ? '−' : '+') : ''}
        {money(Math.abs(value))}
      </span>
      <span className="tile__note">{note}</span>
    </motion.div>
  )
}
