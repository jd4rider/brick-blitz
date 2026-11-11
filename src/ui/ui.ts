import type { Game } from '../sim/game'
import { openTipJar } from './support'
import type { LevelDefinition, PersistedGame } from '../core/types'
import { WORLDS, worldById } from '../levels/worlds'
import { BOSSES } from '../sim/bosses'
import {
  ACHIEVEMENTS,
  BALLS,
  PADDLES,
  TRAILS,
  clearedCount,
  isLevelUnlocked,
  isWorldUnlocked,
  levelId,
  totalStars,
  type Cosmetic,
} from '../platform/save'
import { POWER_UPS } from '../sim/powerups'

export type ModeId = 'campaign' | 'endless' | 'survival' | 'bossrush' | 'daily' | 'zen' | 'challenge'

export interface ResultSummary {
  level: LevelDefinition
  mode: ModeId
  won: boolean
  stars: number
  score: number
  best: boolean
  credits: number
  wave: number
  reason?: string
}

export interface UIHandlers {
  continueCampaign(): void
  openWorlds(): void
  openLevels(world: number): void
  startLevel(index: number): void
  startMode(mode: ModeId): void
  startChallenge(modifier: string): void
  pause(): void
  resume(): void
  restart(): void
  quit(): void
  nextLevel(): void
  retry(): void
  launch(): void
  fire(): void
  goMenu(): void
  wear(kind: 'paddle' | 'ball' | 'trail', id: string): void
  buy(kind: 'paddle' | 'ball' | 'trail', id: string): void
  setting(key: string, value: string | boolean): void
  eraseProgress(): void
  share(): void
}

type Screen =
  | 'menu'
  | 'worlds'
  | 'levels'
  | 'game'
  | 'settings'
  | 'achievements'
  | 'cosmetics'
  | 'challenges'
  | 'help'

const CHALLENGES: { id: string; name: string; blurb: string }[] = [
  { id: 'oneball', name: 'One Ball Only', blurb: 'A single life. Make it count.' },
  { id: 'nopowerups', name: 'No Power-Ups', blurb: 'Pure bricks and paddle.' },
  { id: 'speed', name: 'Speed Run', blurb: 'The ball moves 25% faster.' },
  { id: 'tiny', name: 'Precision Paddle', blurb: 'A permanently small paddle.' },
  { id: 'explosive', name: 'Explosive Bricks', blurb: 'Every brick that dies takes a neighbour.' },
  { id: 'multiball', name: 'Multiball Madness', blurb: 'Start with five balls.' },
  { id: 'laser', name: 'Laser Challenge', blurb: 'Lasers from the first brick.' },
  { id: 'gauntlet', name: 'Survival Gauntlet', blurb: 'Ten waves, no mercy, one life.' },
]

const STAR = '★'

function stars(value: number): string {
  return `${STAR.repeat(Math.max(0, value))}<span class="star-dim">${STAR.repeat(Math.max(0, 3 - value))}</span>`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) =>
    character === '&' ? '&amp;' : character === '<' ? '&lt;' : character === '>' ? '&gt;' : '&quot;',
  )
}

export class UI {
  private readonly root: HTMLElement
  private readonly handlers: UIHandlers
  private screen: Screen = 'menu'
  private save: PersistedGame
  private campaign: LevelDefinition[] = []
  private selectedWorld = 1
  private hud: {
    root: HTMLElement
    score: HTMLElement
    lives: HTMLElement
    name: HTMLElement
    objective: HTMLElement
    combo: HTMLElement
    effects: HTMLElement
    boss: HTMLElement
    bossFill: HTMLElement
    bossName: HTMLElement
    launch: HTMLButtonElement
    fire: HTMLButtonElement
    hint: HTMLElement
  } | null = null
  private lastEffects = ''
  private lastCombo = 0
  private overlay: HTMLElement | null = null
  private toastTimer: number | null = null

  constructor(root: HTMLElement, save: PersistedGame, handlers: UIHandlers) {
    this.root = root
    this.save = save
    this.handlers = handlers
    this.root.addEventListener('click', (event) => this.onClick(event))
    this.root.addEventListener('change', (event) => this.onChange(event))
  }

