[![best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/hurulsufi12-art/heist-game/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/hurulsufi12-art/heist-game/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

# Midnight at the Merah Museum

One night. One gem. No alarms.

Sari steals one thing a night, hurts no one, and never leaves a trace —
tonight it is the **Komet Biru**, a $5,000 gem in the vault of the fictional
Merah Museum in Kota Teluk Merah. Dodge three patrolling guards and their
vision cones, slip past three sweeping security cameras, grab the gem, and
reach the getaway van — before the alarm hits 100 and the museum seals shut.

## How to play

Open `game/index.html` in a browser (or serve it with `node serve.ts` and
open http://localhost:8080).

- **Move** — WASD / arrow keys
- **Sneak** — hold Shift (shorter detection range, slower)
- **Grab loot** — hold E near the Komet, the painting, or the mask
- **EMP** — press 1 (cameras offline 8s, +12 alarm)
- **Smoke** — press 2 (blocks all vision 5s, +5 alarm)
- **Coin** — click a spot, or press 3 to toss ahead (lures a guard 4s)
- **Pause** — P / Esc · **Restart** — R · **Mute** — M

Three routes reach the vault: the **Red Carpet** (fast, exposed), the
**West Corridor** (quiet, one patrolling guard), and the **East Wing**
(technical — camera timing, EMP or Smoke). Alarm 60 means HUNT: every
guard chases you. Alarm 100 means lockdown.

## Score

Loot value − 10 per second played − 5 per final alarm point. Coins you
carry slow you 3% each, so greed has a price.

## Structure

- `game/src/config.js` — every tuning constant
- `game/src/level.js` — floor plan: walls, cover, glass, loot spots
- `game/src/vision.js` — vision cones and line of sight
- `game/src/guards.js` — patrol, suspicion, chase/search/stun
- `game/src/cameras.js` — sweeps and EMP on/off
- `game/src/alarm.js` — the alarm meter and its thresholds
- `game/src/tools.js` — EMP / Smoke / Coin
- `game/src/loot.js` — loot, grab timing, coin slowdown
- `game/src/player.js` — Sari: movement, sneak, wall collision
- `game/src/game.js` — state machine, win/lose, score
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — WebAudio synth, no sound files
- `game/src/render.js` — everything you see
- `game/src/shots.js` — deterministic screenshot poses
- `main.ts` — hand-in program (Node 22 stdlib): copies `game/` and
  `screenshots/` to `/output` and writes `dossier.json`

No libraries, no external assets, no network requests — everything is drawn
and synthesised in code.

## License

MIT — see [LICENSE](LICENSE).
