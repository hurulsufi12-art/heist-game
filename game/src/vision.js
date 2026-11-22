// Vision cones and line-of-sight: pure geometry, no DOM, no clock.
import { CONFIG } from './config.js';
import { pointInRect, segmentClear } from './level.js';

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

// True when (tx,ty) lies inside the cone: range and half-angle are INCLUSIVE.
export function isInCone(ox, oy, facing, tx, ty, range, halfAngleDeg) {
  const dx = tx - ox, dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range + 1e-6) return false;
  if (dist < 1e-9) return true;
  const targetAngle = Math.atan2(dy, dx);
  return angleDiff(targetAngle, facing) <= (halfAngleDeg * Math.PI) / 180 + 1e-9;
}

function segmentHitsSmoke(x1, y1, x2, y2, smokes) {
  if (!smokes) return false;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    for (const s of smokes) {
      if (Math.hypot(x - s.x, y - s.y) <= s.r) return true;
    }
  }
  return false;
}

export function lineOfSightClear(x1, y1, x2, y2, blockers, smokes = []) {
  // A camera is mounted inside its own wall: ignore any blocker that
  // contains the observer's eye, or its own wall would blind it.
  const relevant = blockers.filter((r) => !pointInRect(x1, y1, r));
  if (!segmentClear(x1, y1, x2, y2, relevant)) return false;
  if (segmentHitsSmoke(x1, y1, x2, y2, smokes)) return false;
  return true;
}

// Full visibility test for a guard: cone + line of sight (+ smoke).
// opts: { sneak } shrinks the effective range to the sneak range;
//       { smokes } is a list of {x, y, r} smoke circles.
export function isVisible(ox, oy, facing, tx, ty, range, halfAngleDeg, blockers, opts = {}) {
  const effRange = opts.sneak ? CONFIG.SNEAK_RANGE : range;
  if (!isInCone(ox, oy, facing, tx, ty, effRange, halfAngleDeg)) return false;
  return lineOfSightClear(ox, oy, tx, ty, blockers, opts.smokes || []);
}

// Camera sweep angle in degrees: triangle wave, -sweep at t=0, +sweep at t=T/2.
export function cameraAngleAt(cam, t) {
  const A = cam.sweepDeg;
  if (A === 0) return cam.angleOverrideDeg ?? 0;
  const phase = ((t / cam.period) % 1 + 1) % 1;
  let angle;
  if (phase < 0.5) angle = -A + 4 * A * phase;
  else angle = 3 * A - 4 * A * phase;
  return cam.angleOverrideDeg ?? angle;
}

// Direction vector for a camera facing: 0deg = its base direction
// (south for CAM 1/2, north for CAM 3); positive angles point east.
export function cameraDirection(cam, t) {
  const a = (cameraAngleAt(cam, t) * Math.PI) / 180;
  if (cam.baseDir === 'north') return { x: Math.sin(a), y: -Math.cos(a) };
  return { x: Math.sin(a), y: Math.cos(a) };
}

// True when Sari is inside the camera zone with a clear sight line.
// pad widens the zone for AI planning (autopilot), never for the real game.
export function cameraSeesPlayer(cam, playerPos, t, blockers, smokes = [], empUntil = -Infinity, pad = null) {
  if (t < empUntil) return false; // EMP offline
  const dir = cameraDirection(cam, t);
  const dx = playerPos.x - cam.x, dy = playerPos.y - cam.y;
  const dist = Math.hypot(dx, dy);
  const range = cam.range + (pad?.range ?? 0);
  if (dist > range + 1e-6) return false;
  if (dist < 1e-9) return true;
  const half = cam.zoneDeg / 2 + (pad?.angleDeg ?? 0);
  const targetAngle = Math.atan2(dy, dx);
  const facingAngle = Math.atan2(dir.y, dir.x);
  if (angleDiff(targetAngle, facingAngle) > (half * Math.PI) / 180 + 1e-9) return false;
  return lineOfSightClear(cam.x, cam.y, playerPos.x, playerPos.y, blockers, smokes);
}

// Cone polygon points (for rendering) from an observer.
export function conePolygon(ox, oy, facing, range, halfAngleDeg) {
  const half = (halfAngleDeg * Math.PI) / 180;
  const pts = [{ x: ox, y: oy }];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const a = facing - half + (2 * half * i) / steps;
    pts.push({ x: ox + Math.cos(a) * range, y: oy + Math.sin(a) * range });
  }
  return pts;
}

export { pointInRect };
