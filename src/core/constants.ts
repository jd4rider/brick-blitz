/**
 * Logical arena units. The simulation never sees pixels: x spans -50..50,
 * y spans 0 (below the paddle) to 150 (ceiling). Rendering maps these to the
 * camera, so every device plays the same physics.
 */
export const ARENA = {
  halfWidth: 50,
  bottom: 0,
  top: 150,
  /** Brick field bounds. */
  gridLeft: -45,
  gridTop: 62,
  cellWidth: 9,
  cellHeight: 7.4,
  maxCols: 10,
  maxRows: 12,
} as const

export const PADDLE = {
  y: 13,
  height: 3.2,
  baseWidth: 18,
  minWidth: 8,
  maxWidth: 34,
  speedInfluence: 0.05,
} as const

export const BALL = {
  radius: 1.55,
  baseSpeed: 74,
  maxSpeed: 132,
  minVertical: 14,
  maxBalls: 12,
  damage: 1,
} as const

export const TIMING = {
  fixedStep: 1 / 120,
  maxFrame: 0.05,
} as const

export const CAPSULE = {
  speed: 22,
  radius: 2.6,
} as const

export const LIVES = 3