  mount(save: PersistedGame, campaign: LevelDefinition[]): void {
    this.save = save
    this.campaign = campaign
  }

  get currentScreen(): Screen {
    return this.screen
  }

  // ------------------------------------------------------------------ screens

  showMenu(): void {
    this.screen = 'menu'
    this.hud = null
    this.overlay = null
    const starsTotal = totalStars(this.save)
    const next = this.save.lastLevel
    const nextLevel = this.campaign[next - 1]
    this.root.innerHTML = `
      <div class="screen menu-screen">
        <div class="menu-top">
          <p class="eyebrow">Little Joy Arcade</p>
          <h1 class="title">BRICK<span>BLITZ</span></h1>
          <p class="tagline">Smash the wall. Catch the chaos.</p>
        </div>
        <div class="menu-stats">
          <span>${STAR} ${starsTotal}</span>
          <span>${clearedCount(this.save)}/500 cleared</span>
          <span>${this.save.credits} credits</span>
        </div>
        <div class="menu-actions">
          <button class="btn primary big" data-action="continue">
            <span>CONTINUE</span>
            <small>Level ${next}${nextLevel ? ` · ${escapeHtml(nextLevel.name)}` : ''}</small>
          </button>
          <div class="menu-grid">
            <button class="btn" data-action="worlds"><b>PLAY</b><small>500 levels</small></button>
            <button class="btn" data-action="mode:endless"><b>ENDLESS</b><small>Best wave ${this.save.endlessBest}</small></button>
            <button class="btn" data-action="mode:survival"><b>SURVIVAL</b><small>Best wave ${this.save.survivalBest}</small></button>
            <button class="btn" data-action="mode:bossrush"><b>BOSS RUSH</b><small>Best ${this.save.bossRushBest}</small></button>
            <button class="btn" data-action="mode:daily"><b>DAILY</b><small>${this.save.daily.done ? 'Done today' : 'One shared level'}</small></button>
            <button class="btn" data-action="mode:zen"><b>ZEN</b><small>No pressure</small></button>
            <button class="btn" data-action="challenges"><b>CHALLENGES</b><small>8 modifiers</small></button>
            <button class="btn" data-action="settings"><b>SETTINGS</b><small>Audio · quality</small></button>
          </div>
          <div class="menu-links">
            <button class="link" data-action="achievements">Achievements</button>
            <button class="link" data-action="cosmetics">Cosmetics</button>
            <button class="link" data-action="help">How to play</button>
            <a class="link" href="https://littlejoyarcade.site" target="_blank" rel="noreferrer">Arcade ↗</a>
          </div>
        </div>
      </div>
    `
  }

  showWorlds(): void {
    this.screen = 'worlds'
    this.hud = null
    this.overlay = null
    this.root.innerHTML = `
      <div class="screen panel-screen">
        ${this.header('Choose a world', 'Play')}
        <div class="world-grid">
          ${WORLDS.map((world) => {
            const unlocked = isWorldUnlocked(this.save, world.id)
            const worldStars = Array.from({ length: 50 }, (_, index) => this.save.stars[levelId((world.id - 1) * 50 + index + 1)] ?? 0)
            const earned = worldStars.reduce((sum, value) => sum + value, 0)
            const completed = worldStars.filter((value) => value > 0).length
            return `
              <button class="world-card ${unlocked ? '' : 'locked'}" data-action="levels:${world.id}" aria-label="${world.name}, ${completed} of 50 cleared" style="--sky:${world.palette.sky};--glow:${world.palette.glow};--accent:${world.palette.accent}">
                <span class="world-boss">${unlocked ? BOSSES[world.boss].name : 'Locked'}</span>
                <span class="world-index">World ${world.id}</span>
                <strong>${escapeHtml(world.name)}</strong>
                <small>${escapeHtml(world.subtitle)}</small>
                <span class="world-progress"><i style="width:${(completed / 50) * 100}%"></i></span>
                <span class="world-meta">${unlocked ? `${completed}/50 · ${STAR} ${earned}` : `Clear world ${world.id - 1}'s boss to unlock`}</span>
              </button>
            `
          }).join('')}
        </div>
      </div>
    `
  }

