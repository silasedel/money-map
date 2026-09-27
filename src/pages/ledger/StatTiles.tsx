import { useEffect, useMemo } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import type { MonthPoint, Totals } from '@/lib/finance'
import { money, moneyCompact } from '@/lib/format'
import { spring, stagger } from '@/lib/motion'
import { Icon } from '@/components/Icon'
import { useStore } from '@/lib/store'
import { INFLOW } from './palette'

interface Props {
  totals: Totals
  series: MonthPoint[]
  monthName: string
}

export function StatTiles({ totals, series, monthName }: Props) {
  // Remounts the tickers when the currency changes, so the formatter they
  // captured is rebuilt rather than left showing the old symbol.
  const currency = useStore((s) => s.settings.currency)

  const tiles = [
    {
      key: 'savings',
      label: 'Total savings',
      value: totals.savings,
      hero: true,
      note: 'Everything earned, less everything spent',
      delta: null as number | null,
      goodWhenUp: true,
    },
    {
      key: 'earned',
      label: 'Total earned',
      value: totals.earned,
      note: 'All time',
      delta: null,
      goodWhenUp: true,
    },
    {
      key: 'spent',
      label: 'Total spent',
      value: totals.spent,
      note: 'All time',
      delta: null,
      goodWhenUp: false,
    },
    {
      key: 'monthly',
      label: 'Monthly income',
      value: totals.monthlyIncome,
      note: monthName,
      delta: totals.monthlyIncomeDelta,
      goodWhenUp: true,
    },
    {
      key: 'net',
      label: 'Net profit',
      value: totals.netProfit,
      note: `${monthName} in − out`,
      delta: totals.netProfitDelta,
      goodWhenUp: true,
    },
  ]

  return (
    <div className="tiles">
      {tiles.map((t, i) => (
        <motion.div
          key={t.key}
          className={`tile ${t.hero ? 'tile--hero' : ''}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.calm, delay: stagger(i, 0.045) }}
        >
          <span className="tile__label">{t.label}</span>

          <div className="tile__figure">
            <span className={`tile__value num ${t.value < 0 ? 'is-neg' : ''}`}>
              <Ticker key={currency} value={t.value} />
            </span>
            {t.delta !== null && <Delta value={t.delta} goodWhenUp={t.goodWhenUp} />}
          </div>

          {t.hero ? (
            <Sparkline series={series} />
          ) : (
            <span className="tile__note">{t.note}</span>
          )}
        </motion.div>
      ))}
    </div>
  )
}

/**
 * Seeded with the real figure so the dashboard is correct the instant it
 * paints; the spring only runs when the number actually changes — logging an
 * entry, not switching pages. A money figure should never be seen counting up
 * from a value that was never true.
 */
function Ticker({ value }: { value: number }) {
  const mv = useSpring(value, { stiffness: 130, damping: 26, mass: 1 })
  useEffect(() => {
    mv.set(value)
  }, [mv, value])
  const text = useTransform(mv, (v) => money(v))
  return <motion.span>{text}</motion.span>
}

function Delta({ value, goodWhenUp }: { value: number; goodWhenUp: boolean }) {
  const up = value >= 0
  const good = up === goodWhenUp
  const magnitude = Math.abs(value)
  if (magnitude < 0.005) {
    return <span className="chip chip--flat">flat</span>
  }
  return (
    <span className={`chip ${good ? 'chip--up' : 'chip--down'}`}>
      <Icon name={up ? 'arrowUp' : 'arrowDown'} size={11} strokeWidth={2.4} />
      {magnitude > 9.99 ? '999+' : `${Math.round(magnitude * 100)}`}%
    </span>
  )
}

/** Cumulative savings across the visible months. Context, not a second chart. */
function Sparkline({ series }: { series: MonthPoint[] }) {
  const { d, area, last } = useMemo(() => {
    if (series.length < 2) return { d: '', area: '', last: 0 }
    const w = 148
    const h = 34
    let acc = 0
    const pts = series.map((m) => (acc += m.net))
    const min = Math.min(...pts, 0)
    const max = Math.max(...pts, 1)
    const span = max - min || 1
    const xy = pts.map((p, i) => [
      (i / (pts.length - 1)) * w,
      h - ((p - min) / span) * (h - 4) - 2,
    ])
    // Catmull-Rom-ish smoothing keeps it organic without inventing wiggles.
    let path = `M ${xy[0][0]} ${xy[0][1]}`
    for (let i = 0; i < xy.length - 1; i++) {
      const [x0, y0] = xy[i]
      const [x1, y1] = xy[i + 1]
      const mx = (x0 + x1) / 2
      path += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`
    }
    return {
      d: path,
      area: `${path} L ${w} ${h} L 0 ${h} Z`,
      last: pts[pts.length - 1],
    }
  }, [series])

  if (!d) return <span className="tile__note">Add entries to see your trend</span>

  return (
    <div className="spark">
      <svg viewBox="0 0 148 34" width="148" height="34" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={INFLOW} stopOpacity="0.18" />
            <stop offset="100%" stopColor={INFLOW} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#sparkFill)" />
        <motion.path
          d={d}
          fill="none"
          stroke={INFLOW}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <span className="spark__cap num">{moneyCompact(last)}</span>
    </div>
  )
}
