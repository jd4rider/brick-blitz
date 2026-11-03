/** Shared shapes. Nothing here imports Three.js: the simulation is pure data. */

export type BrickType =
  | 'standard'
  | 'reinforced'
  | 'steel'
  | 'unbreakable'
  | 'explosive'
  | 'chain'
  | 'regen'
  | 'moving'
  | 'sliding'
  | 'rotating'
  | 'shielded'
  | 'colorlock'
  | 'switch'
  | 'portal'
  | 'mirror'
  | 'splitter'
  | 'frozen'
  | 'electric'
  | 'poison'
  | 'treasure'
  | 'mystery'
  | 'gravity'
  | 'magnetic'
  | 'core'
  | 'bossshield'

export type Element = 'none' | 'fire' | 'ice' | 'electric' | 'heavy' | 'ghost' | 'plasma'

export type PowerUpId =
  | 'wide'
  | 'mega'
  | 'tiny'
  | 'multiball'
  | 'supermultiball'
  | 'laser'
  | 'rapidlaser'
  | 'fireball'
  | 'iceball'
  | 'electricball'
  | 'heavyball'
  | 'ghostball'
  | 'sticky'
  | 'magnetic'
  | 'safetynet'
  | 'doublesafetynet'
  | 'slowmo'
  | 'speedboost'
  | 'extralife'
  | 'shieldpaddle'
  | 'bomb'
  | 'megabomb'
  | 'missile'
  | 'drone'
  | 'doubledrone'
  | 'clone'
  | 'scoremult'
  | 'coinmagnet'
  | 'timefreeze'
  | 'repair'
  | 'piercing'
  | 'chainreaction'
  | 'gravityshift'
  | 'portalball'
  | 'rainbow'
  | 'reverse'
  | 'paddlejam'
  | 'blackout'
  | 'brickregen'
  | 'jackpot'

export type BossId =
  | 'titan'
  | 'serpent'
  | 'colossus'
  | 'inferno'
  | 'frost'
  | 'volt'
  | 'gravity'
  | 'phantom'
  | 'citadel'
  | 'blitzking'

export type ObjectiveKind = 'clear' | 'targets' | 'survive' | 'boss' | 'switches'

export interface Objective {
  kind: ObjectiveKind
  /** Bricks required for `targets`, seconds for `survive`. */
  target: number
}

export interface LevelBrick {
  type: BrickType
  /** Column and row on the level grid, both zero-based. */
  col: number
  row: number
  /** Optional phase offset so moving bricks in one row do not move in lockstep. */
  phase?: number
}

export interface LevelDefinition {
  id: string
  index: number
  world: number
  local: number
  seed: string
  name: string
  cols: number
  rows: number
  bricks: LevelBrick[]
  objective: Objective
  /** Power-ups this level may drop. Empty means the world default pool. */
  powerUps: PowerUpId[]
  dropRate: number
  boss: BossId | null
  difficulty: number
  hazards: number
  tutorial: string | null
  modifiers: string[]
}

export type ValidationStatus = 'VERIFIED' | 'REJECTED' | 'UNKNOWN'

export interface ValidationRecord {
  status: ValidationStatus
  breakable: number
  required: number
  issues: string[]
  maxBricks: number
}

export interface PersistedGame {
  version: 2
  stars: Record<string, number>
  scores: Record<string, number>
  credits: number
  unlocked: string[]
  paddle: string
  ball: string
  trail: string
  achievements: string[]
  daily: { date: string; score: number; done: boolean }
  endlessBest: number
  survivalBest: number
  bossRushBest: number
  settings: {
    sound: boolean
    music: boolean
    motion: boolean
    quality: 'low' | 'medium' | 'high'
    highContrast: boolean
    invert: boolean
  }
  lastLevel: number
}
