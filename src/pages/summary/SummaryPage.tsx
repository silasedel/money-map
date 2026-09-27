import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { PageShell } from '@/components/PageShell'
import { Icon } from '@/components/Icon'
import { Donut } from '@/components/Donut'
import { shallowArray, useStore } from '@/lib/store'
import { ui } from '@/lib/ui'
import {
  breakdown,
  computeTotals,
  currentMonthKey,
  monthTotals,
  monthlySeries,
  recentMonthKeys,
} from '@/lib/finance'
import { monthShift } from '@/lib/budgets'
import { commitments, computeOutlook, monthPace } from '@/lib/outlook'
import { dayLabel, money, monthLabel } from '@/lib/format'
import { spring, stagger } from '@/lib/motion'
import { hasTag } from '@/lib/tags'
import { FlowChart } from '../ledger/FlowChart'
import { INFLOW, OUTFLOW, toSlices } from '../ledger/palette'
import '../ledger/ledger.css'
import './summary.css'

type Scope = 'month' | 'quarter' | 'year' | 'all'

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: '3 months' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
]

export function SummaryPage() {
  const transactions = useStore((s) => s.transactions, shallowArray)
  const subscriptions = useStore((s) => s.subscriptions, shallowArray)
  const [scope, setScope] = useState<Scope>('quarter')

  const now = currentMonthKey()

  /* ── The window the pies read from ───────────────── */
  const scoped = useMemo(() => {
    if (scope === 'all') return transactions
    const from =
      scope === 'month' ? now : scope === 'quarter' ? monthShift(now, -2) : `${now.slice(0, 4)}-01`
    return transactions.filter((t) => t.date.slice(0, 7) >= from)
  }, [transactions, scope, now])

  const groups = useMemo(() => breakdown(scoped), [scoped])
  const inSlices = useMemo(() => toSlices(groups.income), [groups.income])
  const outSlices = useMemo(() => toSlices(groups.expense, 3), [groups.expense])
  const inTotal = groups.income.reduce((s, g) => s + g.total, 0)
  const outTotal = groups.expense.reduce((s, g) => s + g.total, 0)

  /* ── Looking ahead ────────────────────────────────── */
  const totals = useMemo(() => computeTotals(transactions), [transactions])
  const outlook = useMemo(() => computeOutlook(transactions, totals), [transactions, totals])
  const recurring = useMemo(() => commitments(transactions, subscriptions), [transactions, subscriptions])
  const pace = useMemo(() => monthPace(transactions, recurring), [transactions, recurring])
  const series = useMemo(() => monthlySeries(transactions, 12), [transactions])

  /**
   * A plain estimate for the months ahead: what repeats, plus the average of
   * everything else over the last three full months. One-off entries are left
   * out so a laptop doesn't haunt the forecast.
   */
  const forecast = useMemo(() => {
    const past = recentMonthKeys(4).slice(0, 3) // three full months before this one
    const committedIn = recurring.filter((r) => r.kind === 'income').reduce((s, r) => s + r.perMonth, 0)
    const committedOut = recurring.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.perMonth, 0)

    let looseIn = 0
    let looseOut = 0
    let observed = 0
    for (const key of past) {
      const m = monthTotals(
        transactions.filter((t) => !t.subscriptionId && !hasTag(t, 'one-off')),
        key,
      )
      if (m.count === 0) continue
      observed++
      // Anything already covered by a commitment shouldn't be counted twice.
      looseIn += Math.max(m.income - committedIn, 0)
      looseOut += Math.max(m.expense - committedOut, 0)
    }
    const avgIn = observed ? looseIn / observed : 0
    const avgOut = observed ? looseOut / observed : 0

    const estIn = committedIn + avgIn
    const estOut = committedOut + avgOut
    const months = [1, 2, 3].map((i) => monthShift(now, i))
    let running = totals.savings + pace.projectedNet
    const rows = months.map((key) => {
      running += estIn - estOut
      return { key, income: estIn, expense: estOut, net: estIn - estOut, savings: running }
    })
    return { rows, estIn, estOut, committedIn, committedOut, observed }
  }, [transactions, recurring, now, totals.savings, pace.projectedNet])

  const hasData = transactions.length > 0

  return (
    <PageShell
      title="Summary"
      subtitle={hasData ? 'Where it comes from, where it goes, where it’s heading' : 'The big picture, once there is one'}
      actions={
        hasData && (
          <div className="sm__scopes">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                className={`sm__scope ${scope === s.id ? 'is-on' : ''}`}
                onClick={() => setScope(s.id)}
              >
                {scope === s.id && <motion.span layoutId="sm-scope" className="sm__scopeThumb" transition={spring.body} />}
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )
      }
    >
      {!hasData ? (
        <motion.div
          className="card sm__blank"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.calm}
        >
          <div className="empty">
            <span className="empty__mark">
              <Icon name="outlook" size={20} />
            </span>
            <h2 className="empty__title">Nothing to sum up yet</h2>
            <p className="empty__text">
              Log a few entries. This page turns them into where your money
              comes from, where it goes, and a read on the months ahead.
            </p>
          </div>
        </motion.div>
      ) : (
        <>
          {/* ── Pies ───────────────────────────────────── */}
          <div className="sm__pies">
            <motion.section
              className="card sm__pie"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.calm}
            >
              <div className="card__head">
                <h3 className="card__title">Where it comes from</h3>
                <span className="card__note num">{money(inTotal)}</span>
              </div>
              <Donut
                slices={inSlices}
                total={inTotal}
                label="earned"
                empty="No income in this window."
                onSlice={(s) => !s.isOther && ui.showInLedger({ group: s.label, kind: 'income', month: 'all' })}
              />
            </motion.section>

            <motion.section
              className="card sm__pie"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.calm, delay: 0.06 }}
            >
              <div className="card__head">
                <h3 className="card__title">Where it goes</h3>
                <span className="card__note num">{money(outTotal)}</span>
              </div>
              <Donut
                slices={outSlices}
                total={outTotal}
                label="spent"
                empty="No spending in this window."
                onSlice={(s) => !s.isOther && ui.showInLedger({ group: s.label, kind: 'expense', month: 'all' })}
              />
            </motion.section>
          </div>

          {/* ── Month by month ─────────────────────────── */}
          <motion.section
            className="card inc__flow"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.calm, delay: 0.1 }}
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

          {/* ── Looking ahead ──────────────────────────── */}
          <div className="sec">
            <h2 className="sec__title">Looking ahead</h2>
            <span className="sec__note">Estimates, from what repeats and what you usually do</span>
          </div>

          <div className="sm__ahead">
            <motion.section
              className="card sm__pace"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.calm, delay: 0.14 }}
            >
              <div className="card__head">
                <h3 className="card__title">{monthLabel(now)} will land around</h3>
                <span className="card__note">Day {pace.dayOfMonth} of {pace.daysInMonth}</span>
              </div>
              <span className={`sm__big num ${pace.projectedNet < 0 ? 'is-neg' : ''}`}>
                {pace.projectedNet >= 0 ? '+' : '−'}
                {money(Math.abs(pace.projectedNet))}
              </span>
              <div className="sm__paceRows">
                <div className="sm__paceRow">
                  <span className="sm__dot" style={{ background: INFLOW }} />
                  <span>In</span>
                  <span className="sm__paceSoFar num">{money(pace.income)} so far</span>
                  <span className="sm__paceVal num">{money(pace.projectedIncome)}</span>
                </div>
                <div className="sm__paceRow">
                  <span className="sm__dot" style={{ background: OUTFLOW }} />
                  <span>Out</span>
                  <span className="sm__paceSoFar num">{money(pace.spend)} so far</span>
                  <span className="sm__paceVal num">{money(pace.projectedSpend)}</span>
                </div>
              </div>
              <p className="sm__note">
                {pace.basis === 'scheduled'
                  ? `What's logged, plus ${money(pace.dueOut)} still due out${pace.dueIn > 0 ? ` and ${money(pace.dueIn)} due in` : ''}.`
                  : 'Straight-line from the days logged so far — nothing repeats yet.'}
              </p>
            </motion.section>

            <motion.section
              className="card sm__forecast"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.calm, delay: 0.18 }}
            >
              <div className="card__head">
                <h3 className="card__title">Next three months</h3>
                <span className="card__note num">
                  ≈ {money(forecast.estIn)} in · {money(forecast.estOut)} out
                </span>
              </div>
              <table className="sm__table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Net</th>
                    <th>Savings</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.rows.map((r, i) => (
                    <motion.tr
                      key={r.key}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...spring.calm, delay: stagger(i, 0.05) }}
                    >
                      <td>{monthLabel(r.key, true)}</td>
                      <td className="num is-in">{money(r.income)}</td>
                      <td className="num">{money(r.expense)}</td>
                      <td className={`num is-net ${r.net < 0 ? 'is-neg' : ''}`}>
                        {r.net >= 0 ? '+' : '−'}
                        {money(Math.abs(r.net))}
                      </td>
                      <td className={`num ${r.savings < 0 ? 'is-neg' : ''}`}>{money(r.savings)}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              <p className="sm__note">
                {money(forecast.committedOut)}/mo repeats
                {forecast.observed
                  ? `, plus what you usually spend on top over the last ${forecast.observed} month${forecast.observed === 1 ? '' : 's'}.`
                  : '. Log a couple of months and the rest fills in.'}
              </p>
            </motion.section>

            <motion.section
              className="card sm__runway"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.calm, delay: 0.22 }}
            >
              <div className="card__head">
                <h3 className="card__title">Runway</h3>
                <span className="card__note">If income stopped</span>
              </div>
              <span className="sm__big num">
                {!Number.isFinite(outlook.runwayMonths)
                  ? '∞'
                  : outlook.runwayMonths >= 24
                    ? `${Math.floor(outlook.runwayMonths / 12)}y+`
                    : `${outlook.runwayMonths.toFixed(1)} mo`}
              </span>
              <p className="sm__note">
                {Number.isFinite(outlook.runwayMonths)
                  ? `${money(totals.savings)} saved against ${money(outlook.burn)} a month${outlook.runsOutOn ? ` — gone by ${dayLabel(outlook.runsOutOn)}` : ''}.`
                  : 'Nothing going out, so nothing to burn through.'}
              </p>
              <div className="sm__rate">
                <div className="sm__rateHead">
                  <span>Savings rate</span>
                  <span className="num">{Math.round(outlook.savingsRate * 100)}%</span>
                </div>
                <div className="sm__meter">
                  <motion.div
                    className="sm__meterFill"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(0, Math.min(outlook.savingsRate, 1)) * 100}%` }}
                    transition={spring.glide}
                  />
                </div>
                <span className="sm__meterNote">
                  You keep {Math.round(outlook.savingsRate * 100)}¢ of every dollar earned.
                </span>
              </div>
            </motion.section>
          </div>
        </>
      )}
    </PageShell>
  )
}
