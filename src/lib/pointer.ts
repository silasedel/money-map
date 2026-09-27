/**
 * Pointer capture throws if the pointer is no longer active (a stale id, a
 * cancelled gesture, a synthetic event). Losing capture degrades a drag; an
 * exception kills the whole interaction — so these never throw.
 */

export function capture(el: Element | null, pointerId: number) {
  try {
    ;(el as HTMLElement | null)?.setPointerCapture(pointerId)
  } catch {
    /* gesture still works, it just won't track outside the element */
  }
}

export function release(el: Element | null, pointerId: number) {
  try {
    ;(el as HTMLElement | null)?.releasePointerCapture(pointerId)
  } catch {
    /* already released */
  }
}
