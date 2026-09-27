import { useState } from 'react'
import { motion } from 'framer-motion'
import { money } from '@/lib/format'
import { spring, stagger } from '@/lib/motion'
import type { Slice } from '@/pages/ledger/palette'

interface Props {
  slices: Slice[]
  total: number
  /** Sits in the hole. */
  label: string
  size?: number
  empty?: string
  onSlice?: (s: Slice) => void
}

/**
 * Part-to-whole as a ring, with the list alongside doing the real work: every
 * slice has its name, amount and share in text, so colour is emphasis rather
 * than the only encoding. Hovering either side highlights both.
 */
export function Donut({ slices, total, label, size = 176, empty = 'Nothing here yet.', onSlice }: Props) {
  const [hover, setHover] = useState<string | null>(null)

  if (!slices.length || total <= 0) {
    return <p className="donut__empty">{empty}</p>
  }

  const stroke = size * 0.15
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gap = 2.5 // px of surface between arcs

  let offset = 0
  const arcs = slices.map((s) => {
    const len = Math.max(c * s.share - gap, 0.5)
    const arc = { s, len, at: offset }
    offset += c * s.share
    return arc
  })

  const active = hover ? slices.find((s) => s.key === hover) : null

  return (
    <div className="donut" onPointerLeave={() => setHover(null)}>
      <div className="donut__chart" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}>
            {arcs.map(({ s, len, at }, i) => (
              <motion.circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === s.key ? stroke * 1.18 : stroke}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-at}
                strokeLinecap="butt"
                initial={{ opacity: 0 }}
                animate={{ opacity: hover && hover !== s.key ? 0.32 : 1 }}
                transition={{ ...spring.calm, delay: stagger(i, 0.04) }}
                style={{ transition: 'stroke-width 0.18s var(--ease-spring)', cursor: onSlice ? 'pointer' : 'default' }}
                onPointerEnter={() => setHover(s.key)}
                onClick={() => onSlice?.(s)}
              />
            ))}
          </g>
        </svg>
        <div className="donut__hole">
          <span className="donut__holeValue num">{money(active ? active.total : total)}</span>
          <span className="donut__holeLabel">{active ? active.label : label}</span>
          {active && <span className="donut__holeShare num">{Math.round(active.share * 100)}%</span>}
        </div>
      </div>

      <ul className="donut__list">
        {slices.map((s, i) => (
          <motion.li
            key={s.key}
            className={`donut__row ${hover === s.key ? 'is-on' : ''} ${hover && hover !== s.key ? 'is-off' : ''}`}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring.calm, delay: stagger(i, 0.03) }}
            onPointerEnter={() => setHover(s.key)}
            onClick={() => onSlice?.(s)}
            style={{ cursor: onSlice && !s.isOther ? 'pointer' : 'default' }}
          >
            <span className="donut__dot" style={{ background: s.color }} />
            <span className="donut__label">{s.label}</span>
            <span className="donut__amt num">{money(s.total)}</span>
            <span className="donut__share num">{Math.round(s.share * 100)}%</span>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
