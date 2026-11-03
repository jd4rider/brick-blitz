import { Rng, hashString } from '../core/rng'
import type {
  BrickType,
  LevelBrick,
  LevelDefinition,
  Objective,
  PowerUpId,
  ValidationRecord,
} from '../core/types'
import { BRICKS } from '../sim/bricks'
import { POWER_UPS_BY_ID } from '../sim/powerups'
import { LEVEL_NAMES, WORLDS, bossFormation, worldById, type FormationId, type WorldSpec } from './worlds'
import { validateLevel } from './validate'

const COLS = 10

const CHAR_MAP: Record<string, BrickType> = {
  S: 'standard',
  R: 'reinforced',
  U: 'steel',
  X: 'unbreakable',
  E: 'explosive',
  C: 'chain',
  G: 'regen',
  M: 'moving',
  L: 'sliding',
  T: 'rotating',
  D: 'shielded',
  K: 'colorlock',
  W: 'switch',
  P: 'portal',
  I: 'mirror',
  F: 'frozen',
  Z: 'electric',
  O: 'poison',
  B: 'treasure',
  Y: 'mystery',
  V: 'gravity',
  N: 'magnetic',
  A: 'core',
  H: 'bossshield',
}

interface Curated {
  name: string
  tutorial: string
  art: string[]
  objective?: Objective
}

/**
 * The first twenty levels are authored by hand, one idea at a time. Rows are
 * written top-down; the builder flips them into arena coordinates.
 */
