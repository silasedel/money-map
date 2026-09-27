import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { MonthPoint } from '@/lib/finance'
import { money, monthLabel } from '@/lib/format'
import { useMeasure } from '@/lib/useMeasure'
import { spring } from '@/lib/motion'
import { INFLOW, OUTFLOW } from './palette'

const H = 208
const PAD_TOP = 16
const PAD_BOTTOM = 30
const MAX_BAR = 34
const R = 4

interface Props {
  data: MonthPoint[]
}

/**
 * Money in above the line, money out below it. Position relative to the
 * baseline is the primary encoding here — colour only reinforces it, which is
 * what lets the green/terracotta pair sit in the colour-vision floor band.
 * Both directions share one scale, so the two halves are honestly comparable.
 */
export function FlowChart({ data }: Props) {
  const [ref, { width }] = useMeasure<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const geom = useMemo(() => {
    if (!width || !data.length) return null

    const plotH = H - PAD_TOP - PAD_BOTTOM
    const maxIn = Math.max(...data.map((d) => d.income), 0)
    const maxOut = Math.max(...data.map((d) => d.expense), 0)
    const span = Math.max(maxIn + maxOut, 1)

    // Give each direction room in proportion to its own peak, but never let
    // one side collapse to a sliver.
    const upShare = Math.min(Math.max(maxIn / span, 0.24), 0.76)
    const baseline = PAD_TOP + plotH * upShare
    const upScale = maxIn > 0 ? (baseline - PAD_TOP) / maxIn : 0
    const downScale = maxOut > 0 ? (PAD_TOP + plotH - baseline) / maxOut : 0

    const col = width / data.length
    const barW = Math.min(col * 0.46, MAX_BAR)

    return { baseline, upScale, downScale, col, barW, plotH }
  }, [data, width])

  const active = hover !== null ? data[hover] : null

  return (
    <div className="flow" ref={ref} onPointerLeave={() => setHover(null)}>
      {geom && (
        <svg width={width} height={H} className="flow__svg">
          {/* Recessive baseline — the only rule the chart needs. */}
          <line
            x1={0}
            x2={width}
            y1={geom.baseline}
            y2={geom.baseline}
            stroke="var(--hairline-strong)"
            strokeWidth={1}
            shapeRendering="crispEdges"
          />

          {data.map((d, i) => {
            const cx = geom.col * i + geom.col / 2
            const x = cx - geom.barW / 2
            const isOn = hover === i
            return (
              <g key={d.key} className={`flow__col ${isOn ? 'is-on' : ''}`}>
                {isOn && (
                  <rect
                    x={cx - geom.col / 2 + 1}
                    y={PAD_TOP - 8}
                    width={geom.col - 2}
                    height={geom.plotH + 16}
                    rx={8}
                    fill="rgba(44,40,35,0.035)"
                  />
                )}

                {d.income > 0 && (
                  <motion.path
                    d={barUp(x, geom.baseline - 1, geom.barW, d.income * geom.upScale)}
                    fill={INFLOW}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isOn || hover === null ? 1 : 0.34 }}
                    transition={{ duration: 0.18 }}
                  />
                )}
                {d.expense > 0 && (
                  <motion.path
                    d={barDown(x, geom.baseline + 1, geom.barW, d.expense * geom.downScale)}
                    fill={OUTFLOW}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isOn || hover === null ? 1 : 0.34 }}
                    transition={{ duration: 0.18 }}
                  />
                )}

                <text
                  className="flow__month"
                  x={cx}
                  y={H - 10}
                  textAnchor="middle"
                  fill={isOn ? 'var(--ink-2)' : 'var(--ink-4)'}
                >
                  {monthLabel(d.key)}
                </text>

                {/* Hit target spans the whole column, not just the bars. */}
                <rect
                  x={cx - geom.col / 2}
                  y={0}
                  width={geom.col}
                  height={H}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover((h) => (h === i ? null : h))}
                />
              </g>
            )
          })}
        </svg>
      )}

      <AnimatePresence>
        {active && geom && (
          <motion.div
            className="flow__tip"
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={spring.snap}
            style={{
              left: Math.min(
                Math.max(geom.col * (hover ?? 0) + geom.col / 2, 74),
                width - 74,
              ),
            }}
          >
            <div className="flow__tipHead">{monthLabel(active.key, true)}</div>
            <div className="flow__tipRow">
              <span className="flow__dot" style={{ background: INFLOW }} />
              <span className="flow__tipKey">In</span>
              <span className="flow__tipVal num">{money(active.income)}</span>
            </div>
            <div className="flow__tipRow">
              <span className="flow__dot" style={{ background: OUTFLOW }} />
              <span className="flow__tipKey">Out</span>
              <span className="flow__tipVal num">{money(active.expense)}</span>
            </div>
            <div className="flow__tipRow flow__tipRow--net">
              <span className="flow__tipKey">Net</span>
              <span className="flow__tipVal num">
                {active.net >= 0 ? '+' : '−'}
                {money(Math.abs(active.net))}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Bar rising from the baseline, rounded only on the far end. */
function barUp(x: number, base: number, w: number, h: number): string {
  const top = base - Math.max(h, 2)
  const r = Math.min(R, w / 2, Math.max(h, 2))
  return `M ${x} ${base} L ${x} ${top + r} Q ${x} ${top} ${x + r} ${top} L ${x + w - r} ${top} Q ${x + w} ${top} ${x + w} ${top + r} L ${x + w} ${base} Z`
}

function barDown(x: number, base: number, w: number, h: number): string {
  const bot = base + Math.max(h, 2)
  const r = Math.min(R, w / 2, Math.max(h, 2))
  return `M ${x} ${base} L ${x} ${bot - r} Q ${x} ${bot} ${x + r} ${bot} L ${x + w - r} ${bot} Q ${x + w} ${bot} ${x + w} ${bot - r} L ${x + w} ${base} Z`
}
