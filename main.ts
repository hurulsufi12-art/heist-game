// Hand-in program for "Midnight at the Merah Museum" (Node 22, standard
// library only). The game is the plain static folder game/ beside this file
// — an index.html plus ES modules, no library, no network request — and this
// program hands it in: it copies game/ and screenshots/ to /output and
// writes /output/dossier.json, the summary the judge reads, using the
// vendored make.fun library. Run it with `node main.ts`; outside the
// grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The directory this file lives in, and the hand-in directory: /output
// inside the grader, or MAKEFUN_OUTPUT_DIR when set (local runs, tests).
const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy the game first: every file under game/ goes to /output/game as-is,
// so the judge plays exactly what the repo holds. Screenshots ride along
// only when they exist — a fresh checkout may not have them yet.
mkdirSync(out, { recursive: true });
const gameDir = join(here, 'game');
if (!existsSync(gameDir)) {
  throw new Error(`main.ts: no game/ beside this file (looked in ${gameDir}) — nothing to hand in`);
}
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse — more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files in all; or a path under game/ over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
