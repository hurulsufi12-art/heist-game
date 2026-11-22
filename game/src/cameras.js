// Security cameras: fixed positions, deterministic sweeps, EMP on/off.
// Pure logic; rendering lives in render.js.
import { CONFIG } from './config.js';
import { cameraSeesPlayer as sees } from './vision.js';

export { cameraAngleAt } from './vision.js';

export const CAMERA_DEFS = [
  {
    id: 1, name: 'CAM 1', x: 640, y: 80, baseDir: 'south',
    sweepDeg: 55, period: 6, zoneDeg: 45, range: 260,
  },
  {
    id: 2, name: 'CAM 2', x: 1120, y: 80, baseDir: 'south',
    sweepDeg: 0, period: 6, zoneDeg: 40, range: 240,
  },
  {
    id: 3, name: 'CAM 3', x: 920, y: 676, baseDir: 'north',
    sweepDeg: 40, period: 5, zoneDeg: 40, range: 220,
  },
];

export function createCamera(def) {
  return { ...def, angleOverrideDeg: null };
}

export function createCameras() {
  return CAMERA_DEFS.map(createCamera);
}

// Cameras are offline while elapsed EMP time is under 8 seconds.
export function isCameraOnline(cam, time, empUntil) {
  return time >= empUntil;
}

export function cameraSeesPlayer(cam, playerPos, time, blockers, smokes = [], empUntil = -Infinity, pad = null) {
  if (!isCameraOnline(cam, time, empUntil)) return false;
  return sees(cam, playerPos, time, blockers, smokes, empUntil, pad);
}
