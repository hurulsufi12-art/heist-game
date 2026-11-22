// Sari the thief: movement, sneak, wall collision, coin slowdown.
import { CONFIG } from './config.js';
import { moveCircle, resolveCircleOutOfSolids, SOLID_RECTS } from './level.js';
import { lootSpeedMultiplier } from './loot.js';

export function createPlayer() {
  return {
    x: CONFIG.SPAWN_X,
    y: CONFIG.SPAWN_Y,
    facing: -Math.PI / 2, // north, into the museum
    coins: 0,
    sneak: false,
  };
}

export function playerSpeed(player, sneak) {
  const base = sneak ? CONFIG.SNEAK_SPEED : CONFIG.PLAYER_SPEED;
  return base * lootSpeedMultiplier(player.coins || 0);
}

// input: {x, y} unit-ish direction. Moves axis-by-axis (slides along walls).
// inSmoke slows Sari to 70% while inside a smoke circle.
export function movePlayer(player, input, dt, solids, sneak, inSmoke = false) {
  const len = Math.hypot(input.x || 0, input.y || 0);
  if (len < 1e-9) return player;
  const nx = (input.x || 0) / len;
  const ny = (input.y || 0) / len;
  let speed = playerSpeed(player, sneak);
  if (inSmoke) speed *= CONFIG.SMOKE_SLOW;
  const moved = moveCircle(player.x, player.y, nx * speed * dt, ny * speed * dt, CONFIG.PLAYER_R, solids);
  player.x = moved.x;
  player.y = moved.y;
  player.facing = Math.atan2(ny, nx);
  return player;
}

export function resolvePlayer(player) {
  const fixed = resolveCircleOutOfSolids(player.x, player.y, CONFIG.PLAYER_R, SOLID_RECTS);
  player.x = fixed.x;
  player.y = fixed.y;
  return player;
}
