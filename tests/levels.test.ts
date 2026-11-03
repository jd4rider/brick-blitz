import { describe, expect, it } from 'vitest'
import { generateCampaign, generateLevel, levelForDate } from '../src/levels/generate'
import { validateCampaign, validateLevel } from '../src/levels/validate'
import type { LevelDefinition } from '../src/core/types'

describe('campaign', () => {
  const levels = generateCampaign()

  it('has 500 levels in ten worlds of fifty', () => {
    expect(levels).toHaveLength(500)
    for (let world = 1; world <= 10; world += 1) {
      expect(levels.filter((level) => level.world === world)).toHaveLength(50)
    }
  })

  it('validates every level', () => {
    const report = validateCampaign(levels)
    expect(report.rejected).toBe(0)
    expect(report.verified).toBe(500)
    expect(report.duplicateIds).toHaveLength(0)
    expect(report.unknown).toBe(0)
  })

  it('gives every world a boss at level 50', () => {
    for (let world = 1; world <= 10; world += 1) {
      const bossLevel = levels[(world - 1) * 50 + 49]!
      expect(bossLevel.boss).not.toBeNull()
      expect(bossLevel.objective.kind).toBe('boss')
      expect(bossLevel.bricks.filter((brick) => brick.type === 'core').length).toBeGreaterThan(1)
    }
  })

  it('starts with handcrafted tutorials that explain one idea each', () => {
    for (const level of levels.slice(0, 20)) {
      expect(level.tutorial).toBeTruthy()
      expect(level.bricks.length).toBeGreaterThan(0)
    }
  })

  it('is reproducible from the level seed', () => {
    const first = generateLevel(137)
    const second = generateLevel(137)
    expect(first.bricks).toEqual(second.bricks)
  })

  it('keeps the largest level inside the brick budget', () => {
    const report = validateCampaign(levels)
    expect(report.maxBricks).toBeLessThanOrEqual(110)
  })

  it('rejects an out-of-grid brick instead of pretending it is fine', () => {
    const bad: LevelDefinition = {
      ...generateLevel(1),
      bricks: [{ type: 'standard', col: 99, row: 0 }],
    }
    const record = validateLevel(bad)
    expect(record.status).toBe('REJECTED')
    expect(record.issues.join(' ')).toContain('outside the grid')
  })

  it('rejects a boss level with no core', () => {
    const level = generateLevel(50)
    const broken: LevelDefinition = {
      ...level,
      bricks: level.bricks.filter((brick) => brick.type !== 'core'),
    }
    expect(validateLevel(broken).status).toBe('REJECTED')
  })

  it('gives everyone the same daily level for a given UTC date', () => {
    const date = new Date(Date.UTC(2026, 10, 2, 15, 30))
    const first = levelForDate(date)
    const second = levelForDate(new Date(Date.UTC(2026, 10, 2, 1, 5)))
    expect(first.id).toBe(second.id)
    expect(first.bricks).toEqual(second.bricks)
    expect(validateLevel(first).status).toBe('VERIFIED')
  })
})