  showLevels(worldNumber: number): void {
    this.selectedWorld = worldNumber
    this.screen = 'levels'
    this.hud = null
    this.overlay = null
    const world = worldById(worldNumber)
    if (!isWorldUnlocked(this.save, worldNumber)) {
      this.showWorlds()
      this.toast(`World ${worldNumber} is locked. Beat the previous boss first.`)
      return
    }
    const levels = this.campaign.filter((level) => level.world === worldNumber)
    this.root.innerHTML = `
      <div class="screen panel-screen" style="--accent:${world.palette.accent}">
        ${this.header(world.name, 'Play')}
        <p class="world-sub">${escapeHtml(world.subtitle)} · Boss: ${BOSSES[world.boss].name}</p>
        <div class="level-grid">
          ${levels
            .map((level) => {
              const unlocked = isLevelUnlocked(this.save, level.index)
              const starsEarned = this.save.stars[levelId(level.index)] ?? 0
              const isBoss = Boolean(level.boss)
              return `
                <button class="level-tile ${unlocked ? '' : 'locked'} ${isBoss ? 'boss' : ''} ${starsEarned === 3 ? 'perfect' : ''}"
                  data-action="level:${level.index}" ${unlocked ? '' : 'disabled'}
                  aria-label="Level ${level.local}${isBoss ? ', boss' : ''}${starsEarned ? `, ${starsEarned} stars` : ''}">
                  <span class="level-number">${isBoss ? '☠' : level.local}</span>
                  <span class="level-stars">${stars(starsEarned)}</span>
                </button>
              `
            })
            .join('')}
        </div>
        <div class="panel-actions">
          <button class="btn" data-action="mode:daily">Daily challenge</button>
          <button class="btn" data-action="menu">Main menu</button>
        </div>
      </div>
    `
  }

  showGame(game: Game): void {
    this.screen = 'game'
    this.overlay = null
    const level = game.level
    this.root.innerHTML = `
      <div class="hud" id="hud">
        <div class="hud-top">
          <button class="icon-btn" data-action="pause" aria-label="Pause">❚❚</button>
          <div class="hud-title">
            <span class="hud-level">${level.boss ? BOSSES[level.boss].name : `Level ${level.index}`}</span>
            <span class="hud-objective" id="hud-objective">${escapeHtml(game.objectiveText())}</span>
          </div>
          <div class="hud-right">
            <span class="hud-score" id="hud-score">0</span>
            <span class="hud-lives" id="hud-lives" aria-label="Lives">♥♥♥</span>
          </div>
        </div>
        <div class="combo" id="hud-combo" aria-live="polite"></div>
        <div class="boss-bar" id="hud-boss" hidden>
          <span id="hud-boss-name"></span>
          <div class="bar"><i id="hud-boss-fill"></i></div>
        </div>
        <div class="effects" id="hud-effects"></div>
        <div class="hud-bottom">
          <p class="hint" id="hud-hint">${level.tutorial ? escapeHtml(level.tutorial) : ''}</p>
          <div class="hud-actions">
            <button class="btn ghost" data-action="fire" id="hud-fire" hidden>FIRE</button>
            <button class="btn primary launch" data-action="launch" id="hud-launch">LAUNCH</button>
          </div>
        </div>
      </div>
    `
    this.hud = {
      root: this.root.querySelector('#hud') as HTMLElement,
      score: this.root.querySelector('#hud-score') as HTMLElement,
      lives: this.root.querySelector('#hud-lives') as HTMLElement,
      name: this.root.querySelector('.hud-level') as HTMLElement,
      objective: this.root.querySelector('#hud-objective') as HTMLElement,
      combo: this.root.querySelector('#hud-combo') as HTMLElement,
      effects: this.root.querySelector('#hud-effects') as HTMLElement,
      boss: this.root.querySelector('#hud-boss') as HTMLElement,
      bossFill: this.root.querySelector('#hud-boss-fill') as HTMLElement,
      bossName: this.root.querySelector('#hud-boss-name') as HTMLElement,
      launch: this.root.querySelector('#hud-launch') as HTMLButtonElement,
      fire: this.root.querySelector('#hud-fire') as HTMLButtonElement,
      hint: this.root.querySelector('#hud-hint') as HTMLElement,
    }
    this.lastEffects = ''
    this.lastCombo = 0
  }

