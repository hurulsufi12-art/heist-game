// Guards: patrol waypoints, suspicion, and the PATROL/SUSPICIOUS/CHASE/SEARCH/STUNNED
// state machine. Pure logic: explicit dt, no DOM, no clock, no randomness.
// Guards collide with walls/cover exactly like Sari (axis-separated slide),
// so a chasing guard cannot cut through the vault wall to the Komet.
import { CONFIG } from './config.js';
import { moveCircle, SOLID_RECTS } from './level.js';

export const GUARD_DEFS = [
  {
    name: 'Bimo', area: 'Main Gallery',
    waypoints: [{ x: 480, y: 180 }, { x: 880, y: 180 }, { x: 880, y: 500 }, { x: 480, y: 500 }],
    wait: 1.2, facingMode: 'move', start: { x: 480, y: 180 }, facing: 0,
  },
  {
    name: 'Raka', area: 'West Corridor',
    waypoints: [{ x: 140, y: 120 }, { x: 140, y: 600 }],
    wait: 1.5, facingMode: 'move', start: { x: 140, y: 120 }, facing: Math.PI / 2,
  },
  {
    name: 'Dewi', area: 'Vault',
    waypoints: [{ x: 1000, y: 380 }, { x: 1180, y: 380 }],
    wait: 1.0, facingMode: 'perp', start: { x: 1000, y: 380 }, facing: Math.PI / 2,
  },
];

