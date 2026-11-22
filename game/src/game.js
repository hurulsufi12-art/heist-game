// Game orchestration: state machine, per-tick update order, win/lose, score.
// Pure logic: explicit dt and game time, no DOM, no clock, no randomness.
import { CONFIG } from './config.js';
import { VISION_BLOCKERS, GETAWAY, SOLID_RECTS } from './level.js';
import { isVisible, cameraSeesPlayer } from './vision.js';
import { createGuard, guardUpdate, GUARD_DEFS } from './guards.js';
import { createCameras, isCameraOnline } from './cameras.js';
import { createAlarm, alarmUpdate, alarmLabel } from './alarm.js';
import { createTools, useEmp, useSmoke, throwCoin, updateTools, smokeAt, isEmpActive } from './tools.js';
import { createLoot, updateLootGrab, totalLootValue, coinsCarried } from './loot.js';
import { createPlayer, movePlayer, resolvePlayer, playerSpeed } from './player.js';

export function createGame() {
  return {
    state: 'TITLE', // TITLE -> BRIEFING -> PLAYING -> PAUSED / CAUGHT / GETAWAY
    time: 0,
    player: createPlayer(),
    guards: GUARD_DEFS.map(createGuard),
    cameras: createCameras(),
    alarm: createAlarm(),
    tools: createTools(),
    loot: createLoot(),
    huntActive: false,
    camSeen: [0, 0, 0],
    lastSeenPos: { x: CONFIG.SPAWN_X, y: CONFIG.SPAWN_Y },
    spottedTimer: 0,
    spottedName: null,
    cause: null,
    score: 0,
    emptyHanded: false,
    wasAtDoor: true, // Sari starts at the door; no empty-handed toast until she returns
    message: null,
    messageTimer: 0,
    grabInfo: { progress: 0, item: null },
    muted: false,
  };
}

export function beginPlaying(game) {
  game.state = 'PLAYING';
  game.time = 0;
  return game;
}

export function resetGame(game) {
  const fresh = createGame();
  for (const k of Object.keys(fresh)) game[k] = fresh[k];
  beginPlaying(game);
  return game;
}

// Final score: loot - 10 * full seconds played - 5 * final alarm, never negative.
export function computeScore(lootValue, seconds, alarm) {
  return Math.max(0, lootValue - 10 * Math.floor(seconds) - 5 * Math.round(alarm));
}

function nearestGuard(game, x, y) {
  let best = null, bestD = Infinity;
  for (const g of game.guards) {
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < bestD) { bestD = d; best = g; }
  }
  return best;
}

function alertGuardTo(guard, pos) {
  if (guard.state === 'CHASE' || guard.state === 'STUNNED') return;
  guard.state = 'SUSPICIOUS';
  // 45 survives suspicion decay long enough to walk to the point; the lure
  // keeps the guard SUSPICIOUS until it arrives (see guards.js).
  guard.suspicion = Math.max(guard.suspicion, 45);
  guard.lastSeen = { x: pos.x, y: pos.y };
  guard.lure = { x: pos.x, y: pos.y, timer: 30 };
}

