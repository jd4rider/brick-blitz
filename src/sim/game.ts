import { ARENA, BALL, CAPSULE, LIVES, PADDLE, TIMING } from '../core/constants'
import { Rng } from '../core/rng'
import type { BrickType, BossId, Element, LevelBrick, LevelDefinition, PowerUpId } from '../core/types'
import { BOSSES, type BossAttack } from './bosses'
import { BRICKS } from './bricks'
import { clamp, reflect, sweepCircleRect, type Rect } from './geometry'
import { DEFAULT_DROP_POOL, NEGATIVE_POWER_UPS, POWER_UPS_BY_ID, powerUpDef } from './powerups'

export type GameMode = 'campaign' | 'endless' | 'survival' | 'bossrush' | 'daily' | 'zen' | 'challenge'
export type Phase = 'ready' | 'playing' | 'won' | 'lost'

export interface Brick {
  id: number
  type: BrickType
  x: number
  y: number
  /** Position before any drift, so movement never accumulates error. */
  baseX: number
  baseY: number
  w: number
  h: number
  hp: number
  maxHp: number
  alive: boolean
  required: boolean
  rotation: number
  offsetX: number
  offsetY: number
  moveAmp: number
  moveSpeed: number
  phase: number
  regenAt: number
  regenCount: number
  portal: number
  hitFlash: number
  bossPart: 'core' | 'shield' | 'body' | null
}

export interface Ball {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
  stuck: boolean
  stuckOffset: number
  alive: boolean
  element: Element
  portalCooldown: number
}

export interface Capsule {
  id: number
  x: number
  y: number
  vy: number
  power: PowerUpId
  spin: number
}

export interface Bolt {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  hostile: boolean
  piercing: boolean
  power: number
  life: number
}

export interface Hazard {
  id: number
  kind: 'mine' | 'orb' | 'beam'
  x: number
  y: number
  vx: number
  vy: number
  r: number
  hp: number
  life: number
  timer: number
  active: boolean
}

export interface BossState {
  id: BossId
  hp: number
  maxHp: number
  phase: 1 | 2 | 3
  timer: number
  telegraph: number
  pending: BossAttack | null
  attackIndex: number
  gravityPulse: number
}

export type SimEvent =
  | { type: 'hit'; x: number; y: number }
  | { type: 'break'; x: number; y: number; color: string }
  | { type: 'paddle' }
  | { type: 'wall' }
  | { type: 'power'; id: PowerUpId; x: number; y: number }
  | { type: 'boom'; x: number; y: number; radius: number }
  | { type: 'laser' }
  | { type: 'lose' }
  | { type: 'win' }
  | { type: 'boss'; telegraph: boolean }

export interface GameOptions {
  mode?: GameMode
  lives?: number
  zen?: boolean
  runSeed?: number
  startScore?: number
  modifiers?: string[]
}

const PADDLE_TOP = PADDLE.y + PADDLE.height / 2

export class Game {
  readonly level: LevelDefinition
  readonly mode: GameMode
  readonly modifiers: Set<string>

  bricks: Brick[] = []
  balls: Ball[] = []
  capsules: Capsule[] = []
  bolts: Bolt[] = []
  hazards: Hazard[] = []
  boss: BossState | null = null
  effects = new Map<PowerUpId, number>()
  events: SimEvent[] = []

  paddle: { x: number; width: number; target: number; vx: number } = {
    x: 0,
    width: PADDLE.baseWidth,
    target: 0,
    vx: 0,
  }
  score: number
  credits = 0
  lives: number
  combo = 0
  comboTimer = 0
  safety = 0
  stun = 0
  time = 0
  phase: Phase = 'ready'
  frozenBricks = 0
  rainbowTimer = 0
  speedBonus = 0
  lastFire = 0
  droneTimer = 0

  private readonly zen: boolean
  private readonly rng: Rng
  private accumulator = 0
  private nextId = 1
  private destroyed = 0
  private readonly breakableTotal: number

  constructor(level: LevelDefinition, options: GameOptions = {}) {
    this.level = level
    this.mode = options.mode ?? 'campaign'
    this.zen = options.zen ?? false
    this.modifiers = new Set([...level.modifiers, ...(options.modifiers ?? [])])
    this.rng = new Rng(`${level.seed}:sim:${options.runSeed ?? 1}:${options.mode ?? 'campaign'}`)
    this.score = options.startScore ?? 0
    this.lives = options.lives ?? (this.zen ? 99 : LIVES)
    this.buildBricks(level.bricks)
    this.breakableTotal = this.bricks.filter((brick) => brick.required).length
    this.paddle.width = PADDLE.baseWidth
    this.spawnBall()
    if (level.boss) {
      const core = this.bricks.filter((brick) => brick.bossPart === 'core').length
      this.boss = {
        id: level.boss,
        hp: core,
        maxHp: core,
        phase: 1,
        timer: 5.5,
        telegraph: 0,
        pending: null,
        attackIndex: 0,
        gravityPulse: 0,
      }
    }
  }

  // ---------------------------------------------------------------- lifecycle

  update(dt: number): void {
    if (this.phase === 'won' || this.phase === 'lost') {
      this.decayEffects(dt)
      return
    }
    this.accelerator(dt)
    while (this.accumulator >= TIMING.fixedStep) {
      this.substep(TIMING.fixedStep)
      this.accumulator -= TIMING.fixedStep
    }
  }

  private accelerator(dt: number): void {
    this.accumulator += Math.min(Math.max(dt, 0), TIMING.maxFrame)
  }

  reset(): void {
    this.bricks = []
    this.balls = []
    this.capsules = []
    this.bolts = []
    this.hazards = []
    this.effects.clear()
    this.boss = null
    this.paddle.x = 0
    this.paddle.target = 0
    this.paddle.width = PADDLE.baseWidth
    this.score = 0
    this.credits = 0
    this.combo = 0
    this.comboTimer = 0
    this.safety = 0
    this.stun = 0
    this.time = 0
    this.destroyed = 0
    this.phase = 'ready'
    this.frozenBricks = 0
    this.rainbowTimer = 0
    this.accumulator = 0
    this.buildBricks(this.level.bricks)
    this.spawnBall()
    if (this.level.boss) {
      const core = this.bricks.filter((brick) => brick.bossPart === 'core').length
      this.boss = {
        id: this.level.boss,
        hp: core,
        maxHp: core,
        phase: 1,
        timer: 5.5,
        telegraph: 0,
        pending: null,
        attackIndex: 0,
        gravityPulse: 0,
      }
    }
  }

