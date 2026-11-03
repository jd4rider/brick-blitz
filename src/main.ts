import './style.css'
import { audio } from './audio'
import type { LevelDefinition, PersistedGame } from './core/types'
import { bossRushLevel, endlessLevel, generateCampaign, generateLevel, levelForDate } from './levels/generate'
import { WORLDS, worldById } from './levels/worlds'
import {
  ACHIEVEMENTS,
  BALLS,
  PADDLES,
  TRAILS,
  createSave,
  evaluateAchievements,
  isLevelUnlocked,
  loadSave,
  recordResult,
  writeSave,
  SAVE_KEY,
} from './platform/save'
import { Renderer } from './render/scene'
import { Game } from './sim/game'
import { UI, type ModeId, type UIHandlers } from './ui/ui'

function todayKey(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}

function cosmeticColor(list: { id: string; color: string; accent?: string }[], id: string, fallback: string): string {
  return list.find((entry) => entry.id === id)?.color ?? fallback
}

class App implements UIHandlers {
  private readonly canvas: HTMLCanvasElement
  private readonly renderer: Renderer
  private readonly ui: UI
  private save: PersistedGame
  private readonly campaign: LevelDefinition[]
  private game: Game | null = null
  private level: LevelDefinition | null = null
  private mode: ModeId = 'campaign'
  private wave = 1
  private waveStartScore = 0
  private challenge: string | null = null
  private paused = false
  private finished = false
  private dragging = false
  private moved = false
  private pointerStart = { x: 0, y: 0 }
  private readonly keys = new Set<string>()
  private last = performance.now()
  private multiballGiven = false
  private readonly sessionSeed = Math.random().toString(36).slice(2)

  constructor() {
    const canvas = document.querySelector<HTMLCanvasElement>('#scene')
    const uiRoot = document.querySelector<HTMLElement>('#ui')
    if (!canvas || !uiRoot) throw new Error('Brick Blitz needs #scene and #ui')
    this.canvas = canvas
    this.renderer = new Renderer(canvas)
    this.save = loadSave()
    this.campaign = generateCampaign()
    this.ui = new UI(uiRoot, this.save, this)
    this.ui.mount(this.save, this.campaign)
    this.applySettings()
    this.ui.showMenu()
    this.renderer.showMenu(WORLDS[0]!.palette)
    this.bindInput()
    this.bindResize()
    this.last = performance.now()
    requestAnimationFrame(this.frame)
  }

  // -------------------------------------------------------------------- modes

  continueCampaign(): void {
    const index = Math.min(500, Math.max(1, this.save.lastLevel))
    this.startLevel(index)
  }

  openWorlds(): void {
    this.ui.showWorlds()
  }

  openLevels(world: number): void {
    this.ui.showLevels(world)
  }

  startLevel(index: number): void {
    if (!isLevelUnlocked(this.save, index)) {
      this.ui.toast('Clear the previous level first.')
      return
    }
    const level = this.campaign[index - 1] ?? generateLevel(index)
    this.mode = 'campaign'
    this.wave = 0
    this.waveStartScore = 0
    this.challenge = null
    this.begin(level, 3)
  }

  startMode(mode: ModeId): void {
    if (mode === 'campaign') {
      this.continueCampaign()
      return
    }
    this.challenge = null
    this.wave = 1
    this.waveStartScore = 0
    this.mode = mode
    if (mode === 'daily') {
      this.begin(levelForDate(new Date()), 3)
      return
    }
    if (mode === 'zen') {
      this.begin(generateLevel(Math.min(500, Math.max(1, this.save.lastLevel))), 99, true)
      return
    }
    if (mode === 'bossrush') {
      this.begin(bossRushLevel(1), 3)
      return
    }
    if (mode === 'survival') {
      this.begin(endlessLevel(1, `${this.sessionSeed}-survival`), 2)
      return
    }
    this.begin(endlessLevel(1, this.sessionSeed), 3)
  }

  startChallenge(modifier: string): void {
    this.challenge = modifier
    this.mode = 'challenge'
    this.wave = 1
    this.waveStartScore = 0
    if (modifier === 'gauntlet') {
      this.mode = 'survival'
      this.begin(endlessLevel(1, `${this.sessionSeed}-gauntlet`), 1)
      return
    }
    const base = generateLevel(Math.min(500, Math.max(1, this.save.lastLevel)))
    const modifiers: string[] = []
    if (modifier === 'nopowerups') modifiers.push('nopowerups')
    if (modifier === 'tinypaddle') modifiers.push('tinypaddle')
    if (modifier === 'explosive') modifiers.push('explosivebricks')
    const lives = modifier === 'oneball' ? 1 : 3
    this.begin(base, lives, false, modifiers)
    if (modifier === 'speed' && this.game) this.game.speedBonus = 0.25
    if (modifier === 'laser' && this.game) this.game.effects.set('laser', 9999)
    if (modifier === 'multiball') this.multiballGiven = false
  }