  updateHud(game: Game): void {
    if (!this.hud || this.screen !== 'game') return
    this.hud.score.textContent = game.score.toLocaleString()
    this.hud.lives.textContent = game.lives > 8 ? '∞' : '♥'.repeat(Math.max(0, game.lives))
    this.hud.objective.textContent = game.objectiveText()
    this.hud.launch.textContent = game.phase === 'ready' ? 'LAUNCH' : 'LAUNCH'
    this.hud.launch.classList.toggle('pulse', game.phase === 'ready')
    this.hud.fire.hidden = !game.effects.has('laser')

    if (game.combo !== this.lastCombo) {
      this.lastCombo = game.combo
      this.hud.combo.textContent = game.combo >= 3 ? `COMBO ×${game.combo}` : ''
      this.hud.combo.classList.toggle('show', game.combo >= 3)
    }

    if (game.boss) {
      this.hud.boss.hidden = false
      this.hud.bossName.textContent = `${BOSSES[game.boss.id].name} · phase ${game.boss.phase}`
      const ratio = game.boss.maxHp > 0 ? Math.max(0, game.boss.hp / game.boss.maxHp) : 0
      this.hud.bossFill.style.width = `${ratio * 100}%`
      this.hud.bossFill.classList.toggle('danger', game.boss.telegraph > 0)
    } else {
      this.hud.boss.hidden = true
    }

    const active = game.activeEffects
      .sort((a, b) => a.remaining - b.remaining)
      .slice(0, 5)
    const signature = active.map((effect) => `${effect.id}:${Math.ceil(effect.remaining)}`).join('|')
    if (signature !== this.lastEffects) {
      this.lastEffects = signature
      this.hud.effects.innerHTML = active
        .map((effect) => {
          const def = POWER_UPS.find((entry) => entry.id === effect.id)
          if (!def) return ''
          return `<span class="chip ${def.negative ? 'bad' : ''}" style="--chip:${def.color}"><b>${escapeHtml(def.glyph)}</b>${escapeHtml(def.name)}<i>${Math.ceil(effect.remaining)}s</i></span>`
        })
        .join('')
    }

    if (game.phase === 'playing' && this.hud.hint.textContent) this.hud.hint.classList.add('fade')
    else this.hud.hint.classList.remove('fade')
  }

  showPause(game: Game): void {
    if (this.overlay) return
    const overlay = document.createElement('div')
    overlay.className = 'overlay'
    overlay.innerHTML = `
      <div class="sheet">
        <p class="eyebrow">Paused</p>
        <h2>${escapeHtml(game.level.name)}</h2>
        <p class="sheet-sub">${escapeHtml(game.objectiveText())} · Score ${game.score.toLocaleString()}</p>
        <div class="sheet-actions">
          <button class="btn primary" data-action="resume">Resume</button>
          <button class="btn" data-action="restart">Restart level</button>
          <button class="btn" data-action="settings">Settings</button>
          <button class="btn ghost" data-action="quit">Quit to menu</button>
        </div>
      </div>
    `
    this.root.appendChild(overlay)
    this.overlay = overlay
  }

