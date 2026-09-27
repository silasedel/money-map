import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { Ring } from '@/components/Ring'
import { QuickAdd } from '@/components/QuickAdd'
import { actions, shallowArray, useStore } from '@/lib/store'
import { ui } from '@/lib/ui'
import {
  breakdown,
  computeTotals,
  currentMonthKey,
  goalCurrent,
  monthTotals,
  monthlySeries,
  taxSummary,
} from '@/lib/finance'
import { budgetStatuses, monthShift } from '@/lib/budgets'
import { commitments, monthPace } from '@/lib/outlook'
import { upcoming, subscriptionTotals } from '@/lib/subscriptions'
import { money, monthLabel, relativeDay } from '@/lib/format'
import { spring, stagger } from '@/lib/motion'
import { FlowChart } from '../ledger/FlowChart'
import { Composition } from '../ledger/Composition'
import { INFLOW, OUTFLOW, toSlices } from '../ledger/palette'
import '../ledger/ledger.css'
import './overview.css'

const RING_COLOR = { ok: 'var(--sage)', ahead: 'var(--amber)', warn: 'var(--amber)', over: 'var(--clay)' }

export function OverviewPage() {
  const transactions = useStore((s) => s.transactions, shallowArray)
  const budgets = useStore((s) => s.budgets, shallowArray)
  const subscriptions = useStore((s) => s.subscriptions, shallowArray)
  const goals = useStore((s) => s.goals, shallowArray)

  const now = currentMonthKey()
  const prev = monthShift(now, -1)

  const totals = useMemo(() => computeTotals(transactions), [transactions])
  const thisMonth = useMemo(() => monthTotals(transactions, now), [transactions, now])
  const lastMonth = useMemo(() => monthTotals(transactions, prev), [transactions, prev])
  const series = useMemo(() => monthlySeries(transactions, 8), [transactions])
  const recurring = useMemo(() => commitments(transactions, subscriptions), [transactions, subscriptions])
  const pace = useMemo(() => monthPace(transactions, recurring), [transactions, recurring])
  const statuses = useMemo(() => budgetStatuses(budgets, transactions), [budgets, transactions])
  const soon = useMemo(() => upcoming(subscriptions, 14), [subscriptions])
  const subTotals = useMemo(() => subscriptionTotals(subscriptions), [subscriptions])
  const tax = useMemo(() => taxSummary(transactions, new Date().getFullYear()), [transactions])

  const monthTx = useMemo(
    () => transactions.filter((t) => t.date.startsWith(now)),
    [transactions, now],
  )
  const groups = useMemo(() => breakdown(monthTx), [monthTx])
  const spendSlices = useMemo(() => toSlices(groups.expense, 3), [groups.expense])

  /* What's genuinely left: this month's income, less what's gone, less what's
     still committed. The number a person actually wants on a Tuesday. */
  const safe = thisMonth.income - thisMonth.expense - pace.dueOut
  const trouble = statuses.filter((s) => s.state === 'over' || s.state === 'warn')

  const today = new Date()
  const dateLine = today.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  if (!transactions.length && !subscriptions.length) {
    return (
      <PageShell
        title="Overview"
        subtitle={dateLine}
        actions={
          <Button variant="primary" icon="plus" onClick={() => ui.openComposer()}>
            Add entry
          </Button>
        }
      >
        <QuickAdd />
        <motion.div
          className="card ov__blank"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.calm}
        >
          <div className="empty">
            <span className="empty__mark">
              <Icon name="home" size={20} />
            </span>
            <h2 className="empty__title">Your money, on one page</h2>
            <p className="empty__text">
              Type what came in or went out in the bar above. Once there's
              something to read, this page shows what's safe to spend, what's
              coming up, and where the month is heading.
            </p>
            <div className="ov__blankActions">
              <Button variant="soft" icon="subscriptions" onClick={() => actions.setPage('subscriptions')}>
                Add a subscription
              </Button>
            </div>
          </div>
        </motion.div>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Overview"
      subtitle={dateLine}
      actions={
        <Button variant="primary" icon="plus" onClick={() => ui.openComposer()}>
          Add entry
        </Button>
      }
    >
      <QuickAdd />

      {/* ── Top row ───────────────────────────────────── */}
      <div className="ov__top">
        <motion.section
          className={`card ov__safe ${safe < 0 ? 'is-neg' : ''}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.calm}
        >
          <span className="ov__label">Safe to spend · {monthLabel(now)}</span>
          <span className="ov__big num">
            {safe < 0 ? '−' : ''}
            {money(Math.abs(safe))}
          </span>
          <p className="ov__safeNote">
            {money(thisMonth.income)} in, {money(thisMonth.expense)} out
            {pace.dueOut > 0 ? `, ${money(pace.dueOut)} still due` : ''}.
            {safe < 0 ? ' The month is already past what came in.' : ''}
          </p>

          <div className="ov__paceBar">
            <motion.span
              className="ov__paceFill"
              initial={{ width: 0 }}
              animate={{ width: `${(pace.dayOfMonth / pace.daysInMonth) * 100}%` }}
              transition={spring.glide}
            />
          </div>
          <span className="ov__paceNote">
            Day {pace.dayOfMonth} of {pace.daysInMonth}
            {pace.daysInMonth - pace.dayOfMonth > 0 && safe > 0
              ? ` · about ${money(safe / (pace.daysInMonth - pace.dayOfMonth + 1))} a day`
              : ''}
          </span>
        </motion.section>

        <motion.section
          className="card ov__month"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.calm, delay: 0.05 }}
        >
          <div className="card__head">
            <h3 className="card__title">This month</h3>
            <span className="card__note">vs {monthLabel(prev)}</span>
          </div>
          <div className="ov__rows">
            <Row label="In" color={INFLOW} value={thisMonth.income} base={lastMonth.income} goodUp />
            <Row label="Out" color={OUTFLOW} value={thisMonth.expense} base={lastMonth.expense} goodUp={false} />
            <Row label="Net" value={thisMonth.net} base={lastMonth.net} goodUp net />
          </div>
          <div className="ov__monthFoot">
            <span>All-time savings</span>
            <span className={`num ${totals.savings < 0 ? 'is-neg' : ''}`}>{money(totals.savings)}</span>
          </div>
        </motion.section>

        <motion.section
          className="card ov__budgets"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.calm, delay: 0.1 }}
        >
          <div className="card__head">
            <h3 className="card__title">Budgets</h3>
            <button className="sec__link" onClick={() => actions.setPage('spending')}>
              Budgets <Icon name="arrowRight" size={12} strokeWidth={2.2} />
            </button>
          </div>

          {statuses.length === 0 ? (
            <div className="ov__budgetsEmpty">
              <p>No limits set yet. Put a ceiling on a group and it shows up here.</p>
              <Button size="sm" variant="soft" icon="plus" onClick={() => actions.setPage('spending')}>
                Set a budget
              </Button>
            </div>
          ) : (
            <>
              <div className="ov__rings">
                {statuses.slice(0, 4).map((s, i) => (
                  <motion.button
                    key={s.budget.id}
                    className="ov__ring"
                    onClick={() => actions.setPage('spending')}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ ...spring.body, delay: stagger(i, 0.05) }}
                    title={`${s.label}: ${money(s.spent)} of ${money(s.limit)}`}
                  >
                    <Ring value={s.ratio} size={54} stroke={5} marker={s.elapsed} color={RING_COLOR[s.state]}>
                      <span className="ov__ringPct num">{Math.round(s.ratio * 100)}</span>
                    </Ring>
                    <span className="ov__ringLabel">{s.label}</span>
                  </motion.button>
                ))}
              </div>
              <p className="ov__budgetsNote">
                {trouble.length === 0
                  ? `All ${statuses.length} on track.`
                  : `${trouble.length} need${trouble.length === 1 ? 's' : ''} a look: ${trouble
                      .slice(0, 2)
                      .map((s) => s.label)
                      .join(', ')}${trouble.length > 2 ? '…' : ''}.`}
              </p>
            </>
          )}
        </motion.section>
      </div>

      {/* ── Middle row ────────────────────────────────── */}
      <div className="ov__mid">
        <motion.section
          className="card inc__flow"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.calm, delay: 0.14 }}
        >
          <div className="card__head">
            <h3 className="card__title">Cash flow</h3>
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

        <motion.section
          className="card ov__soon"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.calm, delay: 0.18 }}
        >
          <div className="card__head">
            <h3 className="card__title">Coming up</h3>
            <button className="sec__link" onClick={() => actions.setPage('subscriptions')}>
              {subTotals.active > 0 ? `${money(subTotals.monthlyOut)}/mo` : 'Subscriptions'}
              <Icon name="arrowRight" size={12} strokeWidth={2.2} />
            </button>
          </div>
          {soon.length === 0 ? (
            <p className="ov__soonEmpty">
              {subscriptions.length
                ? 'Nothing due in the next two weeks.'
                : 'Track a subscription and its next date lands here.'}
            </p>
          ) : (
            <ul className="ov__soonList">
              {soon.slice(0, 6).map((u, i) => (
                <motion.li
                  key={`${u.sub.id}-${u.date}`}
                  className="ov__soonRow"
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...spring.calm, delay: stagger(i, 0.03) }}
                >
                  <span className={`ov__soonDay ${u.days <= 2 ? 'is-now' : ''}`}>
                    {u.days <= 0 ? 'Today' : u.days === 1 ? 'Tmrw' : `${u.days}d`}
                  </span>
                  <span className="ov__soonTitle">{u.sub.title}</span>
                  <span className="ov__soonWhen">{relativeDay(u.date)}</span>
                  <span className={`ov__soonAmt num ${u.sub.kind === 'income' ? 'is-in' : ''}`}>
                    {u.sub.kind === 'income' ? '+' : '−'}
                    {money(u.sub.amount)}
                  </span>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.section>
      </div>

      {/* ── Bottom row ────────────────────────────────── */}
      <div className="ov__bottom">
        <Composition
          title={`Where it went · ${monthLabel(now)}`}
          slices={spendSlices}
          total={thisMonth.expense}
          empty="Nothing spent this month yet."
        />

        <div className="ov__side">
          <motion.section
            className="card ov__tax"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.calm, delay: 0.22 }}
          >
            <div className="card__head">
              <h3 className="card__title">Write-offs · {tax.year}</h3>
              <button className="sec__link" onClick={() => actions.setPage('taxes')}>
                Taxes <Icon name="arrowRight" size={12} strokeWidth={2.2} />
              </button>
            </div>
            <div className="ov__taxFig">
              <span className="ov__taxBig num">{money(tax.deductible)}</span>
              <span className="ov__taxNote">
                {tax.deductibleCount === 0
                  ? 'Tag an expense as a write-off and it counts here.'
                  : `${tax.deductibleCount} entr${tax.deductibleCount === 1 ? 'y' : 'ies'} tagged so far`}
              </span>
            </div>
          </motion.section>

          {goals.length > 0 && (
            <motion.section
              className="card ov__goals"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.calm, delay: 0.26 }}
            >
              <div className="card__head">
                <h3 className="card__title">Goals</h3>
                <button className="sec__link" onClick={() => actions.setPage('goals')}>
                  All <Icon name="arrowRight" size={12} strokeWidth={2.2} />
                </button>
              </div>
              <ul className="ov__goalList">
                {goals.slice(0, 3).map((g) => {
                  const cur = goalCurrent(g, totals)
                  const r = g.target > 0 ? Math.min(cur / g.target, 1) : 0
                  return (
                    <li key={g.id} className={`ov__goal ov__goal--${g.accent}`}>
                      <span className="ov__goalTitle">{g.title}</span>
                      <span className="ov__goalPct num">{Math.round(r * 100)}%</span>
                      <span className="ov__goalTrack">
                        <motion.span
                          className="ov__goalFill"
                          initial={{ width: 0 }}
                          animate={{ width: `${r * 100}%` }}
                          transition={spring.glide}
                        />
                      </span>
                    </li>
                  )
                })}
              </ul>
            </motion.section>
          )}
        </div>
      </div>
    </PageShell>
  )
}

function Row({
  label,
  color,
  value,
  base,
  goodUp,
  net,
}: {
  label: string
  color?: string
  value: number
  base: number
  goodUp: boolean
  net?: boolean
}) {
  const delta = base !== 0 ? (value - base) / Math.abs(base) : null
  const up = (delta ?? 0) >= 0
  const good = up === goodUp
  return (
    <div className={`ov__row ${net ? 'ov__row--net' : ''}`}>
      {color ? <span className="ov__rowDot" style={{ background: color }} /> : <span className="ov__rowDot is-blank" />}
      <span className="ov__rowKey">{label}</span>
      {delta !== null && Math.abs(delta) >= 0.005 && (
        <span className={`chip ${good ? 'chip--up' : 'chip--down'}`}>
          <Icon name={up ? 'arrowUp' : 'arrowDown'} size={10} strokeWidth={2.4} />
          {Math.abs(delta) > 9.99 ? '999+' : Math.round(Math.abs(delta) * 100)}%
        </span>
      )}
      <span className={`ov__rowVal num ${net && value < 0 ? 'is-neg' : ''}`}>
        {net && value !== 0 ? (value > 0 ? '+' : '−') : ''}
        {money(Math.abs(value))}
      </span>
    </div>
  )
}