  private begin(level: LevelDefinition, lives: number, zen = false, modifiers: string[] = []): void {
    this.level = level
    this.paused = false
    this.finished = false
    this.multiballGiven = false
    const startScore = this.mode === 'campaign' ? 0 : this.waveStartScore
    this.game = new Game(level, {
      mode: this.mode,
      lives,
      zen,
      startScore,
      modifiers,
      runSeed: this.wave,
    })
    if (this.mode === 'survival') this.game.speedBonus = Math.min(0.35, this.wave * 0.035)
    const world = worldById(level.world)
    this.renderer.setPalette(world.palette)
    this.renderer.setCosmetics(
      cosmeticColor(PADDLES, this.save.paddle, '#cbd5e1'),
      cosmeticColor(BALLS, this.save.ball, '#a5f3fc'),
      cosmeticColor(TRAILS, this.save.trail, '#7dd3fc'),
    )
    this.renderer.setQuality(this.save.settings.quality)
    this.renderer.setHighContrast(this.save.settings.highContrast)
    this.renderer.buildLevel(this.game, level)
    this.ui.hideOverlay()
    this.ui.showGame(this.game)
    audio.unlock()
  }

  // ------------------------------------------------------------------ actions

  launch(): void {
    if (!this.game) return
    this.game.launch()
    audio.play('ui')
    if (this.challenge === 'multiball' && !this.multiballGiven) {
      this.multiballGiven = true
      this.game.applyPowerUp('multiball')
      this.game.applyPowerUp('multiball')
    }
  }

  fire(): void {
    this.game?.fire()
  }

  pause(): void {
    if (!this.game || this.paused) return
    this.paused = true
    audio.play('ui')
    this.ui.showPause(this.game)
  }

  resume(): void {
    this.paused = false
    this.ui.hideOverlay()
    audio.unlock()
  }

  restart(): void {
    if (!this.level) return
    if (this.challenge) {
      this.startChallenge(this.challenge)
      return
    }
    const lives =
      this.mode === 'zen' ? 99 : this.mode === 'survival' ? (this.challenge === 'gauntlet' ? 1 : 2) : 3
    this.begin(this.level, lives, this.mode === 'zen')
  }

  retry(): void {
    if (!this.level) return
    if (this.challenge) {
      this.startChallenge(this.challenge)
      return
    }
    const lives =
      this.mode === 'zen' ? 99 : this.mode === 'survival' ? (this.challenge === 'gauntlet' ? 1 : 2) : 3
    this.begin(this.level, lives, this.mode === 'zen')
  }

  nextLevel(): void {
    if (!this.level) return
    if (this.mode === 'campaign') {
      const next = Math.min(500, this.level.index + 1)
      if (this.level.index >= 500) {
        this.ui.toast('That was the last level. Endless is waiting.')
        this.quit()
        return
      }
      this.startLevel(next)
      return
    }
    this.waveStartScore = this.game?.score ?? this.waveStartScore
    this.wave += 1
    const lives =
      this.mode === 'zen' ? 99 : this.mode === 'survival' ? (this.challenge === 'gauntlet' ? 1 : 2) : 3
    this.begin(this.waveLevel(this.wave), lives, this.mode === 'zen')
  }

  private waveLevel(wave: number): LevelDefinition {
    if (this.mode === 'bossrush') return bossRushLevel(Math.min(10, wave))
    return endlessLevel(wave, `${this.sessionSeed}-${this.mode}`)
  }

  quit(): void {
    this.game = null
    this.level = null
    this.paused = false
    this.finished = false
    this.ui.hideOverlay()
    this.ui.showMenu()
  }

  goMenu(): void {
    this.quit()
  }

  wear(kind: 'paddle' | 'ball' | 'trail', id: string): void {
    if (!this.save.unlocked.includes(id)) return
    if (kind === 'paddle') this.save.paddle = id
    else if (kind === 'ball') this.save.ball = id
    else this.save.trail = id
    writeSave(this.save)
    this.applySettings()
    this.ui.showCosmetics()
    audio.play('ui')
  }

