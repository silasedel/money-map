import { forwardRef, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { MonthPicker } from '@/components/MonthPicker'
import { Ring } from '@/components/Ring'
import { Icon } from '@/components/Icon'
import { shallowArray, useStore } from '@/lib/store'
import { ui } from '@/lib/ui'
import type { Budget } from '@/lib/types'
import { breakdown, currentMonthKey, groupTrends, monthTotals, recentMonthKeys } from '@/lib/finance'
import { budgetStatuses, unbudgetedGroups, type BudgetStatus } from '@/lib/budgets'
import { money, monthLabel } from '@/lib/format'
import { spring, stagger } from '@/lib/motion'
import { Composition } from '../ledger/Composition'
import { toSlices } from '../ledger/palette'
import { BudgetModal, type BudgetPreset } from './BudgetModal'
import '../ledger/ledger.css'
import './spending.css'

const STATE_LABEL: Record<BudgetStatus['state'], string> = {
  ok: 'On track',
  ahead: 'Ahead of pace',
  warn: 'Nearly there',
  over: 'Over',
}

const RING_COLOR: Record<BudgetStatus['state'], string> = {
  ok: 'var(--sage)',
  ahead: 'var(--amber)',
  warn: 'var(--amber)',
  over: 'var(--clay)',
}

export function SpendingPage() {
  const transactions = useStore((s) => s.transactions, shallowArray)
  const budgets = useStore((s) => s.budgets, shallowArray)

  const [month, setMonth] = useState(currentMonthKey())
  const [modal, setModal] = useState<{ open: boolean; editing: Budget | null; preset: BudgetPreset | null }>({
    open: false,
    editing: null,
    preset: null,
  })

  const isNow = month === currentMonthKey()
  const on = `${month}-15` // any day inside the month places the window

  const statuses = useMemo(() => budgetStatuses(budgets, transactions, on), [budgets, transactions, on])
  const offers = useMemo(() => unbudgetedGroups(budgets, transactions), [budgets, transactions])
  const totals = useMemo(() => monthTotals(transactions, month), [transactions, month])
  const trends = useMemo(() => groupTrends(transactions, 6), [transactions])
  const trendKeys = useMemo(() => recentMonthKeys(6), [])

  const monthTx = useMemo(() => transactions.filter((t) => t.date.startsWith(month)), [transactions, month])
  const slices = useMemo(() => toSlices(breakdown(monthTx).expense, 3), [monthTx])

  const overall = statuses.find((s) => !s.budget.group)
  const perGroup = statuses.filter((s) => s.budget.group)

  const openNew = (preset: BudgetPreset | null = null) => setModal({ open: true, editing: null, preset })
  const openEdit = (b: Budget) => setModal({ open: true, editing: b, preset: null })
  const close = () => setModal((m) => ({ ...m, open: false }))

  const hasSpend = transactions.some((t) => t.kind === 'expense')

  return (
    <>
      <PageShell
        title="Budgets"
        subtitle={
          hasSpend
            ? `${money(totals.expense)} out in ${monthLabel(month, true)}${totals.count ? ` across ${totals.count} entr${totals.count === 1 ? 'y' : 'ies'}` : ''}`
            : 'Budgets, trends, and where it all goes'
        }
        actions={
          <>
            <MonthPicker value={month} onChange={setMonth} />
            <Button variant="primary" icon="plus" onClick={() => openNew()}>
              Set a budget
            </Button>
          </>
        }
      >
        {!hasSpend ? (
          <motion.div
            className="card sp__blank"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.calm}
          >
            <div className="empty">
              <span className="empty__mark">
                <Icon name="spending" size={20} />
              </span>
              <h2 className="empty__title">Nothing spent yet</h2>
              <p className="empty__text">
                Log a few expenses. They're grouped on their own, and each group
                can take a monthly limit — budgets are ceilings on things the
                ledger already knows about.
              </p>
              <div style={{ marginTop: 18 }}>
                <Button variant="primary" icon="plus" onClick={() => ui.openComposer({ preset: { kind: 'expense' } })}>
                  Add an expense
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            {/* ── Budgets ─────────────────────────────── */}
            <div className="sec sec--first">
              <h2 className="sec__title">Budgets</h2>
              <span className="sec__note">
                {statuses.length
                  ? isNow
                    ? 'The tick on each ring is where an even pace would be today'
                    : `As ${monthLabel(month, true)} closed`
                  : 'Ceilings on groups the ledger already knows'}
              </span>
            </div>

            {statuses.length === 0 ? (
              <motion.div
                className="card sp__offer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring.calm}
              >
                <div className="sp__offerHead">
                  <h3 className="card__title">Start with what you already spend on</h3>
                  <p className="sp__offerSub">
                    Averages from the last three months. Set a limit and the ring
                    fills as the month goes.
                  </p>
                </div>
                <ul className="sp__offerList">
                  {offers.slice(0, 6).map((o, i) => (
                    <motion.li
                      key={o.label}
                      className="sp__offerRow"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...spring.calm, delay: stagger(i) }}
                    >
                      <span className="sp__offerLabel">{o.label}</span>
                      <span className="sp__offerAvg num">~{money(o.avg)}/mo</span>
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() => openNew({ group: o.label, limit: roundNice(o.avg) })}
                      >
                        Set limit
                      </Button>
                    </motion.li>
                  ))}
                </ul>
                <div className="sp__offerFoot">
                  <Button size="sm" variant="ghost" icon="plus" onClick={() => openNew({ group: undefined })}>
                    Or cap the whole month
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="sp__grid">
                <AnimatePresence mode="popLayout" initial={false}>
                  {overall && (
                    <BudgetCard key={overall.budget.id} s={overall} hero onClick={() => openEdit(overall.budget)} />
                  )}
                  {perGroup.map((s, i) => (
                    <BudgetCard key={s.budget.id} s={s} index={i} onClick={() => openEdit(s.budget)} />
                  ))}
                </AnimatePresence>

                {offers.length > 0 && (
                  <motion.div
                    className="sp__more"
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <span className="sp__moreTitle">Not budgeted</span>
                    <div className="sp__moreChips">
                      {offers.slice(0, 5).map((o) => (
                        <button
                          key={o.label}
                          className="sp__moreChip"
                          onClick={() => openNew({ group: o.label, limit: roundNice(o.avg) })}
                        >
                          <Icon name="plus" size={10} strokeWidth={2.4} />
                          {o.label}
                          <span className="num">~{money(o.avg)}</span>
                        </button>
                      ))}
                      {!overall && (
                        <button className="sp__moreChip" onClick={() => openNew({ group: undefined })}>
                          <Icon name="plus" size={10} strokeWidth={2.4} />
                          Whole month
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* ── Where + trends ──────────────────────── */}
            <div className="sp__split">
              <div>
                <div className="sec">
                  <h2 className="sec__title">Where it went</h2>
                  <span className="sec__note">{monthLabel(month, true)}</span>
                </div>
                <Composition
                  title="By group"
                  slices={slices}
                  total={totals.expense}
                  empty={`Nothing spent in ${monthLabel(month, true)}.`}
                />
              </div>

              <div>
                <div className="sec">
                  <h2 className="sec__title">Trends</h2>
                  <span className="sec__note">Last six months, by group</span>
                </div>
                <section className="card sp__trends">
                  {trends.length === 0 ? (
                    <p className="comp__empty">Nothing to trend yet.</p>
                  ) : (
                    <ul className="sp__trendList">
                      {trends.slice(0, 8).map((g, i) => (
                        <motion.li
                          key={g.key}
                          className="sp__trend"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...spring.calm, delay: stagger(i, 0.03) }}
                        >
                          <button
                            className="sp__trendOpen"
                            onClick={() => ui.showInLedger({ group: g.label, kind: 'expense', month: 'all' })}
                            title={`Show ${g.label} in the ledger`}
                          >
                            <span className="sp__trendMain">
                              <span className="sp__trendLabel">{g.label}</span>
                              <span className="sp__trendAvg num">~{money(g.avg)}/mo</span>
                            </span>
                            <Bars points={g.points} keys={trendKeys} />
                            {g.delta !== null && Math.abs(g.delta) >= 0.05 ? (
                              <span className={`chip ${g.delta > 0 ? 'chip--down' : 'chip--up'}`}>
                                <Icon name={g.delta > 0 ? 'arrowUp' : 'arrowDown'} size={10} strokeWidth={2.4} />
                                {Math.abs(g.delta) > 9.99 ? '999+' : Math.round(Math.abs(g.delta) * 100)}%
                              </span>
                            ) : (
                              <span className="chip chip--flat">steady</span>
                            )}
                          </button>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </PageShell>

      <BudgetModal open={modal.open} onClose={close} editing={modal.editing} preset={modal.preset} />
    </>
  )
}

/* ── Budget card ──────────────────────────────────────── */

/* Ref-forwarding is load-bearing: the grid's AnimatePresence runs in popLayout,
   which measures a leaving card so the survivors can slide into its place. */
const BudgetCard = forwardRef<HTMLButtonElement, {
  s: BudgetStatus
  hero?: boolean
  index?: number
  onClick: () => void
}>(function BudgetCard({ s, hero, index = 0, onClick }, ref) {
  const over = s.remaining < 0
  return (
    <motion.button
      ref={ref}
      layout
      className={`card sp__budget sp__budget--${s.state} ${hero ? 'sp__budget--hero' : ''}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.16 } }}
      transition={{ ...spring.body, delay: stagger(index, 0.04) }}
      whileHover={{ y: -2 }}
    >
      <Ring
        value={s.ratio}
        size={hero ? 92 : 68}
        stroke={hero ? 8 : 6}
        marker={s.elapsed}
        color={RING_COLOR[s.state]}
      >
        <span className={`sp__pct num ${hero ? 'is-hero' : ''}`}>{Math.round(s.ratio * 100)}%</span>
      </Ring>

      <span className="sp__budgetMain">
        <span className="sp__budgetTop">
          <span className="sp__budgetLabel">{s.label}</span>
          <span className={`sp__state sp__state--${s.state}`}>{STATE_LABEL[s.state]}</span>
        </span>
        <span className="sp__budgetFig num">
          <strong>{money(s.spent)}</strong> of {money(s.limit)}
          <span className="sp__budgetPer">{s.budget.period === 'yearly' ? ' / yr' : ' / mo'}</span>
        </span>
        <span className="sp__budgetLeft">
          {over ? (
            <span className="is-over">{money(-s.remaining)} over</span>
          ) : s.daysLeft > 0 ? (
            <>
              {money(s.remaining)} left · {money(s.dailyAllowance)} a day for {s.daysLeft} day{s.daysLeft === 1 ? '' : 's'}
            </>
          ) : (
            <>{money(s.remaining)} unspent</>
          )}
        </span>
      </span>
    </motion.button>
  )
})

/* ── Six-bar trend ────────────────────────────────────── */

function Bars({ points, keys }: { points: number[]; keys: string[] }) {
  const max = Math.max(...points, 1)
  return (
    <span className="sp__bars" aria-hidden="true">
      {points.map((p, i) => (
        <span key={keys[i]} className="sp__barSlot" title={`${monthLabel(keys[i])}: ${money(p)}`}>
          <motion.span
            className={`sp__bar ${i === points.length - 1 ? 'is-last' : ''}`}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max((p / max) * 100, p > 0 ? 8 : 0)}%` }}
            transition={{ ...spring.glide, delay: i * 0.03 }}
          />
        </span>
      ))}
    </span>
  )
}

/** A limit people would actually type: $47.30/mo becomes $50. */
function roundNice(v: number): number {
  if (v <= 0) return 0
  if (v < 50) return Math.ceil(v / 5) * 5
  if (v < 200) return Math.ceil(v / 10) * 10
  if (v < 1000) return Math.ceil(v / 50) * 50
  return Math.ceil(v / 100) * 100
}
