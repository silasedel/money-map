import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PageShell } from '@/components/PageShell'
import { Button } from '@/components/ui/Button'
import { shallowArray, useStore } from '@/lib/store'
import { computeTotals, goalCurrent, isDerived } from '@/lib/finance'
import { spring } from '@/lib/motion'
import { Icon } from '@/components/Icon'
import type { Goal } from '@/lib/types'
import { GoalCard } from './GoalCard'
import { GoalModal } from './GoalModal'
import './goals.css'

export function GoalsPage() {
  const goals = useStore((s) => s.goals, shallowArray)
  const transactions = useStore((s) => s.transactions, shallowArray)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)

  const totals = useMemo(() => computeTotals(transactions), [transactions])

  const reached = goals.filter(
    (g) => goalCurrent(g, totals) >= g.target && g.target > 0,
  ).length

  const startNew = () => {
    setEditing(null)
    setOpen(true)
  }

  return (
    <>
      <PageShell
        title="Goals"
        subtitle={
          goals.length
            ? `${reached} of ${goals.length} reached`
            : 'What are you working toward?'
        }
        actions={
          <Button variant="primary" icon="plus" onClick={startNew}>
            New goal
          </Button>
        }
      >
        {goals.length === 0 ? (
          <motion.div
            className="card gl__blank"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.calm}
          >
            <div className="empty">
              <span className="empty__mark">
                <Icon name="target" size={20} />
              </span>
              <h2 className="empty__title">No goals yet</h2>
              <p className="empty__text">
                Set a target — $25,000 saved, $10,000 a month, 100,000
                subscribers. Money goals fill in on their own as you log
                entries.
              </p>
              <div style={{ marginTop: 18 }}>
                <Button variant="primary" icon="plus" onClick={startNew}>
                  Create a goal
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="gl__grid">
            <AnimatePresence mode="popLayout">
              {goals.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  current={goalCurrent(g, totals)}
                  derived={isDerived(g)}
                  onEdit={() => {
                    setEditing(g)
                    setOpen(true)
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </PageShell>

      <GoalModal open={open} onClose={() => setOpen(false)} editing={editing} />
    </>
  )
}