const CURATED: Curated[] = [
  {
    name: 'First Light',
    tutorial: 'Drag anywhere on the lower screen to slide the paddle. Tap to launch.',
    art: ['..........', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'Two Windows',
    tutorial: 'Aim with the edge of the paddle: the further from centre, the sharper the angle.',
    art: ['..SS..SS..', '..SS..SS..', '..SSSSSS..'],
  },
  {
    name: 'Thicker Skin',
    tutorial: 'Blue bricks take two hits. Watch the cracks, then finish them.',
    art: ['..RRRRRR..', '...RRRR...', '...SSSS...'],
  },
  {
    name: 'Bulkhead',
    tutorial: 'Dark bulkheads never break. They are walls to shoot around, not targets.',
    art: ['..X.SS.X..', '..X.SS.X..', '..X.SS.X..'],
  },
  {
    name: 'Blast Cap',
    tutorial: 'Orange blast caps take their neighbours with them. Start a chain.',
    art: ['...SEES...', '..SSEESS..', '...SSSS...'],
  },
  {
    name: 'Treasure Run',
    tutorial: 'Gold bricks drop a handful of capsules. Catch them with the paddle.',
    art: ['..B.SS.B..', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'Combo Practice',
    tutorial: 'Every brick inside three seconds keeps the combo alive. Points climb fast.',
    art: ['.S.S.S.S.S', 'S.S.S.S.S.', '.S.S.S.S.S'],
  },
  {
    name: 'Sliding Doors',
    tutorial: 'Pale sliders shove sideways when you hit them. Nudge a gap open.',
    art: ['..LL..LL..', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'Spinners',
    tutorial: 'Spinners rotate in place. Their face turns, the hit box does not.',
    art: ['..TT..TT..', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'Regrowth',
    tutorial: 'Green bricks rebuild themselves. Clear the rest before they return.',
    art: ['..G.G.G...', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'Shields Up',
    tutorial: 'Shielded bricks shrug off the ball. Fire or a blast gets through.',
    art: ['..D.SS.D..', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'Fire Drill',
    tutorial: 'Frozen bricks shatter instantly to a fire ball. Look for the flame capsule.',
    art: ['..FF..FF..', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'Live Wire',
    tutorial: 'Capacitors arc into their neighbours when they pop. Spread the damage.',
    art: ['.Z.SS.SS.Z', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'Colour Lock',
    tutorial: 'Colour locks ignore ordinary hits. An electric ball or a bomb opens them.',
    art: ['..K.KK.K..', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'Switchboard',
    tutorial: 'Switches open every bulkhead on the level. Find them before the walls stop you.',
    art: ['..X.WW.X..', '..X....X..', '...SSSS...'],
  },
  {
    name: 'Portals',
    tutorial: 'Portals fling the ball to their twin. A shortcut, if you can aim it.',
    art: ['..P....P..', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'Mirrors',
    tutorial: 'Mirrors scatter laser bolts. Lasers are for open lanes, not this row.',
    art: ['..I.SS.I..', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'Gravity Well',
    tutorial: 'Gravity bricks bend the ball toward themselves. Plan the curve.',
    art: ['..V.VV.V..', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'Magnet Field',
    tutorial: 'Magnets deflect the ball as it passes. Use the rebound, do not fight it.',
    art: ['..N.NN.N..', '...SSSS...', '...SSSS...'],
  },
  {
    name: 'The Gate',
    tutorial: 'Everything you have learned, in one wall. Good luck.',
    art: ['..SSSSSS..', '.SRREERRS.', '..U.UU.U..', '...SSSS...'],
  },
]

function levelName(index: number): string {
  const base = LEVEL_NAMES[(index - 1) % LEVEL_NAMES.length] ?? 'Untitled'
  return `${base} ${String(index).padStart(3, '0')}`
}

export function buildFromArt(art: string[], offset = 2): LevelBrick[] {
  const bricks: LevelBrick[] = []
  const rows = art.length
  for (let index = 0; index < rows; index += 1) {
    const line = art[index] ?? ''
    const row = rows - 1 - index + offset
    for (let col = 0; col < line.length; col += 1) {
      const type = CHAR_MAP[line[col] ?? '.']
      if (type) bricks.push({ type, col, row, phase: (col * 0.37 + index * 0.11) % 6.28 })
    }
  }
  return bricks
}

function emptyGrid(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => false))
}

function fill(grid: boolean[][], row: number, col: number): void {
  if (row < 0 || row >= grid.length) return
  const line = grid[row]
  if (!line || col < 0 || col >= line.length) return
  line[col] = true
}

function buildShape(formation: FormationId, rng: Rng, cols: number, rows: number, local: number): boolean[][] {
  const grid = emptyGrid(rows, cols)
  const midCol = (cols - 1) / 2

  if (formation === 'rows') {
    const filled = Math.min(rows, 2 + Math.floor(local / 6))
    for (let row = 0; row < filled; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (row > 1 && local > 12 && col % 5 === (row % 2) * 2) continue
        fill(grid, row, col)
      }
    }
    return grid
  }

  if (formation === 'pyramid' || formation === 'arch') {
    for (let row = 0; row < rows; row += 1) {
      const width = formation === 'pyramid' ? 2 + row : Math.min(cols, 3 + Math.floor(row * 1.4))
      const left = Math.round(midCol - width / 2)
      for (let col = left; col <= left + width; col += 1) fill(grid, row, col)
    }
    return grid
  }

  if (formation === 'diamond') {
    const midRow = (rows - 1) / 2
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const distance =
          Math.abs(col - midCol) / Math.max(1, midCol) + Math.abs(row - midRow) / Math.max(1, midRow)
        if (distance <= 0.92) fill(grid, row, col)
      }
    }
    return grid
  }

  if (formation === 'checker') {
    for (let row = 0; row < rows - 1; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if ((row + col) % 2 === 0) fill(grid, row, col)
      }
    }
    return grid
  }

  if (formation === 'rings') {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const edge = col === 0 || col === cols - 1 || row === 0 || row === rows - 1
        const inner = (col === 2 || col === cols - 3) && (row === 2 || row === rows - 3)
        if (edge || inner) fill(grid, row, col)
      }
    }
    return grid
  }

  if (formation === 'maze') {
    for (let row = 0; row < rows; row += 1) {
      const gap = rng.int(cols)
      for (let col = 0; col < cols; col += 1) {
        if (row % 2 === 0) {
          if (col !== gap) fill(grid, row, col)
        } else if (col % 4 === row % 4) {
          fill(grid, row, col)
        }
      }
    }
    return grid
  }

  if (formation === 'columns') {
    for (let row = 0; row < rows - 1; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (col % 2 === row % 2) fill(grid, row, col)
      }
    }
    for (let col = 0; col < cols; col += 1) fill(grid, 0, col)
    return grid
  }

  if (formation === 'wave') {
    for (let col = 0; col < cols; col += 1) {
      const base = Math.max(0, Math.round((rows - 4) / 2 + Math.sin(col * 0.75 + local) * 1.8))
      for (let row = base; row < Math.min(rows, base + 3); row += 1) fill(grid, row, col)
    }
    return grid
  }

  if (formation === 'scatter') {
    const half = Math.ceil(cols / 2)
    for (let col = 0; col < half; col += 1) {
      for (let row = 1; row < rows - 1; row += 1) {
        if (rng.chance(0.42)) {
          fill(grid, row, col)
          fill(grid, row, cols - 1 - col)
        }
      }
    }
    return grid
  }

  // fortress
  for (let row = 0; row < rows - 2; row += 1) {
    for (let col = 1; col < cols - 1; col += 1) {
      if (row % 3 === 1 && col > 2 && col < cols - 3) continue
      fill(grid, row, col)
    }
  }
  for (let row = 0; row < rows - 4; row += 1) {
    fill(grid, row, 0)
    fill(grid, row, cols - 1)
  }
  return grid
}

function pickType(rng: Rng, world: WorldSpec, local: number): BrickType {
  const pool = world.pool
  const specials = pool.filter(
    (type) => !['standard', 'reinforced', 'steel', 'unbreakable'].includes(type),
  )
  const roll = rng.next()
  const specialChance = 0.08 + (local / 50) * 0.3
  if (specials.length > 0 && roll < specialChance) return rng.pick(specials)
  if (roll < specialChance + 0.3) return 'reinforced'
  if (roll < specialChance + 0.4 && pool.includes('steel')) return 'steel'
  if (roll < specialChance + 0.44 && pool.includes('unbreakable') && local > 14) return 'unbreakable'
  return 'standard'
}

function objectiveFor(local: number): Objective {
  if (local === 50) return { kind: 'boss', target: 1 }
  if (local % 17 === 0) return { kind: 'survive', target: 22 + local / 2 }
  if (local % 11 === 0) return { kind: 'targets', target: 0 }
  if (local % 9 === 0) return { kind: 'switches', target: 3 }
  return { kind: 'clear', target: 0 }
}

function applySpecialTypes(
  bricks: LevelBrick[],
  rng: Rng,
  world: WorldSpec,
  local: number,
  formation: FormationId,
): void {
  for (const brick of bricks) {
    brick.type = pickType(rng, world, local)
  }
  if (formation === 'maze' || formation === 'fortress' || formation === 'rings') {
    for (const brick of bricks) {
      if (brick.type === 'standard' && rng.chance(0.14)) brick.type = 'unbreakable'
    }
  }
  void world
}

function ensureSwitches(bricks: LevelBrick[], rng: Rng, count: number): void {
  const candidates = bricks.filter((brick) => brick.type === 'standard' || brick.type === 'reinforced')
  const shuffled = rng.shuffle(candidates)
  for (let index = 0; index < count && index < shuffled.length; index += 1) {
    shuffled[index]!.type = 'switch'
  }
  if (shuffled.length < count) {
    // Guarantee the mechanic exists even on a very small formation.
    for (let index = 0; index < count; index += 1) {
      bricks.push({ type: 'switch', col: index % COLS, row: 1 + Math.floor(index / COLS), phase: index })
    }
  }
}

function build(index: number, attempt: number): LevelDefinition {
  const clamped = Math.max(1, Math.min(500, Math.round(index)))
  const world = worldById(Math.floor((clamped - 1) / 50) + 1)
  const local = ((clamped - 1) % 50) + 1
  const seed = `bb-v1-${clamped}-w${world.id}-a${attempt}`
  const rng = new Rng(seed)
  const boss = local === 50 ? world.boss : null
  const objective = objectiveFor(local)
  const modifiers: string[] = []
  if (local % 23 === 0) modifiers.push('nopowerups')
  if (local % 31 === 0) modifiers.push('oneball')
  if (local % 19 === 0) modifiers.push('speed')

  let bricks: LevelBrick[] = []
  let rows = 8 + Math.floor(local / 14)
  let tutorial: string | null = null
  let name = levelName(clamped)

  if (clamped <= CURATED.length) {
    const curated = CURATED[clamped - 1]!
    bricks = buildFromArt(curated.art)
    rows = curated.art.length + 3
    tutorial = curated.tutorial
    name = curated.name
  } else if (boss) {
    rows = 10
    bricks = bossFormation(boss, COLS, rows, 'core')
    for (let col = 0; col < COLS; col += 1) {
      if (col % 3 === 0) continue
      bricks.push({ type: col % 2 === 0 ? 'reinforced' : 'standard', col, row: 2, phase: col })
      if (local > 25 && col % 4 === 1) bricks.push({ type: 'steel', col, row: 3, phase: col })
    }
  } else {
    const formation = world.formations[rng.int(world.formations.length)] ?? 'rows'
    const grid = buildShape(formation, rng, COLS, rows, local)
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (grid[row]?.[col]) bricks.push({ type: 'standard', col, row, phase: rng.next() * 6.28 })
      }
    }
    applySpecialTypes(bricks, rng, world, local, formation)
  }

  if (objective.kind === 'switches') ensureSwitches(bricks, rng, 3 + (local > 25 ? 1 : 0))

  let breakable = bricks.filter((brick) => !BRICKS[brick.type].solid).length
  if (breakable === 0) {
    bricks.push({ type: 'standard', col: 4, row: 4 })
    bricks.push({ type: 'standard', col: 5, row: 4 })
    breakable = 2
  }
  if (breakable > 104) {
    // Trim the oldest filler first, never the boss parts or switches.
    bricks = bricks.filter(
      (brick, position) =>
        position < 104 || brick.type === 'core' || brick.type === 'bossshield' || brick.type === 'switch',
    )
    breakable = bricks.filter((brick) => !BRICKS[brick.type].solid).length
  }

  const finalObjective: Objective =
    objective.kind === 'targets'
      ? { kind: 'targets', target: Math.max(8, Math.round(breakable * 0.7)) }
      : objective

  const dropRate = modifiers.includes('nopowerups')
    ? 0
    : Math.min(0.34, 0.16 + world.id * 0.012 + (local > 30 ? 0.02 : 0))

  const powerUps: PowerUpId[] = []
  if (!modifiers.includes('nopowerups')) {
    for (const power of world.powerUps) {
      if (POWER_UPS_BY_ID.has(power)) powerUps.push(power)
    }
  }

  return {
    id: `bb-${String(clamped).padStart(3, '0')}`,
    index: clamped,
    world: world.id,
    local,
    seed,
    name,
    cols: COLS,
    rows,
    bricks,
    objective: finalObjective,
    powerUps,
    dropRate,
    boss,
    difficulty: Math.round((1 + ((clamped - 1) / 499) * 9) * 10) / 10,
    hazards: world.id >= 2 ? Math.floor(local / 14) : 0,
    tutorial,
    modifiers,
  }
}

/**
 * Generate one level and refuse to return something the validator rejects. A
 * repaired fallback is used rather than shipping an invalid definition.
 */
export function generateLevel(index: number): LevelDefinition {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const level = build(index, attempt)
    if (validateLevel(level).status === 'VERIFIED') return level
  }
  return safeLevel(index)
}