  launch(): void {
    if (this.phase === 'won' || this.phase === 'lost') return
    if (this.phase === 'ready') this.phase = 'playing'
    for (const ball of this.balls) {
      if (!ball.stuck) continue
      ball.stuck = false
      const angle = clamp(ball.stuckOffset * 0.45, -0.5, 0.5)
      const speed = this.targetSpeed()
      ball.vx = Math.sin(angle) * speed
      ball.vy = Math.cos(angle) * speed
    }
  }

  setPaddleTarget(x: number): void {
    this.paddle.target = x
  }

  nudgePaddle(dx: number): void {
    this.paddle.target = clamp(this.paddle.target + dx, -ARENA.halfWidth, ARENA.halfWidth)
  }

  fire(): boolean {
    if (this.phase !== 'playing') return false
    if (!this.effects.has('laser') || this.effects.has('paddlejam')) return false
    const rapid = this.effects.has('rapidlaser')
    if (this.time - this.lastFire < (rapid ? 0.14 : 0.36)) return false
    this.lastFire = this.time
    const offsets = this.paddle.width > 22 ? [-0.32, 0, 0.32] : [-0.24, 0.24]
    for (const offset of offsets) {
      this.bolts.push({
        id: this.nextId++,
        x: this.paddle.x + this.paddle.width * offset,
        y: PADDLE_TOP + 1,
        vx: 0,
        vy: 132,
        radius: 1.1,
        hostile: false,
        piercing: this.effects.has('piercing'),
        power: 1,
        life: 2.4,
      })
    }
    this.events.push({ type: 'laser' })
    return true
  }

  drainEvents(): SimEvent[] {
    const queued = this.events
    this.events = []
    return queued
  }

  // ------------------------------------------------------------------ helpers

  get paddleWidth(): number {
    let width = PADDLE.baseWidth
    // A negative pickup always wins: catching "tiny" while mega is running has
    // to hurt, otherwise the bad capsules are free points.
    if (this.effects.has('tiny') || this.modifiers.has('tinypaddle')) width *= 0.62
    else if (this.effects.has('mega')) width *= 1.66
    else if (this.effects.has('wide')) width *= 1.33
    return clamp(width, PADDLE.minWidth, PADDLE.maxWidth)
  }

  get remaining(): number {
    return this.bricks.filter((brick) => brick.required && brick.alive).length
  }

  get activeElement(): Element {
    if (this.effects.has('rainbow')) {
      const cycle: Element[] = ['fire', 'ice', 'electric']
      return cycle[Math.floor(this.time / 2.5) % cycle.length] ?? 'none'
    }
    if (this.effects.has('fireball')) return 'fire'
    if (this.effects.has('electricball')) return 'electric'
    if (this.effects.has('iceball')) return 'ice'
    if (this.effects.has('heavyball')) return 'heavy'
    if (this.effects.has('ghostball')) return 'ghost'
    return 'none'
  }

  get activeEffects(): { id: PowerUpId; remaining: number }[] {
    return [...this.effects.entries()].map(([id, remaining]) => ({ id, remaining }))
  }

  objectiveText(): string {
    if (this.level.objective.kind === 'boss') {
      return this.boss ? `${BOSSES[this.boss.id].name} — break the core` : 'Break the boss core'
    }
    if (this.level.objective.kind === 'targets') {
      const done = Math.min(this.level.objective.target, this.destroyed)
      return `Shatter ${done}/${this.level.objective.target} bricks`
    }
    if (this.level.objective.kind === 'survive') {
      return `Survive ${Math.max(0, Math.ceil(this.level.objective.target - this.time))}s`
    }
    if (this.level.objective.kind === 'switches') {
      const left = this.bricks.filter((brick) => brick.type === 'switch' && brick.alive).length
      return left > 0 ? `Open ${left} more switch${left === 1 ? '' : 'es'}` : 'All switches open'
    }
    return `${this.remaining} brick${this.remaining === 1 ? '' : 's'} left`
  }

  stars(): number {
    if (this.phase !== 'won') return 0
    // Par is dominated by the wall itself, not by the clear/lives bonus, so a
    // tidy clear is not automatically three stars.
    const par = 900 + this.breakableTotal * 70 + this.level.index * 5
    if (this.score >= par * 1.45) return 3
    if (this.score >= par) return 2
    return 1
  }

  /** Deterministic fingerprint used by tests. */
  stateHash(): number {
    let hash = 2166136261
    const mix = (value: number) => {
      hash ^= Math.round(value * 1000)
      hash = Math.imul(hash, 16777619)
    }
    mix(this.score)
    mix(this.paddle.x)
    mix(this.balls.length)
    for (const ball of this.balls) {
      mix(ball.x)
      mix(ball.y)
      mix(ball.vx)
      mix(ball.vy)
    }
    for (const brick of this.bricks) mix(brick.alive ? brick.hp : -1)
    return hash >>> 0
  }

  // ---------------------------------------------------------------- brick init

  private buildBricks(source: LevelBrick[]): void {
    for (const entry of source) {
      const spec = BRICKS[entry.type]
      const x = ARENA.gridLeft + entry.col * ARENA.cellWidth + ARENA.cellWidth / 2
      const y = ARENA.gridTop + entry.row * ARENA.cellHeight
      const isBossLevel = Boolean(this.level.boss)
      const bossPart: Brick['bossPart'] =
        entry.type === 'core' ? 'core' : entry.type === 'bossshield' ? 'shield' : isBossLevel ? 'body' : null
      const required = isBossLevel
        ? entry.type === 'core'
        : !spec.solid && entry.type !== 'bossshield'
      const amp = entry.type === 'moving' ? ARENA.cellWidth * 0.5 : 0
      this.bricks.push({
        id: this.nextId++,
        type: entry.type,
        x,
        y,
        baseX: x,
        baseY: y,
        w: ARENA.cellWidth - 0.8,
        h: ARENA.cellHeight - 0.85,
        hp: spec.hp,
        maxHp: spec.hp,
        alive: true,
        required,
        rotation: 0,
        offsetX: 0,
        offsetY: 0,
        moveAmp: amp,
        moveSpeed: 0.9 + (entry.phase ?? 0) * 0.15,
        phase: entry.phase ?? this.rng.next() * Math.PI * 2,
        regenAt: 0,
        regenCount: 0,
        portal: entry.type === 'portal' ? this.nextId : 0,
        hitFlash: 0,
        bossPart,
      })
    }
  }