  showResult(result: ResultSummary): void {
    if (this.overlay) this.overlay.remove()
    const world = worldById(result.level.world)
    const overlay = document.createElement('div')
    overlay.className = 'overlay'
    const nextIndex = Math.min(500, result.level.index + 1)
    const canContinue = result.mode === 'campaign' && result.won && nextIndex <= 500
    overlay.innerHTML = `
      <div class="sheet result ${result.won ? 'won' : 'lost'}" style="--accent:${world.palette.accent}">
        <p class="eyebrow">${result.mode === 'daily' ? 'Daily challenge' : result.mode === 'bossrush' ? 'Boss rush' : result.mode === 'endless' ? `Endless · wave ${result.wave + 1}` : result.mode === 'survival' ? `Survival · wave ${result.wave + 1}` : result.mode === 'zen' ? 'Zen' : `Level ${result.level.index}`}</p>
        <h2>${result.won ? 'Wall cleared' : result.reason ?? 'Out of balls'}</h2>
        <div class="result-stars">${result.won ? stars(result.stars) : ''}</div>
        <dl class="stats">
          <div><dt>Score</dt><dd>${result.score.toLocaleString()}</dd></div>
          <div><dt>${result.best ? 'New best' : 'Best'}</dt><dd>${(result.best ? result.score : this.save.scores[levelId(result.level.index)] ?? result.score).toLocaleString()}</dd></div>
          <div><dt>Credits</dt><dd>+${result.credits}</dd></div>
        </dl>
        ${result.won ? `<p class="sheet-sub">${result.stars === 3 ? 'Perfect. Every brick, no fuss.' : result.stars === 2 ? 'Strong clear. A little more combo for three.' : 'Cleared. Three stars needs a bigger score.'}</p>` : `<p class="sheet-sub">${escapeHtml(result.level.name)} · ${result.score.toLocaleString()} points. The wall does not move, so neither should you.</p>`}
        <div class="sheet-actions">
          ${
            result.won
              ? `${canContinue ? `<button class="btn primary" data-action="next">Next level</button>` : ''}
                 <button class="btn" data-action="retry">Play again</button>
                 <button class="btn ghost" data-action="worlds">World map</button>`
              : `<button class="btn primary" data-action="retry">Try again</button>
                 <button class="btn ghost" data-action="quit">Main menu</button>`
          }
          ${
            result.mode !== 'campaign'
              ? `<button class="btn ghost" data-action="quit">Back to menu</button>`
              : ''
          }
        </div>
        <p class="share-line"><button class="link" data-action="share">Share this score</button> · <button class="link" data-action="tip">☕ Buy me a coffee</button></p>
      </div>
    `
    this.root.appendChild(overlay)
    this.overlay = overlay
  }

  hideOverlay(): void {
    this.overlay?.remove()
    this.overlay = null
  }

  showSettings(): void {
    this.screen = 'settings'
    this.hud = null
    this.overlay = null
    const settings = this.save.settings
    this.root.innerHTML = `
      <div class="screen panel-screen">
        ${this.header('Settings', 'Settings')}
        <div class="settings-list card">
          ${this.toggleRow('sound', 'Sound effects', settings.sound)}
          ${this.toggleRow('music', 'Music', settings.music)}
          ${this.toggleRow('motion', 'Screen shake and motion', settings.motion)}
          ${this.toggleRow('highContrast', 'High-contrast bricks', settings.highContrast)}
          ${this.toggleRow('invert', 'Invert paddle controls', settings.invert)}
          <label class="setting-row">
            <span><b>Graphics quality</b><small>Lower it if the frame rate dips.</small></span>
            <select data-setting="quality">
              <option value="low" ${settings.quality === 'low' ? 'selected' : ''}>Low</option>
              <option value="medium" ${settings.quality === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="high" ${settings.quality === 'high' ? 'selected' : ''}>High</option>
            </select>
          </label>
        </div>
        <div class="panel-actions">
          <button class="btn ghost danger" data-action="erase">Erase all progress</button>
          <button class="btn" data-action="menu">Back</button>
        </div>
        <p class="fineprint">Progress is stored on this device and survives offline play. Erasing cannot be undone.</p>
      </div>
    `
  }