  buy(kind: 'paddle' | 'ball' | 'trail', id: string): void {
    const list = kind === 'paddle' ? PADDLES : kind === 'ball' ? BALLS : TRAILS
    const item = list.find((entry) => entry.id === id)
    if (!item || this.save.unlocked.includes(id)) return
    if (this.save.credits < item.cost) {
      this.ui.toast(`Need ${item.cost - this.save.credits} more credits.`)
      return
    }
    this.save.credits -= item.cost
    this.save.unlocked.push(id)
    this.wear(kind, id)
    this.save.achievements = Array.from(new Set([...this.save.achievements, 'cosmetic']))
    writeSave(this.save)
    this.ui.mount(this.save, this.campaign)
    this.ui.showCosmetics()
  }

  setting(key: string, value: string | boolean): void {
    if (key === 'quality' && (value === 'low' || value === 'medium' || value === 'high')) {
      this.save.settings.quality = value
    } else if (key === 'sound' && typeof value === 'boolean') this.save.settings.sound = value
    else if (key === 'music' && typeof value === 'boolean') this.save.settings.music = value
    else if (key === 'motion' && typeof value === 'boolean') this.save.settings.motion = value
    else if (key === 'highContrast' && typeof value === 'boolean') this.save.settings.highContrast = value
    else if (key === 'invert' && typeof value === 'boolean') this.save.settings.invert = value
    writeSave(this.save)
    this.applySettings()
  }

