export type SoundName =
  | 'paddle'
  | 'wall'
  | 'brick'
  | 'break'
  | 'power'
  | 'laser'
  | 'boom'
  | 'win'
  | 'lose'
  | 'ui'
  | 'boss'

const NOTES: Record<Exclude<SoundName, 'win' | 'lose'>, { freq: number; duration: number; type: OscillatorType; gain: number }> = {
  paddle: { freq: 320, duration: 0.06, type: 'triangle', gain: 0.22 },
  wall: { freq: 210, duration: 0.04, type: 'sine', gain: 0.12 },
  brick: { freq: 480, duration: 0.05, type: 'square', gain: 0.1 },
  break: { freq: 640, duration: 0.09, type: 'triangle', gain: 0.16 },
  power: { freq: 880, duration: 0.16, type: 'sine', gain: 0.2 },
  laser: { freq: 1100, duration: 0.05, type: 'sawtooth', gain: 0.07 },
  boom: { freq: 90, duration: 0.28, type: 'sawtooth', gain: 0.2 },
  ui: { freq: 520, duration: 0.05, type: 'sine', gain: 0.1 },
  boss: { freq: 150, duration: 0.4, type: 'sawtooth', gain: 0.18 },
}

/**
 * Every sound is synthesized, so the game ships with no audio files and works
 * offline. The context is created on the first gesture to respect autoplay.
 */
export class AudioEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private musicTimer: number | null = null
  private musicStep = 0
  sound = true
  music = true

  unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume()
      return
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    this.context = new Ctor()
    this.master = this.context.createGain()
    this.master.gain.value = 0.5
    this.master.connect(this.context.destination)
    if (this.music) this.startMusic()
  }

  setSound(enabled: boolean): void {
    this.sound = enabled
  }

  setMusic(enabled: boolean): void {
    this.music = enabled
    if (!enabled) this.stopMusic()
    else this.startMusic()
  }

  play(name: SoundName): void {
    if (!this.sound || !this.context || !this.master) return
    if (name === 'win') {
      this.sequence([523, 659, 784, 1046], 0.12)
      return
    }
    if (name === 'lose') {
      this.sequence([392, 330, 262, 196], 0.16)
      return
    }
    const note = NOTES[name]
    this.tone(note.freq, note.duration, note.type, note.gain)
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain: number, delay = 0): void {
    if (!this.context || !this.master) return
    const start = this.context.currentTime + delay
    const osc = this.context.createOscillator()
    const envelope = this.context.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.72), start + duration)
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008)
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(envelope)
    envelope.connect(this.master)
    osc.start(start)
    osc.stop(start + duration + 0.02)
  }

  private sequence(frequencies: number[], spacing: number): void {
    frequencies.forEach((freq, index) => {
      this.tone(freq, 0.18, 'triangle', 0.18, index * spacing)
    })
  }

  startMusic(): void {
    if (!this.music || !this.context || this.musicTimer !== null) return
    const pattern = [196, 246.94, 293.66, 349.23, 293.66, 246.94, 220, 261.63]
    const tick = () => {
      if (!this.context || !this.master) return
      const freq = pattern[this.musicStep % pattern.length] ?? 220
      this.musicStep += 1
      this.tone(freq, 0.42, 'sine', 0.035)
      if (this.musicStep % 2 === 0) this.tone(freq / 2, 0.5, 'triangle', 0.02)
    }
    this.musicTimer = window.setInterval(tick, 620)
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer)
      this.musicTimer = null
    }
  }

  suspend(): void {
    this.stopMusic()
    if (this.context?.state === 'running') void this.context.suspend()
  }

  resume(): void {
    if (this.context?.state === 'suspended') void this.context.resume()
    if (this.music) this.startMusic()
  }
}

export const audio = new AudioEngine()