function safeLevel(index: number): LevelDefinition {
  const clamped = Math.max(1, Math.min(500, Math.round(index)))
  const world = worldById(Math.floor((clamped - 1) / 50) + 1)
  const local = ((clamped - 1) % 50) + 1
  const boss = local === 50 ? world.boss : null
  const bricks: LevelBrick[] = boss
    ? bossFormation(boss, COLS, 10, 'core')
    : Array.from({ length: 3 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => ({
          type: 'standard' as BrickType,
          col: col + 1,
          row: row + 2,
        })),
      ).flat()
  return {
    id: `bb-${String(clamped).padStart(3, '0')}`,
    index: clamped,
    world: world.id,
    local,
    seed: `bb-safe-${clamped}`,
    name: levelName(clamped),
    cols: COLS,
    rows: 11,
    bricks,
    objective: boss ? { kind: 'boss', target: 1 } : { kind: 'clear', target: 0 },
    powerUps: world.powerUps.filter((power) => POWER_UPS_BY_ID.has(power)),
    dropRate: 0.2,
    boss,
    difficulty: 5,
    hazards: 0,
    tutorial: null,
    modifiers: [],
  }
}

export function generateCampaign(): LevelDefinition[] {
  return Array.from({ length: 500 }, (_, index) => generateLevel(index + 1))
}

