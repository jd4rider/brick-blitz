import { describe, expect, it } from 'vitest'
import { BALL, PADDLE } from '../src/core/constants'
import type { LevelBrick, LevelDefinition } from '../src/core/types'
import { Game } from '../src/sim/game'
import { sweepCircleRect } from '../src/sim/geometry'

function makeLevel(bricks: LevelBrick[], overrides: Partial<LevelDefinition> = {}): LevelDefinition {
  return {
    id: 'test-level',
    index: 1,
    world: 1,
    local: 1,
    seed: 'test-seed',
    name: 'Test',
    cols: 10,
    rows: 10,
    bricks,
    objective: { kind: 'clear', target: 0 },
    powerUps: ['wide', 'mega', 'tiny', 'supermultiball', 'multiball', 'slowmo', 'speedboost', 'extralife'],
    dropRate: 0,
    boss: null,
    difficulty: 1,
    hazards: 0,
    tutorial: null,
    modifiers: [],
    ...overrides,
  }
}

function hitBrick(game: Game) {
  const ball = game.balls[0]!
  ball.stuck = false
  game.phase = 'playing'
  ball.x = -45 + 4 * 9 + 4.5
  ball.y = 62 + 5 * 7.4 + 8
  ball.vx = 0
  ball.vy = -BALL.baseSpeed
  for (let index = 0; index < 24; index += 1) game.update(1 / 120)
}

describe('swept collision', () => {
  it('reports the entry time and face normal of a box', () => {
    const hit = sweepCircleRect(0, 30, 0, -40, 1.5, { x: 0, y: 0, w: 8, h: 4 })
    expect(hit).not.toBeNull()
    expect(hit!.ny).toBe(1)
    expect(hit!.time).toBeGreaterThan(0)
    expect(hit!.time).toBeLessThan(1)
  })

  it('finds contact even when one step covers a thousand units', () => {
    const hit = sweepCircleRect(0, 300, 0, -1000, 1.5, { x: 0, y: 0, w: 8, h: 4 })
    expect(hit).not.toBeNull()
    expect(hit!.ny).toBe(1)
  })

  it('misses when the sweep passes beside the box', () => {
    expect(sweepCircleRect(20, 30, 0, -20, 1.5, { x: 0, y: 0, w: 8, h: 4 })).toBeNull()
  })

  it('never tunnels a fast ball through a thin brick', () => {
    const game = new Game(makeLevel([{ type: 'standard', col: 4, row: 5 }]))
    hitBrick(game)
    expect(game.bricks[0]!.alive).toBe(false)
    expect(game.score).toBeGreaterThan(0)
  })

  it('reflects a ball off the side wall', () => {
    const game = new Game(makeLevel([{ type: 'standard', col: 0, row: 8 }]))
    const ball = game.balls[0]!
    game.phase = 'playing'
    ball.stuck = false
    ball.x = 44
    ball.y = 100
    ball.vx = 120
    ball.vy = 1
    for (let index = 0; index < 20; index += 1) game.update(1 / 60)
    expect(ball.vx).toBeLessThan(0)
    expect(ball.x).toBeLessThan(50)
  })
})

describe('paddle', () => {
  it('sends an edge hit away at an angle and a centre hit almost straight up', () => {
    const level = makeLevel([{ type: 'standard', col: 0, row: 9 }])
    const edge = new Game(level)
    const edgeBall = edge.balls[0]!
    edge.phase = 'playing'
    edgeBall.stuck = false
    edgeBall.x = PADDLE.baseWidth / 2 - 0.4
    edgeBall.y = PADDLE.y + 8
    edgeBall.vx = 0
    edgeBall.vy = -120
    edge.setPaddleTarget(0)
    for (let index = 0; index < 20; index += 1) edge.update(1 / 120)
    expect(edgeBall.vy).toBeGreaterThan(0)

    const centre = new Game(level)
    const centreBall = centre.balls[0]!
    centre.phase = 'playing'
    centreBall.stuck = false
    centreBall.x = 0
    centreBall.y = PADDLE.y + 8
    centreBall.vx = 0
    centreBall.vy = -120
    centre.setPaddleTarget(0)
    for (let index = 0; index < 20; index += 1) centre.update(1 / 120)
    expect(Math.abs(centreBall.vx)).toBeLessThanOrEqual(Math.abs(edgeBall.vx) + 0.001)
  })

  it('keeps the paddle inside the arena', () => {
    const game = new Game(makeLevel([{ type: 'standard', col: 0, row: 9 }]))
    game.setPaddleTarget(999)
    game.update(1 / 30)
    expect(game.paddle.x + game.paddle.width / 2).toBeLessThanOrEqual(50.001)
    game.setPaddleTarget(-999)
    game.update(1 / 30)
    expect(game.paddle.x - game.paddle.width / 2).toBeGreaterThanOrEqual(-50.001)
  })
})

describe('power-ups', () => {
  it('resolves paddle size by precedence instead of multiplying', () => {
    const game = new Game(makeLevel([{ type: 'standard', col: 1, row: 1 }]))
    game.applyPowerUp('wide')
    const wide = game.paddleWidth
    game.applyPowerUp('mega')
    const mega = game.paddleWidth
    // A negative pickup overrides the good ones, so it must still shrink.
    game.applyPowerUp('tiny')
    const tiny = game.paddleWidth
    expect(mega).toBeGreaterThan(wide)
    expect(wide).toBeGreaterThan(PADDLE.baseWidth)
    expect(tiny).toBeLessThan(PADDLE.baseWidth)
  })

  it('caps the ball swarm', () => {
    const game = new Game(makeLevel([{ type: 'standard', col: 1, row: 1 }]))
    game.launch()
    for (let index = 0; index < 40; index += 1) game.applyPowerUp('supermultiball')
    expect(game.balls.length).toBeLessThanOrEqual(BALL.maxBalls)
  })

  it('caps speed when slow and fast effects stack', () => {
    const game = new Game(makeLevel([{ type: 'standard', col: 1, row: 1 }]))
    game.applyPowerUp('slowmo')
    game.applyPowerUp('speedboost')
    game.launch()
    const speed = Math.hypot(game.balls[0]!.vx, game.balls[0]!.vy)
    expect(speed).toBeLessThanOrEqual(BALL.maxSpeed)
    expect(speed).toBeGreaterThan(0)
  })

  it('adds a life but never beyond the cap', () => {
    const game = new Game(makeLevel([{ type: 'standard', col: 1, row: 1 }]))
    for (let index = 0; index < 12; index += 1) game.applyPowerUp('extralife')
    expect(game.lives).toBe(6)
  })
})

describe('determinism', () => {
  it('produces the same state from the same seed and input', () => {
    const level = makeLevel([
      { type: 'standard', col: 3, row: 6 },
      { type: 'explosive', col: 5, row: 6 },
      { type: 'moving', col: 7, row: 5 },
    ])
    const run = () => {
      const game = new Game(level, { runSeed: 7 })
      game.setPaddleTarget(4)
      game.launch()
      for (let index = 0; index < 240; index += 1) game.update(1 / 60)
      return game.stateHash()
    }
    expect(run()).toBe(run())
  })
})