export function updateGame(game, input = {}, dt = 1 / 60) {
  dt = Math.max(0, Math.min(CONFIG.MAX_DT, dt));
  if (dt === 0) return game;

  // --- meta states ---
  if (game.state === 'PAUSED') {
    if (input.pause) game.state = 'PLAYING';
    if (input.restart) resetGame(game);
    return game;
  }
  if (game.state === 'TITLE') {
    if (input.start) game.state = 'BRIEFING';
    return game;
  }
  if (game.state === 'BRIEFING') {
    if (input.start) beginPlaying(game);
    if (input.restart) resetGame(game);
    return game;
  }
  if (game.state === 'CAUGHT' || game.state === 'GETAWAY') {
    if (input.restart) resetGame(game);
    return game;
  }
  if (input.pause) { game.state = 'PAUSED'; return game; }
  if (input.restart) { resetGame(game); return game; }
  if (input.mute) game.muted = !game.muted;

  // --- PLAYING ---
  const alarmBefore = game.alarm.value;
  game.time += dt;
  if (game.spottedTimer > 0) game.spottedTimer = Math.max(0, game.spottedTimer - dt);
  if (game.messageTimer > 0) {
    game.messageTimer -= dt;
    if (game.messageTimer <= 0) game.message = null;
  }
  updateTools(game.tools, game.time);

  let instantAlarm = 0;

  // --- tools (one-shot flags) ---
  if (input.emp) {
    const r = useEmp(game.tools, game.time, game.player);
    if (r.ok) {
      instantAlarm += r.alarmCost;
      const g = nearestGuard(game, game.player.x, game.player.y);
      if (g) alertGuardTo(g, { x: game.player.x, y: game.player.y });
    }
  }
  if (input.smoke) {
    const r = useSmoke(game.tools, game.time, game.player);
    if (r.ok) instantAlarm += r.alarmCost;
  }
  if (input.coin) {
    const r = throwCoin(game.tools, game.player, input.coin);
    if (r.ok) {
      for (const g of game.guards) {
        if ((g.state === 'PATROL' || g.state === 'SUSPICIOUS') &&
            Math.hypot(g.x - r.coin.x, g.y - r.coin.y) <= CONFIG.COIN_LURE_RADIUS) {
          g.lure = { x: r.coin.x, y: r.coin.y, timer: CONFIG.COIN_LURE_TIME };
          if (g.state === 'PATROL') {
            g.state = 'SUSPICIOUS';
            g.suspicion = Math.max(g.suspicion, CONFIG.SUSPICION_SUSPICIOUS);
          }
        }
      }
    }
  }

  // --- movement ---
  let mx = 0, my = 0;
  if (input.move) { mx = input.move.x || 0; my = input.move.y || 0; }
  else {
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
  }
  const sneak = !!input.sneak;
  game.player.sneak = sneak;
  const inSmoke = smokeAt(game.tools, game.player.x, game.player.y, game.time);
  movePlayer(game.player, { x: mx, y: my }, dt, SOLID_RECTS, sneak, inSmoke);
  resolvePlayer(game.player);

  // --- loot ---
  game.player.coins = coinsCarried(game.loot);
  const grab = updateLootGrab(game.loot, dt, !!input.interact, game.player);
  game.player.coins = coinsCarried(game.loot);
  game.grabInfo = { progress: grab.progress, item: grab.grabbed ? grab.grabbed.id : (grab.progress > 0 ? nearestGrabTarget(game) : null) };
  if (grab.grabbed) {
    instantAlarm += grab.alarmCost;
    if (grab.grabbed.id === 'komet') {
      // Grabbing the Komet alerts every guard to the vault.
      for (const g of game.guards) alertGuardTo(g, { x: 1120, y: 140 });
      game.lastSeenPos = { x: 1120, y: 140 };
    }
  }

  // --- visibility: guards ---
  const smokes = game.tools.smokes;
  const seenBy = [];
  for (const g of game.guards) {
    const seen = g.state !== 'STUNNED' &&
      isVisible(g.x, g.y, g.facing, game.player.x, game.player.y,
        CONFIG.CONE_RANGE, CONFIG.CONE_HALF_DEG, VISION_BLOCKERS, { sneak, smokes });
    seenBy.push(seen);
    if (seen) game.lastSeenPos = { x: game.player.x, y: game.player.y };
  }

  // --- visibility: cameras ---
  const camSeenNow = [];
  for (let i = 0; i < game.cameras.length; i++) {
    const cam = game.cameras[i];
    const sees = cameraSeesPlayer(cam, game.player, game.time, VISION_BLOCKERS, smokes, game.tools.empUntil);
    camSeenNow.push(sees);
    if (sees) {
      game.camSeen[i] += dt;
      game.lastSeenPos = { x: game.player.x, y: game.player.y };
      if (game.camSeen[i] >= CONFIG.CAMERA_ALERT_TIME) {
        const g = nearestGuard(game, game.player.x, game.player.y);
        if (g) alertGuardTo(g, { x: game.player.x, y: game.player.y });
        game.camSeen[i] = 0;
      }
    } else {
      game.camSeen[i] = 0;
    }
  }

  // --- guards step (suspicion, states, patrol/chase movement) ---
  for (let i = 0; i < game.guards.length; i++) {
    const g = game.guards[i];
    const prevState = g.state;
    guardUpdate(g, dt, { seen: seenBy[i], playerPos: game.player, smokes, hunt: game.huntActive });
    if (prevState !== 'CHASE' && g.state === 'CHASE') {
      game.spottedTimer = CONFIG.SPOTTED_GRACE;
      game.spottedName = g.name;
    }
  }

  // --- alarm: sources SUM; EMP re-online charges +5 once ---
  if (game.tools.empUsedAt > -Infinity && game.time >= game.tools.empUntil && !game.tools.empReonlineCharged) {
    instantAlarm += CONFIG.EMP_REONLINE_ALARM;
    game.tools.empReonlineCharged = true;
  }
  const rates = [];
  for (let i = 0; i < game.guards.length; i++) {
    if (!seenBy[i]) continue;
    const st = game.guards[i].state;
    if (st === 'CHASE') rates.push(CONFIG.ALARM_CHASE_RATE);
    else if (st === 'SUSPICIOUS' || st === 'SEARCH') rates.push(CONFIG.ALARM_SUSPICIOUS_RATE);
    else rates.push(CONFIG.ALARM_PATROL_RATE);
  }
  for (let i = 0; i < game.cameras.length; i++) if (camSeenNow[i]) rates.push(CONFIG.CAMERA_ALARM_RATE);
  alarmUpdate(game.alarm, dt, rates, instantAlarm);

  // --- HUNT with hysteresis: on at >=60, off below 50 ---
  if (game.huntActive) {
    if (game.alarm.value < CONFIG.ALARM_HUNT_OFF) game.huntActive = false;
  } else if (alarmBefore >= CONFIG.ALARM_HUNT_ON || game.alarm.value >= CONFIG.ALARM_HUNT_ON) {
    game.huntActive = true;
  }
  if (game.huntActive) {
    for (const g of game.guards) {
      if (g.state === 'STUNNED') continue;
      if (g.state !== 'CHASE') {
        g.state = 'CHASE';
        g.suspicion = Math.max(g.suspicion, CONFIG.SUSPICION_CHASE);
        game.spottedTimer = Math.max(game.spottedTimer, CONFIG.SPOTTED_GRACE);
        game.spottedName = game.spottedName || g.name;
      }
      g.lastSeen = { ...game.lastSeenPos };
    }
  }

  // --- touch: a non-CHASE guard touching Sari spots her; a CHASE guard catches (after grace) ---
  for (const g of game.guards) {
    const d = Math.hypot(g.x - game.player.x, g.y - game.player.y);
    if (d >= CONFIG.CATCH_DIST) continue;
    if (g.state === 'CHASE') {
      if (g.graceTimer <= 0) {
        game.state = 'CAUGHT';
        game.cause = `${g.name} caught you in the ${g.area}`;
        return game;
      }
    } else if (g.state !== 'STUNNED') {
      g.suspicion = Math.max(g.suspicion, CONFIG.SUSPICION_CHASE);
      if (g.state !== 'CHASE') {
        g.state = 'CHASE';
        g.graceTimer = CONFIG.SPOTTED_GRACE;
        game.spottedTimer = CONFIG.SPOTTED_GRACE;
        game.spottedName = g.name;
      }
      g.lastSeen = { x: game.player.x, y: game.player.y };
    }
  }

  // --- getaway (catch is checked first, above) ---
  const doorDist = Math.hypot(game.player.x - GETAWAY.x, game.player.y - GETAWAY.y);
  if (doorDist <= CONFIG.GETAWAY_RADIUS) {
    const komet = game.loot.find((l) => l.id === 'komet');
    if (komet && komet.taken) {
      game.state = 'GETAWAY';
      game.score = computeScore(totalLootValue(game.loot), game.time, game.alarm.value);
      return game;
    }
    if (!game.wasAtDoor) {
      game.emptyHanded = true;
      game.message = 'You left empty-handed — the Komet Biru is still inside';
      game.messageTimer = 3;
    }
    game.wasAtDoor = true;
  } else {
    game.wasAtDoor = false;
  }

  // --- lockdown: alarm 100 ends the night instantly ---
  // (alarmBefore: decay must not let a 100 alarm slip under the bar this tick)
  if (game.alarm.value >= 100 || alarmBefore >= 100) {
    game.state = 'CAUGHT';
    game.cause = 'Lockdown — the museum sealed shut';
    return game;
  }

  return game;
}

function nearestGrabTarget(game) {
  let best = null, bestD = 48;
  for (const l of game.loot) {
    if (l.taken || l.grabTime === 0) continue;
    const d = Math.hypot(l.x - game.player.x, l.y - game.player.y);
    if (d <= bestD) { bestD = d; best = l.id; }
  }
  return best;
}

export { alarmLabel, playerSpeed };