  showAchievements(): void {
    this.screen = 'achievements'
    this.hud = null
    this.overlay = null
    const unlocked = new Set(this.save.achievements)
    this.root.innerHTML = `
      <div class="screen panel-screen">
        ${this.header(`${unlocked.size}/${ACHIEVEMENTS.length} achievements`, 'Progress')}
        <ul class="achievement-list">
          ${ACHIEVEMENTS.map(
            (entry) => `
            <li class="${unlocked.has(entry.id) ? 'unlocked' : ''}">
              <span class="badge">${unlocked.has(entry.id) ? '★' : '☆'}</span>
              <span><b>${escapeHtml(entry.name)}</b><small>${escapeHtml(entry.blurb)}</small></span>
            </li>`,
          ).join('')}
        </ul>
        <div class="panel-actions"><button class="btn" data-action="menu">Back</button></div>
      </div>
    `
  }

  showCosmetics(): void {
    this.screen = 'cosmetics'
    this.hud = null
    this.overlay = null
    this.root.innerHTML = `
      <div class="screen panel-screen">
        ${this.header('Cosmetics', `${this.save.credits} credits`)}
        ${this.cosmeticSection('Paddle', 'paddle', PADDLES, this.save.paddle)}
        ${this.cosmeticSection('Ball', 'ball', BALLS, this.save.ball)}
        ${this.cosmeticSection('Trail', 'trail', TRAILS, this.save.trail)}
        <p class="fineprint">Cosmetics never change hitboxes, speed or scoring.</p>
        <div class="panel-actions"><button class="btn" data-action="menu">Back</button></div>
      </div>
    `
  }

  showChallenges(): void {
    this.screen = 'challenges'
    this.hud = null
    this.overlay = null
    this.root.innerHTML = `
      <div class="screen panel-screen">
        ${this.header('Challenge mode', 'Modes')}
        <div class="challenge-list">
          ${CHALLENGES.map(
            (challenge) => `
            <button class="challenge-card" data-action="challenge:${challenge.id}">
              <b>${escapeHtml(challenge.name)}</b>
              <small>${escapeHtml(challenge.blurb)}</small>
            </button>`,
          ).join('')}
        </div>
        <div class="panel-actions"><button class="btn" data-action="menu">Back</button></div>
      </div>
    `
  }

  showHelp(): void {
    this.screen = 'help'
    this.hud = null
    this.overlay = null
    this.root.innerHTML = `
      <div class="screen panel-screen">
        ${this.header('How to play', 'Guide')}
        <div class="help-grid">
          <section class="card">
            <h3>Move</h3>
            <p>Drag anywhere in the lower half of the screen. The paddle follows your finger; you never have to touch the paddle itself. Arrow keys or A/D work on desktop.</p>
          </section>
          <section class="card">
            <h3>Aim</h3>
            <p>Where the ball lands on the paddle decides the angle. Centre sends it almost straight up; the edges send it wide. Moving as you hit adds a little spin.</p>
          </section>
          <section class="card">
            <h3>Launch and fire</h3>
            <p>Tap LAUNCH (or Space) to start. With a laser paddle, FIRE (or Space) shoots the bricks. Sticky paddle catches the ball so you can place your shot.</p>
          </section>
          <section class="card">
            <h3>Read the bricks</h3>
            <p>Every special brick carries a glyph, not just a colour: shields, locks, portals, gravity wells and switches all say what they are. Unbreakable bulkheads shape the level; they are never required.</p>
          </section>
          <section class="card">
            <h3>Power-ups</h3>
            <p>40 capsules, some bad. Red-ringed chips in the HUD are the negative ones. Paddle sizes resolve by precedence (tiny wins), so a bad catch always stings.</p>
          </section>
          <section class="card">
            <h3>Bosses</h3>
            <p>Break the shield plating, then hit the glowing core. A boss telegraphs every attack for almost a second — that pause is your warning.</p>
          </section>
        </div>
        <div class="panel-actions"><button class="btn" data-action="menu">Back</button></div>
      </div>
    `
  }

