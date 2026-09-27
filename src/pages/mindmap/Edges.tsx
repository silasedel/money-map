import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { MindEdge } from '@/lib/types'
import { actions } from '@/lib/store'
import { pathFor, scene, solveEdge } from './scene'
import { useCalmMotion } from '@/lib/motion'
import { Icon } from '@/components/Icon'

interface Props {
  edges: MindEdge[]
  selected: string | null
  onSelect: (id: string | null) => void
  /** Owned by the page — the raw stroke while a connection is being drawn. */
  inkRef: RefObject<SVGPathElement>
}

/* Elastic constants. Loose enough to visibly trail a yanked bubble, damped
   enough that it settles in about a third of a second with one clear rebound
   rather than wobbling like jelly. */
const K = 0.28
const DAMP = 0.71

interface Lag {
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * Connections live in one SVG that never re-renders on movement. React owns the
 * *set* of edges; this component's animation loop owns their shape.
 *
 * Each connection carries a little mass: its belly is a spring chasing where
 * the curve geometrically wants to be. Drag a bubble and the line trails, then
 * whips past and settles — the same physics the bubbles themselves use, so a
 * yanked connection reads as something attached rather than something redrawn.
 */
export function Edges({ edges, selected, onSelect, inkRef }: Props) {
  const lines = useRef(new Map<string, SVGPathElement>())
  const halos = useRef(new Map<string, SVGPathElement>())
  const hits = useRef(new Map<string, SVGPathElement>())
  const capA = useRef(new Map<string, SVGCircleElement>())
  const capB = useRef(new Map<string, SVGCircleElement>())
  const knobRef = useRef<HTMLDivElement>(null)

  const lag = useRef(new Map<string, Lag>())
  const edgesRef = useRef(edges)
  edgesRef.current = edges

  const [hovered, setHovered] = useState<string | null>(null)
  const focusRef = useRef<string | null>(null)
  focusRef.current = selected ?? hovered

  const calm = useCalmMotion()
  const calmRef = useRef(calm)
  calmRef.current = calm

  const raf = useRef(0)
  const drawRef = useRef<(integrate: boolean) => boolean>(() => false)

  useEffect(() => {
    /**
     * One pass over every edge. `integrate` advances the elastic by a frame;
     * without it this just repaints from the current state, which is what the
     * layout pass needs so a new edge is never seen without a path.
     */
    const draw = (integrate: boolean) => {
      let active = false

      for (const e of edgesRef.current) {
        const a = scene.get(e.from)
        const b = scene.get(e.to)
        const line = lines.current.get(e.id)
        if (!a || !b || !line) continue

        const s = solveEdge(a, b, e.bow ?? 0, e.bowAt ?? 0.5)

        let st = lag.current.get(e.id)
        if (!st) {
          // First sight: start at rest so nothing springs in on load.
          st = { x: s.waist.x, y: s.waist.y, vx: 0, vy: 0 }
          lag.current.set(e.id, st)
        }

        if (integrate && !calmRef.current) {
          st.vx = (st.vx + (s.waist.x - st.x) * K) * DAMP
          st.vy = (st.vy + (s.waist.y - st.y) * K) * DAMP
          st.x += st.vx
          st.y += st.vy
        }

        if (calmRef.current) {
          st.x = s.waist.x
          st.y = s.waist.y
          st.vx = 0
          st.vy = 0
        } else if (
          Math.abs(st.vx) > 0.02 ||
          Math.abs(st.vy) > 0.02 ||
          Math.hypot(s.waist.x - st.x, s.waist.y - st.y) > 0.06
        ) {
          active = true
        } else {
          st.x = s.waist.x
          st.y = s.waist.y
          st.vx = 0
          st.vy = 0
        }

        const d = pathFor(s, st)
        line.setAttribute('d', d)
        halos.current.get(e.id)?.setAttribute('d', d)
        hits.current.get(e.id)?.setAttribute('d', d)

        const ca = capA.current.get(e.id)
        if (ca) {
          ca.setAttribute('cx', `${s.pa.x}`)
          ca.setAttribute('cy', `${s.pa.y}`)
        }
        const cb = capB.current.get(e.id)
        if (cb) {
          cb.setAttribute('cx', `${s.pb.x}`)
          cb.setAttribute('cy', `${s.pb.y}`)
        }

        if (focusRef.current === e.id && knobRef.current) {
          try {
            const mid = line.getPointAtLength(line.getTotalLength() / 2)
            knobRef.current.style.transform = `translate3d(${mid.x}px, ${mid.y}px, 0)`
          } catch {
            /* path not measurable on the very first paint */
          }
        }
      }

      return active
    }

    drawRef.current = draw

    /* Exactly one frame may ever be pending. `tick` clears the slot as it
       enters and only re-arms if something is still in motion — otherwise
       every scene notification would queue another callback on top of the one
       `tick` schedules for itself, and the springs would integrate dozens of
       steps per frame and snap instead of trailing. */
    const tick = () => {
      raf.current = 0
      if (draw(true)) schedule()
    }

    const schedule = () => {
      if (!raf.current) raf.current = requestAnimationFrame(tick)
    }

    schedule()
    const off = scene.subscribe(schedule)
    return () => {
      off()
      if (raf.current) cancelAnimationFrame(raf.current)
      raf.current = 0
    }
  }, [edges])

  // Paint synchronously on render so a newly added edge never shows up blank.
  useLayoutEffect(() => {
    drawRef.current(false)
  })

  // Retire springs for edges that no longer exist.
  useEffect(() => {
    const live = new Set(edges.map((e) => e.id))
    lag.current.forEach((_, id) => {
      if (!live.has(id)) lag.current.delete(id)
    })
  }, [edges])

  const focus = selected ?? hovered

  return (
    <>
      {/* A large, origin-centred coordinate space: world units map 1:1 to user
          units, and hit-testing works anywhere on the canvas. */}
      <svg
        className="edges"
        viewBox="-20000 -20000 40000 40000"
        width="40000"
        height="40000"
        style={{ left: -20000, top: -20000 }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="edgeInk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--edge-ink-a)" />
            <stop offset="100%" stopColor="var(--edge-ink-b)" />
          </linearGradient>
        </defs>

        {edges.map((e) => {
          const on = focus === e.id
          return (
            <g key={e.id} className={`edge ${on ? 'is-focus' : ''} ${selected === e.id ? 'is-selected' : ''}`}>
              <path ref={(el) => registry(halos.current, e.id, el)} className="edge__halo" />
              <path ref={(el) => registry(lines.current, e.id, el)} className="edge__line" />
              <circle ref={(el) => registry(capA.current, e.id, el)} className="edge__cap" r="3.2" />
              <circle ref={(el) => registry(capB.current, e.id, el)} className="edge__cap" r="3.2" />
              <path
                ref={(el) => registry(hits.current, e.id, el)}
                className="edge__hit"
                onPointerEnter={() => setHovered(e.id)}
                onPointerLeave={() => setHovered((h) => (h === e.id ? null : h))}
                onPointerDown={(ev) => {
                  ev.stopPropagation()
                  onSelect(selected === e.id ? null : e.id)
                }}
              />
            </g>
          )
        })}

        {/* The raw stroke, shown only while drawing. */}
        <path ref={inkRef} className="edge__ink" />
      </svg>

      {focus && (
        <div
          ref={knobRef}
          className="edgeKnob"
          onPointerEnter={() => setHovered(focus)}
          onPointerLeave={() => setHovered((h) => (h === focus ? null : h))}
        >
          <button
            className="edgeKnob__btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              actions.removeEdge(focus)
              onSelect(null)
              setHovered(null)
            }}
            aria-label="Remove connection"
            title="Remove connection"
          >
            <Icon name="close" size={12} strokeWidth={2.2} />
          </button>
        </div>
      )}
    </>
  )
}

function registry<T extends Element>(map: Map<string, T>, id: string, el: T | null) {
  if (el) map.set(id, el)
  else map.delete(id)
}
