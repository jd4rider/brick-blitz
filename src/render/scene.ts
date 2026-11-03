import * as THREE from 'three'
import { ARENA, PADDLE } from '../core/constants'
import type { LevelDefinition } from '../core/types'
import { BOSSES } from '../sim/bosses'
import { BRICKS } from '../sim/bricks'
import type { Brick, Game, Hazard, SimEvent } from '../sim/game'
import { powerUpDef } from '../sim/powerups'

export type Quality = 'low' | 'medium' | 'high'

const SPECIAL_GLYPHS: Record<string, string> = {
  explosive: '✸',
  chain: '⌁',
  regen: '↺',
  moving: '↔',
  sliding: '⇥',
  rotating: '⟳',
  shielded: '⛨',
  colorlock: '⚡',
  switch: '⊕',
  portal: '◎',
  mirror: '╱',
  splitter: '⁂',
  frozen: '❄',
  electric: 'ϟ',
  poison: '☠',
  treasure: '★',
  mystery: '?',
  gravity: '◉',
  magnetic: '∪',
  core: '◈',
  bossshield: '▤',
}

interface BrickView {
  group: THREE.Group
  body: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  plate: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  glyph: THREE.Sprite | null
  maxHp: number
}

/**
 * The renderer is a view of the simulation and nothing more. It never decides
 * where a ball goes; it only draws the state the Game hands it.
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.OrthographicCamera

  private readonly canvas: HTMLCanvasElement
  private readonly arena = new THREE.Group()
  private readonly brickLayer = new THREE.Group()
  private readonly effectLayer = new THREE.Group()
  private readonly background: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private readonly paddle: THREE.Group
  private readonly paddleBody: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshStandardMaterial>
  private readonly paddleGlow: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshBasicMaterial>
  private readonly ballHaloTexture: THREE.Texture
  private readonly glyphTextures = new Map<string, THREE.Texture>()
  private readonly bricks = new Map<number, BrickView>()
  private readonly balls = new Map<number, { group: THREE.Group; ball: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> }>()
  private readonly capsules = new Map<number, THREE.Group>()
  private readonly bolts = new Map<number, THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>>()
  private readonly hazards = new Map<number, THREE.Object3D>()
  private readonly trailGeometry: THREE.BufferGeometry
  private readonly trailPositions: Float32Array
  private readonly trailColors: Float32Array
  private readonly trailPoints: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>
  private trailCursor = 0
  private trailTimer = 0

  private readonly particleGeometry: THREE.BufferGeometry
  private readonly particlePositions: Float32Array
  private readonly particleColors: Float32Array
  private readonly particlePoints: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>
  private readonly particleVelocity: Float32Array
  private readonly particleLife: Float32Array
  private particleCursor = 0
  private readonly particleCapacity: number

  private readonly debris: { mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>; vx: number; vy: number; vz: number; spin: number; life: number }[] = []
  private readonly maxDebris: number

  private readonly keyLight: THREE.DirectionalLight
  private readonly rimLight: THREE.PointLight
  private readonly bossRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>

  private viewWidth = 110
  private viewHeight = 176
  private quality: Quality = 'high'
  private dim = 0
  private shake = 0
  private menuMode = false
  private menuTime = 0
  private palette = { sky: '#0b1230', glow: '#2a4bd8', accent: '#4de1ff', floor: '#101a3d' }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1

    this.camera = new THREE.OrthographicCamera(-55, 55, 88, -88, 1, 600)
    // Centred on the whole arena: the camera top must clear y=150 so the top
    // brick row is never cropped on a tall phone.
    this.camera.position.set(0, 66, 190)
    this.camera.lookAt(0, 78, 0)
    this.scene.add(this.camera)

    this.scene.fog = new THREE.Fog(0x070a18, 220, 420)

    this.background = this.buildBackground()
    this.scene.add(this.background)

    this.keyLight = new THREE.DirectionalLight(0xffffff, 0.95)
    this.keyLight.position.set(-30, 70, 90)
    this.scene.add(this.keyLight)

    const fill = new THREE.DirectionalLight(0x8ecbff, 0.4)
    fill.position.set(40, 30, 60)
    this.scene.add(fill)

    this.rimLight = new THREE.PointLight(0x4de1ff, 30, 180, 2)
    this.rimLight.position.set(0, 8, 40)
    this.scene.add(this.rimLight)

    this.scene.add(new THREE.HemisphereLight(0xbcd7ff, 0x0a0f22, 0.5))
    this.scene.add(this.arena)
    this.arena.add(this.brickLayer)
    this.arena.add(this.effectLayer)

    this.buildArena()
    this.paddle = new THREE.Group()
    const paddleMaterial = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.9,
      roughness: 0.22,
      emissive: 0x1a2a44,
      emissiveIntensity: 0.4,
    })
    this.paddleBody = new THREE.Mesh(new THREE.CapsuleGeometry(1.55, PADDLE.baseWidth - 3.1, 6, 18), paddleMaterial)
    this.paddleBody.rotation.z = Math.PI / 2
    this.paddleBody.position.z = 2
    const glowGeometry = new THREE.CapsuleGeometry(0.35, PADDLE.baseWidth - 4, 4, 10)
    this.paddleGlow = new THREE.Mesh(glowGeometry, new THREE.MeshBasicMaterial({ color: 0x8ecbff }))
    this.paddleGlow.rotation.z = Math.PI / 2
    this.paddleGlow.position.set(0, 1.1, 4)
    this.paddle.add(this.paddleBody)
    this.paddle.add(this.paddleGlow)
    this.paddle.position.set(0, PADDLE.y, 0)
    this.scene.add(this.paddle)

    this.ballHaloTexture = this.makeGlowTexture()
    this.trailGeometry = new THREE.BufferGeometry()
    this.trailPositions = new Float32Array(160 * 3)
    this.trailPositions.fill(-999)
    this.trailColors = new Float32Array(160 * 3)
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3))
    this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(this.trailColors, 3))
    this.trailPoints = new THREE.Points(
      this.trailGeometry,
      new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    this.trailPoints.frustumCulled = false
    this.scene.add(this.trailPoints)

    this.particleCapacity = 420
    this.particlePositions = new Float32Array(this.particleCapacity * 3)
    this.particleColors = new Float32Array(this.particleCapacity * 3)
    this.particleVelocity = new Float32Array(this.particleCapacity * 3)
    this.particleLife = new Float32Array(this.particleCapacity)
    this.particleGeometry = new THREE.BufferGeometry()
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3))
    this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3))
    this.particleGeometry.setDrawRange(0, 0)
    this.particlePoints = new THREE.Points(
      this.particleGeometry,
      new THREE.PointsMaterial({ size: 2.6, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    this.particlePoints.frustumCulled = false
    this.scene.add(this.particlePoints)

    this.maxDebris = 70
    const debrisGeometry = new THREE.BoxGeometry(1.6, 1.6, 1.6)
    for (let index = 0; index < this.maxDebris; index += 1) {
      const mesh = new THREE.Mesh(
        debrisGeometry,
        new THREE.MeshStandardMaterial({ color: 0x4de1ff, metalness: 0.3, roughness: 0.5 }),
      )
      mesh.visible = false
      this.effectLayer.add(mesh)
      this.debris.push({ mesh, vx: 0, vy: 0, vz: 0, spin: 0, life: 0 })
    }

    this.bossRing = new THREE.Mesh(
      new THREE.TorusGeometry(14, 0.6, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }),
    )
    this.bossRing.visible = false
    this.scene.add(this.bossRing)

    this.resize(canvas.clientWidth || 390, canvas.clientHeight || 844)
  }

  // ------------------------------------------------------------------ setup

  private buildBackground(): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(this.palette.sky) },
        bottomColor: { value: new THREE.Color(this.palette.floor) },
        glowColor: { value: new THREE.Color(this.palette.glow) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 glowColor;
        void main() {
          vec3 color = mix(bottomColor, topColor, smoothstep(0.0, 1.0, vUv.y));
          float halo = pow(max(0.0, 1.0 - distance(vUv, vec2(0.5, 0.62)) * 1.7), 3.0);
          color += glowColor * halo * 0.55;
          float grid = step(0.985, fract(vUv.x * 42.0)) + step(0.985, fract(vUv.y * 60.0));
          color += glowColor * grid * 0.05;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), material)
    mesh.position.z = -60
    return mesh
  }

  private buildArena(): void {
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b2448,
      metalness: 0.7,
      roughness: 0.35,
      emissive: 0x0c1633,
      emissiveIntensity: 0.7,
    })
    const left = new THREE.Mesh(new THREE.BoxGeometry(2, ARENA.top + 16, 6), railMaterial)
    left.position.set(-ARENA.halfWidth - 1, ARENA.top / 2 + 4, 0)
    const right = left.clone()
    right.position.x = ARENA.halfWidth + 1
    const cap = new THREE.Mesh(new THREE.BoxGeometry(ARENA.halfWidth * 2 + 4, 2, 6), railMaterial)
    cap.position.set(0, ARENA.top + 8, 0)
    this.arena.add(left, right, cap)

    const accentMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.palette.accent),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    })
    const stripLeft = new THREE.Mesh(new THREE.BoxGeometry(0.35, ARENA.top + 10, 0.4), accentMaterial)
    stripLeft.position.set(-ARENA.halfWidth + 0.5, ARENA.top / 2 + 4, 3.5)
    const stripRight = stripLeft.clone()
    stripRight.position.x = ARENA.halfWidth - 0.5
    this.arena.add(stripLeft, stripRight)
  }

  setPalette(palette: { sky: string; glow: string; accent: string; paddle: string; floor: string }): void {
    this.palette = palette
    this.background.material.uniforms.topColor!.value = new THREE.Color(palette.sky)
    this.background.material.uniforms.bottomColor!.value = new THREE.Color(palette.floor)
    this.background.material.uniforms.glowColor!.value = new THREE.Color(palette.glow)
    this.paddleBody.material.color.set(palette.paddle)
    this.paddleGlow.material.color.set(palette.accent)
    this.rimLight.color.set(palette.accent)
    this.scene.fog = new THREE.Fog(new THREE.Color(palette.sky), 230, 430)
  }

  setQuality(quality: Quality): void {
    this.quality = quality
    this.renderer.setPixelRatio(quality === 'low' ? Math.min(window.devicePixelRatio || 1, 1) : Math.min(window.devicePixelRatio || 1, 2))
    this.particlePoints.material.size = quality === 'low' ? 1.8 : 2.6
    this.trailPoints.visible = quality !== 'low'
    for (const view of this.bricks.values()) view.glyph && (view.glyph.visible = quality !== 'low')
  }

  setCosmetics(paddleColor: string, ballColor: string, trailColor: string): void {
    this.paddleBody.material.color.set(paddleColor)
    this.paddleGlow.material.color.set(ballColor)
    for (const entry of this.balls.values()) entry.ball.material.emissive.set(ballColor)
    this.trailPoints.material.color.set(trailColor)
  }

  setHighContrast(enabled: boolean): void {
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
        object.material.emissiveIntensity = enabled ? 0.9 : 0.35
      }
    })
  }

  setDim(value: number): void {
    this.dim = value
  }

  resize(width: number, height: number): void {
    const aspect = Math.max(0.2, width / Math.max(1, height))
    const neededWidth = ARENA.halfWidth * 2 + 14
    const neededHeight = ARENA.top + 22
    if (height <= 0) return
    if (width / height >= neededWidth / neededHeight) {
      this.viewHeight = neededHeight
      this.viewWidth = neededHeight * aspect
    } else {
      this.viewWidth = neededWidth
      this.viewHeight = neededWidth / aspect
    }
    this.renderer.setSize(width, height, false)
    this.camera.left = -this.viewWidth / 2
    this.camera.right = this.viewWidth / 2
    this.camera.top = this.viewHeight / 2
    this.camera.bottom = -this.viewHeight / 2
    this.camera.updateProjectionMatrix()
    this.background.scale.set(this.viewWidth / 300, this.viewHeight / 300, 1)
    this.background.position.set(0, 0, -60)
  }

  /** Screen x in CSS pixels -> logical arena x. Ortho with no yaw keeps this exact. */
  worldX(clientX: number, rect: DOMRect): number {
    const ratio = (clientX - rect.left) / Math.max(1, rect.width)
    return (ratio - 0.5) * this.viewWidth + 0.5
  }

  worldY(clientY: number, rect: DOMRect): number {
    const ratio = (clientY - rect.top) / Math.max(1, rect.height)
    return (0.5 - ratio) * this.viewHeight + 0.5
  }

  // --------------------------------------------------------------- level build

  buildLevel(game: Game, level: LevelDefinition): void {
    this.menuMode = false
    this.paddle.visible = true
    this.clearBricks()
    for (const brick of game.bricks) this.ensureBrick(brick)
    this.bossRing.visible = Boolean(level.boss)
    if (level.boss) this.bossRing.material.color.set(BOSSES[level.boss].color)
    this.trailPositions.fill(-999)
    this.trailColors.fill(0)
    this.trailGeometry.attributes.position!.needsUpdate = true
    this.trailGeometry.attributes.color!.needsUpdate = true
    this.dim = 0
  }

  private clearBricks(): void {
    for (const [id, view] of this.bricks) {
      this.disposeBrick(view)
      this.bricks.delete(id)
    }
  }

  private disposeBrick(view: BrickView): void {
    this.brickLayer.remove(view.group)
    view.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose())
        else child.material.dispose()
      }
      if (child instanceof THREE.Sprite) child.material.dispose()
    })
  }

  private ensureBrick(brick: Brick): BrickView {
    const existing = this.bricks.get(brick.id)
    if (existing) return existing
    const spec = BRICKS[brick.type]
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.color),
      metalness: 0.35,
      roughness: 0.3,
      emissive: new THREE.Color(spec.accent),
      emissiveIntensity: 0.18,
    })
    const plateMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.accent),
      metalness: 0.2,
      roughness: 0.25,
      emissive: new THREE.Color(spec.color),
      emissiveIntensity: 0.55,
    })
    // A dark rim behind the tile reads as a bevel and gives the wall depth cues
    // even straight-on, without needing shadow maps on a phone.
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(brick.w + 0.4, brick.h + 0.4, 3.2),
      new THREE.MeshBasicMaterial({ color: 0x04070f }),
    )
    rim.position.z = -0.4
    const body = new THREE.Mesh(new THREE.BoxGeometry(brick.w, brick.h, 4.2), bodyMaterial)
    body.position.z = 0.3
    const plate = new THREE.Mesh(new THREE.BoxGeometry(brick.w * 0.82, brick.h * 0.72, 0.7), plateMaterial)
    plate.position.z = 2.5
    const group = new THREE.Group()
    group.add(rim, body, plate)
    group.position.set(brick.x, brick.y, 0)

    let glyph: THREE.Sprite | null = null
    const character = SPECIAL_GLYPHS[brick.type]
    if (character && this.quality !== 'low') {
      const texture = this.glyphTexture(brick.type, character, spec.accent)
      glyph = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
      glyph.scale.set(3.4, 3.4, 1)
      glyph.position.z = 2.6
      group.add(glyph)
    }

    this.brickLayer.add(group)
    const view: BrickView = { group, body, plate, glyph, maxHp: brick.maxHp }
    this.bricks.set(brick.id, view)
    return view
  }

  private glyphTexture(key: string, character: string, color: string): THREE.Texture {
    const existing = this.glyphTextures.get(key)
    if (existing) return existing
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const context = canvas.getContext('2d')
    if (context) {
      context.font = '44px ui-sans-serif, system-ui, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = color
      context.shadowColor = color
      context.shadowBlur = 12
      context.fillText(character, 32, 34)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    this.glyphTextures.set(key, texture)
    return texture
  }

  // ------------------------------------------------------------------- events

  handleEvents(events: SimEvent[], game: Game): void {
    for (const event of events) {
      if (event.type === 'break') {
        this.spawnBurst(event.x, event.y, event.color, 14)
        this.spawnDebris(event.x, event.y, event.color, 3)
        this.shake = Math.min(1.4, this.shake + 0.25)
      } else if (event.type === 'hit') {
        this.spawnBurst(event.x, event.y, '#bfe9ff', 4)
      } else if (event.type === 'boom') {
        this.spawnBurst(event.x, event.y, '#ffb347', 26)
        this.spawnDebris(event.x, event.y, '#ff9f43', 6)
        this.shake = Math.min(2.2, this.shake + 0.8)
      } else if (event.type === 'paddle') {
        this.spawnBurst(game.paddle.x, PADDLE.y + 3, '#8ecbff', 6)
        this.shake = Math.min(0.6, this.shake + 0.12)
      } else if (event.type === 'power') {
        this.spawnBurst(event.x, event.y, powerUpDef(event.id).color, 18)
      } else if (event.type === 'wall') {
        this.shake = Math.min(0.4, this.shake + 0.05)
      } else if (event.type === 'boss') {
        this.shake = Math.min(2, this.shake + 0.5)
      }
    }
  }

  private spawnBurst(x: number, y: number, color: string, count: number): void {
    const budget = this.quality === 'low' ? Math.ceil(count / 2) : count
    const base = new THREE.Color(color)
    for (let index = 0; index < budget; index += 1) {
      const cursor = this.particleCursor % this.particleCapacity
      this.particleCursor += 1
      const offset = cursor * 3
      const angle = Math.random() * Math.PI * 2
      const speed = 8 + Math.random() * 42
      this.particlePositions[offset] = x
      this.particlePositions[offset + 1] = y
      this.particlePositions[offset + 2] = 2 + Math.random() * 3
      this.particleVelocity[offset] = Math.cos(angle) * speed
      this.particleVelocity[offset + 1] = Math.sin(angle) * speed + 12
      this.particleVelocity[offset + 2] = (Math.random() - 0.5) * 22
      const jitter = 0.75 + Math.random() * 0.4
      this.particleColors[offset] = Math.min(1, base.r * jitter + 0.15)
      this.particleColors[offset + 1] = Math.min(1, base.g * jitter + 0.15)
      this.particleColors[offset + 2] = Math.min(1, base.b * jitter + 0.15)
      this.particleLife[cursor] = 0.45 + Math.random() * 0.55
    }
    ;(this.particleGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.particleGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
  }

  private spawnDebris(x: number, y: number, color: string, count: number): void {
    let spawned = 0
    for (const piece of this.debris) {
      if (spawned >= count) break
      if (piece.life > 0) continue
      spawned += 1
      piece.mesh.visible = true
      piece.mesh.position.set(x + (Math.random() - 0.5) * 4, y + (Math.random() - 0.5) * 3, 1)
      piece.mesh.scale.setScalar(0.6 + Math.random() * 0.7)
      piece.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      piece.mesh.material.color.set(color)
      piece.mesh.material.emissive.set(color)
      piece.mesh.material.emissiveIntensity = 0.4
      piece.vx = (Math.random() - 0.5) * 46
      piece.vy = 6 + Math.random() * 34
      piece.vz = 8 + Math.random() * 30
      piece.spin = (Math.random() - 0.5) * 10
      piece.life = 0.9 + Math.random() * 0.5
    }
  }

  private spawnTrail(x: number, y: number, color: THREE.Color): void {
    if (this.quality === 'low') return
    const cursor = this.trailCursor % 160
    this.trailCursor += 1
    const offset = cursor * 3
    this.trailPositions[offset] = x
    this.trailPositions[offset + 1] = y
    this.trailPositions[offset + 2] = 1.5
    this.trailColors[offset] = color.r
    this.trailColors[offset + 1] = color.g
    this.trailColors[offset + 2] = color.b
    ;(this.trailGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    ;(this.trailGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
  }

  // --------------------------------------------------------------------- sync

  sync(game: Game, dt: number): void {
    this.menuMode = false
    this.syncBricks(game)
    this.syncBalls(game, dt)
    this.syncPaddle(game)
    this.syncCapsules(game)
    this.syncBolts(game)
    this.syncHazards(game)
    this.syncBoss(game, dt)
    this.stepParticles(dt)
    this.stepDebris(dt)

    if (game.has('blackout') || game.stun > 0) this.dim = Math.min(0.62, this.dim + dt * 2)
    else this.dim = Math.max(0, this.dim - dt * 2)
    const visibility = 1 - this.dim
    this.keyLight.intensity = 1.5 * visibility
    this.rimLight.intensity = 80 * visibility

    this.shake = Math.max(0, this.shake - dt * 4)
    const shakeX = (Math.random() - 0.5) * this.shake * 2.4
    const shakeY = (Math.random() - 0.5) * this.shake * 2.4
    this.camera.position.x = shakeX
    this.camera.position.y = 66 + shakeY
    this.camera.lookAt(shakeX * 0.4, 78 + shakeY * 0.4, 0)

    for (let index = 0; index < this.trailColors.length; index += 1) {
      const value = this.trailColors[index] ?? 0
      if (value > 0.01) this.trailColors[index] = value * 0.94
    }
    ;(this.trailGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
    this.background.rotation.z = Math.sin(game.time * 0.05) * 0.01
    this.renderer.render(this.scene, this.camera)
  }

  private syncBricks(game: Game): void {
    for (const brick of game.bricks) this.ensureBrick(brick)
    for (const brick of game.bricks) {
      const view = this.bricks.get(brick.id)
      if (!view) continue
      view.group.visible = brick.alive
      if (!brick.alive) continue
      view.group.position.set(brick.x, brick.y, 0)
      view.group.rotation.z = brick.type === 'rotating' ? brick.rotation : 0
      const health = brick.maxHp === Number.POSITIVE_INFINITY ? 1 : Math.max(0.2, brick.hp / Math.max(1, brick.maxHp))
      view.plate.material.emissiveIntensity = 0.25 + health * 0.7 + brick.hitFlash * 1.4
      view.body.material.emissiveIntensity = 0.08 + health * 0.22 + brick.hitFlash * 1.6
      view.group.scale.setScalar(brick.hitFlash > 0 ? 1 + brick.hitFlash * 0.08 : 1)
      if (view.glyph) view.glyph.material.opacity = 0.55 + health * 0.45
    }
  }

  private syncBalls(game: Game, dt: number): void {
    const active = new Set<number>()
    for (const ball of game.balls) {
      active.add(ball.id)
      let view = this.balls.get(ball.id)
      if (!view) {
        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: new THREE.Color(this.palette.accent),
          emissiveIntensity: 2.4,
          metalness: 0.1,
          roughness: 0.15,
        })
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(ball.r, 18, 14), material)
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.ballHaloTexture,
            color: new THREE.Color(this.palette.accent),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.75,
          }),
        )
        halo.scale.set(9, 9, 1)
        const group = new THREE.Group()
        group.add(mesh, halo)
        this.scene.add(group)
        view = { group, ball: mesh }
        this.balls.set(ball.id, view)
      }
      view.group.position.set(ball.x, ball.y, 2)
      view.ball.material.emissive.set(game.activeElement === 'none' ? this.palette.accent : elementColor(game.activeElement))
      this.trailTimer -= dt
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.016
        this.spawnTrail(ball.x, ball.y, new THREE.Color(view.ball.material.emissive))
      }
    }
    for (const [id, view] of this.balls) {
      if (active.has(id)) continue
      this.scene.remove(view.group)
      view.ball.geometry.dispose()
      view.ball.material.dispose()
      this.balls.delete(id)
    }
  }

  private syncPaddle(game: Game): void {
    this.paddle.position.x = game.paddle.x
    this.paddleBody.scale.x = game.paddle.width / PADDLE.baseWidth
    this.paddleGlow.scale.x = game.paddle.width / PADDLE.baseWidth
    this.paddle.position.z = game.stun > 0 ? Math.sin(game.time * 40) * 0.8 : 0
  }

  private syncCapsules(game: Game): void {
    const active = new Set<number>()
    for (const capsule of game.capsules) {
      active.add(capsule.id)
      let group = this.capsules.get(capsule.id)
      if (!group) {
        const def = powerUpDef(capsule.power)
        const shell = new THREE.Mesh(
          new THREE.OctahedronGeometry(2.2, 0),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(def.color),
            emissive: new THREE.Color(def.color),
            emissiveIntensity: 1.2,
            metalness: 0.4,
            roughness: 0.2,
          }),
        )
        const icon = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glyphTexture(`power-${capsule.power}`, def.glyph, '#ffffff'),
            transparent: true,
            depthWrite: false,
          }),
        )
        icon.scale.set(2.6, 2.6, 1)
        icon.position.z = 2
        group = new THREE.Group()
        group.add(shell, icon)
        this.effectLayer.add(group)
        this.capsules.set(capsule.id, group)
      }
      group.position.set(capsule.x, capsule.y, 4)
      group.rotation.y = capsule.spin
      group.rotation.z = Math.sin(capsule.spin) * 0.3
    }
    for (const [id, group] of this.capsules) {
      if (active.has(id)) continue
      this.effectLayer.remove(group)
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          child.material.dispose()
        }
        if (child instanceof THREE.Sprite) child.material.dispose()
      })
      this.capsules.delete(id)
    }
  }

  private syncBolts(game: Game): void {
    const active = new Set<number>()
    for (const bolt of game.bolts) {
      active.add(bolt.id)
      let mesh = this.bolts.get(bolt.id)
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, 4.4, 6),
          new THREE.MeshBasicMaterial({ color: bolt.hostile ? 0xff8fa3 : 0xffe066 }),
        )
        this.effectLayer.add(mesh)
        this.bolts.set(bolt.id, mesh)
      }
      mesh.position.set(bolt.x, bolt.y, 5)
      mesh.rotation.z = Math.atan2(bolt.vy, bolt.vx) - Math.PI / 2
      mesh.material.color.set(bolt.hostile ? 0xff8fa3 : bolt.piercing ? 0xa5f3fc : 0xffe066)
    }
    for (const [id, mesh] of this.bolts) {
      if (active.has(id)) continue
      this.effectLayer.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
      this.bolts.delete(id)
    }
  }

  private syncHazards(game: Game): void {
    const active = new Set<number>()
    for (const hazard of game.hazards) {
      active.add(hazard.id)
      let object = this.hazards.get(hazard.id)
      if (!object) {
        object = this.makeHazard(hazard)
        this.effectLayer.add(object)
        this.hazards.set(hazard.id, object)
      }
      if (hazard.kind === 'beam') {
        object.position.set(hazard.x, ARENA.top / 2, 1)
        const mesh = object as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>
        mesh.scale.y = hazard.active ? 1 : 0.02
        mesh.material.opacity = hazard.active ? 0.85 : 0.14
        mesh.material.color.set(hazard.active ? 0xff4d6d : 0xffd166)
      } else {
        object.position.set(hazard.x, hazard.y, 4)
        object.rotation.x += 0.03
        object.rotation.y += 0.04
      }
      const mesh = object as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>
      if (mesh.material) mesh.material.opacity = hazard.kind === 'orb' ? 0.7 : 1
    }
    for (const [id, object] of this.hazards) {
      if (active.has(id)) continue
      this.effectLayer.remove(object)
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        object.material.dispose()
      }
      this.hazards.delete(id)
    }
  }

  private makeHazard(hazard: Hazard): THREE.Object3D {
    if (hazard.kind === 'mine') {
      return new THREE.Mesh(
        new THREE.IcosahedronGeometry(hazard.r, 0),
        new THREE.MeshBasicMaterial({ color: 0xff4d6d }),
      )
    }
    if (hazard.kind === 'orb') {
      return new THREE.Mesh(
        new THREE.SphereGeometry(hazard.r, 14, 10),
        new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.7, wireframe: false }),
      )
    }
    return new THREE.Mesh(
      new THREE.BoxGeometry(hazard.r * 2, ARENA.top + 10, 1),
      new THREE.MeshBasicMaterial({ color: 0xff4d6d, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending }),
    )
  }

  private syncBoss(game: Game, dt: number): void {
    if (!game.boss || game.boss.hp <= 0) {
      this.bossRing.visible = false
      return
    }
    const cores = game.bricks.filter((brick) => brick.alive && brick.bossPart === 'core')
    if (cores.length === 0) {
      this.bossRing.visible = false
      return
    }
    const x = cores.reduce((sum, brick) => sum + brick.x, 0) / cores.length
    const y = cores.reduce((sum, brick) => sum + brick.y, 0) / cores.length
    this.bossRing.visible = true
    this.bossRing.position.set(x, y, -2)
    this.bossRing.rotation.z += dt * 0.6
    this.bossRing.scale.setScalar(1 + Math.sin(game.time * 2) * 0.03 + (game.boss.telegraph > 0 ? 0.12 : 0))
    this.bossRing.material.opacity = game.boss.telegraph > 0 ? 0.95 : 0.4
  }

  private stepParticles(dt: number): void {
    for (let index = 0; index < this.particleCapacity; index += 1) {
      const life = this.particleLife[index] ?? 0
      if (life <= 0) continue
      const next = life - dt
      this.particleLife[index] = next
      const offset = index * 3
      if (next <= 0) {
        this.particlePositions[offset + 1] = -999
        continue
      }
      this.particlePositions[offset] = (this.particlePositions[offset] ?? 0) + (this.particleVelocity[offset] ?? 0) * dt
      this.particlePositions[offset + 1] =
        (this.particlePositions[offset + 1] ?? 0) + (this.particleVelocity[offset + 1] ?? 0) * dt
      this.particlePositions[offset + 2] =
        (this.particlePositions[offset + 2] ?? 0) + (this.particleVelocity[offset + 2] ?? 0) * dt
      this.particleVelocity[offset + 1] = (this.particleVelocity[offset + 1] ?? 0) - 55 * dt
    }
    this.particleGeometry.setDrawRange(0, this.particleCursor > this.particleCapacity ? this.particleCapacity : this.particleCursor)
    ;(this.particleGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
  }

  private stepDebris(dt: number): void {
    for (const piece of this.debris) {
      if (piece.life <= 0) continue
      piece.life -= dt
      if (piece.life <= 0) {
        piece.mesh.visible = false
        continue
      }
      piece.vy -= 90 * dt
      piece.mesh.position.x += piece.vx * dt
      piece.mesh.position.y += piece.vy * dt
      piece.mesh.position.z += piece.vz * dt
      piece.mesh.rotation.x += piece.spin * dt
      piece.mesh.rotation.y += piece.spin * dt * 0.7
      piece.mesh.scale.multiplyScalar(1 - dt * 0.4)
    }
  }

  // --------------------------------------------------------------------- menu

  showMenu(palette: { sky: string; glow: string; accent: string; paddle: string; floor: string }): void {
    this.setPalette(palette)
    if (this.menuMode) return
    this.menuMode = true
    this.menuTime = 0
    this.paddle.visible = false
    this.clearBricks()
    this.bossRing.visible = false
    for (const [id, view] of this.balls) {
      this.scene.remove(view.group)
      view.ball.geometry.dispose()
      view.ball.material.dispose()
      this.balls.delete(id)
    }
    const colors = ['#4de1ff', '#f472b6', '#fde047', '#8ef0c8']
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const brick: Brick = {
          id: -1000 - (row * 7 + col),
          type: 'standard',
          x: (col - 3) * 11,
          y: 80 - row * 7.4,
          baseX: (col - 3) * 11,
          baseY: 80 - row * 7.4,
          w: 9.6,
          h: 6.4,
          hp: 1,
          maxHp: 1,
          alive: true,
          required: true,
          rotation: 0,
          offsetX: 0,
          offsetY: 0,
          moveAmp: 0,
          moveSpeed: 1,
          phase: 0,
          regenAt: 0,
          regenCount: 0,
          portal: 0,
          hitFlash: 0,
          bossPart: null,
        }
        const view = this.ensureBrick(brick)
        view.body.material.color.set(colors[(row + col) % colors.length]!)
        view.plate.material.emissive.set(colors[(row + col) % colors.length]!)
      }
    }
  }

  menu(dt: number): void {
    this.menuTime += dt
    const orbit = this.menuTime * 1.4
    let view = this.balls.get(-1)
    if (!view) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(2.2, 20, 16),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(this.palette.accent), emissiveIntensity: 2.6 }),
      )
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.ballHaloTexture, color: new THREE.Color(this.palette.accent), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }),
      )
      halo.scale.set(12, 12, 1)
      const group = new THREE.Group()
      group.add(mesh, halo)
      this.scene.add(group)
      view = { group, ball: mesh }
      this.balls.set(-1, view)
    }
    view.group.position.set(Math.sin(orbit) * 26, 66 + Math.cos(orbit * 0.7) * 13, 3)
    if (this.menuTime % 0.05 < dt) {
      this.spawnTrail(view.group.position.x, view.group.position.y, new THREE.Color(this.palette.accent))
    }
    this.stepParticles(dt)
    this.stepDebris(dt)
    for (let index = 0; index < this.trailColors.length; index += 1) {
      const value = this.trailColors[index] ?? 0
      if (value > 0.01) this.trailColors[index] = value * 0.94
    }
    ;(this.trailGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true
    this.background.rotation.z = Math.sin(this.menuTime * 0.1) * 0.02
    this.camera.position.set(0, 66, 190)
    this.camera.lookAt(0, 78, 0)
    this.renderer.render(this.scene, this.camera)
  }

  private makeGlowTexture(): THREE.Texture {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 62)
      gradient.addColorStop(0, 'rgba(255,255,255,1)')
      gradient.addColorStop(0.28, 'rgba(255,255,255,0.55)')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      context.fillStyle = gradient
      context.fillRect(0, 0, 128, 128)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  dispose(): void {
    this.clearBricks()
    for (const view of this.balls.values()) {
      view.ball.geometry.dispose()
      view.ball.material.dispose()
    }
    this.balls.clear()
    this.ballHaloTexture.dispose()
    for (const texture of this.glyphTextures.values()) texture.dispose()
    this.glyphTextures.clear()
    this.renderer.dispose()
  }
}

function elementColor(element: string): string {
  if (element === 'fire') return '#ff8a3d'
  if (element === 'ice') return '#8ed8ff'
  if (element === 'electric') return '#ffe066'
  if (element === 'heavy') return '#cbd5e1'
  if (element === 'ghost') return '#c4b5fd'
  return '#ffffff'
}
