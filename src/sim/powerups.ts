import type { PowerUpId } from '../core/types'

export interface PowerUpDef {
  id: PowerUpId
  name: string
  glyph: string
  color: string
  /** 1 common, 2 uncommon, 3 rare. Negative pickups stay weight 1. */
  rarity: 1 | 2 | 3
  seconds: number
  negative: boolean
  blurb: string
}

export const POWER_UPS: PowerUpDef[] = [
  { id: 'wide', name: 'Wide Paddle', glyph: '↔', color: '#4ade80', rarity: 1, seconds: 16, negative: false, blurb: 'Paddle grows by a third.' },
  { id: 'mega', name: 'Mega Paddle', glyph: '⇔', color: '#22c55e', rarity: 2, seconds: 14, negative: false, blurb: 'Paddle grows by two thirds.' },
  { id: 'tiny', name: 'Tiny Paddle', glyph: '><', color: '#f87171', rarity: 1, seconds: 10, negative: true, blurb: 'Paddle shrinks. Catch it or dodge it.' },
  { id: 'multiball', name: 'Multiball', glyph: '⁂', color: '#38bdf8', rarity: 2, seconds: 0, negative: false, blurb: 'Each ball splits into three.' },
  { id: 'supermultiball', name: 'Super Multiball', glyph: '✳', color: '#0ea5e9', rarity: 3, seconds: 0, negative: false, blurb: 'A swarm: every ball splits into four.' },
  { id: 'laser', name: 'Laser Paddle', glyph: '↑', color: '#fb7185', rarity: 2, seconds: 18, negative: false, blurb: 'Fire bolts upward with the action button.' },
  { id: 'rapidlaser', name: 'Rapid Laser', glyph: '⇈', color: '#f43f5e', rarity: 2, seconds: 14, negative: false, blurb: 'Laser cooldown drops to a third.' },
  { id: 'fireball', name: 'Fireball', glyph: '🔥', color: '#f97316', rarity: 2, seconds: 16, negative: false, blurb: 'Extra damage, melts frozen and shielded bricks.' },
  { id: 'iceball', name: 'Ice Ball', glyph: '❄', color: '#7dd3fc', rarity: 2, seconds: 16, negative: false, blurb: 'Freezes bricks so they stop moving.' },
  { id: 'electricball', name: 'Electric Ball', glyph: '⚡', color: '#fde047', rarity: 2, seconds: 16, negative: false, blurb: 'Breaks colour locks and arcs to neighbours.' },
  { id: 'heavyball', name: 'Heavy Ball', glyph: '⬤', color: '#94a3b8', rarity: 1, seconds: 16, negative: false, blurb: 'Double damage, slightly slower.' },
  { id: 'ghostball', name: 'Ghost Ball', glyph: '◌', color: '#c4b5fd', rarity: 3, seconds: 12, negative: false, blurb: 'Passes through bulkheads.' },
  { id: 'sticky', name: 'Sticky Paddle', glyph: '⌒', color: '#facc15', rarity: 2, seconds: 14, negative: false, blurb: 'Catches the ball so you can aim.' },
  { id: 'magnetic', name: 'Magnetic Paddle', glyph: '∪', color: '#fb923c', rarity: 2, seconds: 14, negative: false, blurb: 'Bends nearby balls toward the paddle.' },
  { id: 'safetynet', name: 'Safety Net', glyph: '▁', color: '#34d399', rarity: 2, seconds: 0, negative: false, blurb: 'Catches the next missed ball.' },
  { id: 'doublesafetynet', name: 'Double Safety Net', glyph: '▂', color: '#10b981', rarity: 3, seconds: 0, negative: false, blurb: 'Two catches.' },
  { id: 'slowmo', name: 'Slow Motion', glyph: '◷', color: '#60a5fa', rarity: 1, seconds: 10, negative: false, blurb: 'Balls move at 65% speed.' },
  { id: 'speedboost', name: 'Speed Boost', glyph: '»', color: '#f472b6', rarity: 1, seconds: 10, negative: false, blurb: 'Faster balls, more damage. Capped.' },
  { id: 'extralife', name: 'Extra Life', glyph: '♥', color: '#ef4444', rarity: 3, seconds: 0, negative: false, blurb: 'One more ball in reserve.' },
  { id: 'shieldpaddle', name: 'Shield Paddle', glyph: '⛨', color: '#22d3ee', rarity: 2, seconds: 18, negative: false, blurb: 'Blocks falling mines and laser bolts.' },
  { id: 'bomb', name: 'Bomb', glyph: '●', color: '#f97316', rarity: 1, seconds: 0, negative: false, blurb: 'Clears a small cluster.' },
  { id: 'megabomb', name: 'Mega Bomb', glyph: '◉', color: '#ea580c', rarity: 2, seconds: 0, negative: false, blurb: 'Clears a wide cluster.' },
  { id: 'missile', name: 'Missile Launcher', glyph: '➤', color: '#f59e0b', rarity: 2, seconds: 18, negative: false, blurb: 'Homing missiles seek bricks.' },
  { id: 'drone', name: 'Drone Buddy', glyph: '◇', color: '#a78bfa', rarity: 3, seconds: 20, negative: false, blurb: 'A little helper shoots for you.' },
  { id: 'doubledrone', name: 'Double Drone', glyph: '◈', color: '#8b5cf6', rarity: 3, seconds: 20, negative: false, blurb: 'Two helpers.' },
  { id: 'clone', name: 'Ball Clone', glyph: '❂', color: '#22d3ee', rarity: 2, seconds: 0, negative: false, blurb: 'Duplicates one active ball.' },
  { id: 'scoremult', name: 'Score Multiplier', glyph: '×2', color: '#fbbf24', rarity: 2, seconds: 18, negative: false, blurb: 'Double points while active.' },
  { id: 'coinmagnet', name: 'Coin Magnet', glyph: '⊂', color: '#facc15', rarity: 1, seconds: 18, negative: false, blurb: 'Capsules drift toward the paddle.' },
  { id: 'timefreeze', name: 'Time Freeze', glyph: '✻', color: '#a5f3fc', rarity: 3, seconds: 8, negative: false, blurb: 'Hazards and moving bricks stop.' },
  { id: 'repair', name: 'Repair', glyph: '✚', color: '#4ade80', rarity: 2, seconds: 0, negative: false, blurb: 'Restores a shield charge.' },
  { id: 'piercing', name: 'Piercing Shot', glyph: '⇉', color: '#eab308', rarity: 3, seconds: 16, negative: false, blurb: 'Lasers punch through bricks.' },
  { id: 'chainreaction', name: 'Chain Reaction', glyph: '⌁', color: '#fb7185', rarity: 3, seconds: 18, negative: false, blurb: 'Explosions reach much further.' },
  { id: 'gravityshift', name: 'Gravity Shift', glyph: '↓', color: '#818cf8', rarity: 2, seconds: 10, negative: true, blurb: 'Balls sag toward the paddle. Harder to keep up.' },
  { id: 'portalball', name: 'Portal Ball', glyph: '◍', color: '#c084fc', rarity: 3, seconds: 14, negative: false, blurb: 'Teleports across the arena when it hits a wall.' },
  { id: 'rainbow', name: 'Rainbow Ball', glyph: '◐', color: '#f472b6', rarity: 3, seconds: 18, negative: false, blurb: 'Cycles through fire, ice and electric.' },
  { id: 'reverse', name: 'Reverse Controls', glyph: '⇄', color: '#f87171', rarity: 1, seconds: 8, negative: true, blurb: 'Paddle input is mirrored. Clearly flagged.' },
  { id: 'paddlejam', name: 'Paddle Jam', glyph: '⊗', color: '#ef4444', rarity: 1, seconds: 6, negative: true, blurb: 'Lasers and drones go offline.' },
  { id: 'blackout', name: 'Blackout', glyph: '◑', color: '#64748b', rarity: 1, seconds: 7, negative: true, blurb: 'The arena dims. The ball still glows.' },
  { id: 'brickregen', name: 'Brick Regen', glyph: '↺', color: '#a3e635', rarity: 1, seconds: 0, negative: true, blurb: 'A few broken bricks come back.' },
  { id: 'jackpot', name: 'Jackpot', glyph: '★', color: '#fde047', rarity: 1, seconds: 0, negative: false, blurb: 'Instant credit bonus.' },
]

export const POWER_UPS_BY_ID = new Map<PowerUpId, PowerUpDef>(POWER_UPS.map((entry) => [entry.id, entry]))

export const NEGATIVE_POWER_UPS = new Set<PowerUpId>(
  POWER_UPS.filter((entry) => entry.negative).map((entry) => entry.id),
)

/** Common pool used by worlds that do not curate their own list. */
export const DEFAULT_DROP_POOL: PowerUpId[] = [
  'wide',
  'multiball',
  'laser',
  'fireball',
  'iceball',
  'safetynet',
  'slowmo',
  'bomb',
  'scoremult',
  'sticky',
  'magnetic',
  'jackpot',
  'tiny',
]

export function powerUpDef(id: PowerUpId): PowerUpDef {
  const def = POWER_UPS_BY_ID.get(id)
  if (!def) throw new Error(`Unknown power-up ${id}`)
  return def
}