/** One shared level per UTC day. */
export function levelForDate(date: Date): LevelDefinition {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000)
  const index = (hashString(`bb-daily-${day}`) % 500) + 1
  const level = generateLevel(index)
  return {
    ...level,
    id: `daily-${day}`,
    seed: `bb-daily-${day}`,
    name: 'Daily Blitz',
    tutorial: null,
  }
}

export function endlessLevel(wave: number, seed: string): LevelDefinition {
  const base = generateLevel(((hashString(`${seed}:${wave}`) % 500) + 1))
  return {
    ...base,
    id: `endless-${wave}`,
    seed: `endless-${seed}-${wave}`,
    name: `Wave ${wave}`,
    boss: wave % 10 === 0 ? base.boss ?? worldById(base.world).boss : base.boss,
    difficulty: Math.min(10, 2 + wave * 0.3),
    tutorial: null,
  }
}

export function bossRushLevel(stage: number): LevelDefinition {
  const world = Math.min(10, Math.max(1, stage))
  const level = generateLevel((world - 1) * 50 + 50)
  return { ...level, id: `bossrush-${stage}`, name: worldById(world).name }
}

export function validateCampaignLevels(levels: LevelDefinition[]): ValidationRecord[] {
  return levels.map((level) => validateLevel(level))
}

export { WORLDS }
