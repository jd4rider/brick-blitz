import type { BrickType, PowerUpId, BossId, LevelBrick } from '../core/types'

export type FormationId =
  | 'rows'
  | 'pyramid'
  | 'diamond'
  | 'checker'
  | 'rings'
  | 'maze'
  | 'columns'
  | 'arch'
  | 'wave'
  | 'scatter'
  | 'fortress'

export interface WorldSpec {
  id: number
  name: string
  subtitle: string
  boss: BossId
  /** Scene colours: background, horizon glow, key accent. */
  palette: { sky: string; glow: string; accent: string; paddle: string; floor: string }
  pool: BrickType[]
  powerUps: PowerUpId[]
  formations: FormationId[]
  /** Ball speed multiplier for the world. */
  speed: number
}

const SHARED: PowerUpId[] = [
  'wide',
  'multiball',
  'laser',
  'safetynet',
  'slowmo',
  'bomb',
  'scoremult',
  'jackpot',
]

export const WORLDS: WorldSpec[] = [
  {
    id: 1,
    name: 'Arcade Awakening',
    subtitle: 'Where the lights come on',
    boss: 'titan',
    palette: { sky: '#0b1230', glow: '#2a4bd8', accent: '#4de1ff', paddle: '#8ecbff', floor: '#101a3d' },
    pool: ['standard', 'reinforced', 'unbreakable', 'explosive', 'treasure'],
    powerUps: [...SHARED, 'mega', 'sticky', 'magnetic'],
    formations: ['rows', 'pyramid', 'checker', 'columns'],
    speed: 1,
  },
  {
    id: 2,
    name: 'Neon Nights',
    subtitle: 'Moving targets, moving lights',
    boss: 'serpent',
    palette: { sky: '#1a0b2e', glow: '#c026d3', accent: '#f472b6', paddle: '#f0abfc', floor: '#22103b' },
    pool: ['standard', 'reinforced', 'moving', 'sliding', 'unbreakable', 'mystery', 'treasure'],
    powerUps: [...SHARED, 'rapidlaser', 'fireball', 'iceball', 'electricball'],
    formations: ['wave', 'columns', 'maze', 'checker'],
    speed: 1.04,
  },
  {
    id: 3,
    name: 'Crystal Caverns',
    subtitle: 'Precision, reflected',
    boss: 'colossus',
    palette: { sky: '#071b2a', glow: '#0e7490', accent: '#67e8f9', paddle: '#a5f3fc', floor: '#0b2434' },
    pool: ['standard', 'reinforced', 'steel', 'shielded', 'mirror', 'frozen', 'unbreakable', 'regen'],
    powerUps: [...SHARED, 'piercing', 'iceball', 'heavyball', 'repair'],
    formations: ['diamond', 'rings', 'pyramid', 'maze'],
    speed: 1.08,
  },
  {
    id: 4,
    name: 'Inferno Factory',
    subtitle: 'Heat, chain reactions, noise',
    boss: 'inferno',
    palette: { sky: '#2a0d08', glow: '#b91c1c', accent: '#fb923c', paddle: '#fdba74', floor: '#35120c' },
    pool: ['standard', 'reinforced', 'explosive', 'chain', 'steel', 'core', 'unbreakable'],
    powerUps: [...SHARED, 'fireball', 'megabomb', 'chainreaction', 'missile'],
    formations: ['pyramid', 'rows', 'scatter', 'columns'],
    speed: 1.1,
  },
  {
    id: 5,
    name: 'Frozen Frontier',
    subtitle: 'Slippery bricks, patient shots',
    boss: 'frost',
    palette: { sky: '#0a1b2e', glow: '#0284c7', accent: '#bae6fd', paddle: '#e0f2fe', floor: '#0f2638' },
    pool: ['standard', 'reinforced', 'frozen', 'sliding', 'moving', 'steel', 'unbreakable'],
    powerUps: [...SHARED, 'iceball', 'heavyball', 'ghostball', 'doublesafetynet'],
    formations: ['rings', 'wave', 'diamond', 'maze'],
    speed: 1.12,
  },
  {
    id: 6,
    name: 'Electric Avenue',
    subtitle: 'Switches, arcs, timing',
    boss: 'volt',
    palette: { sky: '#241a05', glow: '#ca8a04', accent: '#fde047', paddle: '#fef08a', floor: '#2c2108' },
    pool: ['standard', 'reinforced', 'switch', 'electric', 'moving', 'colorlock', 'unbreakable', 'core'],
    powerUps: [...SHARED, 'electricball', 'chainreaction', 'rapidlaser', 'doubledrone'],
    formations: ['maze', 'checker', 'columns', 'scatter'],
    speed: 1.15,
  },
  {
    id: 7,
    name: 'Gravity Galaxy',
    subtitle: 'Everything pulls a little',
    boss: 'gravity',
    palette: { sky: '#0d0a2b', glow: '#4338ca', accent: '#a5b4fc', paddle: '#c7d2fe', floor: '#151238' },
    pool: ['standard', 'reinforced', 'gravity', 'magnetic', 'steel', 'moving', 'unbreakable'],
    powerUps: [...SHARED, 'ghostball', 'portalball', 'gravityshift', 'heavyball'],
    formations: ['rings', 'diamond', 'wave', 'scatter'],
    speed: 1.17,
  },
  {
    id: 8,
    name: 'Phantom Dimension',
    subtitle: 'Portals and things that vanish',
    boss: 'phantom',
    palette: { sky: '#160a2a', glow: '#7e22ce', accent: '#d8b4fe', paddle: '#e9d5ff', floor: '#1e0f36' },
    pool: ['standard', 'reinforced', 'portal', 'mystery', 'sliding', 'regen', 'unbreakable', 'treasure'],
    powerUps: [...SHARED, 'portalball', 'rainbow', 'clone', 'ghostball'],
    formations: ['scatter', 'maze', 'rings', 'wave'],
    speed: 1.2,
  },
  {
    id: 9,
    name: 'Iron Dominion',
    subtitle: 'Armour with a weak centre',
    boss: 'citadel',
    palette: { sky: '#101720', glow: '#475569', accent: '#cbd5e1', paddle: '#e2e8f0', floor: '#17202c' },
    pool: ['standard', 'reinforced', 'steel', 'core', 'shielded', 'bossshield', 'unbreakable', 'switch'],
    powerUps: [...SHARED, 'piercing', 'megabomb', 'fireball', 'extralife'],
    formations: ['fortress', 'maze', 'columns', 'checker'],
    speed: 1.23,
  },
  {
    id: 10,
    name: 'Ultimate Blitz',
    subtitle: 'Everything, all at once',
    boss: 'blitzking',
    palette: { sky: '#210818', glow: '#be123c', accent: '#fb7185', paddle: '#fecdd3', floor: '#2a0c1f' },
    pool: [
      'standard',
      'reinforced',
      'steel',
      'explosive',
      'chain',
      'moving',
      'shielded',
      'colorlock',
      'switch',
      'portal',
      'splitter',
      'frozen',
      'electric',
      'core',
      'bossshield',
      'unbreakable',
    ],
    powerUps: [...SHARED, 'supermultiball', 'rainbow', 'piercing', 'doubledrone', 'extralife', 'megabomb'],
    formations: ['fortress', 'pyramid', 'rings', 'maze', 'scatter'],
    speed: 1.27,
  },
]