function legFacing(guard, from, to) {
  if (guard.facingMode === 'perp') {
    // G3 faces perpendicular to motion: south while walking east, north while walking west.
    return to.x > from.x ? Math.PI / 2 : -Math.PI / 2;
  }
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function shortestTurn(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function createGuard(def) {
  return {
    name: def.name,
    area: def.area,
    waypoints: def.waypoints.map((w) => ({ ...w })),
    wait: def.wait,
    facingMode: def.facingMode,
    x: def.start.x,
    y: def.start.y,
    facing: def.facing,
    waypointIndex: 1, // heading for the second waypoint
    waitTimer: 0,
    waitFrom: def.facing,
    waitTo: def.facing,
    state: 'PATROL',
    suspicion: 0,
    lastSeen: { x: def.start.x, y: def.start.y },
    loseTimer: 0,
    searchTimer: 0,
    searchAngle: 0,
    graceTimer: 0,
    lure: null, // {x, y, timer} set by a coin toss
    hunt: false, // forced CHASE by the alarm HUNT state
  };
}

export function guardSpeedFor(state) {
  if (state === 'CHASE') return CONFIG.GUARD_CHASE_SPEED;
  if (state === 'SUSPICIOUS') return CONFIG.GUARD_SUSPICIOUS_SPEED;
  return CONFIG.GUARD_PATROL_SPEED;
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x, dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return true;
  const step = Math.min(dist, speed * dt);
  const moved = moveCircle(guard.x, guard.y, (dx / dist) * step, (dy / dist) * step, CONFIG.GUARD_R, SOLID_RECTS);
  guard.x = moved.x;
  guard.y = moved.y;
  return Math.hypot(tx - guard.x, ty - guard.y) < 0.5;
}

function enterChase(guard) {
  if (guard.state !== 'CHASE') {
    guard.state = 'CHASE';
    guard.graceTimer = CONFIG.SPOTTED_GRACE; // 0.8s fair warning
    guard.lure = null; // a live chase overrides any coin / investigation lure
  }
}

// One simulation step. ctx: { seen, playerPos, smokes, hunt, time }.
export function guardUpdate(guard, dt, ctx) {
  const { seen, playerPos, smokes = [], hunt = false } = ctx;
  if (guard.graceTimer > 0) guard.graceTimer = Math.max(0, guard.graceTimer - dt);

  // Smoke: a guard inside a smoke circle is STUNNED (cone off, frozen).
  const inSmoke = smokes.some((s) => Math.hypot(guard.x - s.x, guard.y - s.y) <= s.r);
  if (inSmoke && guard.state !== 'STUNNED') {
    guard.state = 'STUNNED';
    guard.stunPos = { x: guard.x, y: guard.y };
  }
  if (guard.state === 'STUNNED') {
    if (!inSmoke) {
      guard.state = 'SEARCH';
      guard.searchTimer = CONFIG.SEARCH_TIME;
      guard.lastSeen = guard.stunPos || { x: guard.x, y: guard.y };
    }
    return;
  }

  // A live sighting overrides any lure: chase the real Sari, not the coin.
  if (seen) guard.lure = null;

  // Suspicion: +40/s seen, -25/s unseen (frozen while CHASE); <80px jumps to 60.
  if (seen) {
    guard.suspicion += CONFIG.SUSPICION_UP * dt;
    guard.lastSeen = { x: playerPos.x, y: playerPos.y };
    guard.loseTimer = 0;
    if (Math.hypot(playerPos.x - guard.x, playerPos.y - guard.y) < CONFIG.SUSPICION_CLOSE_DIST) {
      guard.suspicion = Math.max(guard.suspicion, CONFIG.SUSPICION_CLOSE_VALUE);
    }
  } else if (guard.state !== 'CHASE') {
    guard.suspicion -= CONFIG.SUSPICION_DOWN * dt;
  }
  guard.suspicion = Math.max(0, Math.min(100, guard.suspicion));

  // State transitions from suspicion. Only PATROL/SUSPICIOUS take part:
  // a guard in SEARCH must finish searching (its suspicion is decaying),
  // otherwise it would flip CHASE->SEARCH every tick and reset its timer.
  if (guard.state === 'PATROL' || guard.state === 'SUSPICIOUS') {
    if (guard.suspicion >= CONFIG.SUSPICION_CHASE) enterChase(guard);
    else if (guard.suspicion >= CONFIG.SUSPICION_SUSPICIOUS && guard.state === 'PATROL') {
      guard.state = 'SUSPICIOUS';
    } else if (guard.suspicion < CONFIG.SUSPICION_SUSPICIOUS && guard.state === 'SUSPICIOUS' && !guard.lure) {
      // A lure (coin / camera / EMP investigation) keeps the guard
      // SUSPICIOUS until it reaches the point, even as suspicion decays.
      guard.state = 'PATROL';
    }
  }

  // HUNT (alarm >= 60): every guard chases the last seen position.
  guard.hunt = hunt;
  if (hunt && guard.state !== 'CHASE') {
    guard.state = 'CHASE';
    guard.suspicion = Math.max(guard.suspicion, CONFIG.SUSPICION_CHASE);
  }

  switch (guard.state) {
    case 'PATROL': {
      // Coin lure overrides the patrol route for a while.
      if (guard.lure) {
        guard.lure.timer -= dt;
        if (guard.lure.timer <= 0) { guard.lure = null; break; }
        const arrived = moveToward(guard, guard.lure.x, guard.lure.y, CONFIG.GUARD_SUSPICIOUS_SPEED, dt);
        guard.facing = Math.atan2(guard.lure.y - guard.y, guard.lure.x - guard.x);
        if (arrived) guard.lure.timer = Math.min(guard.lure.timer, 0.5);
        break;
      }
      patrolStep(guard, dt);
      break;
    }
    case 'SUSPICIOUS': {
      if (guard.lure) {
        guard.lure.timer -= dt;
        if (guard.lure.timer <= 0) { guard.lure = null; guard.state = 'PATROL'; break; }
        const arrived = moveToward(guard, guard.lure.x, guard.lure.y, CONFIG.GUARD_SUSPICIOUS_SPEED, dt);
        guard.facing = Math.atan2(guard.lure.y - guard.y, guard.lure.x - guard.x);
        if (arrived) guard.lure.timer = Math.min(guard.lure.timer, 0.5);
        break;
      }
      moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, CONFIG.GUARD_SUSPICIOUS_SPEED, dt);
      guard.facing = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
      break;
    }
    case 'CHASE': {
      const target = seen ? { x: playerPos.x, y: playerPos.y } : guard.lastSeen;
      moveToward(guard, target.x, target.y, CONFIG.GUARD_CHASE_SPEED, dt);
      guard.facing = Math.atan2(target.y - guard.y, target.x - guard.x);
      if (!seen) {
        guard.loseTimer += dt;
        if (guard.loseTimer >= CONFIG.CHASE_LOSE_TIME && !hunt) {
          guard.state = 'SEARCH';
          guard.searchTimer = CONFIG.SEARCH_TIME;
        }
      }
      break;
    }
    case 'SEARCH': {
      const arrived = moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, CONFIG.GUARD_PATROL_SPEED, dt);
      if (arrived) {
        guard.searchTimer -= dt;
        guard.searchAngle += dt * 1.5; // slow scan of the cone
        guard.facing = guard.searchAngle;
        if (guard.searchTimer <= 0) {
          guard.state = 'PATROL';
          guard.suspicion = 0;
          guard.waypointIndex = nearestWaypointIndex(guard);
        }
      } else {
        guard.facing = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
      }
      break;
    }
    default:
      break;
  }
}

function nearestWaypointIndex(guard) {
  let best = 0, bestD = Infinity;
  guard.waypoints.forEach((w, i) => {
    const d = Math.hypot(w.x - guard.x, w.y - guard.y);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function patrolStep(guard, dt) {
  if (guard.waitTimer > 0) {
    guard.waitTimer -= dt;
    // Rotate toward the next leg during the wait.
    const total = guard.wait;
    const done = Math.max(0, Math.min(1, 1 - guard.waitTimer / total));
    guard.facing = guard.waitFrom + shortestTurn(guard.waitFrom, guard.waitTo) * done;
    if (guard.waitTimer <= 0) {
      guard.waitTimer = 0;
      guard.facing = guard.waitTo;
    }
    return;
  }
  const target = guard.waypoints[guard.waypointIndex];
  const arrived = moveToward(guard, target.x, target.y, CONFIG.GUARD_PATROL_SPEED, dt);
  guard.facing = legFacing(guard, { x: guard.x, y: guard.y }, target);
  if (arrived) {
    const next = (guard.waypointIndex + 1) % guard.waypoints.length;
    const from = target;
    const to = guard.waypoints[next];
    guard.waitFrom = guard.facing;
    guard.waitTo = legFacing(guard, from, to);
    guard.waitTimer = guard.wait;
    guard.waypointIndex = next;
  }
}
