import { ARENA } from '../core/constants'
import type { LevelDefinition, ValidationRecord } from '../core/types'
import { BRICKS } from '../sim/bricks'
import { POWER_UPS_BY_ID } from '../sim/powerups'

const MAX_BRICKS = 110

/**
 * Structural validation only: placement, objective consistency, boss parts and
 * performance budget. It cannot prove that a paddle-and-ball level is winnable —
 * no static check can — so VERIFIED means "legal and complete", not "proven".
 */
export function validateLevel(level: LevelDefinition): ValidationRecord {
  const issues: string[] = []

  if (!/^[a-z0-9-]{3,40}$/.test(level.id)) issues.push(`bad id "${level.id}"`)
  if (level.index < 1) issues.push('index must be positive')
  if (level.world < 1 || level.world > 10) issues.push(`world ${level.world} out of range`)
  if (level.local < 1 || level.local > 50) issues.push(`local ${level.local} out of range`)
  if (level.cols < 3 || level.cols > ARENA.maxCols) issues.push(`cols ${level.cols} out of range`)
  if (level.rows < 3 || level.rows > ARENA.maxRows + 1) issues.push(`rows ${level.rows} out of range`)
  if (level.bricks.length === 0) issues.push('level has no bricks')
  if (level.bricks.length > MAX_BRICKS) issues.push(`${level.bricks.length} bricks exceeds the budget of ${MAX_BRICKS}`)
  if (level.dropRate < 0 || level.dropRate > 1) issues.push(`drop rate ${level.dropRate} out of range`)
  if (level.difficulty < 0 || level.difficulty > 10) issues.push(`difficulty ${level.difficulty} out of range`)

  const cells = new Set<string>()
  let breakable = 0
  let solids = 0
  let cores = 0
  let shields = 0
  let switches = 0

  for (const entry of level.bricks) {
    if (!BRICKS[entry.type]) {
      issues.push(`unknown brick type "${entry.type}"`)
      continue
    }
    if (!Number.isInteger(entry.col) || entry.col < 0 || entry.col >= level.cols) {
      issues.push(`brick column ${entry.col} outside the grid`)
    }
    if (!Number.isInteger(entry.row) || entry.row < 0 || entry.row >= level.rows) {
      issues.push(`brick row ${entry.row} outside the grid`)
    }
    const key = `${entry.col}:${entry.row}`
    if (cells.has(key)) issues.push(`two bricks share cell ${key}`)
    cells.add(key)

    const spec = BRICKS[entry.type]
    if (spec.solid) solids += 1
    else breakable += 1
    if (entry.type === 'core') cores += 1
    if (entry.type === 'bossshield') shields += 1
    if (entry.type === 'switch') switches += 1
  }

  if (breakable === 0) issues.push('no breakable bricks, so the objective cannot complete')
  // Bulkheads are a design tool, not a defect. They only become a problem when
  // they crowd out the bricks the objective actually needs.
  if (solids > Math.floor(level.bricks.length * 0.65)) issues.push('too many solid bricks')

  for (const power of level.powerUps) {
    if (!POWER_UPS_BY_ID.has(power)) issues.push(`unknown power-up "${power}"`)
  }

  const objective = level.objective
  if (objective.kind === 'targets') {
    if (objective.target < 1) issues.push('target objective needs a positive target')
    if (objective.target > breakable) issues.push(`target ${objective.target} exceeds ${breakable} breakable bricks`)
  }
  if (objective.kind === 'survive' && (objective.target < 10 || objective.target > 120)) {
    issues.push(`survive target ${objective.target}s out of range`)
  }
  if (objective.kind === 'switches' && switches < 2) {
    issues.push('switch objective needs at least two switch bricks')
  }
  if (objective.kind === 'boss') {
    if (!level.boss) issues.push('boss objective without a boss')
    if (cores < 2) issues.push('boss needs at least two core bricks')
    if (shields < 2) issues.push('boss needs at least two shield bricks')
  }
  if (level.boss && objective.kind !== 'boss') issues.push('a boss is set but the objective is not boss')
  if (!level.boss && objective.kind === 'boss') issues.push('boss objective without a boss id')

  if (level.index >= 1 && level.index <= 500) {
    const expectedWorld = Math.floor((level.index - 1) / 50) + 1
    if (level.world !== expectedWorld) issues.push(`world ${level.world} does not match index ${level.index}`)
  }

  return {
    status: issues.length === 0 ? 'VERIFIED' : 'REJECTED',
    breakable,
    required: objective.kind === 'boss' ? cores : breakable,
    issues,
    maxBricks: MAX_BRICKS,
  }
}

export interface CampaignReport {
  total: number
  verified: number
  rejected: number
  unknown: number
  issues: { id: string; issues: string[] }[]
  duplicateIds: string[]
  similar: string[]
  maxBricks: number
  largest: { id: string; bricks: number } | null
  worlds: Record<number, number>
  bosses: number
}

/**
 * Validates the whole campaign and looks for accidental duplicates. A level is
 * only counted as verified when its own record passes; nothing is inferred.
 */
export function validateCampaign(levels: LevelDefinition[]): CampaignReport {
  const issues: { id: string; issues: string[] }[] = []
  const ids = new Set<string>()
  const duplicateIds: string[] = []
  const signatures = new Map<string, string[]>()
  const worlds: Record<number, number> = {}
  let verified = 0
  let rejected = 0
  let maxBricks = 0
  let largest: { id: string; bricks: number } | null = null
  let bosses = 0

  for (const level of levels) {
    if (ids.has(level.id)) duplicateIds.push(level.id)
    ids.add(level.id)
    worlds[level.world] = (worlds[level.world] ?? 0) + 1
    if (level.boss) bosses += 1

    const record = validateLevel(level)
    if (record.status === 'VERIFIED') verified += 1
    else {
      rejected += 1
      issues.push({ id: level.id, issues: record.issues })
    }

    if (level.bricks.length > maxBricks) {
      maxBricks = level.bricks.length
      largest = { id: level.id, bricks: level.bricks.length }
    }

    const signature = `${level.cols}x${level.rows}:${level.bricks
      .map((brick) => `${brick.col},${brick.row},${brick.type}`)
      .sort()
      .join('|')}`
    const existing = signatures.get(signature)
    if (existing) existing.push(level.id)
    else signatures.set(signature, [level.id])
  }

  const similar = [...signatures.values()].filter((group) => group.length > 1).map((group) => group.join(', '))

  return {
    total: levels.length,
    verified,
    rejected,
    unknown: levels.length - verified - rejected,
    issues,
    duplicateIds,
    similar,
    maxBricks,
    largest,
    worlds,
    bosses,
  }
}
