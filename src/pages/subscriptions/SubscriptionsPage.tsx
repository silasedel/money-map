import { forwardRef, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/Icon'
import { TagChip } from '@/components/Tags'
import { actions, shallowArray, useStore } from '@/lib/store'
import { ui } from '@/lib/ui'
import type { Subscription, Transaction } from '@/lib/types'
import {
  cadenceLabel,
  cadenceShort,
  daysUntil,
  lastPaid,
  nextDue,
  perMonth,
  subscriptionTotals,
  upcoming,
} from '@/lib/subscriptions'
import { suggestions } from '@/lib/outlook'
import { dayLabel, money, relativeDay } from '@/lib/format'
import { spring, stagger } from '@/lib/motion'
import { SubscriptionModal, type SubPreset } from './SubscriptionModal'
import './subscriptions.css'

export function SubscriptionsPage() {
  const subscriptions = useStore((s) => s.subscriptions, shallowArray)
  const transactions = useStore((s) => s.transactions, shallowArray)

  const [modal, setModal] = useState<{ open: boolean; editing: Subscription | null; preset: SubPreset | null }>({
    open: false,
    editing: null,
    preset: null,
  })
  const [showCancelled, setShowCancelled] = useState(false)

  const totals = useMemo(() => subscriptionTotals(subscriptions), [subscriptions])
  const soon = useMemo(() => upcoming(subscriptions, 30), [subscriptions])
  const found = useMemo(() => suggestions(transactions, subscriptions), [transactions, subscriptions])

  const active = subscriptions
    .filter((s) => s.status === 'active')
    .sort((a, b) => nextDue(a).localeCompare(nextDue(b)))
  const paused = subscriptions.filter((s) => s.status === 'paused')
  const cancelled = subscriptions.filter((s) => s.status === 'cancelled')

  const next = soon[0]

  const openNew = (preset: SubPreset | null = null) => setModal({ open: true, editing: null, preset })
  const openEdit = (s: Subscription) => setModal({ open: true, editing: s, preset: null })
  const close = () => setModal((m) => ({ ...m, open: false }))

  const track = (r: (typeof found)[number]) =>
    actions.addSubscription({
      title: r.title,
      amount: r.typical,
      kind: r.kind,
      cadence: r.cadence,
      nextDate: r.nextDate,
      status: 'active',
    })

  return (
    <>
      <PageShell
        title="Subscriptions"
        subtitle={
          subscriptions.length
            ? `${totals.active} active · ${money(totals.monthlyOut)} a month · ${money(totals.yearlyOut)} a year`
            : 'Everything you pay on a schedule'
        }
        actions={
          <Button variant="primary" icon="plus" onClick={() => openNew()}>
            Add subscription
          </Button>
        }
      >
        {subscriptions.length === 0 && found.length === 0 ? (
          <motion.div
            className="card sb__blank"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.calm}
          >
            <div className="empty">
              <span className="empty__mark">
                <Icon name="subscriptions" size={20} />
              </span>
              <h2 className="empty__title">Nothing on a schedule yet</h2>
              <p className="empty__text">
                Rent, streaming, the gym, a client on retainer. Add it once with
                its next date and Money Map counts it as due, projects it into
                the month, and keeps the next date moving as you log payments.
              </p>
              <div style={{ marginTop: 18 }}>
                <Button variant="primary" icon="plus" onClick={() => openNew()}>
                  Add your first
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            {/* ── Totals ──────────────────────────────── */}
            <div className="sb__tiles">
              <motion.div
                className="tile tile--hero sb__tileHero"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring.calm}
              >
                <span className="tile__label">Every month</span>
                <span className="tile__value num">{money(totals.monthlyOut)}</span>
                <span className="tile__note">
                  {totals.monthlyIn > 0
                    ? `${money(totals.monthlyIn)} coming in on a schedule too`
                    : `${money(totals.yearlyOut)} a year across ${totals.active} subscription${totals.active === 1 ? '' : 's'}`}
                </span>
              </motion.div>
              <motion.div
                className="tile"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.calm, delay: 0.05 }}
              >
                <span className="tile__label">Every year</span>
                <span className="tile__value num">{money(totals.yearlyOut)}</span>
                <span className="tile__note">What it adds up to</span>
              </motion.div>
              <motion.div
                className="tile"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.calm, delay: 0.1 }}
              >
                <span className="tile__label">Next up</span>
                {next ? (
                  <>
                    <span className="tile__value sb__nextTitle">{next.sub.title}</span>
                    <span className="tile__note">
                      {money(next.sub.amount)} · {relativeDay(next.date)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="tile__value">—</span>
                    <span className="tile__note">Nothing due in 30 days</span>
                  </>
                )}
              </motion.div>
            </div>

            {/* ── Suggestions ─────────────────────────── */}
            <AnimatePresence initial={false}>
              {found.length > 0 && (
                <motion.section
                  className="card sb__found"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={spring.calm}
                >
                  <div className="card__head">
                    <h3 className="card__title">
                      <Icon name="sparkle" size={14} strokeWidth={1.9} /> Looks like these repeat
                    </h3>
                    <span className="card__note">Spotted in the ledger — track them to make them count</span>
                  </div>
                  <ul className="sb__foundList">
                    {found.slice(0, 5).map((r, i) => (
                      <motion.li
                        key={`${r.kind}-${r.key}`}
                        className="sb__foundRow"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...spring.calm, delay: stagger(i) }}
                      >
                        <span className={`sb__foundMark sb__foundMark--${r.kind}`}>
                          <Icon name="repeat" size={13} strokeWidth={1.9} />
                        </span>
                        <span className="sb__foundMain">
                          <span className="sb__foundLabel">{r.title}</span>
                          <span className="sb__foundMeta">
                            {cadenceLabel(r.cadence)} · seen {r.occurrences}× · next {relativeDay(r.nextDate)}
                          </span>
                        </span>
                        <span className="sb__foundAmt num">
                          {r.kind === 'income' ? '+' : ''}
                          {money(r.typical)}
                        </span>
                        <Button size="sm" variant="soft" icon="plus" onClick={() => track(r)}>
                          Track
                        </Button>
                      </motion.li>
                    ))}
                  </ul>
                </motion.section>
              )}
            </AnimatePresence>

            <div className="sb__split">
              {/* ── Tracked ─────────────────────────────── */}
              <div>
                <div className="sec">
                  <h2 className="sec__title">Tracked</h2>
                  <span className="sec__note">Soonest first</span>
                </div>

                {active.length === 0 && paused.length === 0 ? (
                  <div className="card sb__none">Nothing tracked yet. Add one, or track something from the list above.</div>
                ) : (
                  <div className="sb__grid">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {active.map((s, i) => (
                        <SubCard key={s.id} sub={s} index={i} transactions={transactions} onEdit={() => openEdit(s)} />
                      ))}
                      {paused.map((s, i) => (
                        <SubCard key={s.id} sub={s} index={active.length + i} transactions={transactions} onEdit={() => openEdit(s)} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {cancelled.length > 0 && (
                  <div className="sb__cancelled">
                    <button className="sb__cancelledToggle" onClick={() => setShowCancelled((v) => !v)}>
                      <motion.span animate={{ rotate: showCancelled ? 90 : 0 }} transition={spring.snap} style={{ display: 'flex' }}>
                        <Icon name="chevron" size={12} strokeWidth={2.2} />
                      </motion.span>
                      {cancelled.length} cancelled
                    </button>
                    <AnimatePresence initial={false}>
                      {showCancelled && (
                        <motion.ul
                          className="sb__cancelledList"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={spring.calm}
                        >
                          {cancelled.map((s) => (
                            <li key={s.id} className="sb__cancelledRow">
                              <span className="sb__cancelledTitle">{s.title}</span>
                              <span className="sb__cancelledMeta num">
                                {money(s.amount)}
                                {cadenceShort(s.cadence)}
                              </span>
                              <button className="sb__cancelledAct" onClick={() => actions.updateSubscription(s.id, { status: 'active' })}>
                                Resume
                              </button>
                              <button className="sb__cancelledAct is-del" onClick={() => actions.removeSubscription(s.id)}>
                                Delete
                              </button>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* ── Next 30 days ────────────────────────── */}
              <div>
                <div className="sec">
                  <h2 className="sec__title">Next 30 days</h2>
                  <span className="sec__note num">
                    {money(soon.filter((u) => u.sub.kind === 'expense').reduce((s, u) => s + u.sub.amount, 0))} due
                  </span>
                </div>
                <section className="card sb__timeline">
                  {soon.length === 0 ? (
                    <p className="comp__empty">Nothing due in the next month.</p>
                  ) : (
                    <ul className="sb__tl">
                      {soon.map((u, i) => (
                        <motion.li
                          key={`${u.sub.id}-${u.date}`}
                          className={`sb__tlRow ${u.days <= 0 ? 'is-today' : ''}`}
                          initial={{ opacity: 0, x: 6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ...spring.calm, delay: stagger(i, 0.025, 10) }}
                        >
                          <span className="sb__tlDate">
                            <span className="sb__tlDay num">{u.date.slice(8)}</span>
                            <span className="sb__tlMon">{dayLabel(u.date).split(' ')[0]}</span>
                          </span>
                          <span className="sb__tlLine" />
                          <span className="sb__tlMain">
                            <span className="sb__tlTitle">{u.sub.title}</span>
                            <span className="sb__tlMeta">{u.days <= 0 ? 'Due today' : `in ${u.days} day${u.days === 1 ? '' : 's'}`}</span>
                          </span>
                          <span className={`sb__tlAmt num ${u.sub.kind === 'income' ? 'is-in' : ''}`}>
                            {u.sub.kind === 'income' ? '+' : '−'}
                            {money(u.sub.amount)}
                          </span>
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

      <SubscriptionModal open={modal.open} onClose={close} editing={modal.editing} preset={modal.preset} />
    </>
  )
}

/* ── Card ─────────────────────────────────────────────── */

const SubCard = forwardRef<HTMLElement, {
  sub: Subscription
  index: number
  transactions: Transaction[]
  onEdit: () => void
}>(function SubCard({ sub, index, transactions, onEdit }, ref) {
  const due = nextDue(sub)
  const days = daysUntil(due)
  const last = lastPaid(sub, transactions)
  const paused = sub.status === 'paused'

  const logPayment = () =>
    ui.openComposer({
      preset: {
        kind: sub.kind,
        title: sub.title,
        amount: sub.amount,
        tags: sub.tags,
        group: sub.group,
        subscriptionId: sub.id,
        date: due <= new Date().toISOString().slice(0, 10) ? due : undefined,
      },
    })

  return (
    <motion.article
      ref={ref}
      layout
      className={`card sb__card ${paused ? 'is-paused' : ''} ${!paused && days <= 3 ? 'is-soon' : ''}`}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.16 } }}
      transition={{ ...spring.body, delay: stagger(index, 0.035) }}
    >
      <header className="sb__cardHead">
        <span className={`sb__cardMark sb__cardMark--${sub.kind}`}>
          <Icon name={paused ? 'pause' : 'repeat'} size={14} strokeWidth={2} />
        </span>
        <span className="sb__cardTitles">
          <span className="sb__cardTitle">{sub.title}</span>
          <span className="sb__cardCadence">
            {cadenceLabel(sub.cadence)}
            {sub.cadence !== 'monthly' && ` · ${money(perMonth(sub.amount, sub.cadence))}/mo`}
          </span>
        </span>
        <span className={`sb__cardAmt num ${sub.kind === 'income' ? 'is-in' : ''}`}>
          {sub.kind === 'income' ? '+' : ''}
          {money(sub.amount)}
          <span className="sb__cardPer">{cadenceShort(sub.cadence)}</span>
        </span>
      </header>

      {sub.tags && sub.tags.length > 0 && (
        <div className="sb__cardTags">
          {sub.tags.map((t) => (
            <TagChip key={t} id={t} />
          ))}
        </div>
      )}

      <div className="sb__cardWhen">
        {paused ? (
          <span className="sb__cardDue is-paused">Paused</span>
        ) : (
          <span className={`sb__cardDue ${days <= 0 ? 'is-now' : days <= 3 ? 'is-soon' : ''}`}>
            {days < 0 ? `Overdue ${-days}d` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due ${dayLabel(due)}`}
          </span>
        )}
        <span className="sb__cardLast">
          {last ? `Last paid ${dayLabel(last.date)}` : 'No payments logged'}
        </span>
      </div>

      <footer className="sb__cardFoot">
        {!paused && (
          <Button size="sm" variant="soft" icon="check" onClick={logPayment}>
            Log payment
          </Button>
        )}
        <span className="sb__cardTools">
          <button
            className="sb__tool"
            onClick={() => actions.updateSubscription(sub.id, { status: paused ? 'active' : 'paused' })}
            title={paused ? 'Resume' : 'Pause'}
            aria-label={paused ? 'Resume' : 'Pause'}
          >
            <Icon name={paused ? 'play' : 'pause'} size={13} strokeWidth={2} />
          </button>
          <button className="sb__tool" onClick={onEdit} title="Edit" aria-label="Edit">
            <Icon name="pencil" size={13} strokeWidth={1.8} />
          </button>
        </span>
      </footer>
    </motion.article>
  )
})
