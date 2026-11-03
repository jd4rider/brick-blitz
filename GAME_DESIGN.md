# Brick Blitz — game design

## The loop

Drag to place the paddle. Launch. Read the ball, not the trail. Every brick
destroyed inside three seconds extends the combo; the combo multiplies the
score rather than the damage, so a long rally pays without trivialising the
wall. Clear the objective, take the stars, spend credits on cosmetics, repeat.

The game is played on a logical plane. Screen size changes the camera framing,
never the physics.

## Scoring and stars

| Event | Points |
| --- | --- |
| Brick | 50–240 by type |
| Combo bonus | +2% per consecutive brick, capped at +60% |
| Score Multiplier pickup | ×2 while active |
| Capsule | 1 credit; Jackpot 750 points + 150 credits |
| Level clear | 400 + level index × 6 |
| Remaining lives | 220 each (not in Zen) |

Stars are score thresholds derived from the level's own brick count:
1 star for clearing, 2 at ~92% of par, 3 at ~135% of par. Time is never scored,
so a careful player is not punished. Credits are awarded at 40 + 25/star +
score/600.

## Modes

- **Campaign** — 500 levels; progression is linear, worlds unlock by beating
  the previous world's boss.
- **Endless** — generated waves, score carries, best wave saved.
- **Survival** — two lives, each wave 3.5% faster, best wave saved.
- **Boss Rush** — the ten bosses in order, score carries.
- **Daily** — one level per UTC day, identical for everyone with this build.
- **Zen** — one generated level, unlimited lives, no pressure.
- **Challenges** — One Ball, No Power-Ups, Speed Run, Precision Paddle,
  Explosive Bricks, Multiball Madness, Laser, Survival Gauntlet.

## Worlds

| # | World | Boss | Mechanic introduced |
| --- | --- | --- | --- |
| 1 | Arcade Awakening | Brick Titan | Aiming, reinforced bricks |
| 2 | Neon Nights | Neon Serpent | Moving and sliding bricks |
| 3 | Crystal Caverns | Crystal Colossus | Shields, mirrors, regeneration |
| 4 | Inferno Factory | Inferno Engine | Explosions and chain reactions |
| 5 | Frozen Frontier | Frost Fortress | Frozen bricks, hazards |
| 6 | Electric Avenue | Volt Overlord | Switches, colour locks |
| 7 | Gravity Galaxy | Gravity Core | Gravity and magnets |
| 8 | Phantom Dimension | Phantom Matrix | Portals, mystery bricks |
| 9 | Iron Dominion | Iron Citadel | Armoured cores, boss plating |
| 10 | Ultimate Blitz | The Blitz King | Everything at once |

The first twenty levels are hand-authored (ASCII art in `src/levels/generate.ts`)
and teach one idea each. Beyond that, formations are seeded from the level ID:
rows, pyramid, diamond, checker, rings, maze, columns, arch, wave, scatter and
fortress.

## Bricks (25)

Standard, Reinforced, Steel, Bulkhead (solid), Blast Cap, Chain Bomb,
Regenerator, Drifter, Slider, Spinner, Shielded, Colour Lock, Switch, Portal,
Mirror, Splitter, Frozen, Capacitor, Toxic, Treasure, Mystery, Gravity Well,
Magnet, Armoured Core, Boss Shield.

Rules worth knowing:

- **Bulkheads** never break and are never required. They shape shots and can be
  opened wholesale by destroying a Switch.
- **Shielded** ignores the ball; fire or a blast burns the shield off.
- **Colour Lock** only takes electric damage or a blast.
- **Armoured Core** only takes damage near its glowing centre.
- **Boss Shield** plating protects the core; break the plating first.
- **Rotating** bricks rotate visually but keep an axis-aligned hitbox. This is
  a deliberate readability choice: a rotating hitbox on a phone produces hits
  the player cannot predict.
- **Regenerator** returns up to three times, six and a half seconds apart.

## Power-ups (40)

Positive: Wide, Mega, Multiball, Super Multiball, Laser, Rapid Laser, Fireball,
Ice Ball, Electric Ball, Heavy Ball, Ghost Ball, Sticky, Magnetic, Safety Net,
Double Safety Net, Slow Motion, Speed Boost, Extra Life, Shield Paddle, Bomb,
Mega Bomb, Missile Launcher, Drone, Double Drone, Ball Clone, Score Multiplier,
Coin Magnet, Time Freeze, Repair, Piercing Shot, Chain Reaction, Portal Ball,
Rainbow Ball, Jackpot.

Negative (red-ringed chips, clearly telegraphed): Tiny Paddle, Gravity Shift,
Reverse Controls, Paddle Jam, Blackout, Brick Regen.

Conflict resolution is deterministic:

1. Paddle width: **tiny > mega > wide**, then clamped 8–34.
2. Ball element: rainbow cycles every 2.5s, otherwise
   **fire > electric > ice > heavy > ghost**.
3. Ball speed: slow motion (×0.68), speed boost (×1.18), heavy (×0.94), clamped
   to 42–132 units/s.
4. Ball count is capped at 12, so multiball cannot flood the device.
5. Durations refresh to the longer remaining time; they never stack.

## Bosses

Each boss is a formation brick structure: shield plating on top, a row of
armoured plates, and two to six core bricks. Damage the core only after the
plating is gone. Health phases at 66% and 33% shorten the attack timer.

Bosses telegraph for 0.85s before every attack, and the arena ring turns solid
during the warning. The ten bosses share an attack vocabulary but have distinct
schedules and palettes; the final boss cycles six attacks across three phases.
No boss requires a specific power-up.

## Accessibility

- Every special brick carries a glyph, not just a colour.
- High-contrast mode raises emissive intensity.
- Reduced-motion setting disables shake (and CSS animations respect the OS
  setting).
- Keyboard-only play is possible; paddling also works with mouse.
- Invert controls is available because drag direction is personal.
- The ball is always drawn above every effect, in every mode.