  toast(message: string): void {
    let element = this.root.querySelector<HTMLElement>('.toast')
    if (!element) {
      element = document.createElement('div')
      element.className = 'toast'
      element.setAttribute('role', 'status')
      this.root.appendChild(element)
    }
    element.textContent = message
    element.classList.add('show')
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => element?.classList.remove('show'), 2600)
  }

  // ------------------------------------------------------------------- markup

  private header(title: string, eyebrow: string): string {
    return `
      <div class="panel-head">
        <button class="icon-btn" data-action="menu" aria-label="Back to menu">←</button>
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <span class="pill">${STAR} ${totalStars(this.save)}</span>
      </div>
    `
  }

  private toggleRow(key: string, label: string, value: boolean): string {
    return `
      <label class="setting-row">
        <span><b>${escapeHtml(label)}</b></span>
        <input type="checkbox" data-setting="${key}" ${value ? 'checked' : ''} />
      </label>
    `
  }

  private cosmeticSection(
    title: string,
    kind: 'paddle' | 'ball' | 'trail',
    items: Cosmetic[],
    equipped: string,
  ): string {
    return `
      <section class="cosmetic-section">
        <h3>${title}</h3>
        <div class="cosmetic-grid">
          ${items
            .map((item) => {
              const owned = this.save.unlocked.includes(item.id)
              const wearing = equipped === item.id
              return `
                <button class="cosmetic-card ${wearing ? 'wearing' : ''} ${owned ? '' : 'locked'}"
                  data-action="${owned ? `wear:${kind}:${item.id}` : `buy:${kind}:${item.id}`}"
                  style="--swatch:${item.color};--swatch2:${item.accent ?? item.color}">
                  <span class="swatch"></span>
                  <b>${escapeHtml(item.name)}</b>
                  <small>${wearing ? 'Wearing' : owned ? 'Owned' : `${item.cost} credits`}</small>
                </button>
              `
            })
            .join('')}
        </div>
      </section>
    `
  }

  // ------------------------------------------------------------------ handlers

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!target) return
    const action = target.dataset.action ?? ''
    const [kind, ...rest] = action.split(':')

    if (kind === 'continue') this.handlers.continueCampaign()
    else if (kind === 'worlds') this.handlers.openWorlds()
    else if (kind === 'levels') this.handlers.openLevels(Number(rest[0] ?? 1))
    else if (kind === 'level') this.handlers.startLevel(Number(rest[0] ?? 1))
    else if (kind === 'mode') this.handlers.startMode((rest[0] ?? 'campaign') as ModeId)
    else if (kind === 'challenge') this.handlers.startChallenge(rest[0] ?? 'oneball')
    else if (kind === 'pause') this.handlers.pause()
    else if (kind === 'resume') this.handlers.resume()
    else if (kind === 'restart') this.handlers.restart()
    else if (kind === 'retry') this.handlers.retry()
    else if (kind === 'next') this.handlers.nextLevel()
    else if (kind === 'quit') this.handlers.quit()
    else if (kind === 'menu') this.handlers.goMenu()
    else if (kind === 'launch') this.handlers.launch()
    else if (kind === 'fire') this.handlers.fire()
    else if (kind === 'settings') this.showSettings()
    else if (kind === 'achievements') this.showAchievements()
    else if (kind === 'cosmetics') this.showCosmetics()
    else if (kind === 'help') this.showHelp()
    else if (kind === 'challenges') this.showChallenges()
    else if (kind === 'share') this.handlers.share()
    else if (kind === 'tip') openTipJar()
    else if (kind === 'erase') {
      if (window.confirm('Erase all Brick Blitz progress on this device? This cannot be undone.')) {
        this.handlers.eraseProgress()
      }
    } else if (kind === 'wear') {
      this.handlers.wear(rest[0] as 'paddle' | 'ball' | 'trail', rest[1] ?? '')
    } else if (kind === 'buy') {
      this.handlers.buy(rest[0] as 'paddle' | 'ball' | 'trail', rest[1] ?? '')
    }
  }

  private onChange(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement
    const key = target.dataset.setting
    if (!key) return
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      this.handlers.setting(key, target.checked)
    } else {
      this.handlers.setting(key, target.value)
    }
  }
}
