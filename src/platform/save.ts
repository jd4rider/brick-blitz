import type { PersistedGame } from '../core/types'

export const SAVE_KEY = 'brick-blitz-save-v1'

export interface Cosmetic {
  id: string
  name: string
  cost: number
  color: string
  accent?: string
}

export const PADDLES: Cosmetic[] = [
  { id: 'chrome', name: 'Chrome', cost: 0, color: '#cbd5e1', accent: '#f8fafc' },
  { id: 'neon', name: 'Neon', cost: 250, color: '#22d3ee', accent: '#cffafe' },
  { id: 'rainbow', name: 'Rainbow', cost: 600, color: '#f472b6', accent: '#fde68a' },
  { id: 'retro', name: 'Retro Arcade', cost: 400, color: '#fbbf24', accent: '#fef3c7' },
  { id: 'galaxy', name: 'Galaxy', cost: 800, color: '#8b5cf6', accent: '#ede9fe' },
]

export const BALLS: Cosmetic[] = [
  { id: 'plasma', name: 'Plasma', cost: 0, color: '#a5f3fc', accent: '#ffffff' },
  { id: 'solar', name: 'Solar', cost: 300, color: '#fbbf24', accent: '#fff7ed' },
  { id: 'void', name: 'Void', cost: 500, color: '#c084fc', accent: '#f3e8ff' },
  { id: 'emerald', name: 'Emerald', cost: 450, color: '#4ade80', accent: '#dcfce7' },
]

export const TRAILS: Cosmetic[] = [
  { id: 'spark', name: 'Spark', cost: 0, color: '#7dd3fc' },
  { id: 'comet', name: 'Comet', cost: 250, color: '#fda4af' },
  { id: 'crystal', name: 'Crystal', cost: 450, color: '#a5b4fc' },
  { id: 'fireworks', name: 'Fireworks', cost: 700, color: '#fbbf24' },
]

export const ACHIEVEMENTS: { id: string; name: string; blurb: string }[] = [
  { id: 'first-clear', name: 'Lights On', blurb: 'Clear your first level.' },
  { id: 'ten-clears', name: 'Warmed Up', blurb: 'Clear ten levels.' },
  { id: 'fifty-clears', name: 'Regular', blurb: 'Clear fifty levels.' },
  { id: 'ten-triples', name: 'Clean Sweep', blurb: 'Earn three stars ten times.' },
  { id: 'boss-one', name: 'Giant Slayer', blurb: 'Beat any boss.' },
  { id: 'boss-all', name: 'Ten Crowns', blurb: 'Beat all ten bosses.' },
  { id: 'credits-2000', name: 'Deep Pockets', blurb: 'Bank 2,000 credits.' },
  { id: 'daily', name: 'Daily Habit', blurb: 'Finish a daily challenge.' },
  { id: 'endless-ten', name: 'Endless Runner', blurb: 'Reach wave 10 in Endless.' },
  { id: 'survival-five', name: 'Survivor', blurb: 'Reach wave 5 in Survival.' },
  { id: 'bossrush', name: 'Rush Hour', blurb: 'Clear three bosses in one Boss Rush.' },
  { id: 'cosmetic', name: 'Dressed Up', blurb: 'Unlock a cosmetic.' },
]

export function levelId(index: number): string {
  return `bb-${String(index).padStart(3, '0')}`
}

