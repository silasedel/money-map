import { motion } from 'framer-motion'
import { monthLabel } from '@/lib/format'
import { monthShift } from '@/lib/budgets'
import { currentMonthKey } from '@/lib/finance'
import { spring } from '@/lib/motion'
import { Icon } from './Icon'

interface Props {
  value: string
  onChange: (key: string) => void
  /** Allow stepping past the current month. */
  future?: boolean
  /** Offer an "all time" option, represented as 'all'. */
  allowAll?: boolean
}

/** Step through months. Today is always one click away. */
export function MonthPicker({ value, onChange, future = false, allowAll = false }: Props) {
  const now = currentMonthKey()
  const isAll = value === 'all'
  const atNow = value === now
  const canForward = isAll ? false : future || value < now

  const label = isAll
    ? 'All time'
    : `${monthLabel(value, true)}`

  return (
    <div className="mp">
      <button
        className="mp__step"
        onClick={() => onChange(monthShift(isAll ? now : value, -1))}
        aria-label="Previous month"
      >
        <Icon name="chevron" size={13} strokeWidth={2.1} style={{ transform: 'rotate(180deg)' }} />
      </button>

      <motion.button
        key={value}
        className={`mp__label num ${isAll ? 'is-all' : ''}`}
        onClick={() => onChange(atNow && allowAll ? 'all' : now)}
        title={atNow ? (allowAll ? 'Show all time' : undefined) : 'Back to this month'}
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.snap}
      >
        {label}
        {!atNow && !isAll && <span className="mp__now">today</span>}
      </motion.button>

      <button
        className="mp__step"
        onClick={() => canForward && onChange(monthShift(value, 1))}
        disabled={!canForward}
        aria-label="Next month"
      >
        <Icon name="chevron" size={13} strokeWidth={2.1} />
      </button>
    </div>
  )
}
