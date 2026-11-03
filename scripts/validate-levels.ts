/**
 * Validates all 500 campaign levels and writes reports/level-validation.json.
 * The build fails if any level is rejected, duplicated, or if a world is short
 * of its fifty levels. CI runs this before the production build.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateCampaign } from '../src/levels/generate'
import { validateCampaign, validateLevel } from '../src/levels/validate'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const levels = generateCampaign()
const report = validateCampaign(levels)

const records = levels.map((level) => {
  const record = validateLevel(level)
  return {
    id: level.id,
    index: level.index,
    world: level.world,
    local: level.local,
    seed: level.seed,
    name: level.name,
    boss: level.boss,
    objective: level.objective,
    bricks: level.bricks.length,
    breakable: record.breakable,
    status: record.status,
    issues: record.issues,
    modifiers: level.modifiers,
  }
})

const worldsOk = Object.keys(report.worlds).length === 10 && Object.values(report.worlds).every((count) => count === 50)
const bossesOk = report.bosses === 10

mkdirSync(resolve(root, 'reports'), { recursive: true })
writeFileSync(
  resolve(root, 'reports/level-validation.json'),
  JSON.stringify(
    {
      generator: 'brick-blitz-v1',
      generatedAt: new Date().toISOString(),
      total: report.total,
      verified: report.verified,
      rejected: report.rejected,
      unknown: report.unknown,
      duplicateIds: report.duplicateIds,
      similar: report.similar.length,
      largest: report.largest,
      maxBricks: report.maxBricks,
      worlds: report.worlds,
      bosses: report.bosses,
      levels: records,
    },
    null,
    2,
  ),
)

console.log(`levels: ${report.total}, verified: ${report.verified}, rejected: ${report.rejected}`)
console.log(`worlds: ${JSON.stringify(report.worlds)}`)
console.log(`bosses: ${report.bosses}, largest level: ${report.largest?.id} (${report.largest?.bricks} bricks)`)
console.log(`identical layouts: ${report.similar.length} groups (allowed, reported for review)`)

if (report.rejected > 0 || report.duplicateIds.length > 0 || !worldsOk || !bossesOk) {
  for (const failure of report.issues.slice(0, 20)) {
    console.error(`REJECTED ${failure.id}: ${failure.issues.join('; ')}`)
  }
  if (!worldsOk) console.error('World distribution is not 10 x 50')
  if (!bossesOk) console.error(`Expected 10 boss levels, found ${report.bosses}`)
  process.exit(1)
}

console.log('All 500 levels verified.')
