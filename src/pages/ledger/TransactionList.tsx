import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Transaction } from '@/lib/types'
import { actions } from '@/lib/store'
import { ui } from '@/lib/ui'
import { dayLabel, money, monthLabel, relativeDay } from '@/lib/format'
import { spring, stagger } from '@/lib/motion'
import { hasTag } from '@/lib/tags'
import { Icon } from '@/components/Icon'
import { TagChip } from '@/components/Tags'
import { CategoryChip } from '@/components/Categories'
import { shallowArray, useStore } from '@/lib/store'

interface Props {
  transactions: Transaction[]
  /** Derived group label per entry id, so each row can say where it was filed. */
  groupOf: Map<string, string>
  onGroupClick?: (label: string) => void
  onCategoryClick?: (id: string) => void
  emptyText?: string
}

const DAYS_PAGE = 30

interface Day {
  date: string
  rows: Transaction[]
  income: number
  expense: number
}

/**
 * The plain record behind every chart. Entries are stacked by day, each day
 * carrying its own net, so a scroll through the month reads like a statement
 * rather than a feed.
 */
export function TransactionList({ transactions, groupOf, onGroupClick, onCategoryClick, emptyText }: Props) {
  const [limit, setLimit] = useState(DAYS_PAGE)
  const categories = useStore((s) => s.categories, shallowArray)
  const categoryOf = (id?: string) => (id ? categories.find((c) => c.id === id) : undefined)

  const days = useMemo(() => {
    const byDay = new Map<string, Day>()
    for (const t of transactions) {
      let d = byDay.get(t.date)
      if (!d) {
        d = { date: t.date, rows: [], income: 0, expense: 0 }
        byDay.set(t.date, d)
      }
      d.rows.push(t)
      if (t.kind === 'income') d.income += t.amount
      else d.expense += t.amount
    }
    const out = [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date))
    out.forEach((d) => d.rows.sort((a, b) => b.createdAt - a.createdAt))
    return out
  }, [transactions])

  const visible = days.slice(0, limit)
  const hiddenDays = days.length - visible.length
  /* Month headings only earn their place when the list spans more than one. */
  const spansMonths = new Set(days.map((d) => d.date.slice(0, 7))).size > 1

  if (!transactions.length) {
    return (
      <section className="card txl">
        <p className="txl__empty">{emptyText ?? 'Nothing here.'}</p>
      </section>
    )
  }

  let rowIndex = 0

  return (
    <section className="card txl">
      <AnimatePresence initial={false}>
        {visible.map((d, di) => (
          <motion.div
            key={d.date}
            className="txl__day"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.calm}
          >
            {spansMonths && (di === 0 || visible[di - 1].date.slice(0, 7) !== d.date.slice(0, 7)) && (
              <MonthHead
                monthKey={d.date.slice(0, 7)}
                rows={transactions.filter((t) => t.date.startsWith(d.date.slice(0, 7)))}
              />
            )}
            <header className="txl__dayHead">
              <span className="txl__dayName">{relativeDay(d.date)}</span>
              <span className="txl__dayDate">{dayLabel(d.date)}</span>
              <span className="txl__dayNet num">
                {d.income > 0 && <span className="is-in">+{money(d.income)}</span>}
                {d.expense > 0 && <span className="is-out">−{money(d.expense)}</span>}
              </span>
            </header>

            <ul className="txl__list">
              <AnimatePresence initial={false}>
                {d.rows.map((t) => {
                  const i = rowIndex++
                  const group = groupOf.get(t.id)
                  return (
                    <motion.li
                      key={t.id}
                      className="txl__row"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 12, height: 0, marginTop: 0 }}
                      transition={{ ...spring.calm, delay: stagger(i, 0.022, 8) }}
                    >
                      <span className={`txl__mark txl__mark--${t.kind}`}>
                        <Icon
                          name={t.subscriptionId ? 'repeat' : t.kind === 'income' ? 'arrowUp' : 'arrowDown'}
                          size={13}
                          strokeWidth={2.2}
                        />
                      </span>

                      {/* The row itself opens the editor — the buttons are
                          shortcuts, not the only way in. */}
                      <button
                        className="txl__open"
                        onClick={() => ui.openComposer({ editing: t })}
                        aria-label={`Edit ${t.title}`}
                      >
                        <span className="txl__main">
                          <span className="txl__title">{t.title}</span>
                          <span className="txl__meta">
                            {group && (
                              <span
                                className={`txl__group ${onGroupClick ? 'is-link' : ''}`}
                                onClick={(e) => {
                                  if (!onGroupClick) return
                                  e.stopPropagation()
                                  onGroupClick(group)
                                }}
                                role={onGroupClick ? 'button' : undefined}
                              >
                                {group}
                              </span>
                            )}
                            {t.note && <span className="txl__note">{t.note}</span>}
                          </span>
                        </span>

                        {(t.categoryId || (t.tags && t.tags.length > 0)) && (
                          <span className="txl__tags">
                            {categoryOf(t.categoryId) && (
                              <span
                                onClick={(e) => {
                                  if (!onCategoryClick) return
                                  e.stopPropagation()
                                  onCategoryClick(t.categoryId!)
                                }}
                              >
                                <CategoryChip category={categoryOf(t.categoryId)!} />
                              </span>
                            )}
                            {t.tags?.map((id) => (
                              <TagChip key={id} id={id} />
                            ))}
                          </span>
                        )}

                        <span className={`txl__amt num txl__amt--${t.kind}`}>
                          {t.kind === 'income' ? '+' : '−'}
                          {money(t.amount)}
                        </span>
                      </button>

                      <span className="txl__tools">
                        {t.kind === 'expense' && (
                          <button
                            className={`txl__tool ${hasTag(t, 'deductible') ? 'is-on' : ''}`}
                            onClick={() => actions.toggleTag(t.id, 'deductible')}
                            aria-label={hasTag(t, 'deductible') ? 'Not a write-off' : 'Mark as write-off'}
                            title={hasTag(t, 'deductible') ? 'Write-off — click to clear' : 'Mark as write-off'}
                          >
                            <Icon name="receipt" size={13} strokeWidth={1.8} />
                          </button>
                        )}
                        <button
                          className="txl__tool"
                          onClick={() => ui.openComposer({ editing: t })}
                          aria-label={`Edit ${t.title}`}
                          title="Edit"
                        >
                          <Icon name="pencil" size={13} strokeWidth={1.8} />
                        </button>
                        <button
                          className="txl__tool txl__tool--del"
                          onClick={() => actions.removeTransaction(t.id)}
                          aria-label={`Delete ${t.title}`}
                          title="Delete"
                        >
                          <Icon name="trash" size={13} strokeWidth={1.8} />
                        </button>
                      </span>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          </motion.div>
        ))}
      </AnimatePresence>

      {hiddenDays > 0 && (
        <button className="txl__more" onClick={() => setLimit((l) => l + DAYS_PAGE * 2)}>
          Show {Math.min(DAYS_PAGE * 2, hiddenDays)} more day{Math.min(DAYS_PAGE * 2, hiddenDays) === 1 ? '' : 's'}
        </button>
      )}
    </section>
  )
}

/** A running heading with the month's own totals, so scrolling back reads like a statement. */
function MonthHead({ monthKey, rows }: { monthKey: string; rows: Transaction[] }) {
  let income = 0
  let expense = 0
  for (const t of rows) {
    if (t.kind === 'income') income += t.amount
    else expense += t.amount
  }
  return (
    <div className="txl__month">
      <span className="txl__monthName">{monthLabel(monthKey, true)}</span>
      <span className="txl__monthSums num">
        {income > 0 && <span className="is-in">+{money(income)}</span>}
        {expense > 0 && <span>−{money(expense)}</span>}
        <span className={`is-net ${income - expense < 0 ? 'is-neg' : ''}`}>
          {income - expense >= 0 ? '+' : '−'}
          {money(Math.abs(income - expense))}
        </span>
      </span>
    </div>
  )
}
