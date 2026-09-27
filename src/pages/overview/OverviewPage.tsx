import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { PageShell } from '@/components/PageShell'
import { QuickAdd } from '@/components/QuickAdd'
import { Icon } from '@/components/Icon'
import { actions, shallowArray, useStore } from '@/lib/store'
import { computeTotals, currentMonthKey, monthTotals } from '@/lib/finance'
import { commitments, monthPace } from '@/lib/outlook'
import { upcoming } from '@/lib/subscriptions'
import { money, monthLabel, relativeDay } from '@/lib/format'
import { spring, stagger } from '@/lib/motion'
import './overview.css'

/**
 * Deliberately sparse. One bar to log money, one card that says how the month
 * is going, one list of what's about to leave. Everything else has a page.
 */
export function OverviewPage() {
  const transactions = useStore((s) => s.transactions, shallowArray)
  const subscriptions = useStore((s) => s.subscriptions, shallowArray)

  const now = currentMonthKey()
  const totals = useMemo(() => computeTotals(transactions), [transactions])
  const month = useMemo(() => monthTotals(transactions, now), [transactions, now])
  const recurring = useMemo(() => commitments(transactions, subscriptions), [transactions, subscriptions])
  const pace = useMemo(() => monthPace(transactions, recurring), [transactions, recurring])
  const soon = useMemo(() => upcoming(subscriptions, 14), [subscriptions])

  const safe = month.income - month.expense - pace.dueOut
  const daysLeft = pace.daysInMonth - pace.dayOfMonth + 1

  const dateLine = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const empty = transactions.length === 0

  return (
    <PageShell title="Overview" subtitle={dateLine}>
      <QuickAdd />

      <motion.section
        className={`card ov__hero ${safe < 0 ? 'is-neg' : ''}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.calm}
      >
        {empty ? (
          <div className="ov__heroEmpty">
            <span className="empty__mark">
              <Icon name="home" size={20} />
            </span>
            <h2 className="empty__title">Type what came in or went out above</h2>
            <p className="empty__text">
              That's the whole habit. This card will show what's safe to spend
              this month once there's something to read.
            </p>
          </div>
        ) : (
          <>
            <div className="ov__heroMain">
              <span className="ov__label">Safe to spend · {monthLabel(now)}</span>
              <span className="ov__big num">
                {safe < 0 ? '−' : ''}
                {money(Math.abs(safe))}
              </span>
              <span className="ov__heroNote">
                {safe > 0 && daysLeft > 0
                  ? `About ${money(safe / daysLeft)} a day for the next ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
                  : safe < 0
                    ? 'The month is already past what came in.'
                    : 'Nothing left for the month.'}
              </span>
            </div>

            <div className="ov__heroSide">
              <Stat label="In" value={month.income} tone="in" />
              <Stat label="Out" value={month.expense} />
              {pace.dueOut > 0 && <Stat label="Still due" value={pace.dueOut} muted />}
              <Stat label="All-time savings" value={totals.savings} tone={totals.savings < 0 ? 'neg' : 'ink'} top />
            </div>
          </>
        )}
      </motion.section>

      {soon.length > 0 && (
        <motion.section
          className="card ov__soon"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.calm, delay: 0.08 }}
        >
          <div className="card__head">
            <h3 className="card__title">Coming up</h3>
            <button className="sec__link" onClick={() => actions.setPage('subscriptions')}>
              Subscriptions <Icon name="arrowRight" size={12} strokeWidth={2.2} />
            </button>
          </div>
          <ul className="ov__soonList">
            {soon.slice(0, 5).map((u, i) => (
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
        </motion.section>
      )}
    </PageShell>
  )
}

function Stat({
  label,
  value,
  tone,
  muted,
  top,
}: {
  label: string
  value: number
  tone?: 'in' | 'neg' | 'ink'
  muted?: boolean
  top?: boolean
}) {
  return (
    <div className={`ov__stat ${top ? 'ov__stat--top' : ''} ${muted ? 'is-muted' : ''}`}>
      <span className="ov__statLabel">{label}</span>
      <span className={`ov__statValue num ${tone ? `is-${tone}` : ''}`}>{money(value)}</span>
    </div>
  )
}
