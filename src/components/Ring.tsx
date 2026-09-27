import { motion } from 'framer-motion'
import { spring } from '@/lib/motion'

interface Props {
  /** 0–1; anything over 1 wraps to a full ring in the over colour. */
  value: number
  size?: number
  stroke?: number
  /** A faint marker at this share of the ring — "where you should be by now". */
  marker?: number
  color?: string
  track?: string
  children?: React.ReactNode
}

/**
 * A progress ring. Direction is the encoding, colour is the emphasis: the
 * ring fills clockwise from the top, the tick shows the even-pace point, and
 * an over-budget ring completes and changes colour rather than spilling.
 */
export function Ring({
  value,
  size = 64,
  stroke = 6,
  marker,
  color = 'var(--sage)',
  track = 'var(--surface-sunken)',
  children,
}: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const fill = Math.max(0, Math.min(value, 1))

  const tick =
    marker !== undefined && marker > 0 && marker < 1
      ? (() => {
          const a = marker * Math.PI * 2 - Math.PI / 2
          const cx = size / 2
          const cy = size / 2
          const inner = r - stroke / 2 - 1.5
          const outer = r + stroke / 2 + 1.5
          return {
            x1: cx + Math.cos(a) * inner,
            y1: cy + Math.sin(a) * inner,
            x2: cx + Math.cos(a) * outer,
            y2: cy + Math.sin(a) * outer,
          }
        })()
      : null

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - fill) }}
          transition={spring.glide}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
        {tick && (
          <line
            {...tick}
            stroke="var(--ink-3)"
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.7}
          />
        )}
      </svg>
      {children && <div className="ring__inner">{children}</div>}
    </div>
  )
}
