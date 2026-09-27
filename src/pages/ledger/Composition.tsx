import { useState } from 'react'
import { motion } from 'framer-motion'
import { money } from '@/lib/format'
import { spring, stagger } from '@/lib/motion'
import type { Slice } from './palette'

interface Props {
  title: string
  slices: Slice[]
  total: number
  empty: string
}

/**
 * Part-to-whole as a capsule ribbon plus a ranked list. The list doubles as the
 * legend and as the direct labels — identity is never carried by colour alone,
 * and every segment's value is visible in text.
 */
export function Composition({ title, slices, total, empty }: Props) {
  const [hover, setHover] = useState<string | null>(null)

  if (!slices.length) {
    return (
      <section className="card comp">
        <div className="card__head">
          <h3 className="card__title">{title}</h3>
        </div>
        <p className="comp__empty">{empty}</p>
      </section>
    )
  }

  return (
    <section className="card comp">
      <div className="card__head">
        <h3 className="card__title">{title}</h3>
        <span className="card__note num">{money(total)}</span>
      </div>

      <div className="comp__ribbon" onPointerLeave={() => setHover(null)}>
        {slices.map((s) => (
          <motion.button
            key={s.key}
            className="comp__seg"
            style={{ background: s.color }}
            initial={{ flexGrow: 0.0001, opacity: 0 }}
            animate={{
              flexGrow: Math.max(s.share, 0.012),
              opacity: hover && hover !== s.key ? 0.3 : 1,
            }}
            transition={{ ...spring.glide, opacity: { duration: 0.16 } }}
            onPointerEnter={() => setHover(s.key)}
            aria-label={`${s.label}, ${money(s.total)}`}
          />
        ))}
      </div>

      <ul className="comp__list">
        {slices.map((s, i) => (
          <motion.li
            key={s.key}
            className={`comp__row ${hover === s.key ? 'is-on' : ''} ${
              hover && hover !== s.key ? 'is-off' : ''
            }`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.calm, delay: stagger(i) }}
            onPointerEnter={() => setHover(s.key)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="comp__dot" style={{ background: s.color }} />
            <span className="comp__label">{s.label}</span>
            <span className="comp__count">
              {s.count} {s.isOther ? 'entries' : s.count === 1 ? 'entry' : 'entries'}
            </span>
            <span className="comp__amt num">{money(s.total)}</span>
            <span className="comp__share num">{Math.round(s.share * 100)}%</span>
          </motion.li>
        ))}
      </ul>
    </section>
  )
}
