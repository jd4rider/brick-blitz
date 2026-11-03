/** Small deterministic PRNG. Same seed and calls always produce the same run. */
export function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export class Rng {
  private state: number

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed >>> 0 : hashString(seed)
    if (this.state === 0) this.state = 0x9e3779b9
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive)
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]!
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items]
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = this.int(index + 1)
      const value = copy[index]!
      copy[index] = copy[swap]!
      copy[swap] = value
    }
    return copy
  }

  weighted<T>(entries: readonly { value: T; weight: number }[]): T {
    const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0)
    if (total <= 0) return entries[0]!.value
    let roll = this.next() * total
    for (const entry of entries) {
      roll -= Math.max(0, entry.weight)
      if (roll <= 0) return entry.value
    }
    return entries[entries.length - 1]!.value
  }
}
