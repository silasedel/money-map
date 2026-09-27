import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
  AnimatePresence,
} from 'framer-motion'
import type { BubbleColor, MindNode } from '@/lib/types'
import { actions } from '@/lib/store'
import { spring, useCalmMotion } from '@/lib/motion'
import { scene } from './scene'
import { Icon } from '@/components/Icon'

export const MIN_W = 128
export const MIN_H = 64
export const MAX_W = 720
export const MAX_H = 520

export const COLORS: BubbleColor[] = ['sand', 'sage', 'sky', 'blush', 'lilac', 'mist']

type Corner = 'nw' | 'ne' | 'sw' | 'se'

interface Props {
  node: MindNode
  selected: boolean
  editing: boolean
  isConnectTarget: boolean
  getZoom: () => number
  onSelect: (id: string | null) => void
  onEdit: (id: string | null) => void
  onStartConnect: (id: string, e: React.PointerEvent) => void
}

/** Only the visible affordance — a connection may start anywhere on a band. */
type PortSide = 't' | 'r' | 'b' | 'l'
const SIDES: PortSide[] = ['t', 'r', 'b', 'l']
const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

function BubbleImpl({
  node,
  selected,
  editing,
  isConnectTarget,
  getZoom,
  onSelect,
  onEdit,
  onStartConnect,
}: Props) {
  const x = useMotionValue(node.x)
  const y = useMotionValue(node.y)
  const w = useMotionValue(node.w)
  const h = useMotionValue(node.h)

  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const calm = useCalmMotion()

  const inputRef = useRef<HTMLTextAreaElement>(null)

  /* ── The physical bit ──────────────────────────────────
     Tilt is derived from the bubble's own velocity and then run through a
     spring, so it leans into a throw and wobbles upright when you let go.
     Nothing here is a keyframe — it's all reaction. */
  const vx = useVelocity(x)
  const vy = useVelocity(y)
  const tiltTarget = useTransform<number, number>(
    [vx, vy],
    ([dx, dy]) => clamp(dx * 0.0075, -7, 7) + clamp(dy * 0.0018, -2, 2),
  )
  const tilt = useSpring(tiltTarget, {
    stiffness: 230,
    damping: 15,
    mass: 0.6,
    restDelta: 0.01,
  })
  const rotate = calm ? 0 : tilt

  /* Keep the live scene in sync with wherever this bubble actually is. */
  useEffect(() => {
    const push = () =>
      scene.put(node.id, { x: x.get(), y: y.get(), w: w.get(), h: h.get() })
    push()
    const offs = [
      x.on('change', push),
      y.on('change', push),
      w.on('change', push),
      h.on('change', push),
    ]
    return () => offs.forEach((off) => off())
  }, [node.id, x, y, w, h])

  useEffect(() => () => scene.drop(node.id), [node.id])

  /* Adopt external changes, but never fight a gesture in progress. */
  useEffect(() => {
    if (!dragging && !resizing) {
      x.set(node.x)
      y.set(node.y)
    }
  }, [node.x, node.y, dragging, resizing, x, y])

  useEffect(() => {
    if (!resizing) {
      w.set(node.w)
      h.set(node.h)
    }
  }, [node.w, node.h, resizing, w, h])

  /* ── Drag ──────────────────────────────────────────────
     Gestures listen on the window rather than relying on pointer capture of
     the element that started them. Handles come and go with hover state, and
     a gesture must never die because its handle unmounted underneath it. */
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (editing || e.button !== 0) return
      if ((e.target as HTMLElement).closest('[data-no-drag]')) return

      e.stopPropagation()
      onSelect(node.id)
      actions.bringToFront(node.id)

      const startX = e.clientX
      const startY = e.clientY
      const ox = x.get()
      const oy = y.get()
      let moved = false
      setDragging(true)

      const onMove = (ev: PointerEvent) => {
        const z = getZoom()
        const dx = (ev.clientX - startX) / z
        const dy = (ev.clientY - startY) / z
        if (!moved && Math.hypot(dx, dy) > 2) moved = true
        x.set(ox + dx)
        y.set(oy + dy)
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        // Settling back to scale 1 runs through `spring.bouncy` — that
        // overshoot is the "set it down on the table" beat.
        setDragging(false)
        if (moved) {
          actions.updateNode(node.id, {
            x: Math.round(x.get()),
            y: Math.round(y.get()),
          })
        }
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [editing, getZoom, node.id, onSelect, x, y],
  )

  /* ── Resize — from any corner ──────────────────────── */
  const startResize = useCallback(
    (corner: Corner) => (e: React.PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      onSelect(node.id)

      const startX = e.clientX
      const startY = e.clientY
      const o = { x: x.get(), y: y.get(), w: w.get(), h: h.get() }
      setResizing(true)

      const onMove = (ev: PointerEvent) => {
        const z = getZoom()
        const dx = (ev.clientX - startX) / z
        const dy = (ev.clientY - startY) / z

        let nw = o.w
        let nh = o.h
        let nx = o.x
        let ny = o.y

        if (corner === 'se' || corner === 'ne') nw = clamp(o.w + dx, MIN_W, MAX_W)
        if (corner === 'sw' || corner === 'nw') {
          nw = clamp(o.w - dx, MIN_W, MAX_W)
          nx = o.x + (o.w - nw) // west edge moves, east edge stays put
        }
        if (corner === 'se' || corner === 'sw') nh = clamp(o.h + dy, MIN_H, MAX_H)
        if (corner === 'ne' || corner === 'nw') {
          nh = clamp(o.h - dy, MIN_H, MAX_H)
          ny = o.y + (o.h - nh)
        }

        w.set(nw)
        h.set(nh)
        x.set(nx)
        y.set(ny)
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
        setResizing(false)
        actions.updateNode(node.id, {
          x: Math.round(x.get()),
          y: Math.round(y.get()),
          w: Math.round(w.get()),
          h: Math.round(h.get()),
        })
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [getZoom, node.id, onSelect, w, h, x, y],
  )

  /* ── Editing ───────────────────────────────────────── */
  useEffect(() => {
    if (!editing) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
    autosize(el)
  }, [editing])

  const commit = useCallback(() => {
    const el = inputRef.current
    if (el) actions.updateNode(node.id, { text: el.value })
    onEdit(null)
  }, [node.id, onEdit])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      commit()
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      commit()
    }
    e.stopPropagation()
  }

  /* Handles stay put through a gesture — only a plain hover-out hides them,
     and editing text never takes them away. */
  const showChrome = hovered || selected || resizing
  const empty = !node.text.trim()

  return (
    <motion.div
      className={[
        'bub',
        `bub--${node.color}`,
        selected ? 'is-selected' : '',
        dragging ? 'is-dragging' : '',
        editing ? 'is-editing' : '',
        isConnectTarget ? 'is-target' : '',
      ].join(' ')}
      style={{ x, y, width: w, height: h, rotate }}
      initial={{ opacity: 0, scale: 0.68 }}
      animate={{
        opacity: 1,
        scale: dragging ? 1.032 : resizing ? 1.012 : 1,
      }}
      exit={{ opacity: 0, scale: 0.72, transition: { duration: 0.16 } }}
      transition={{
        default: dragging || resizing ? spring.snap : spring.bouncy,
        opacity: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
      }}
      onPointerDown={onPointerDown}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onEdit(node.id)
      }}
    >
      <div className="bub__body">
        {editing ? (
          <textarea
            ref={inputRef}
            data-no-drag
            className="bub__text bub__input"
            defaultValue={node.text}
            onBlur={commit}
            onKeyDown={onKeyDown}
            onInput={(e) => autosize(e.currentTarget)}
            onPointerDown={(e) => e.stopPropagation()}
            spellCheck={false}
            placeholder="Type something…"
          />
        ) : (
          <div className={`bub__text ${empty ? 'is-empty' : ''}`}>
            {node.text || 'Double-click to edit'}
          </div>
        )}
      </div>

      {/* Edges pull connections. The whole band is grabbable, not just the dot —
          the dot is only there to say so. */}
      <AnimatePresence>
        {showChrome &&
          !dragging &&
          SIDES.map((side) => (
            <motion.div
              key={`port-${side}`}
              data-no-drag
              className={`bub__port bub__port--${side}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              onPointerDown={(e) => {
                e.stopPropagation()
                onStartConnect(node.id, e)
              }}
              title="Drag to connect"
            >
              <span className="bub__portDot" />
            </motion.div>
          ))}
      </AnimatePresence>

      {/* Corners resize. */}
      <AnimatePresence>
        {showChrome &&
          !dragging &&
          CORNERS.map((corner) => (
            <motion.div
              key={`grip-${corner}`}
              data-no-drag
              className={`bub__grip bub__grip--${corner}`}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={spring.snap}
              onPointerDown={startResize(corner)}
            >
              <span />
            </motion.div>
          ))}
      </AnimatePresence>

      {/* Palette + delete */}
      <AnimatePresence>
        {selected && !dragging && !resizing && (
          <motion.div
            data-no-drag
            className="bub__bar"
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={spring.body}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {COLORS.map((c) => (
              <button
                key={c}
                className={`bub__swatch bub__swatch--${c} ${c === node.color ? 'is-on' : ''}`}
                onClick={() => actions.updateNode(node.id, { color: c })}
                aria-label={c}
              />
            ))}
            <span className="bub__barDiv" />
            <button
              className="bub__del"
              onClick={() => {
                onSelect(null)
                actions.removeNode(node.id)
              }}
              aria-label="Delete bubble"
            >
              <Icon name="trash" size={13} strokeWidth={1.8} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function autosize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export const Bubble = memo(BubbleImpl)