export function worldById(id: number): WorldSpec {
  return WORLDS[Math.min(WORLDS.length, Math.max(1, Math.round(id))) - 1]!
}

/** Names are generated from a pool so 500 levels do not repeat one title. */
export const LEVEL_NAMES = [
  'First Light',
  'Cold Start',
  'Uplink',
  'Ripple',
  'Afterglow',
  'Static Bloom',
  'Night Shift',
  'Overclock',
  'Loose Wire',
  'Glasswork',
  'Hard Reset',
  'Shardfall',
  'Long Way Down',
  'Bright Noise',
  'Slow Burn',
  'Crosswind',
  'Tin Roof',
  'Signal Lost',
  'Paper Wall',
  'Deep Field',
  'Switchboard',
  'Lantern',
  'Undertow',
  'Half Measure',
  'Full Spectrum',
  'Fault Line',
  'Iron Petal',
  'Cascade',
  'Blue Hour',
  'Last Light',
]

export function bossFormation(boss: BossId, cols: number, rows: number, core: BrickType): LevelBrick[] {
  const bricks: LevelBrick[] = []
  const mid = (cols - 1) / 2
  const topRow = rows - 1
  const width = Math.max(4, Math.min(cols - 2, boss === 'blitzking' ? 8 : 7))
  const left = Math.round(mid - width / 2)

  for (let col = 0; col < cols; col += 1) {
    const distance = Math.abs(col - mid)
    if (distance <= width / 2 && distance > width / 2 - 2) {
      bricks.push({ type: 'bossshield', col, row: topRow })
    }
  }
  for (let col = left; col < left + width; col += 1) {
    bricks.push({ type: col % 3 === 0 ? 'unbreakable' : 'bossshield', col, row: topRow - 1 })
  }
  for (let col = left + 1; col < left + width - 1; col += 1) {
    bricks.push({ type: core, col, row: topRow - 2 })
  }
  return bricks
}