  eraseProgress(): void {
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      // ignore
    }
    this.save = createSave()
    this.ui.mount(this.save, this.campaign)
    this.applySettings()
    this.ui.showMenu()
    this.ui.toast('Progress erased on this device.')
  }

  share(): void {
    const score = this.game?.score ?? this.save.scores[this.level ? `bb-${String(this.level.index).padStart(3, '0')}` : ''] ?? 0
    const text = `I scored ${score.toLocaleString()} in Brick Blitz. ${this.mode === 'campaign' ? `Level ${this.level?.index ?? 1}` : this.mode}.`
    const nav = navigator as Navigator & { share?: (data: { text: string; url?: string }) => Promise<void> }
    if (nav.share) {
      void nav.share({ text, url: 'https://brickblitz.littlejoyarcade.site' }).catch(() => {})
      return
    }
    void navigator.clipboard?.writeText(`${text} https://brickblitz.littlejoyarcade.site`).then(
      () => this.ui.toast('Score copied to the clipboard.'),
      () => this.ui.toast('Could not copy the score.'),
    )
  }

  // ------------------------------------------------------------------ helpers

  private applySettings(): void {
    audio.setSound(this.save.settings.sound)
    audio.setMusic(this.save.settings.music && this.save.settings.sound)
    this.renderer.setQuality(this.save.settings.quality)
    this.renderer.setHighContrast(this.save.settings.highContrast)
    this.renderer.setCosmetics(
      cosmeticColor(PADDLES, this.save.paddle, '#cbd5e1'),
      cosmeticColor(BALLS, this.save.ball, '#a5f3fc'),
      cosmeticColor(TRAILS, this.save.trail, '#7dd3fc'),
    )
  }

  private finish(): void {
    if (!this.game || !this.level || this.finished) return
    this.finished = true
    const game = this.game
    const level = this.level
    const won = game.phase === 'won'
    const stars = won ? game.stars() : 0
    let credits = 0
    let best = false

    if (won) {
      if (this.mode === 'campaign') {
        const recorded = recordResult(this.save, level.index, stars, game.score)
        credits = recorded.credits
        best = recorded.best
      } else {
        credits = 25 + stars * 20 + Math.floor(game.score / 900)
        this.save.credits += credits
        if (this.mode === 'endless') this.save.endlessBest = Math.max(this.save.endlessBest, this.wave)
        if (this.mode === 'survival') this.save.survivalBest = Math.max(this.save.survivalBest, this.wave)
        if (this.mode === 'bossrush') this.save.bossRushBest = Math.max(this.save.bossRushBest, this.wave)
        if (this.mode === 'daily') {
          const date = todayKey()
          const previous = this.save.daily.date === date ? this.save.daily.score : 0
          this.save.daily = { date, score: Math.max(previous, game.score), done: true }
        }
      }
    }

    const unlocked = evaluateAchievements(this.save)
    writeSave(this.save)
    this.ui.mount(this.save, this.campaign)
    this.ui.showResult({
      level,
      mode: this.mode,
      won,
      stars,
      score: game.score,
      best,
      credits,
      wave: this.wave,
      reason: won ? undefined : 'Out of balls',
    })
    audio.play(won ? 'win' : 'lose')
    if (unlocked.length > 0) {
      const names = unlocked
        .map((id) => ACHIEVEMENTS.find((entry) => entry.id === id)?.name ?? id)
        .join(', ')
      this.ui.toast(`Achievement unlocked: ${names}`)
    }
  }

  private playEvents(events: import('./sim/game').SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'break') audio.play('break')
      else if (event.type === 'hit') audio.play('brick')
      else if (event.type === 'paddle') audio.play('paddle')
      else if (event.type === 'wall') audio.play('wall')
      else if (event.type === 'laser') audio.play('laser')
      else if (event.type === 'boom') audio.play('boom')
      else if (event.type === 'power') audio.play('power')
      else if (event.type === 'boss') audio.play('boss')
      else if (event.type === 'lose') audio.play('lose')
    }
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000))
    this.last = now

    if (!this.game || this.ui.currentScreen !== 'game') {
      const world = this.level ? worldById(this.level.world) : WORLDS[0]!
      this.renderer.showMenu(world.palette)
      this.renderer.menu(dt)
      requestAnimationFrame(this.frame)
      return
    }

    if (!this.paused) {
      if (this.keys.size > 0) {
        const step = 110 * dt
        if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) this.game.nudgePaddle(-step)
        if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) this.game.nudgePaddle(step)
      }
      this.game.update(dt)
    }

    const events = this.game.drainEvents()
    this.playEvents(events)
    this.renderer.handleEvents(events, this.game)
    this.renderer.sync(this.game, this.paused ? 0 : dt)
    this.ui.updateHud(this.game)

    if (!this.finished && (this.game.phase === 'won' || this.game.phase === 'lost')) this.finish()
    requestAnimationFrame(this.frame)
  }

  // -------------------------------------------------------------------- input

  private bindInput(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      audio.unlock()
      if (!this.game || this.overlayOpen()) return
      this.dragging = true
      this.moved = false
      this.pointerStart = { x: event.clientX, y: event.clientY }
      this.canvas.setPointerCapture(event.pointerId)
      this.movePaddle(event.clientX)
    })

    this.canvas.addEventListener('pointermove', (event) => {
      if (!this.dragging) return
      if (Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 8) {
        this.moved = true
      }
      this.movePaddle(event.clientX)
    })

    const release = (event: PointerEvent) => {
      if (!this.dragging) return
      this.dragging = false
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
      if (!this.moved && this.game?.phase === 'ready' && !this.overlayOpen()) this.launch()
    }
    this.canvas.addEventListener('pointerup', release)
    this.canvas.addEventListener('pointercancel', () => {
      this.dragging = false
    })

    window.addEventListener('keydown', (event) => {
      audio.unlock()
      this.keys.add(event.code)
      if (event.code === 'Space') {
        event.preventDefault()
        if (this.paused) this.resume()
        else if (this.game?.phase === 'ready') this.launch()
        else this.fire()
      }
      if (event.code === 'Escape') {
        if (this.paused) this.resume()
        else if (this.game && this.ui.currentScreen === 'game') this.pause()
      }
      if (event.code === 'KeyR' && this.game && this.game.phase !== 'won') this.restart()
    })
    window.addEventListener('keyup', (event) => this.keys.delete(event.code))

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.game && !this.paused && !this.finished) this.pause()
    })
  }

  private overlayOpen(): boolean {
    return this.paused || this.finished
  }

  private movePaddle(clientX: number): void {
    if (!this.game) return
    const rect = this.canvas.getBoundingClientRect()
    let x = this.renderer.worldX(clientX, rect)
    if (this.save.settings.invert) x = -x
    this.game.setPaddleTarget(x)
  }

  private bindResize(): void {
    const resize = () => {
      const rect = this.canvas.getBoundingClientRect()
      this.renderer.resize(Math.max(1, rect.width), Math.max(1, rect.height))
    }
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', () => window.setTimeout(resize, 120))
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(this.canvas)
    resize()
  }
}

const app = new App()

if (new URLSearchParams(window.location.search).has('debug')) {
  ;(window as unknown as { __bb: unknown }).__bb = {
    state: () => (app as unknown as { game: Game | null }).game?.describe() ?? null,
    level: () => (app as unknown as { level: LevelDefinition | null }).level?.index ?? null,
    mode: () => (app as unknown as { mode: ModeId }).mode,
    screen: () => (app as unknown as { ui: UI }).ui.currentScreen,
    grant: (id: string) => (app as unknown as { game: Game | null }).game?.applyPowerUp(id as never),
    launch: () => app.launch(),
    win: () => {
      const game = (app as unknown as { game: Game | null }).game
      const level = (app as unknown as { level: LevelDefinition | null }).level
      if (!game || !level) return false
      for (const brick of game.bricks) {
        if (brick.required && brick.alive) game.damageBrick(brick, 999, 'none', brick.x, brick.y, 'blast')
      }
      return true
    },
  }
}

void app
