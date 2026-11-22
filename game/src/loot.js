// Loot: the Komet Biru, optional painting/mask/coins, grab timing, coin slowdown.
import { CONFIG } from './config.js';

export function createLoot() {
  return [
    { id: 'komet', name: 'Komet Biru', x: 1120, y: 140, value: CONFIG.KOMET_VALUE, grabTime: CONFIG.KOMET_GRAB_TIME, alarmCost: CONFIG.KOMET_ALARM_COST, taken: false, progress: 0 },
    { id: 'painting', name: 'Senja di Teluk', x: 180, y: 240, value: CONFIG.PAINTING_VALUE, grabTime: CONFIG.PAINTING_GRAB_TIME, alarmCost: 0, taken: false, progress: 0 },
    { id: 'mask', name: 'Topeng Emas', x: 920, y: 440, value: CONFIG.MASK_VALUE, grabTime: CONFIG.MASK_GRAB_TIME, alarmCost: 0, taken: false, progress: 0 },
    { id: 'coin1', name: 'Koin Kolektor', x: 560, y: 480, value: CONFIG.COIN_VALUE, grabTime: 0, alarmCost: 0, taken: false, progress: 0 },
    { id: 'coin2', name: 'Koin Kolektor', x: 760, y: 480, value: CONFIG.COIN_VALUE, grabTime: 0, alarmCost: 0, taken: false, progress: 0 },
    { id: 'coin3', name: 'Koin Kolektor', x: 640, y: 640, value: CONFIG.COIN_VALUE, grabTime: 0, alarmCost: 0, taken: false, progress: 0 },
  ];
}

// Each coin carried costs 3% speed (normal and sneak alike).
export function lootSpeedMultiplier(coins) {
  return 1 - CONFIG.COIN_SPEED_PENALTY * Math.max(0, Math.min(3, coins));
}

export function totalLootValue(loot) {
  return loot.reduce((sum, l) => sum + (l.taken ? l.value : 0), 0);
}

export function coinsCarried(loot) {
  return loot.filter((l) => l.taken && l.id.startsWith('coin')).length;
}

export function nearestLoot(loot, x, y, radius) {
  let best = null, bestD = radius;
  for (const l of loot) {
    if (l.taken) continue;
    const d = Math.hypot(l.x - x, l.y - y);
    if (d <= bestD) { bestD = d; best = l; }
  }
  return best;
}

const GRAB_RADIUS = 48;
const COIN_RADIUS = 26;

// One step of looting. Coins are picked up on touch; the rest need E held.
// Returns { grabbed, progress, alarmCost } for the item being worked on.
export function updateLootGrab(loot, dt, holdingE, playerPos) {
  // Coins first: instant on touch.
  for (const l of loot) {
    if (!l.taken && l.grabTime === 0 && Math.hypot(l.x - playerPos.x, l.y - playerPos.y) <= COIN_RADIUS) {
      l.taken = true;
      return { grabbed: l, progress: 1, alarmCost: 0 };
    }
  }
  const target = nearestLoot(loot, playerPos.x, playerPos.y, GRAB_RADIUS);
  if (!target || target.grabTime === 0) {
    for (const l of loot) if (!l.taken && l.grabTime > 0) l.progress = 0;
    return { grabbed: null, progress: 0, alarmCost: 0 };
  }
  if (holdingE) {
    target.progress += dt / target.grabTime;
    if (target.progress >= 1 - 1e-6) { // float-safe: 90 ticks of 1/60 can sum to 0.9999999
      target.progress = 1;
      target.taken = true;
      return { grabbed: target, progress: 1, alarmCost: target.alarmCost };
    }
    return { grabbed: null, progress: target.progress, alarmCost: 0 };
  }
  target.progress = 0;
  return { grabbed: null, progress: 0, alarmCost: 0 };
}
