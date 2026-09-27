import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { actions, shallowArray, snapshot, useStore } from '@/lib/store'
import type { Viewport } from '@/lib/types'
import { Icon } from '@/components/Icon'
import { spring } from '@/lib/motion'
import { capture, release } from '@/lib/pointer'
import { Bubble, COLORS } from './Bubble'
import { Edges as EdgesRaw } from './Edges'
import { boundaryPoint, distillStroke, scene, type Point } from './scene'
import './mindmap.css'

const Edges = memo(EdgesRaw)

const ZOOM_MIN = 0.28
const ZOOM_MAX = 2.4
const NEW_W = 196
const NEW_H = 96
/** How far outside a bubble a released connection still counts, in world units. */
const CATCH = 34

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export function MindMapPage() {
  const nodes = useStore((s) => s.nodes, shallowArray)
  const edges = useStore((s) => s.edges, shallowArray)

  const canvasRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const inkRef = useRef<SVGPathElement>(null)

  const vp = useRef<Viewport>({ ...snapshot().viewport })
  const [zoomPct, setZoomPct] = useState(() => Math.round(vp.current.zoom * 100))

  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [connectTarget, setConnectTarget] = useState<string | null>(null)

  /* ── Viewport plumbing ─────────────────────────────── */

  const applyTransform = useCallback(() => {
    const { x, y, zoom } = vp.current
    const world = worldRef.current
    if (world) {
      world.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`
      // Anything that must stay a constant on-screen size divides by this.
      world.style.setProperty('--inv-z', `${1 / zoom}`)
    }
    const grid = gridRef.current
    if (grid) {
      const gap = 26 * zoom
      grid.style.backgroundSize = `${gap}px ${gap}px`
      grid.style.backgroundPosition = `${x}px ${y}px`
      grid.style.opacity = `${clamp((zoom - 0.34) * 1.6, 0, 1)}`
    }
  }, [])

  useLayoutEffect(applyTransform, [applyTransform])

  const commitTimer = useRef<number>()
  const commitViewport = useCallback(() => {
    window.clearTimeout(commitTimer.current)
    commitTimer.current = window.setTimeout(() => {
      actions.setViewport({ ...vp.current })
    }, 400)
  }, [])

  const setZoomLabel = useCallback(() => {
    const next = Math.round(vp.current.zoom * 100)
    setZoomPct((prev) => (prev === next ? prev : next))
  }, [])

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const { x, y, zoom } = vp.current
    return {
      x: (clientX - rect.left - x) / zoom,
      y: (clientY - rect.top - y) / zoom,
    }
  }, [])

  const getZoom = useCallback(() => vp.current.zoom, [])

  /** Zoom about a screen-space point so the content under it stays put. */
  const zoomAt = useCallback(
    (factor: number, screenX: number, screenY: number) => {
      const rect = canvasRef.current!.getBoundingClientRect()
      const cx = screenX - rect.left
      const cy = screenY - rect.top
      const prev = vp.current.zoom
      const next = clamp(prev * factor, ZOOM_MIN, ZOOM_MAX)
      if (next === prev) return
      vp.current = {
        zoom: next,
        x: cx - (cx - vp.current.x) * (next / prev),
        y: cy - (cy - vp.current.y) * (next / prev),
      }
      applyTransform()
      setZoomLabel()
      commitViewport()
    },
    [applyTransform, commitViewport, setZoomLabel],
  )

  /* Native listener so we can actually preventDefault the page-zoom gesture. */
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.0102), e.clientX, e.clientY)
      } else {
        vp.current = {
          ...vp.current,
          x: vp.current.x - e.deltaX,
          y: vp.current.y - e.deltaY,
        }
        applyTransform()
        commitViewport()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [applyTransform, commitViewport, zoomAt])

  /** Eased flight to a target viewport — used by fit and the zoom buttons. */
  const flyTo = useCallback(
    (target: Viewport, ms = 480) => {
      const from = { ...vp.current }
      const start = performance.now()
      const step = (now: number) => {
        const t = clamp((now - start) / ms, 0, 1)
        const e = 1 - Math.pow(1 - t, 3)
        vp.current = {
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          zoom: from.zoom + (target.zoom - from.zoom) * e,
        }
        applyTransform()
        setZoomLabel()
        if (t < 1) requestAnimationFrame(step)
        else commitViewport()
      }
      requestAnimationFrame(step)
    },
    [applyTransform, commitViewport, setZoomLabel],
  )

  const fitToContent = useCallback(() => {
    const el = canvasRef.current
    if (!el || nodes.length === 0) return
    const pad = 110
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + n.w)
      maxY = Math.max(maxY, n.y + n.h)
    }
    const rect = el.getBoundingClientRect()
    const zoom = clamp(
      Math.min(
        (rect.width - pad * 2) / Math.max(maxX - minX, 1),
        (rect.height - pad * 2) / Math.max(maxY - minY, 1),
      ),
      ZOOM_MIN,
      1.15,
    )
    flyTo({
      zoom,
      x: rect.width / 2 - ((minX + maxX) / 2) * zoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * zoom,
    })
  }, [flyTo, nodes])

  /* ── Creating bubbles ──────────────────────────────── */

  const createAt = useCallback(
    (world: { x: number; y: number }) => {
      const id = actions.addNode({
        x: Math.round(world.x - NEW_W / 2),
        y: Math.round(world.y - NEW_H / 2),
        w: NEW_W,
        h: NEW_H,
        text: '',
        color: COLORS[snapshot().nodes.length % COLORS.length],
      })
      setSelected(id)
      setSelectedEdge(null)
      setEditing(id)
      return id
    },
    [],
  )

  const createAtCenter = useCallback(() => {
    const el = canvasRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const jitter = (Math.random() - 0.5) * 46
    createAt(
      toWorld(rect.left + rect.width / 2 + jitter, rect.top + rect.height / 2 + jitter),
    )
  }, [createAt, toWorld])

  /* ── Canvas gestures: pan, deselect, create ────────── */

  const pan = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null)
  const connect = useRef<{ from: string; stroke: Point[] } | null>(null)

  /** Paint the raw stroke as it's drawn. It is never what gets saved. */
  const drawInk = useCallback((stroke: Point[]) => {
    const el = inkRef.current
    if (!el) return
    if (stroke.length < 2) {
      el.removeAttribute('d')
      return
    }
    let d = `M ${stroke[0].x} ${stroke[0].y}`
    for (let i = 1; i < stroke.length; i++) d += ` L ${stroke[i].x} ${stroke[i].y}`
    el.setAttribute('d', d)
  }, [])

  const clearInk = useCallback(() => {
    inkRef.current?.removeAttribute('d')
  }, [])

  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    capture(e.currentTarget as HTMLElement, e.pointerId)
    pan.current = {
      px: e.clientX,
      py: e.clientY,
      ox: vp.current.x,
      oy: vp.current.y,
      moved: false,
    }
  }, [])

  const onCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const c = connect.current
      if (c) {
        const world = toWorld(e.clientX, e.clientY)
        const last = c.stroke[c.stroke.length - 1]
        // Thin the stroke as it's captured — sub-pixel jitter tells us nothing.
        if (!last || Math.hypot(world.x - last.x, world.y - last.y) > 3) {
          c.stroke.push(world)
          drawInk(c.stroke)
        }
        const hit = scene.hitTest(world, c.from, CATCH)
        setConnectTarget((prev) => (prev === hit ? prev : hit))
        return
      }

      const p = pan.current
      if (!p) return
      const dx = e.clientX - p.px
      const dy = e.clientY - p.py
      if (!p.moved && Math.hypot(dx, dy) > 3) p.moved = true
      if (!p.moved) return
      vp.current = { ...vp.current, x: p.ox + dx, y: p.oy + dy }
      applyTransform()
    },
    [applyTransform, toWorld],
  )

  const onCanvasPointerUp = useCallback(
    (e: React.PointerEvent) => {
      release(e.currentTarget as HTMLElement, e.pointerId)

      const c = connect.current
      if (c) {
        const world = toWorld(e.clientX, e.clientY)
        const hit = scene.hitTest(world, c.from, CATCH)
        const fromRect = scene.get(c.from)
        const toRect = hit ? scene.get(hit) : undefined

        if (hit && fromRect && toRect) {
          // Throw the scribble away and keep only its intent: how far it bowed
          // off the straight run, and where. The connector redraws as one
          // clean curve that still goes the way it was drawn.
          const a = c.stroke[0]
          const b = { x: toRect.x + toRect.w / 2, y: toRect.y + toRect.h / 2 }
          const { bow, bowAt } = distillStroke(c.stroke, a, b)
          actions.connect(c.from, hit, bow || undefined, bow ? bowAt : undefined)
        }

        connect.current = null
        setConnectTarget(null)
        clearInk()
        pan.current = null
        return
      }

      const p = pan.current
      pan.current = null
      if (!p) return
      if (p.moved) {
        commitViewport()
      } else {
        setSelected(null)
        setEditing(null)
        setSelectedEdge(null)
      }
    },
    [commitViewport, toWorld],
  )

  const onStartConnect = useCallback(
    (id: string, e: React.PointerEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return
      capture(canvas, e.pointerId)
      const from = scene.get(id)
      const world = toWorld(e.clientX, e.clientY)
      // Start the stroke on the outline directly under the grab, wherever that
      // is — so pulling from the middle of an edge, or from just inside or
      // outside it, all begin from the point you actually touched.
      const start = from ? boundaryPoint(from, world).p : world
      connect.current = { from: id, stroke: [start] }
      pan.current = null
      setSelected(id)
      setSelectedEdge(null)
    },
    [toWorld],
  )

  /**
   * Stable identity matters here: every bubble is memoised, so an inline
   * handler would invalidate all of them on any store write (a viewport
   * commit, a transaction added on another page) and re-render the whole
   * canvas. The functional update keeps `editing` out of the dependencies.
   */
  const handleSelect = useCallback((id: string | null) => {
    setSelected(id)
    setSelectedEdge(null)
    setEditing((cur) => (cur === id ? cur : null))
  }, [])

  /* ── Keyboard ──────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if ((e.key === 'Backspace' || e.key === 'Delete') && !editing) {
        if (selected) {
          e.preventDefault()
          actions.removeNode(selected)
          setSelected(null)
        } else if (selectedEdge) {
          e.preventDefault()
          actions.removeEdge(selectedEdge)
          setSelectedEdge(null)
        }
      }
      if (e.key === 'Enter' && selected && !editing) {
        e.preventDefault()
        setEditing(selected)
      }
      if (e.key === 'Escape') {
        setSelected(null)
        setSelectedEdge(null)
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        zoomStep(1.25)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault()
        zoomStep(1 / 1.25)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault()
        resetZoom()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selectedEdge, editing])

  const zoomStep = useCallback(
    (factor: number) => {
      const el = canvasRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const prev = vp.current.zoom
      const next = clamp(prev * factor, ZOOM_MIN, ZOOM_MAX)
      const cx = rect.width / 2
      const cy = rect.height / 2
      flyTo(
        {
          zoom: next,
          x: cx - (cx - vp.current.x) * (next / prev),
          y: cy - (cy - vp.current.y) * (next / prev),
        },
        260,
      )
    },
    [flyTo],
  )

  const resetZoom = useCallback(() => {
    const el = canvasRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const prev = vp.current.zoom
    const cx = rect.width / 2
    const cy = rect.height / 2
    flyTo({
      zoom: 1,
      x: cx - (cx - vp.current.x) * (1 / prev),
      y: cy - (cy - vp.current.y) * (1 / prev),
    })
  }, [flyTo])

  /* ── Render ────────────────────────────────────────── */

  return (
    <div className="mm">
      <div
        ref={canvasRef}
        className={`mm__canvas ${connectTarget !== null || connect.current ? 'is-connecting' : ''}`}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        onDoubleClick={(e) => {
          if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('mm__grid'))
            return
          createAt(toWorld(e.clientX, e.clientY))
        }}
      >
        <div ref={gridRef} className="mm__grid" />

        <div ref={worldRef} className="mm__world">
          <Edges
            edges={edges}
            selected={selectedEdge}
            onSelect={setSelectedEdge}
            inkRef={inkRef}
          />

          <AnimatePresence>
            {nodes.map((n) => (
              <Bubble
                key={n.id}
                node={n}
                selected={selected === n.id}
                editing={editing === n.id}
                isConnectTarget={connectTarget === n.id}
                getZoom={getZoom}
                onSelect={handleSelect}
                onEdit={setEditing}
                onStartConnect={onStartConnect}
              />
            ))}
          </AnimatePresence>
        </div>

        <div className="mm__vignette" />
      </div>

      {/* Floating chrome */}
      <div className="mm__head">
        <h1 className="t-page-title">Mind Map</h1>
        <p className="mm__headSub">
          {nodes.length === 0
            ? 'An empty canvas'
            : `${nodes.length} bubble${nodes.length === 1 ? '' : 's'}${
                edges.length ? ` · ${edges.length} connection${edges.length === 1 ? '' : 's'}` : ''
              }`}
        </p>
      </div>

      <AnimatePresence>
        {nodes.length === 0 && (
          <motion.div
            className="mm__blank"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={spring.calm}
          >
            <div className="mm__blankArt">
              <span className="mm__blankBub mm__blankBub--a" />
              <span className="mm__blankBub mm__blankBub--b" />
              <span className="mm__blankBub mm__blankBub--c" />
              <svg viewBox="0 0 180 96" className="mm__blankLines" aria-hidden="true">
                <path d="M52 34 C 74 34, 82 52, 106 52" />
                <path d="M46 46 C 58 62, 62 70, 82 74" />
              </svg>
            </div>
            <h2 className="mm__blankTitle">Start with one thought</h2>
            <p className="mm__blankText">
              Double-click anywhere to drop a bubble. Drag from its edge to
              connect it to another.
            </p>
            <button className="mm__blankBtn" onClick={createAtCenter}>
              <Icon name="plus" size={15} strokeWidth={2} />
              New bubble
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="mm__dock"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring.calm, delay: 0.08 }}
      >
        <button className="mm__dockBtn mm__dockBtn--primary" onClick={createAtCenter} title="New bubble">
          <Icon name="plus" size={17} strokeWidth={2.1} />
        </button>
        <span className="mm__dockDiv" />
        <button className="mm__dockBtn" onClick={() => zoomStep(1 / 1.25)} title="Zoom out">
          <Icon name="minus" size={15} strokeWidth={2.1} />
        </button>
        <button className="mm__dockZoom num" onClick={resetZoom} title="Reset to 100%">
          {zoomPct}%
        </button>
        <button className="mm__dockBtn" onClick={() => zoomStep(1.25)} title="Zoom in">
          <Icon name="plus" size={15} strokeWidth={2.1} />
        </button>
        <span className="mm__dockDiv" />
        <button
          className="mm__dockBtn"
          onClick={fitToContent}
          disabled={nodes.length === 0}
          title="Fit to content"
        >
          <Icon name="crosshair" size={16} strokeWidth={1.8} />
        </button>
      </motion.div>
    </div>
  )
}
