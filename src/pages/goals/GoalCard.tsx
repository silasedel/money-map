import { forwardRef, useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import type { Goal } from '@/lib/types'
import { actions, useStore } from '@/lib/store'
import { money } from '@/lib/format'
import { spring } from '@/lib/motion'
import { Icon } from '@/components/Icon'

interface Props {
  goal: Goal
  current: number
  derived: boolean
  onEdit: () => void
}

const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

const SOURCE_LABEL: Record<string, string> = {
  savings: 'Savings',
  earned: 'Total earned',
  spent: 'Total spent',
  monthlyIncome: 'Monthly income',
}

/**
 * Ref-forwarding is load-bearing: the grid's `AnimatePresence` runs in
 * `popLayout`, which measures the leaving card so the survivors can slide into
 * its place. Without the ref that measurement silently fails and the grid
 * jumps instead of reflowing.
 */
export const GoalCard = forwardRef<HTMLElement, Props>(function GoalCard(
  { goal, current, derived, onEdit },
  ref,
) {
  const currency = useStore((s) => s.settings.currency)
  const [editingValue, setEditingValue] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ratio = goal.target > 0 ? current / goal.target : 0
  const pct = Math.max(0, Math.min(ratio, 1))
  const done = ratio >= 1

  const fmt = (n: number) =>
    goal.prefix === '$'
      ? money(n)
      : `${plain.format(Math.round(n))}${goal.suffix ?? ''}`

  useEffect(() => {
    if (editingValue) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editingValue])

  const commitValue = () => {
    const raw = inputRef.current?.value ?? ''
    const next = Number.parseFloat(raw.replace(/[^0-9.]/g, ''))
    if (Number.isFinite(next)) actions.updateGoal(goal.id, { current: next })
    setEditingValue(false)
  }

  return (
    <motion.article
      ref={ref}
      className={`goal goal--${goal.accent} ${done ? 'is-done' : ''}`}
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
      transition={spring.body}
      whileHover={{ y: -2 }}
    >
      <header className="goal__head">
        <div className="goal__titles">
          <h3 className="goal__title">{goal.title}</h3>
          <span className="goal__source">
            {derived ? (
              <>
                <Icon name="sparkle" size={11} strokeWidth={2} />
                Tracks {SOURCE_LABEL[goal.metric] ?? 'your entries'}
              </>
            ) : (
              'Updated by you'
            )}
          </span>
        </div>

        <div className="goal__tools">
          <button className="goal__tool" onClick={onEdit} aria-label="Edit goal">
            <Icon name="grip" size={14} strokeWidth={1.9} />
          </button>
          <button
            className="goal__tool goal__tool--del"
            onClick={() => actions.removeGoal(goal.id)}
            aria-label="Delete goal"
          >
            <Icon name="trash" size={14} strokeWidth={1.7} />
          </button>
        </div>
      </header>

      <div className="goal__figures">
        {editingValue ? (
          <input
            ref={inputRef}
            className="goal__input num"
            defaultValue={String(goal.current)}
            onBlur={commitValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitValue()
              if (e.key === 'Escape') setEditingValue(false)
            }}
            inputMode="decimal"
          />
        ) : (
          <button
            className={`goal__current num ${derived ? 'is-locked' : ''}`}
            onClick={() => !derived && setEditingValue(true)}
            title={derived ? undefined : 'Click to update'}
          >
            <Counter key={currency} value={current} format={fmt} />
          </button>
        )}
        <span className="goal__target num">of {fmt(goal.target)}</span>
      </div>

      <div className="goal__track">
        <motion.div
          className="goal__fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={spring.glide}
        />
      </div>

      <footer className="goal__foot">
        <span className="goal__pct num">{Math.round(ratio * 100)}%</span>
        {done ? (
          <span className="goal__done">
            <Icon name="check" size={12} strokeWidth={2.4} />
            Reached
          </span>
        ) : (
          <span className="goal__left num">
            {fmt(Math.max(goal.target - current, 0))} to go
          </span>
        )}
      </footer>
    </motion.article>
  )
})

function Counter({
  value,
  format,
}: {
  value: number
  format: (n: number) => string
}) {
  const mv = useSpring(value, { stiffness: 130, damping: 26, mass: 1 })
  useEffect(() => {
    mv.set(value)
  }, [mv, value])
  const text = useTransform(mv, (v) => format(v))
  return <motion.span>{text}</motion.span>
}
