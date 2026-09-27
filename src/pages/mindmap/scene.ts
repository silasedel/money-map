/**
 * The mind map's live geometry, deliberately kept *outside* React.
 *
 * While a bubble is being dragged its position changes 60+ times a second.
 * Routing that through state would re-render every node and every edge on
 * every frame. Instead bubbles write their rect here as they move, and the
 * edge layer redraws itself from these rects in a single rAF pass — so
 * dragging one node costs one path rewrite per connected edge, and nothing
 * else in the tree even knows it happened.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

type Sub = () => void

const rects = new Map<string, Rect>()
const subs = new Set<Sub>()
let frame = 0

function flush() {
  frame = 0
  subs.forEach((fn) => fn())
}

/** Coalesce every write in a frame into one notification. */
export function invalidate() {
  if (frame) return
  frame = requestAnimationFrame(flush)
}

export const scene = {
  rects,

  put(id: string, rect: Rect) {
    const prev = rects.get(id)
    if (
      prev &&
      prev.x === rect.x &&
      prev.y === rect.y &&
      prev.w === rect.w &&
      prev.h === rect.h
    ) {
      return
    }
    rects.set(id, rect)
    invalidate()
  },

  get(id: string): Rect | undefined {
    return rects.get(id)
  },

  drop(id: string) {
    if (rects.delete(id)) invalidate()
  },

  subscribe(fn: Sub) {
    subs.add(fn)
    return () => {
      subs.delete(fn)
    }
  },

  /**
   * The node under a world-space point — or near it. `margin` extends every
   * bubble's catch area outward, so releasing a connection just past the edge
   * still lands, and the nearest candidate wins rather than the first found.
   */
  hitTest(p: Point, exclude?: string, margin = 0): string | null {
    let found: string | null = null
    let bestD = Infinity
    rects.forEach((r, id) => {
      if (id === exclude) return
      const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w))
      const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h))
      const d = Math.hypot(dx, dy)
      // `<=` so that on a tie the later entry wins, matching paint order.
      if (d <= margin && d <= bestD) {
        bestD = d
        found = id
      }
    })
    return found
  },
}

/* ── Curve geometry ───────────────────────────────────── */

/** Matches the bubble's CSS corner radius, so anchors ride the real outline. */
const BUBBLE_RADIUS = 21

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

const centerOf = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

/**
 * Where a ray leaving the bubble's centre crosses its outline, and the outward
 * normal there.
 *
 * Connections attach *anywhere* on the perimeter rather than at four fixed
 * points, so an anchor slides continuously around the shape as either end
 * moves instead of jumping between sides. The rounded corners are solved as
 * real arcs: on a flat run the normal is the side's, and across a corner it
 * rotates smoothly from one side's normal to the next, which is what keeps the
 * curve from flicking as an anchor rounds a corner.
 */
export function boundaryPoint(
  rect: Rect,
  toward: Point,
): { p: Point; n: Point } {
  const c = centerOf(rect)
  const hw = rect.w / 2
  const hh = rect.h / 2
  const r = Math.min(BUBBLE_RADIUS, hw, hh)

  let dx = toward.x - c.x
  let dy = toward.y - c.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) {
    // Degenerate aim (concentric bubbles) — pick a stable direction.
    dx = 1
    dy = 0
  } else {
    dx /= len
    dy /= len
  }

  // Exit through the sharp rectangle first.
  const tx = Math.abs(dx) > 1e-6 ? hw / Math.abs(dx) : Infinity
  const ty = Math.abs(dy) > 1e-6 ? hh / Math.abs(dy) : Infinity
  let t = Math.min(tx, ty)
  let px = c.x + dx * t
  let py = c.y + dy * t

  // In a corner region the true outline is the arc, not the sharp corner.
  if (Math.abs(px - c.x) > hw - r && Math.abs(py - c.y) > hh - r) {
    const kx = c.x + Math.sign(px - c.x) * (hw - r)
    const ky = c.y + Math.sign(py - c.y) * (hh - r)
    const mx = c.x - kx
    const my = c.y - ky
    const b = dx * mx + dy * my
    const cc = mx * mx + my * my - r * r
    const disc = Math.max(b * b - cc, 0)
    t = -b + Math.sqrt(disc)
    px = c.x + dx * t
    py = c.y + dy * t
    return { p: { x: px, y: py }, n: { x: (px - kx) / r, y: (py - ky) / r } }
  }

  const n =
    tx < ty ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) }
  return { p: { x: px, y: py }, n }
}

