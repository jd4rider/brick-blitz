# Brick Blitz

A portrait-first, Three.js brick-breaker for Little Joy Arcade.
**Smash the wall. Catch the chaos.**

Production target: <https://brickblitz.littlejoyarcade.site>
Build: <https://jd4rider.github.io/brick-blitz/play/>

## What it is

A deterministic arcade simulation rendered in real 3D. The playfield is a
logical 2D plane (−50…50 × 0…150) so a phone, a tablet and a desktop all get
the same physics; Three.js provides the depth, lighting and destruction.

- **500 campaign levels** across 10 worlds of 50, ending in a boss per world.
- **25 brick types**: shields, locks, portals, mirrors, magnets, gravity wells,
  switch-operated bulkheads, regenerating and sliding bricks, armoured cores.
- **40 power-ups**, including bad ones. Paddle sizes resolve by precedence
  (tiny beats mega), ball-swarm size is capped, speed is capped.
- **10 bosses** with three health phases and a shared, telegraphed attack
  vocabulary (rain, spread, nova, sweep, shields, summons, gravity, teleport).
- **Modes**: Campaign, Endless, Survival, Boss Rush, Daily, Zen, and eight
  Challenge modifiers.
- **Progression**: stars, best scores, credits, 12 achievements, cosmetics,
  versioned offline saves.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # physics, power-ups, campaign (21 tests)
npm run check:levels # validates all 500 levels, writes reports/
npm run build        # type-check + production build
npm run preview      # serve dist/
```

Node 20.19+ or 22.12+ (Vite 7).

## Controls

| Action | Touch | Desktop |
| --- | --- | --- |
| Move paddle | Drag anywhere in the lower screen | Mouse, ← →, A/D |
| Launch | LAUNCH button or tap | Space |
| Fire lasers | FIRE button | Space |
| Pause | Pause button | Escape |
| Restart | Pause menu | R |

Aiming is positional: the ball leaves the paddle at up to ±60° depending on
where it lands, with a small amount of paddle-velocity spin.

## Verification, precisely

Run and passing on this build:

- `npm test` — 21 tests: swept collision including a single step covering 1,000
  units, no tunnelling through a thin brick, wall reflection, paddle edge vs
  centre aiming, arena clamping, paddle-size precedence, ball cap, speed cap,
  life cap, run-to-run determinism (`stateHash`), 500 levels, ten worlds × 50,
  boss at every 50th level, tutorials, reproducibility, brick budget, rejection
  of out-of-grid bricks and core-less bosses, daily determinism.
- `npm run check:levels` — 500/500 VERIFIED, 10 worlds × 50, 10 bosses, largest
  level 82 bricks. Report in `reports/level-validation.json`.
- `node scripts/smoke.mjs` — real Chromium at 390 × 844: menu, world select,
  50 level tiles, touch-drag paddle movement, launch, multiball, pause/resume,
  victory screen, next level.

Not claimed:

- Level validation is **structural** (placement, objective consistency, boss
  parts, performance budget). It does not prove a level is winnable; no static
  checker can prove that for a physics game. Levels are not labelled "proven".
- The game has **not** been tested on physical phones, only Chromium device
  emulation, plus a desktop-width pass.
- Endless and Survival chain generated levels rather than presenting one
  continuous arena; difficulty rises with the wave.
- Bloom is faked with additive sprites and emissive materials. There is no
  `UnrealBloomPass`, which keeps the mobile frame budget predictable.
- Rotating bricks rotate visually while keeping an axis-aligned hitbox. This is
  deliberate and documented in `GAME_DESIGN.md`.

## Save format

`localStorage['brick-blitz-save-v1']`, version 2:

```json
{
  "version": 2,
  "stars": { "bb-001": 3 },
  "scores": { "bb-001": 8420 },
  "credits": 640,
  "unlocked": ["chrome", "plasma", "spark", "neon"],
  "paddle": "neon",
  "ball": "plasma",
  "trail": "spark",
  "achievements": ["first-clear"],
  "daily": { "date": "2026-11-02", "score": 5210, "done": true },
  "settings": { "sound": true, "music": true, "motion": true, "quality": "high", "highContrast": false, "invert": false },
  "lastLevel": 12
}
```

Corrupt or partial payloads are repaired field by field; a parse error never
wipes the campaign silently.

## Documents

- `GAME_DESIGN.md` — loop, scoring, worlds, bosses, brick and power-up rules.
- `DEPLOYMENT.md` — Pages, arcade publishing, custom domain.
