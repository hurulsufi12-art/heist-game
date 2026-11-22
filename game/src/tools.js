// Tools: EMP charge, smoke bomb, coin toss. Counts, costs, effects.
// Pure logic; game.js applies the alarm costs and guard reactions.
import { CONFIG } from './config.js';

export function createTools() {
  return {
    emp: CONFIG.EMP_COUNT,
    smoke: CONFIG.SMOKE_COUNT,
    coin: CONFIG.COIN_COUNT,
    smokes: [], // {x, y, r, until}
    coins: [], // {x, y, until} landed coins (visual only)
    empUntil: -Infinity, // game time when cameras come back online
    empUsedAt: -Infinity,
    empReonlineCharged: true, // +5 alarm already charged for the current EMP cycle
  };
}

export function isEmpActive(tools, time) {
  return time < tools.empUntil;
}

export function useEmp(tools, time, playerPos) {
  if (tools.emp <= 0) return { ok: false, alarmCost: 0 };
  tools.emp -= 1;
  tools.empUsedAt = time;
  tools.empUntil = time + CONFIG.EMP_DURATION;
  tools.empReonlineCharged = false;
  return { ok: true, alarmCost: CONFIG.EMP_ALARM_COST, at: { x: playerPos.x, y: playerPos.y } };
}

export function useSmoke(tools, time, playerPos) {
  if (tools.smoke <= 0) return { ok: false, alarmCost: 0 };
  tools.smoke -= 1;
  tools.smokes.push({ x: playerPos.x, y: playerPos.y, r: CONFIG.SMOKE_RADIUS, until: time + CONFIG.SMOKE_DURATION });
  return { ok: true, alarmCost: CONFIG.SMOKE_ALARM_COST };
}

// Clicks further than 200px clamp to 200px in the click direction.
export function throwCoin(tools, playerPos, target) {
  if (tools.coin <= 0) return { ok: false, coin: null };
  const dx = target.x - playerPos.x, dy = target.y - playerPos.y;
  const dist = Math.hypot(dx, dy);
  let x, y;
  if (dist <= CONFIG.COIN_MAX_THROW || dist < 1e-9) { x = target.x; y = target.y; }
  else {
    x = playerPos.x + (dx / dist) * CONFIG.COIN_MAX_THROW;
    y = playerPos.y + (dy / dist) * CONFIG.COIN_MAX_THROW;
  }
  tools.coin -= 1;
  const coin = { x, y, until: 0 }; // visual marker; lure timing lives on the guard
  tools.coins.push(coin);
  return { ok: true, coin };
}

export function updateTools(tools, time) {
  tools.smokes = tools.smokes.filter((s) => time < s.until);
  return tools;
}

// True when point (x,y) sits inside any live smoke circle at game time.
export function smokeAt(tools, x, y, time) {
  return tools.smokes.some((s) => time < s.until && Math.hypot(x - s.x, y - s.y) <= s.r);
}