export function createSave(): PersistedGame {
  return {
    version: 2,
    stars: {},
    scores: {},
    credits: 0,
    unlocked: ['chrome', 'plasma', 'spark'],
    paddle: 'chrome',
    ball: 'plasma',
    trail: 'spark',
    achievements: [],
    daily: { date: '', score: 0, done: false },
    endlessBest: 0,
    survivalBest: 0,
    bossRushBest: 0,
    settings: {
      sound: true,
      music: true,
      motion: true,
      quality: 'high',
      highContrast: false,
      invert: false,
    },
    lastLevel: 1,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function numberOf(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function starsRecord(value: unknown): Record<string, number> {
  const raw = asRecord(value)
  const out: Record<string, number> = {}
  for (const [key, entry] of Object.entries(raw)) {
    const stars = Math.round(numberOf(entry))
    if (stars >= 1 && stars <= 3) out[key] = stars
  }
  return out
}

/**
 * Accepts anything. A corrupt or older payload is repaired field by field, so a
 * bad save costs at most the broken part, never the whole campaign.
 */
export function migrateSave(raw: unknown): PersistedGame {
  const base = createSave()
  if (typeof raw !== 'object' || raw === null) return base
  const data = raw as Record<string, unknown>
  const settings = asRecord(data.settings)
  const daily = asRecord(data.daily)
  const quality = settings.quality
  const version = numberOf(data.version, 1)

  const save: PersistedGame = {
    version: 2,
    stars: starsRecord(data.stars ?? data.progress),
    scores: {},
    credits: Math.max(0, Math.round(numberOf(data.credits))),
    unlocked: Array.isArray(data.unlocked)
      ? data.unlocked.filter((entry): entry is string => typeof entry === 'string')
      : [...base.unlocked],
    paddle: typeof data.paddle === 'string' ? data.paddle : base.paddle,
    ball: typeof data.ball === 'string' ? data.ball : base.ball,
    trail: typeof data.trail === 'string' ? data.trail : base.trail,
    achievements: Array.isArray(data.achievements)
      ? data.achievements.filter((entry): entry is string => typeof entry === 'string')
      : [],
    daily: {
      date: typeof daily.date === 'string' ? daily.date : '',
      score: Math.max(0, Math.round(numberOf(daily.score))),
      done: daily.done === true,
    },
    endlessBest: Math.max(0, Math.round(numberOf(data.endlessBest))),
    survivalBest: Math.max(0, Math.round(numberOf(data.survivalBest))),
    bossRushBest: Math.max(0, Math.round(numberOf(data.bossRushBest))),
    settings: {
      sound: settings.sound !== false,
      music: settings.music !== false,
      motion: settings.motion !== false,
      quality: quality === 'low' || quality === 'medium' || quality === 'high' ? quality : base.settings.quality,
      highContrast: settings.highContrast === true,
      invert: settings.invert === true,
    },
    lastLevel: Math.min(500, Math.max(1, Math.round(numberOf(data.lastLevel, 1)))),
  }

  const scores = asRecord(data.scores)
  for (const [key, entry] of Object.entries(scores)) {
    const score = Math.round(numberOf(entry))
    if (score > 0) save.scores[key] = score
  }

  if (!save.unlocked.includes('chrome')) save.unlocked.push('chrome')
  if (!save.unlocked.includes('plasma')) save.unlocked.push('plasma')
  if (!save.unlocked.includes('spark')) save.unlocked.push('spark')
  for (const list of [PADDLES, BALLS, TRAILS]) {
    for (const item of list) if (item.cost === 0 && !save.unlocked.includes(item.id)) save.unlocked.push(item.id)
  }
  if (!PADDLES.some((item) => item.id === save.paddle)) save.paddle = base.paddle
  if (!BALLS.some((item) => item.id === save.ball)) save.ball = base.ball
  if (!TRAILS.some((item) => item.id === save.trail)) save.trail = base.trail

  // v1 stored a bare progress map and no credits; the repair above is enough,
  // this branch exists to make the migration explicit for future readers.
  if (version < 2) save.credits = Math.max(save.credits, 0)

  return save
}

export function loadSave(): PersistedGame {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return createSave()
    return migrateSave(JSON.parse(raw))
  } catch {
    return createSave()
  }
}

export function writeSave(save: PersistedGame): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save))
  } catch {
    // Private mode or a full quota: the session still plays, progress just will
    // not survive the tab. Never throw into the game loop for this.
  }
}

export function totalStars(save: PersistedGame): number {
  return Object.values(save.stars).reduce((sum, stars) => sum + stars, 0)
}

export function clearedCount(save: PersistedGame): number {
  return Object.keys(save.stars).length
}

export function isWorldUnlocked(save: PersistedGame, world: number): boolean {
  if (world <= 1) return true
  const previousBoss = levelId((world - 1) * 50)
  return (save.stars[previousBoss] ?? 0) > 0
}

export function isLevelUnlocked(save: PersistedGame, index: number): boolean {
  if (index <= 1) return true
  if (!isWorldUnlocked(save, Math.floor((index - 1) / 50) + 1)) return false
  const local = ((index - 1) % 50) + 1
  if (local === 1) return true
  return (save.stars[levelId(index - 1)] ?? 0) > 0
}

export function recordResult(
  save: PersistedGame,
  index: number,
  stars: number,
  score: number,
): { credits: number; best: boolean } {
  const id = levelId(index)
  const previous = save.stars[id] ?? 0
  const bestScore = save.scores[id] ?? 0
  const best = score > bestScore
  save.stars[id] = Math.max(previous, stars)
  save.scores[id] = Math.max(bestScore, score)
  save.lastLevel = Math.min(500, Math.max(save.lastLevel, index + 1))
  const credits = 40 + stars * 25 + Math.floor(score / 600)
  save.credits += credits
  return { credits, best }
}

export function evaluateAchievements(save: PersistedGame): string[] {
  const unlocked: string[] = []
  const grant = (id: string, condition: boolean) => {
    if (condition && !save.achievements.includes(id)) {
      save.achievements.push(id)
      unlocked.push(id)
    }
  }
  const stars = Object.values(save.stars)
  const total = stars.reduce((sum, value) => sum + value, 0)
  const bossStars = Array.from({ length: 10 }, (_, world) => save.stars[levelId((world + 1) * 50)] ?? 0)

  grant('first-clear', stars.length >= 1)
  grant('ten-clears', stars.length >= 10)
  grant('fifty-clears', stars.length >= 50)
  grant('ten-triples', stars.filter((value) => value === 3).length >= 10)
  grant('boss-one', bossStars.some((value) => value > 0))
  grant('boss-all', bossStars.every((value) => value > 0))
  grant('credits-2000', save.credits >= 2000)
  grant('daily', save.daily.done)
  grant('endless-ten', save.endlessBest >= 10)
  grant('survival-five', save.survivalBest >= 5)
  grant('bossrush', save.bossRushBest >= 3)
  grant('cosmetic', save.unlocked.length > 3)
  void total
  return unlocked
}