  private spawnBall(offset = 0): void {
    this.balls.push({
      id: this.nextId++,
      x: this.paddle.x + offset,
      y: PADDLE_TOP + BALL.radius + 0.6,
      vx: 0,
      vy: 0,
      r: BALL.radius,
      stuck: true,
      stuckOffset: offset / Math.max(6, this.paddle.width / 2),
      alive: true,
      element: 'none',
      portalCooldown: 0,
    })
  }

  private clampPaddle(): void {
    const half = this.paddle.width / 2
    this.paddle.target = clamp(this.paddle.target, -ARENA.halfWidth + half, ARENA.halfWidth - half)
    this.paddle.x = clamp(this.paddle.x, -ARENA.halfWidth + half, ARENA.halfWidth - half)
  }

  // ------------------------------------------------------------------- update

  private substep(dt: number): void {
    this.time += dt
    this.decayEffects(dt)
    this.updatePaddle(dt)

    if (this.phase === 'ready') {
      for (const ball of this.balls) {
        if (!ball.stuck) continue
        ball.x = this.paddle.x + ball.stuckOffset * (this.paddle.width / 2 - BALL.radius)
        ball.y = PADDLE_TOP + BALL.radius + 0.6
      }
      return
    }
    if (this.phase !== 'playing') return

    if (this.comboTimer > 0) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) this.combo = 0
    }
    if (this.stun > 0) this.stun = Math.max(0, this.stun - dt)
    if (this.frozenBricks > 0) this.frozenBricks = Math.max(0, this.frozenBricks - dt)

    this.updateBricks(dt)
    this.updateCapsules(dt)
    this.updateBolts(dt)
    this.updateHazards(dt)
    this.updateBoss(dt)
    this.updateDrones(dt)
    this.updateBoltsFromBricks(dt)

    for (const ball of this.balls) {
      if (ball.alive) this.advanceBall(ball, dt)
    }
    this.balls = this.balls.filter((ball) => ball.alive)
    if (this.balls.length === 0) this.onAllBallsLost()

    this.checkObjective()
  }

  private updatePaddle(dt: number): void {
    this.paddle.width = this.paddleWidth
    this.clampPaddle()
    const previous = this.paddle.x
    const stiffness = 1 - Math.exp(-34 * dt)
    this.paddle.x += (this.paddle.target - this.paddle.x) * stiffness
    this.paddle.vx = dt > 0 ? (this.paddle.x - previous) / dt : 0
  }

  private decayEffects(dt: number): void {
    for (const [id, remaining] of [...this.effects.entries()]) {
      const next = remaining - dt
      if (next <= 0) this.effects.delete(id)
      else this.effects.set(id, next)
    }
    this.rainbowTimer += dt
    for (const capsule of this.capsules) capsule.spin += dt * 2.4
    for (const brick of this.bricks) {
      if (brick.hitFlash > 0) brick.hitFlash = Math.max(0, brick.hitFlash - dt * 4)
      if (brick.type === 'rotating') brick.rotation += dt * 0.9
    }
  }

  private updateBricks(dt: number): void {
    const frozen = this.frozenBricks > 0 || this.effects.has('timefreeze')
    for (const brick of this.bricks) {
      if (!brick.alive) {
        if (brick.type === 'regen' && brick.regenCount < 3 && this.time >= brick.regenAt && brick.regenAt > 0) {
          brick.alive = true
          brick.hp = brick.maxHp
          brick.regenCount += 1
          brick.regenAt = 0
        }
        continue
      }
      if (brick.type !== 'moving') continue
      if (frozen) {
        brick.x = brick.baseX + brick.offsetX
        continue
      }
      brick.offsetX = Math.sin(this.time * brick.moveSpeed + brick.phase) * brick.moveAmp
      brick.x = brick.baseX + brick.offsetX
    }
  }

  private updateCapsules(dt: number): void {
    if (this.effects.has('timefreeze')) return
    const magnet = this.effects.has('coinmagnet')
    for (const capsule of this.capsules) {
      capsule.y -= CAPSULE.speed * dt
      if (magnet) {
        const pull = (this.paddle.x - capsule.x) * dt * 1.9
        capsule.x = clamp(capsule.x + pull, -ARENA.halfWidth, ARENA.halfWidth)
      }
      if (
        capsule.y < PADDLE_TOP + 4 &&
        capsule.y > PADDLE.y - 3 &&
        Math.abs(capsule.x - this.paddle.x) < this.paddle.width / 2 + CAPSULE.radius
      ) {
        capsule.y = -999
        this.applyPowerUp(capsule.power)
      }
    }
    this.capsules = this.capsules.filter((capsule) => capsule.y > -20)
  }

  private updateBolts(dt: number): void {
    for (const bolt of this.bolts) {
      bolt.x += bolt.vx * dt
      bolt.y += bolt.vy * dt
      bolt.life -= dt
      if (bolt.hostile) {
        if (this.hitsPaddle(bolt.x, bolt.y, bolt.radius)) {
          this.damagePaddle(false)
          bolt.life = 0
        }
        continue
      }
      // Friendly bolt versus bricks.
      for (const brick of this.bricks) {
        if (!brick.alive) continue
        if (
          Math.abs(bolt.x - brick.x) <= brick.w / 2 + bolt.radius &&
          Math.abs(bolt.y - brick.y) <= brick.h / 2 + bolt.radius
        ) {
          this.damageBrick(brick, bolt.power, 'none', bolt.x, bolt.y, 'laser')
          if (!bolt.piercing) {
            bolt.life = 0
            break
          }
        }
      }
      for (const hazard of this.hazards) {
        if (hazard.kind === 'orb' && hazard.hp > 0) {
          if (Math.hypot(hazard.x - bolt.x, hazard.y - bolt.y) < hazard.r + bolt.radius) {
            hazard.hp -= 1
            bolt.life = 0
            if (hazard.hp <= 0) this.events.push({ type: 'boom', x: hazard.x, y: hazard.y, radius: 5 })
          }
        }
      }
    }
    this.bolts = this.bolts.filter(
      (bolt) =>
        bolt.life > 0 &&
        bolt.y > -10 &&
        bolt.y < ARENA.top + 20 &&
        Math.abs(bolt.x) < ARENA.halfWidth + 20,
    )
    this.hazards = this.hazards.filter((hazard) => hazard.hp > 0 || hazard.kind !== 'orb')
  }

  private updateBoltsFromBricks(_dt: number): void {
    // Hook kept explicit: bricks that fire are handled by boss/hazard code so
    // ordinary bricks never create unbounded projectiles.
    void _dt
  }

  private updateHazards(dt: number): void {
    if (this.effects.has('timefreeze')) return
    for (const hazard of this.hazards) {
      hazard.life -= dt
      if (hazard.kind === 'beam') {
        hazard.timer -= dt
        if (!hazard.active && hazard.timer <= 0) {
          hazard.active = true
          hazard.timer = 1.5
        } else if (hazard.active && hazard.timer <= 0) {
          hazard.life = 0
        }
        if (hazard.active) {
          for (const ball of this.balls) {
            if (
              Math.abs(ball.x - hazard.x) < hazard.r + ball.r &&
              ball.y > PADDLE_TOP &&
              ball.y < ARENA.top
            ) {
              ball.vx = Math.abs(ball.vx) * (ball.x < hazard.x ? -1 : 1)
              ball.x = hazard.x + (ball.x < hazard.x ? -1 : 1) * (hazard.r + ball.r)
            }
          }
        }
        continue
      }

      hazard.x += hazard.vx * dt
      hazard.y += hazard.vy * dt
      if (hazard.kind === 'mine') {
        if (hazard.y <= PADDLE_TOP + 2 && Math.abs(hazard.x - this.paddle.x) < this.paddle.width / 2 + hazard.r) {
          this.damagePaddle(true)
          hazard.life = 0
        }
        if (hazard.y < -4) {
          this.loseLife()
          hazard.life = 0
        }
      } else {
        if (hazard.x < -ARENA.halfWidth + hazard.r || hazard.x > ARENA.halfWidth - hazard.r) {
          hazard.vx *= -1
          hazard.x = clamp(hazard.x, -ARENA.halfWidth + hazard.r, ARENA.halfWidth - hazard.r)
        }
        if (hazard.y < 30 || hazard.y > ARENA.top - hazard.r) {
          hazard.vy *= -1
          hazard.y = clamp(hazard.y, 30, ARENA.top - hazard.r)
        }
        for (const ball of this.balls) {
          const dx = ball.x - hazard.x
          const dy = ball.y - hazard.y
          const distance = Math.hypot(dx, dy)
          if (distance < hazard.r + ball.r && distance > 0.001) {
            const nx = dx / distance
            const ny = dy / distance
            const dot = ball.vx * nx + ball.vy * ny
            if (dot < 0) {
              ball.vx -= 2 * dot * nx
              ball.vy -= 2 * dot * ny
            }
            ball.x = hazard.x + nx * (hazard.r + ball.r + 0.05)
            ball.y = hazard.y + ny * (hazard.r + ball.r + 0.05)
            this.events.push({ type: 'wall' })
          }
        }
      }
    }
    this.hazards = this.hazards.filter((hazard) => hazard.life > 0)
    this.hazards = this.hazards.filter((hazard) => hazard.hp > 0 || hazard.kind !== 'orb')
  }

  private updateDrones(dt: number): void {
    const drones = this.effects.has('doubledrone') ? 2 : this.effects.has('drone') ? 1 : 0
    if (drones === 0 || this.effects.has('paddlejam')) return
    this.droneTimer -= dt
    if (this.droneTimer > 0) return
    this.droneTimer = 0.85
    const target = this.nearestBrick(this.paddle.x, PADDLE_TOP + 40)
    if (!target) return
    for (let index = 0; index < drones; index += 1) {
      const originX = this.paddle.x + (index === 0 ? -1 : 1) * (this.paddle.width / 2 + 3)
      const dx = target.x - originX
      const dy = target.y - (PADDLE_TOP + 10)
      const distance = Math.max(1, Math.hypot(dx, dy))
      this.bolts.push({
        id: this.nextId++,
        x: originX,
        y: PADDLE_TOP + 10,
        vx: (dx / distance) * 100,
        vy: (dy / distance) * 100,
        radius: 1,
        hostile: false,
        piercing: false,
        power: 1,
        life: 2.2,
      })
    }
    this.events.push({ type: 'laser' })
  }

  private nearestBrick(x: number, y: number): Brick | null {
    let best: Brick | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const brick of this.bricks) {
      if (!brick.alive || brick.type === 'unbreakable') continue
      const distance = Math.hypot(brick.x - x, brick.y - y)
      if (distance < bestDistance) {
        bestDistance = distance
        best = brick
      }
    }
    return best
  }

  private targetSpeed(): number {
    let speed = BALL.baseSpeed * (0.92 + this.speedBonus) * (this.level ? 1 : 1)
    if (this.effects.has('slowmo')) speed *= 0.68
    if (this.effects.has('speedboost')) speed *= 1.18
    if (this.effects.has('heavyball')) speed *= 0.94
    return clamp(speed, 42, BALL.maxSpeed)
  }

  // ---------------------------------------------------------------- ball motion

  private advanceBall(ball: Ball, dt: number): void {
    ball.element = this.activeElement
    ball.portalCooldown = Math.max(0, ball.portalCooldown - dt)
    this.applyFields(ball, dt)

    let remaining = dt
    for (let iteration = 0; iteration < 8 && remaining > 0.0001; iteration += 1) {
      const dx = ball.vx * remaining
      const dy = ball.vy * remaining
      const hit = this.firstHit(ball, dx, dy)
      if (!hit) {
        ball.x += dx
        ball.y += dy
        break
      }
      const travel = Math.max(0, Math.min(1, hit.time))
      ball.x += dx * travel
      ball.y += dy * travel
      const reflected = reflect(ball.vx, ball.vy, hit.nx, hit.ny)
      ball.vx = reflected.vx
      ball.vy = reflected.vy

      if (hit.brick) {
        const wasPortal = hit.brick.type === 'portal'
        this.damageBrick(hit.brick, this.ballDamage(ball), ball.element, ball.x, ball.y, 'ball')
        ball.x += hit.nx * 0.08
        ball.y += hit.ny * 0.08
        if (wasPortal && ball.portalCooldown <= 0) {
          const partner = this.bricks.find(
            (other) => other.alive && other.type === 'portal' && other.id !== hit.brick!.id,
          )
          if (partner) {
            ball.x = partner.x
            ball.y = partner.y + 3.4
            ball.portalCooldown = 0.35
            this.events.push({ type: 'wall' })
          }
        }
      } else if (hit.paddle) {
        this.paddleBounce(ball)
        if (ball.stuck) break
      } else if (hit.wall === 'left' || hit.wall === 'right') {
        if (this.effects.has('portalball') && ball.portalCooldown <= 0) {
          ball.x = -ball.x
          ball.portalCooldown = 1.2
          this.events.push({ type: 'wall' })
        } else {
          this.events.push({ type: 'wall' })
        }
        ball.x = clamp(ball.x, -ARENA.halfWidth + ball.r, ARENA.halfWidth - ball.r)
      } else if (hit.wall === 'top') {
        ball.y = ARENA.top - ball.r
        this.events.push({ type: 'wall' })
      }

      remaining *= Math.max(0, 1 - travel)
      this.normalizeBall(ball)
    }

    if (ball.y < -6) {
      ball.alive = false
      if (this.safety > 0) {
        this.safety -= 1
        this.respawnCaught()
      } else {
        this.events.push({ type: 'lose' })
      }
    }
  }

  private normalizeBall(ball: Ball): void {
    if (this.effects.has('sticky')) return
    const speed = this.targetSpeed()
    const current = Math.hypot(ball.vx, ball.vy)
    if (current < 0.001) return
    let vx = (ball.vx / current) * speed
    let vy = (ball.vy / current) * speed
    if (Math.abs(vy) < BALL.minVertical) {
      vy = Math.sign(vy || -1) * BALL.minVertical
    }
    const corrected = Math.hypot(vx, vy)
    ball.vx = (vx / corrected) * speed
    ball.vy = (vy / corrected) * speed
  }

  private applyFields(ball: Ball, dt: number): void {
    for (const brick of this.bricks) {
      if (!brick.alive) continue
      if (brick.type !== 'gravity' && brick.type !== 'magnetic') continue
      const dx = brick.x - ball.x
      const dy = brick.y - ball.y
      const distance = Math.hypot(dx, dy)
      if (distance > 26 || distance < 0.5) continue
      const strength = (brick.type === 'gravity' ? 34 : 18) * (1 - distance / 26)
      ball.vx += (dx / distance) * strength * dt
      ball.vy += (dy / distance) * strength * dt
    }
    if (this.effects.has('gravityshift')) ball.vy -= 26 * dt
    if (this.boss && this.boss.gravityPulse > 0) {
      const bossX = this.bossX()
      const bossY = this.bossY()
      const dx = bossX - ball.x
      const dy = bossY - ball.y
      const distance = Math.max(1, Math.hypot(dx, dy))
      ball.vx += (dx / distance) * 42 * dt
      ball.vy += (dy / distance) * 42 * dt
    }
    const speed = Math.hypot(ball.vx, ball.vy)
    const cap = this.targetSpeed() * 1.35
    if (speed > cap) {
      ball.vx = (ball.vx / speed) * cap
      ball.vy = (ball.vy / speed) * cap
    }
  }

  private ballDamage(ball: Ball): number {
    let damage = BALL.damage
    if (ball.element === 'heavy') damage *= 2
    if (this.effects.has('fireball')) damage *= 2
    return damage
  }

  private firstHit(
    ball: Ball,
    dx: number,
    dy: number,
  ):
    | { time: number; nx: number; ny: number; brick?: Brick; paddle?: boolean; wall?: 'left' | 'right' | 'top' }
    | null {
    let best: {
      time: number
      nx: number
      ny: number
      brick?: Brick
      paddle?: boolean
      wall?: 'left' | 'right' | 'top'
    } | null = null

    if (dx < 0) {
      const time = (-ARENA.halfWidth + ball.r - ball.x) / dx
      if (time >= 0 && time <= 1) best = { time, nx: 1, ny: 0, wall: 'left' }
    } else if (dx > 0) {
      const time = (ARENA.halfWidth - ball.r - ball.x) / dx
      if (time >= 0 && time <= 1) best = { time, nx: -1, ny: 0, wall: 'right' }
    }
    if (dy > 0) {
      const time = (ARENA.top - ball.r - ball.y) / dy
      if (time >= 0 && time <= 1 && (!best || time < best.time)) {
        best = { time, nx: 0, ny: -1, wall: 'top' }
      }
    }

    const paddleRect: Rect = { x: this.paddle.x, y: PADDLE.y, w: this.paddle.width, h: PADDLE.height }
    const paddleHit = sweepCircleRect(ball.x, ball.y, dx, dy, ball.r, paddleRect)
    if (paddleHit && paddleHit.time <= 1 && (!best || paddleHit.time < best.time)) {
      best = { time: paddleHit.time, nx: paddleHit.nx, ny: paddleHit.ny, paddle: true }
    }

    for (const brick of this.bricks) {
      if (!brick.alive) continue
      if (ball.element === 'ghost' && brick.type === 'unbreakable') continue
      const hit = sweepCircleRect(ball.x, ball.y, dx, dy, ball.r, {
        x: brick.x,
        y: brick.y,
        w: brick.w,
        h: brick.h,
      })
      if (!hit || hit.time > 1) continue
      if (!best || hit.time < best.time) {
        best = { time: hit.time, nx: hit.nx, ny: hit.ny, brick }
      }
    }

    return best
  }

  private paddleBounce(ball: Ball): void {
    this.events.push({ type: 'paddle' })
    const offset = clamp((ball.x - this.paddle.x) / (this.paddle.width / 2), -1, 1)
    const speed = this.targetSpeed()
    const angle = offset * 1.02
    ball.vx = Math.sin(angle) * speed + this.paddle.vx * PADDLE.speedInfluence
    ball.vy = Math.abs(Math.cos(angle) * speed)
    const magnitude = Math.max(1, Math.hypot(ball.vx, ball.vy))
    ball.vx = (ball.vx / magnitude) * speed
    ball.vy = (ball.vy / magnitude) * speed
    if (Math.abs(ball.vy) < BALL.minVertical) ball.vy = BALL.minVertical
    ball.y = PADDLE_TOP + ball.r + 0.08
    if (this.effects.has('sticky')) {
      ball.stuck = true
      ball.stuckOffset = offset
      this.phase = 'ready'
    }
  }

  private hitsPaddle(x: number, y: number, radius: number): boolean {
    if (this.effects.has('shieldpaddle')) {
      if (Math.abs(y - PADDLE.y) < 9 && Math.abs(x - this.paddle.x) < this.paddle.width / 2 + 8) {
        this.effects.delete('shieldpaddle')
        this.events.push({ type: 'paddle' })
        return true
      }
    }
    return (
      Math.abs(y - PADDLE.y) < PADDLE.height / 2 + radius &&
      Math.abs(x - this.paddle.x) < this.paddle.width / 2 + radius
    )
  }

  private damagePaddle(mine: boolean): void {
    if (this.effects.has('shieldpaddle')) {
      this.effects.delete('shieldpaddle')
      this.events.push({ type: 'paddle' })
      return
    }
    this.combo = 0
    if (mine) this.loseLife()
    else this.stun = 0.9
  }

  private respawnCaught(): void {
    this.balls = []
    this.spawnBall()
    this.phase = 'ready'
    this.events.push({ type: 'paddle' })
  }

  private onAllBallsLost(): void {
    if (this.phase !== 'playing') return
    if (this.zen) {
      this.spawnBall()
      this.phase = 'ready'
      return
    }
    this.loseLife()
  }

  private loseLife(): void {
    if (this.phase === 'won' || this.phase === 'lost') return
    this.lives -= 1
    this.combo = 0
    if (this.lives <= 0) {
      this.lives = 0
      this.phase = 'lost'
      this.effects.clear()
      return
    }
    this.spawnBall()
    this.phase = 'ready'
    this.events.push({ type: 'lose' })
  }

  // ------------------------------------------------------------- brick damage

  damageBrick(
    brick: Brick,
    amount: number,
    element: Element,
    hitX: number,
    hitY: number,
    source: 'ball' | 'laser' | 'blast',
  ): void {
    if (!brick.alive) return
    const spec = BRICKS[brick.type]
    if (brick.type === 'unbreakable') {
      this.events.push({ type: 'hit', x: hitX, y: hitY })
      return
    }
    if (brick.type === 'core' && source === 'ball') {
      const offX = Math.abs(hitX - brick.x) / (brick.w / 2)
      const offY = Math.abs(hitY - brick.y) / (brick.h / 2)
      if (offX > 0.55 || offY > 0.55) {
        this.events.push({ type: 'hit', x: hitX, y: hitY })
        return
      }
    }
    if (brick.type === 'shielded' && element !== 'fire' && source !== 'blast') {
      this.events.push({ type: 'hit', x: hitX, y: hitY })
      return
    }
    if (brick.type === 'colorlock' && element !== 'electric' && source !== 'blast') {
      this.events.push({ type: 'hit', x: hitX, y: hitY })
      return
    }
    if (brick.type === 'frozen' && element === 'fire') amount = Math.max(amount, brick.hp)
    if (brick.bossPart === 'core' && this.bricks.some((other) => other.alive && other.bossPart === 'shield')) {
      this.events.push({ type: 'hit', x: hitX, y: hitY })
      return
    }

    if (brick.type === 'sliding' && source === 'ball') {
      brick.offsetX = clamp(brick.offsetX + (hitX < brick.x ? 1.4 : -1.4), -6, 6)
      brick.x = brick.baseX + brick.offsetX
    }

    brick.hp -= amount
    brick.hitFlash = 1
    if (brick.hp > 0) {
      this.events.push({ type: 'hit', x: hitX, y: hitY })
      return
    }
    this.destroyBrick(brick, spec.color, source)
  }

  private destroyBrick(brick: Brick, color: string, source: 'ball' | 'laser' | 'blast'): void {
    const spec = BRICKS[brick.type]
    brick.alive = false
    brick.hp = 0
    this.destroyed += 1
    this.combo += 1
    this.comboTimer = 3
    const multiplier = this.effects.has('scoremult') ? 2 : 1
    const comboBonus = 1 + Math.min(0.6, this.combo * 0.02)
    this.score += Math.round(spec.score * multiplier * comboBonus)
    this.credits += 1
    this.events.push({ type: 'break', x: brick.x, y: brick.y, color })

    if (brick.type === 'regen' && brick.regenCount < 3) {
      brick.regenAt = this.time + 6.5
    }

    if (brick.bossPart === 'core' && this.boss) {
      this.boss.hp = Math.max(0, this.boss.hp - 1)
      this.boss.timer = Math.min(this.boss.timer, 2.4)
      this.events.push({ type: 'boss', telegraph: false })
    }

    if (!this.modifiers.has('nopowerups')) {
      let drops = spec.drops
      if (brick.type === 'treasure') drops = 3
      for (let index = 0; index < drops; index += 1) {
        if (index > 0 || this.rng.chance(this.level.dropRate)) {
          this.capsules.push({
            id: this.nextId++,
            x: brick.x + (index - (drops - 1) / 2) * 3,
            y: brick.y,
            vy: 0,
            power: this.rollPowerUp(),
            spin: 0,
          })
        }
      }
    }

    switch (brick.type) {
      case 'explosive':
        this.blast(brick.x, brick.y, 11, 0)
        break
      case 'chain':
        this.blast(brick.x, brick.y, 9, 0)
        break
      case 'electric':
        this.chainLightning(brick)
        break
      case 'splitter':
        this.splitBall(2)
        break
      case 'switch':
        this.openBulkheads()
        break
      case 'poison':
        this.effects.set('tiny', 4)
        break
      case 'mystery':
        this.applyPowerUp(this.rollPowerUp())
        break
      default:
        break
    }
    if (this.modifiers.has('explosivebricks') && brick.type !== 'unbreakable') {
      this.blast(brick.x, brick.y, 7, 1)
    }

    void source
    void color
  }

  private blast(x: number, y: number, radius: number, depth: number): void {
    if (depth > 4) return
    const reach = radius * (this.effects.has('chainreaction') ? 1.6 : 1)
    this.events.push({ type: 'boom', x, y, radius: reach })
    const victims = this.bricks.filter(
      (brick) => brick.alive && brick.type !== 'unbreakable' && Math.hypot(brick.x - x, brick.y - y) <= reach + brick.w / 2,
    )
    for (const victim of victims) {
      this.damageBrick(victim, 3, 'none', victim.x, victim.y, 'blast')
      if (victim.type === 'explosive' || victim.type === 'chain') {
        this.blast(victim.x, victim.y, reach * 0.7, depth + 1)
      }
    }
  }

  private chainLightning(origin: Brick): void {
    const targets = this.bricks
      .filter((brick) => brick.alive && brick.id !== origin.id && brick.type !== 'unbreakable')
      .sort((a, b) => Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y))
      .slice(0, 3)
    for (const target of targets) {
      this.damageBrick(target, 1, 'electric', target.x, target.y, 'blast')
    }
  }

  private splitBall(count: number): void {
    const source = this.balls.find((ball) => !ball.stuck)
    if (!source) return
    if (this.balls.length >= BALL.maxBalls) return
    const speed = Math.hypot(source.vx, source.vy) || this.targetSpeed()
    for (let index = 0; index < count - 1; index += 1) {
      if (this.balls.length >= BALL.maxBalls) return
      const angle = Math.atan2(source.vy, source.vx) + (index + 1) * 0.45
      this.balls.push({
        id: this.nextId++,
        x: source.x,
        y: source.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: source.r,
        stuck: false,
        stuckOffset: 0,
        alive: true,
        element: this.activeElement,
        portalCooldown: 0,
      })
    }
  }

  private openBulkheads(): void {
    for (const brick of this.bricks) {
      if (brick.alive && brick.type === 'unbreakable') {
        brick.alive = false
        this.events.push({ type: 'break', x: brick.x, y: brick.y, color: '#6c7c9e' })
      }
    }
  }

  // ------------------------------------------------------------------ pickups

  private rollPowerUp(): PowerUpId {
    const pool = (this.level.powerUps.length ? this.level.powerUps : DEFAULT_DROP_POOL).filter((id) =>
      POWER_UPS_BY_ID.has(id),
    )
    if (pool.length === 0) return 'jackpot'
    const weighted = pool.map((id) => {
      const def = powerUpDef(id)
      const weight = def.negative ? 1.6 : def.rarity === 3 ? 1.6 : def.rarity === 2 ? 3.4 : 6
      return { value: id, weight }
    })
    return this.rng.weighted(weighted)
  }

  applyPowerUp(id: PowerUpId): void {
    const def = powerUpDef(id)
    this.events.push({ type: 'power', id, x: this.paddle.x, y: PADDLE_TOP + 3 })
    if (def.negative) this.combo = 0
    if (def.seconds > 0) {
      const existing = this.effects.get(id) ?? 0
      this.effects.set(id, Math.max(existing, def.seconds))
    }

    switch (id) {
      case 'multiball':
        this.splitBall(3)
        break
      case 'supermultiball':
        this.splitBall(4)
        break
      case 'clone':
        this.splitBall(2)
        break
      case 'safetynet':
        this.safety += 1
        break
      case 'doublesafetynet':
        this.safety += 2
        break
      case 'repair':
        this.safety += 1
        break
      case 'extralife':
        this.lives = Math.min(6, this.lives + 1)
        break
      case 'bomb':
        this.bombNearest(14)
        break
      case 'megabomb':
        this.bombNearest(26)
        break
      case 'brickregen':
        this.reviveBricks(4)
        break
      case 'jackpot':
        this.score += 750
        this.credits += 150
        break
      default:
        break
    }
  }

  private bombNearest(radius: number): void {
    const candidates = this.bricks.filter((brick) => brick.alive && brick.required)
    if (candidates.length === 0) return
    const target = candidates[Math.floor(this.rng.next() * candidates.length)]!
    this.blast(target.x, target.y, radius, 0)
  }

  private reviveBricks(count: number): void {
    const dead = this.bricks.filter((brick) => !brick.alive && brick.type !== 'unbreakable' && brick.type !== 'bossshield')
    for (let index = 0; index < Math.min(count, dead.length); index += 1) {
      const brick = dead[index]!
      brick.alive = true
      brick.hp = brick.maxHp
      brick.regenAt = 0
      brick.hitFlash = 1
      this.destroyed = Math.max(0, this.destroyed - 1)
    }
  }

  // -------------------------------------------------------------------- bosses

  private bossX(): number {
    const cores = this.bricks.filter((brick) => brick.bossPart === 'core')
    if (cores.length === 0) return 0
    return cores.reduce((sum, brick) => sum + brick.x, 0) / cores.length
  }

  private bossY(): number {
    const cores = this.bricks.filter((brick) => brick.bossPart === 'core')
    if (cores.length === 0) return ARENA.top - 20
    return cores.reduce((sum, brick) => sum + brick.y, 0) / cores.length
  }

  private updateBoss(dt: number): void {
    if (!this.boss) return
    if (this.boss.hp <= 0) return
    if (this.boss.gravityPulse > 0) this.boss.gravityPulse = Math.max(0, this.boss.gravityPulse - dt)
    const spec = BOSSES[this.boss.id]
    const health = this.boss.maxHp > 0 ? this.boss.hp / this.boss.maxHp : 0
    const phase: 1 | 2 | 3 = health > 0.66 ? 1 : health > 0.33 ? 2 : 3
    if (phase !== this.boss.phase) {
      this.boss.phase = phase
      this.events.push({ type: 'boss', telegraph: false })
    }

    if (this.boss.telegraph > 0) {
      this.boss.telegraph -= dt
      if (this.boss.telegraph <= 0 && this.boss.pending) {
        this.executeBossAttack(this.boss.pending)
        this.boss.pending = null
        this.boss.timer = Math.max(2.6, 7.2 - phase * 1.2)
      }
      return
    }

    this.boss.timer -= dt
    if (this.boss.timer <= 0) {
      const attack = spec.attacks[this.boss.attackIndex % spec.attacks.length] ?? 'rain'
      this.boss.attackIndex += 1
      this.boss.pending = attack
      this.boss.telegraph = 0.85
      this.events.push({ type: 'boss', telegraph: true })
    }
  }

  private executeBossAttack(attack: BossAttack): void {
    const x = this.bossX()
    const y = this.bossY()
    switch (attack) {
      case 'rain':
        for (let index = 0; index < 3; index += 1) {
          this.hazards.push({
            id: this.nextId++,
            kind: 'mine',
            x: this.rng.range(-ARENA.halfWidth + 6, ARENA.halfWidth - 6),
            y: ARENA.top - 3,
            vx: 0,
            vy: -16 - this.rng.next() * 8,
            r: 2.4,
            hp: 1,
            life: 14,
            timer: 0,
            active: true,
          })
        }
        break
      case 'sweep':
        for (let index = 0; index < 2; index += 1) {
          const dx = this.paddle.x - x
          const dy = PADDLE.y - y
          const distance = Math.max(1, Math.hypot(dx, dy))
          this.bolts.push({
            id: this.nextId++,
            x,
            y,
            vx: (dx / distance) * 52,
            vy: (dy / distance) * 52,
            radius: 1.6,
            hostile: true,
            piercing: false,
            power: 1,
            life: 8,
          })
        }
        break
      case 'spread':
        for (let index = 0; index < 5; index += 1) {
          const angle = Math.PI + (index - 2) * 0.22
          this.bolts.push({
            id: this.nextId++,
            x,
            y,
            vx: Math.cos(angle) * 46,
            vy: Math.sin(angle) * 46,
            radius: 1.5,
            hostile: true,
            piercing: false,
            power: 1,
            life: 10,
          })
        }
        break
      case 'nova':
        for (let index = 0; index < 8; index += 1) {
          const angle = (Math.PI * 2 * index) / 8
          this.bolts.push({
            id: this.nextId++,
            x,
            y,
            vx: Math.cos(angle) * 40,
            vy: Math.sin(angle) * 40,
            radius: 1.4,
            hostile: true,
            piercing: false,
            power: 1,
            life: 5,
          })
        }
        break
      case 'shield': {
        const side = this.rng.chance(0.5) ? -1 : 1
        const col = 4 + Math.round(this.rng.next() * 2)
        void side
        this.bricks.push({
          id: this.nextId++,
          type: 'bossshield',
          x: ARENA.gridLeft + col * ARENA.cellWidth + ARENA.cellWidth / 2,
          y: ARENA.gridTop + (this.level.rows - 1) * ARENA.cellHeight,
          baseX: ARENA.gridLeft + col * ARENA.cellWidth + ARENA.cellWidth / 2,
          baseY: ARENA.gridTop + (this.level.rows - 1) * ARENA.cellHeight,
          w: ARENA.cellWidth - 0.8,
          h: ARENA.cellHeight - 0.85,
          hp: 3,
          maxHp: 3,
          alive: true,
          required: false,
          rotation: 0,
          offsetX: 0,
          offsetY: 0,
          moveAmp: 0,
          moveSpeed: 1,
          phase: 0,
          regenAt: 0,
          regenCount: 0,
          portal: 0,
          hitFlash: 1,
          bossPart: 'shield',
        })
        break
      }
      case 'summon':
        for (let index = 0; index < 2; index += 1) {
          this.hazards.push({
            id: this.nextId++,
            kind: 'orb',
            x: x + (index === 0 ? -8 : 8),
            y,
            vx: (index === 0 ? -1 : 1) * 22,
            vy: -18,
            r: 3,
            hp: 3,
            life: 30,
            timer: 0,
            active: true,
          })
        }
        break
      case 'gravity':
        this.boss!.gravityPulse = 2.2
        break
      case 'laser':
        this.hazards.push({
          id: this.nextId++,
          kind: 'beam',
          x: clamp(this.paddle.x + this.rng.range(-14, 14), -ARENA.halfWidth + 4, ARENA.halfWidth - 4),
          y: 0,
          vx: 0,
          vy: 0,
          r: 1.8,
          hp: 1,
          life: 4,
          timer: 1.1,
          active: false,
        })
        break
      case 'swap':
        for (const ball of this.balls) {
          ball.x = this.rng.range(-ARENA.halfWidth + ball.r + 2, ARENA.halfWidth - ball.r - 2)
        }
        this.events.push({ type: 'wall' })
        break
      case 'rush':
        this.hazards.push({
          id: this.nextId++,
          kind: 'mine',
          x: clamp(this.paddle.x + this.rng.range(-10, 10), -ARENA.halfWidth + 6, ARENA.halfWidth - 6),
          y,
          vx: 0,
          vy: -26,
          r: 2.6,
          hp: 1,
          life: 12,
          timer: 0,
          active: true,
        })
        this.hazards.push({
          id: this.nextId++,
          kind: 'orb',
          x,
          y,
          vx: this.rng.range(-26, 26),
          vy: -22,
          r: 3,
          hp: 3,
          life: 26,
          timer: 0,
          active: true,
        })
        break
    }
  }

  // ---------------------------------------------------------------- objective

  private checkObjective(): void {
    if (this.phase !== 'playing') return
    const objective = this.level.objective
    const won =
      objective.kind === 'boss'
        ? Boolean(this.boss && this.boss.hp <= 0)
        : objective.kind === 'survive'
          ? this.time >= objective.target
          : objective.kind === 'targets'
            ? this.destroyed >= objective.target || this.remaining === 0
            : objective.kind === 'switches'
              ? this.bricks.every((brick) => brick.type !== 'switch' || !brick.alive)
              : this.remaining === 0
    if (!won) return
    this.phase = 'won'
    const livesBonus = this.zen ? 0 : this.lives * 220
    const clearBonus = 400 + this.level.index * 6
    this.score += livesBonus + clearBonus
    this.effects.clear()
    this.events.push({ type: 'win' })
  }

  /** True when a positive effect with this id is running. */
  has(id: PowerUpId): boolean {
    return this.effects.has(id)
  }

  /** Debug/smoke helper: names of effects and the ball count. */
  describe(): {
    phase: Phase
    balls: number
    bricks: number
    score: number
    lives: number
    boss: number | null
    paddleX: number
    effects: number
  } {
    return {
      phase: this.phase,
      balls: this.balls.length,
      bricks: this.remaining,
      score: this.score,
      lives: this.lives,
      boss: this.boss ? this.boss.hp : null,
      paddleX: Math.round(this.paddle.x * 100) / 100,
      effects: this.effects.size,
    }
  }
}

/** NEGATIVE_POWER_UPS is exported for the UI legend. */
export const NEGATIVE_PICKUPS = NEGATIVE_POWER_UPS
