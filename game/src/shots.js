// Deterministic screenshot poses: build a game state, pose it, render one frame.
// No clock, no randomness: the same shot name + seed always renders the same frame.
// Unknown shot names fall back to 'cover'; a non-numeric seed defaults to 1.
import { createGame, beginPlaying } from './game.js';

const KNOWN_SHOTS = ['cover', 'alarm', 'tools', 'title'];

function poseGuard(game, i, x, y, facing, state = 'PATROL', suspicion = 0) {
  const g = game.guards[i];
  g.x = x; g.y = y; g.facing = facing;
  g.state = state; g.suspicion = suspicion;
  g.waitTimer = 0;
  g.lastSeen = { x, y };
  return g;
}

function poseCamera(game, i, angleDeg) {
  game.cameras[i].angleOverrideDeg = angleDeg;
}

export function buildShotGame(shot, seed) {
  const name = KNOWN_SHOTS.includes(shot) ? shot : 'cover';
  const s = Number(seed);
  const seedNum = Number.isFinite(s) ? s : 1;
  void seedNum; // poses are fixed; the seed only pins the call signature
  const game = createGame();
  beginPlaying(game);

  if (name === 'title') {
    game.state = 'TITLE';
    game.time = 0;
    return { shotName: name, game };
  }

  if (name === 'cover') {
    // Binding pose (PLAN §11): Sari mid-gallery, Bimo's cone edge touching her,
    // Dewi guarding the vault door, Raka in the west corridor, all three cameras
    // visible, Komet glowing, alarm 42, one coin already taken, 00:47 on the clock.
    game.time = 47;
    game.player.x = 640; game.player.y = 420; game.player.facing = -Math.PI / 2;
    poseGuard(game, 0, 560, 300, Math.PI / 4, 'PATROL', 12); // Bimo, facing south-east
    poseGuard(game, 1, 140, 300, 0, 'PATROL', 0); // Raka, facing east
    poseGuard(game, 2, 1080, 380, Math.PI / 2, 'PATROL', 0); // Dewi, facing south
    poseCamera(game, 0, 30); // CAM 1 sweeping toward Sari
    poseCamera(game, 1, 0); // CAM 2 fixed south
    poseCamera(game, 2, -20); // CAM 3
    game.alarm.value = 42;
    const coin = game.loot.find((l) => l.id === 'coin1');
    coin.taken = true;
    game.player.coins = 1;
    return { shotName: name, game };
  }

  if (name === 'alarm') {
    // Spotted in Dewi's red cone: Sari inside it, SPOTTED! banner, alarm 68 (HUNT).
    game.time = 83;
    game.player.x = 1020; game.player.y = 420; game.player.facing = -Math.PI / 2;
    poseGuard(game, 0, 700, 180, Math.PI / 2, 'PATROL', 0);
    poseGuard(game, 1, 140, 500, -Math.PI / 2, 'PATROL', 0);
    const dewi = poseGuard(game, 2, 1080, 380, Math.PI / 2, 'CHASE', 85);
    dewi.lastSeen = { x: 1020, y: 420 };
    dewi.graceTimer = 0.4;
    poseCamera(game, 0, -30);
    poseCamera(game, 1, 0);
    poseCamera(game, 2, 20);
    game.alarm.value = 68;
    game.huntActive = true;
    game.spottedTimer = 0.8;
    game.spottedName = 'Dewi';
    return { shotName: name, game };
  }

  // tools: smoke in the East Wing, CAM 3 blind, CAM 1 OFF, coin luring Raka.
  game.time = 112;
  game.player.x = 920; game.player.y = 560; game.player.facing = -Math.PI / 2;
  poseGuard(game, 0, 700, 300, Math.PI, 'PATROL', 0);
  const raka = poseGuard(game, 1, 260, 340, Math.PI / 4, 'SUSPICIOUS', 35);
  raka.lure = { x: 300, y: 320, timer: 3 };
  raka.lastSeen = { x: 300, y: 320 };
  poseGuard(game, 2, 1080, 380, Math.PI / 2, 'PATROL', 0);
  poseCamera(game, 0, 10);
  poseCamera(game, 1, 0);
  poseCamera(game, 2, 0);
  game.tools.emp = 1;
  game.tools.empUntil = game.time + 6; // EMP used 2s ago: CAM 1 OFF 6s
  game.tools.empUsedAt = game.time - 2;
  game.tools.smoke = 2;
  game.tools.smokes = [{ x: 920, y: 560, r: 90, until: game.time + 4 }];
  game.tools.coin = 2;
  game.tools.coins = [{ x: 300, y: 320, until: 0 }];
  game.alarm.value = 24;
  const coin = game.loot.find((l) => l.id === 'coin2');
  coin.taken = true;
  game.player.coins = 1;
  return { shotName: name, game };
}
