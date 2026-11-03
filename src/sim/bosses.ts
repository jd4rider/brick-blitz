import type { BossId } from '../core/types'

export type BossAttack =
  | 'rain'
  | 'sweep'
  | 'shield'
  | 'summon'
  | 'gravity'
  | 'spread'
  | 'laser'
  | 'swap'
  | 'rush'
  | 'nova'

export interface BossSpec {
  id: BossId
  name: string
  title: string
  color: string
  accent: string
  /** Core bricks. Each one is a weak point; all must break. */
  hp: number
  attacks: BossAttack[]
  blurb: string
}

export const BOSSES: Record<BossId, BossSpec> = {
  titan: {
    id: 'titan',
    name: 'Brick Titan',
    title: 'Guardian of the first wall',
    color: '#94a3b8',
    accent: '#f8fafc',
    hp: 6,
    attacks: ['rain', 'sweep'],
    blurb: 'Slow, heavy and honest. Teaches you to read a falling hazard.',
  },
  serpent: {
    id: 'serpent',
    name: 'Neon Serpent',
    title: 'A coil of dancing light',
    color: '#22d3ee',
    accent: '#cffafe',
    hp: 7,
    attacks: ['sweep', 'spread', 'swap'],
    blurb: 'Slides along the ceiling and spits bolts in fans.',
  },
  colossus: {
    id: 'colossus',
    name: 'Crystal Colossus',
    title: 'Every facet is a mirror',
    color: '#a5b4fc',
    accent: '#eef2ff',
    hp: 8,
    attacks: ['shield', 'spread', 'laser'],
    blurb: 'Regrows crystal plating until you commit to the core.',
  },
  inferno: {
    id: 'inferno',
    name: 'Inferno Engine',
    title: 'The furnace that never cools',
    color: '#fb923c',
    accent: '#ffedd5',
    hp: 9,
    attacks: ['rain', 'rush', 'nova'],
    blurb: 'Rains embers and surges forward when wounded.',
  },
  frost: {
    id: 'frost',
    name: 'Frost Fortress',
    title: 'A wall of patient ice',
    color: '#7dd3fc',
    accent: '#e0f2fe',
    hp: 10,
    attacks: ['shield', 'laser', 'rain'],
    blurb: 'Freezes your rhythm with sweeping beams.',
  },
  volt: {
    id: 'volt',
    name: 'Volt Overlord',
    title: 'Conductor of the whole grid',
    color: '#fde047',
    accent: '#fefce8',
    hp: 11,
    attacks: ['spread', 'nova', 'summon'],
    blurb: 'Fills the arena with arcing orbs, then dares you to thread them.',
  },
  gravity: {
    id: 'gravity',
    name: 'Gravity Core',
    title: 'A small, rude planet',
    color: '#818cf8',
    accent: '#e0e7ff',
    hp: 12,
    attacks: ['gravity', 'rain', 'swap'],
    blurb: 'Bends every ball toward itself. Aim becomes a negotiation.',
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom Matrix',
    title: 'Here, then not',
    color: '#c084fc',
    accent: '#f3e8ff',
    hp: 13,
    attacks: ['swap', 'summon', 'spread'],
    blurb: 'Teleports the ball and hides behind summoned drones.',
  },
  citadel: {
    id: 'citadel',
    name: 'Iron Citadel',
    title: 'A fortress with a schedule',
    color: '#cbd5e1',
    accent: '#f8fafc',
    hp: 14,
    attacks: ['shield', 'rush', 'laser', 'rain'],
    blurb: 'Layer after layer of plating. Chip it, then break the keep.',
  },
  blitzking: {
    id: 'blitzking',
    name: 'The Blitz King',
    title: 'Every trick you have learned',
    color: '#f43f5e',
    accent: '#ffe4e6',
    hp: 18,
    attacks: ['nova', 'spread', 'shield', 'gravity', 'rush', 'laser'],
    blurb: 'Six attacks, three phases, no new rules. A final exam.',
  },
}

export const BOSS_LIST = Object.keys(BOSSES) as BossId[]
