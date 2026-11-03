export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface SweepHit {
  /** Fraction of the movement segment, 0..1. */
  time: number
  /** Surface normal pointing back toward the incoming ball. */
  nx: number
  ny: number
}

const EPSILON = 1e-6

/**
 * Swept circle against an axis-aligned rectangle, using the expanded-box slab
 * method (the Minkowski sum of a rectangle and a circle is a rounded rectangle;
 * treating it as a plain box is exact for the four faces and slightly generous
 * at the corners, which is the forgiving direction for arcade play).
 *
 * Returns the first contact along `vx, vy` scaled to one unit of time.
 */
export function sweepCircleRect(
  px: number,
  py: number,
  vx: number,
  vy: number,
  radius: number,
  rect: Rect,
): SweepHit | null {
  const left = rect.x - rect.w / 2 - radius
  const right = rect.x + rect.w / 2 + radius
  const bottom = rect.y - rect.h / 2 - radius
  const top = rect.y + rect.h / 2 + radius

  let entryX = -Infinity
  let exitX = Infinity
  let entryY = -Infinity
  let exitY = Infinity

  if (Math.abs(vx) < EPSILON) {
    if (px < left || px > right) return null
  } else {
    const t1 = (left - px) / vx
    const t2 = (right - px) / vx
    entryX = Math.min(t1, t2)
    exitX = Math.max(t1, t2)
  }

  if (Math.abs(vy) < EPSILON) {
    if (py < bottom || py > top) return null
  } else {
    const t1 = (bottom - py) / vy
    const t2 = (top - py) / vy
    entryY = Math.min(t1, t2)
    exitY = Math.max(t1, t2)
  }

  const entry = Math.max(entryX, entryY)
  const exit = Math.min(exitX, exitY)
  if (entry > exit || exit < 0 || entry > 1) return null

  if (entry < 0) {
    // Already overlapping. Push out along the shallowest axis.
    const overlapX = Math.min(Math.abs(px - left), Math.abs(right - px))
    const overlapY = Math.min(Math.abs(py - bottom), Math.abs(top - py))
    if (overlapX < overlapY) {
      return { time: 0, nx: px < rect.x ? -1 : 1, ny: 0 }
    }
    return { time: 0, nx: 0, ny: py < rect.y ? -1 : 1 }
  }

  if (entryX > entryY) {
    return { time: entry, nx: vx > 0 ? -1 : 1, ny: 0 }
  }
  return { time: entry, nx: 0, ny: vy > 0 ? -1 : 1 }
}

/** Clamp a value into a closed range. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value
}

/** Reflect a velocity about a unit-ish normal. */
export function reflect(vx: number, vy: number, nx: number, ny: number): { vx: number; vy: number } {
  const dot = vx * nx + vy * ny
  return { vx: vx - 2 * dot * nx, vy: vy - 2 * dot * ny }
}

export function length(x: number, y: number): number {
  return Math.hypot(x, y)
}
