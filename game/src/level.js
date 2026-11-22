// Museum floor plan: walls, cover, glass, doors, loot spots, spawn, getaway.
// All geometry is data here; no behaviour lives in this file.
import { CONFIG } from './config.js';

// Outer walls (40px thick). South wall has the getaway gap x40-120.
export const WALLS = [
  { x: 0, y: 56, w: 1280, h: 40 }, // north
  { x: 0, y: 656, w: 40, h: 40 }, // south-west corner
  { x: 120, y: 656, w: 1160, h: 40 }, // south (gap x40-120 = getaway door)
  { x: 0, y: 56, w: 40, h: 640 }, // west
  { x: 1240, y: 56, w: 40, h: 640 }, // east
  // Vault west wall (x960-980, y56-360) and south wall (y340-360) with door gap x1000-1040
  { x: 960, y: 56, w: 20, h: 304 },
  { x: 960, y: 340, w: 40, h: 20 },
  { x: 1040, y: 340, w: 200, h: 20 },
  // West corridor wall (x240) with two gaps: y200-240 and y480-520
  { x: 240, y: 56, w: 20, h: 144 },
  { x: 240, y: 240, w: 20, h: 240 },
  { x: 240, y: 520, w: 20, h: 136 },
];

// Solid cover: blocks movement AND vision.
export const COVERS = [
  { x: 520, y: 200, w: 80, h: 80, name: 'Patung A' },
  { x: 700, y: 200, w: 80, h: 80, name: 'Patung B' },
  { x: 440, y: 520, w: 120, h: 60, name: 'Meja Arsip Barat' },
  { x: 820, y: 520, w: 120, h: 60, name: 'Meja Arsip Timur' },
  { x: 620, y: 440, w: 40, h: 40, name: 'Pilar' },
  // Ticket desk by the entrance: Sari starts hidden behind it, so Raka's
  // southbound patrol down the west corridor cannot spot the spawn pocket.
  // It leaves the corridor passable to its east (x>134) and does not touch
  // Raka's patrol line (x140, 6px clear of the desk's east face).
  { x: 40, y: 580, w: 80, h: 40, name: 'Meja Tiket' },
];

// Glass cases: block movement, do NOT block vision (a fair trap).
export const GLASS = [
  { x: 520, y: 320, w: 120, h: 60, name: 'Etalase Kaca 1' },
  { x: 740, y: 320, w: 120, h: 60, name: 'Etalase Kaca 2' },
];

export const SOLID_RECTS = [...WALLS, ...COVERS, ...GLASS];
export const VISION_BLOCKERS = [...WALLS, ...COVERS];

export const SPAWN = { x: CONFIG.SPAWN_X, y: CONFIG.SPAWN_Y };
export const GETAWAY = { x: CONFIG.GETAWAY_X, y: CONFIG.GETAWAY_Y };

export const VAULT_DOOR = { x: 1000, y: 340, w: 40, h: 20 };

export const ROOM_LABELS = [
  { text: 'RUANG BRANKAS', x: 1100, y: 90, size: 20 },
  { text: 'GALERI UTAMA', x: 640, y: 130, size: 20 },
  { text: 'KORIDOR BARAT', x: 140, y: 130, size: 20 },
  { text: 'LOBI TIMUR', x: 920, y: 420, size: 20 },
];

export const PAINTINGS = [
  { x: 300, y: 100, w: 120, h: 70, name: 'Senja di Teluk', wall: 'north' },
  { x: 60, y: 300, w: 60, h: 100, name: 'Ombak', wall: 'west' },
];

export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function circleHitsRect(x, y, rad, r) {
  const cx = Math.max(r.x, Math.min(x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(y, r.y + r.h));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy < rad * rad;
}

// Sampled segment test: true when the segment hits no blocker rect.
export function segmentClear(x1, y1, x2, y2, rects) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    for (const r of rects) if (pointInRect(x, y, r)) return false;
  }
  return true;
}

// Move a circle axis-by-axis so it slides along walls instead of sticking.
export function moveCircle(x, y, dx, dy, rad, solids) {
  let nx = x + dx;
  for (const r of solids) {
    if (circleHitsRect(nx, y, rad, r)) {
      if (dx > 0) nx = r.x - rad;
      else if (dx < 0) nx = r.x + r.w + rad;
    }
  }
  let ny = y + dy;
  for (const r of solids) {
    if (circleHitsRect(nx, ny, rad, r)) {
      if (dy > 0) ny = r.y - rad;
      else if (dy < 0) ny = r.y + r.h + rad;
    }
  }
  return { x: nx, y: ny };
}

// Push a circle out of any solid it overlaps, then clamp to the play bounds.
export function resolveCircleOutOfSolids(x, y, rad, solids) {
  let cx = Math.max(40 + rad, Math.min(1240 - rad, x));
  let cy = Math.max(96 + rad, Math.min(696 - rad, y));
  for (const r of solids) {
    if (!circleHitsRect(cx, cy, rad, r)) continue;
    const pushLeft = cx + rad - r.x;
    const pushRight = r.x + r.w + rad - cx;
    const pushUp = cy + rad - r.y;
    const pushDown = r.y + r.h + rad - cy;
    const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
    if (m === pushLeft) cx = r.x - rad;
    else if (m === pushRight) cx = r.x + r.w + rad;
    else if (m === pushUp) cy = r.y - rad;
    else cy = r.y + r.h + rad;
  }
  cx = Math.max(40 + rad, Math.min(1240 - rad, cx));
  cy = Math.max(96 + rad, Math.min(696 - rad, cy));
  return { x: cx, y: cy };
}