/** The point the curve's belly wants to pass through. */
function bellyPoint(p0: Point, p1: Point, bow: number, at: number): Point {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const len = Math.hypot(dx, dy) || 1
  return {
    x: p0.x + dx * at + (-dy / len) * bow,
    y: p0.y + dy * at + (dx / len) * bow,
  }
}

export interface EdgeSolve {
  pa: Point
  pb: Point
  na: Point
  nb: Point
  /** Where the curve's belly wants to sit, before any elastic lag. */
  waist: Point
  bowAt: number
}

/**
 * Resolve an edge to its endpoints and its resting belly. `bow` is the signed
 * perpendicular offset distilled from whatever the user drew; `bowAt` is where
 * along the run that bulge peaks.
 *
 * Two passes: aim both anchors at the belly implied by the centre-to-centre
 * run, then re-derive the belly from the anchors that produced. One pass would
 * be circular — the anchors depend on the belly and the belly on the anchors —
 * and two is enough for the result to sit still.
 */
export function solveEdge(a: Rect, b: Rect, bow = 0, bowAt = 0.5): EdgeSolve {
  const at = clamp01(bowAt)

  const aim = bellyPoint(centerOf(a), centerOf(b), bow, at)
  const A = boundaryPoint(a, aim)
  const B = boundaryPoint(b, aim)

  return {
    pa: A.p,
    pb: B.p,
    na: A.n,
    nb: B.n,
    bowAt: at,
    waist: bellyPoint(A.p, B.p, bow, at),
  }
}

/**
 * A cubic that leaves each bubble perpendicular to its edge — so the line
 * appears to grow out of the shape rather than be pinned to it — and bellies
 * through `waist`. Because a cubic's midpoint sits at (pa + 3c1 + 3c2 + pb)/8,
 * displacing both controls by 4/3 of the desired offset lands the curve on it.
 */
export function pathFor(s: EdgeSolve, waist: Point): string {
  const { pa, pb, na, nb, bowAt } = s
  const d = dist(pa, pb)
  const k = Math.min(Math.max(d * 0.42, 32), 190)

  const midX = (pa.x + pb.x) / 2
  const midY = (pa.y + pb.y) / 2
  const offX = (waist.x - midX) * (4 / 3)
  const offY = (waist.y - midY) * (4 / 3)

  // Skew the bulge toward wherever the peak actually was.
  const w1 = 2 * (1 - bowAt)
  const w2 = 2 * bowAt

  const c1 = { x: pa.x + na.x * k + offX * w1, y: pa.y + na.y * k + offY * w1 }
  const c2 = { x: pb.x + nb.x * k + offX * w2, y: pb.y + nb.y * k + offY * w2 }

  return `M ${r(pa.x)} ${r(pa.y)} C ${r(c1.x)} ${r(c1.y)}, ${r(c2.x)} ${r(c2.y)}, ${r(pb.x)} ${r(pb.y)}`
}

/** Convenience for callers that don't need the intermediate solve. */
export function edgePath(a: Rect, b: Rect, bow = 0, bowAt = 0.5): string {
  const s = solveEdge(a, b, bow, bowAt)
  return pathFor(s, s.waist)
}

/**
 * Reduce a freehand stroke to the two numbers a connector needs: how far it
 * bowed off the straight run, and where that bow peaked. Everything else about
 * the scribble is thrown away — which is exactly the point.
 */
export function distillStroke(
  stroke: Point[],
  a: Point,
  b: Point,
): { bow: number; bowAt: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  if (len2 < 1 || stroke.length < 3) return { bow: 0, bowAt: 0.5 }
  const len = Math.sqrt(len2)
  const px = -dy / len
  const py = dx / len

  let peak = 0
  let peakAt = 0.5
  for (const p of stroke) {
    const vx = p.x - a.x
    const vy = p.y - a.y
    const t = (vx * dx + vy * dy) / len2
    if (t < 0.08 || t > 0.92) continue // ends are pinned; ignore their noise
    const off = vx * px + vy * py
    if (Math.abs(off) > Math.abs(peak)) {
      peak = off
      peakAt = t
    }
  }

  // Below this it was a straight pull, not a deliberate arc.
  if (Math.abs(peak) < 16) return { bow: 0, bowAt: 0.5 }
  // Keep it a curve, not a hairpin.
  const capped = Math.sign(peak) * Math.min(Math.abs(peak), len * 0.75 + 90)
  return { bow: capped, bowAt: clamp01(peakAt) }
}

const r = (n: number) => Math.round(n * 10) / 10
const clamp01 = (v: number) => Math.min(Math.max(v, 0.12), 0.88)
