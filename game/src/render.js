// Drawing only: the game state in, pixels out. No logic lives here — every
// number comes from the game state or the level data. All animation is a
// function of game.time, so a ?shot= pose renders the same frame every time.
// Palette (PLAN §2.3): dark marble, brick red, gold, blue glass; guard cones
// yellow (red when suspicion > 50), camera zones orange, loot blue/gold.
import { CONFIG } from './config.js';
import { WALLS, COVERS, GLASS, ROOM_LABELS, PAINTINGS, VAULT_DOOR, GETAWAY } from './level.js';
import { conePolygon, cameraDirection } from './vision.js';
import { alarmLabel, alarmColor } from './alarm.js';
import { totalLootValue } from './loot.js';

const W = 1280;
const H = 720;
const FONT = 'system-ui, sans-serif';

const PALETTE = {
  backdrop: '#0d0a10',
  hud: '#1c1216',
  hudLine: '#3a2a2e',
  floor: '#23202e',
  floorDark: '#1d1a28',
  carpet: '#7a1f1f',
  carpetEdge: '#a83232',
  vaultFloor: '#2a2438',
  corridorFloor: '#221f2c',
  wall: '#6e2b28',
  wallTop: '#8a3a34',
  cover: '#4a4556',
  coverTop: '#5d5870',
  glass: 'rgba(77, 166, 255, 0.22)',
  glassFrame: '#7fb3e8',
  gold: '#ffd60a',
  goldDark: '#c9a227',
  komet: '#4da6ff',
  kometGlow: 'rgba(77, 166, 255, 0.35)',
  text: '#f5efe6',
  muted: '#b8a89a',
  danger: '#ff3b30',
  warning: '#ff9500',
  ok: '#30d158',
  smoke: 'rgba(200, 200, 210, 0.45)',
};

function fmtTime(seconds) {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / W, height / H);
    view.x = (width - W * view.scale) / 2;
    view.y = (height - H * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`.trim());
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- floor and rooms ---
  function renderFloor(game) {
    rect(0, CONFIG.HUD_H, W, CONFIG.PLAY_BOTTOM - CONFIG.HUD_H, PALETTE.floor);
    // subtle marble tiles
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 40; x < W; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, CONFIG.HUD_H); ctx.lineTo(x, CONFIG.PLAY_BOTTOM); ctx.stroke();
    }
    for (let y = 96; y < CONFIG.PLAY_BOTTOM; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // vault floor (north-east, x960-1240, y56-360)
    rect(980, CONFIG.HUD_H, 260, 304, PALETTE.vaultFloor);
    // west corridor floor (x40-240)
    rect(40, CONFIG.HUD_H, 200, 600, PALETTE.corridorFloor);
    // red carpet (x240-880, y420-500)
    rect(240, 420, 640, 80, PALETTE.carpet);
    ctx.strokeStyle = PALETTE.carpetEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(240, 420, 640, 80);
    // east wing lobby zone (x880-960, y400-520)
    ctx.strokeStyle = 'rgba(255, 214, 10, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(880, 400, 80, 120);
    ctx.setLineDash([]);
    // room labels (20px, readable at thumbnail scale)
    for (const l of ROOM_LABELS) {
      text(l.text, l.x, l.y, l.size, 'rgba(245, 239, 230, 0.5)', 'center', 'bold');
    }
    renderStreet();
  }

  function renderStreet() {
    // Street strip y696-720: road, getaway van, green arrow to the door.
    rect(0, 696, W, 24, '#17161c');
    ctx.strokeStyle = '#3a3a44';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    ctx.beginPath(); ctx.moveTo(0, 708); ctx.lineTo(W, 708); ctx.stroke();
    ctx.setLineDash([]);
    // van waiting outside the getaway door (x40-120)
    rect(52, 698, 56, 18, '#2e5d3a');
    rect(52, 698, 56, 6, '#3a7a4a');
    circle(64, 716, 4, '#111');
    circle(96, 716, 4, '#111');
    text('GETAWAY →', 124, 714, 18, PALETTE.ok, 'left', 'bold');
  }

  // --- walls, cover, glass, paintings ---
  function renderWalls() {
    for (const r of WALLS) {
      rect(r.x, r.y, r.w, r.h, PALETTE.wall);
      rect(r.x, r.y, r.w, 4, PALETTE.wallTop);
    }
    // vault door gap (x1000-1040 in the south vault wall): gold frame
    rect(VAULT_DOOR.x, VAULT_DOOR.y, VAULT_DOOR.w, VAULT_DOOR.h, PALETTE.goldDark);
  }

  function renderCover() {
    for (const r of COVERS) {
      rect(r.x, r.y, r.w, r.h, PALETTE.cover);
      rect(r.x, r.y, r.w, 5, PALETTE.coverTop);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      if (r.w >= 80 && r.name !== 'Meja Tiket') text(r.name.toUpperCase(), r.x + r.w / 2, r.y + r.h / 2 + 6, 16, 'rgba(245,239,230,0.65)', 'center', 'bold');
    }
  }

  function renderGlass() {
    for (const r of GLASS) {
      ctx.fillStyle = PALETTE.glass;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = PALETTE.glassFrame;
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + r.h);
      ctx.lineTo(r.x + r.w, r.y);
      ctx.strokeStyle = 'rgba(127, 179, 232, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function renderPaintings() {
    for (const p of PAINTINGS) {
      rect(p.x, p.y, p.w, p.h, '#3a2a1a');
      ctx.strokeStyle = PALETTE.goldDark;
      ctx.lineWidth = 3;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      // a tiny painted scene: sun over waves
      circle(p.x + p.w / 2, p.y + p.h / 3, 10, '#e8a33d');
      ctx.strokeStyle = '#4da6ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + 8, p.y + p.h - 14);
      ctx.quadraticCurveTo(p.x + p.w / 2, p.y + p.h - 26, p.x + p.w - 8, p.y + p.h - 14);
      ctx.stroke();
      text(p.name, p.x + p.w / 2, p.y + p.h + 18, 16, 'rgba(245,239,230,0.55)', 'center');
    }
  }

  // --- loot ---
  function renderLoot(game) {
    for (const l of game.loot) {
      if (l.taken) continue;
      if (l.id === 'komet') {
        // glowing blue diamond + pulsing halo (pulse is a function of game.time)
        const pulse = 1 + 0.12 * Math.sin(game.time * 3);
        ctx.save();
        ctx.globalAlpha = 0.5;
        circle(l.x, l.y, 34 * pulse, PALETTE.kometGlow);
        ctx.restore();
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = PALETTE.komet;
        ctx.fillRect(-13, -13, 26, 26);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(-13, -13, 26, 8);
        ctx.restore();
        text('KOMET BIRU', l.x - 32, l.y + 6, 18, '#bcd8ff', 'right', 'bold');
        text('$5,000', l.x, l.y + 48, 16, PALETTE.gold, 'center', 'bold');
      } else if (l.id === 'painting') {
        circle(l.x, l.y, 12, PALETTE.gold);
        ctx.strokeStyle = PALETTE.goldDark;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(l.x, l.y, 12, 0, Math.PI * 2); ctx.stroke();
        text('Senja di Teluk', l.x, l.y - 20, 16, PALETTE.gold, 'center');
      } else if (l.id === 'mask') {
        circle(l.x, l.y, 12, PALETTE.gold);
        ctx.fillStyle = '#1c1216';
        circle(l.x - 4, l.y - 2, 2.5, '#1c1216');
        circle(l.x + 4, l.y - 2, 2.5, '#1c1216');
        // label below the mask: above it sits the LOBI TIMUR room label.
        text('Topeng Emas', l.x, l.y + 36, 16, PALETTE.gold, 'center');
      } else {
        // collector coins: small gold discs
        circle(l.x, l.y, 9, PALETTE.gold);
        ctx.strokeStyle = PALETTE.goldDark;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(l.x, l.y, 9, 0, Math.PI * 2); ctx.stroke();
        text('$', l.x, l.y + 5, 14, '#7a5c00', 'center', 'bold');
      }
    }
    // grab progress ring over the item being held
    if (game.grabInfo && game.grabInfo.progress > 0 && game.grabInfo.item) {
      const item = game.loot.find((l) => l.id === game.grabInfo.item);
      if (item) {
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * game.grabInfo.progress);
        ctx.stroke();
        text(`Hold E — ${item.name}`, item.x, item.y - 52, 16, PALETTE.text, 'center', 'bold');
      }
    }
  }

  // --- smoke and thrown coins ---
  function renderToolsOnFloor(game) {
    for (const s of game.tools.smokes) {
      const fade = Math.max(0, Math.min(1, (s.until - game.time) / 1));
      ctx.save();
      ctx.globalAlpha = 0.55 * fade + 0.15;
      circle(s.x, s.y, s.r, PALETTE.smoke);
      ctx.globalAlpha = 0.35 * fade;
      circle(s.x, s.y, s.r * 0.7, 'rgba(220,220,230,0.5)');
      ctx.restore();
    }
    for (const c of game.tools.coins) {
      circle(c.x, c.y, 7, PALETTE.gold);
      ctx.strokeStyle = PALETTE.goldDark;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // --- cameras ---
  function renderCameraZones(game) {
    for (const cam of game.cameras) {
      const online = game.time >= game.tools.empUntil;
      const dir = cameraDirection(cam, game.time);
      const facing = Math.atan2(dir.y, dir.x);
      const half = ((cam.zoneDeg / 2) * Math.PI) / 180;
      const pts = [{ x: cam.x, y: cam.y }];
      for (let i = 0; i <= 8; i++) {
        const a = facing - half + (2 * half * i) / 8;
        pts.push({ x: cam.x + Math.cos(a) * cam.range, y: cam.y + Math.sin(a) * cam.range });
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      if (!online) {
        ctx.fillStyle = 'rgba(120, 120, 130, 0.10)';
      } else {
        ctx.fillStyle = 'rgba(255, 149, 0, 0.13)';
      }
      ctx.fill();
      ctx.strokeStyle = online ? 'rgba(255, 149, 0, 0.45)' : 'rgba(120,120,130,0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function renderCameras(game) {
    for (const cam of game.cameras) {
      const online = game.time >= game.tools.empUntil;
      // wall mount + lens
      rect(cam.x - 10, cam.y - 6, 20, 12, '#3a3a44');
      circle(cam.x, cam.y, 6, online ? PALETTE.warning : '#777');
      // Name below the mount for the north-wall cameras (a label above would
      // collide with the HUD); above for CAM 3 at the south wall.
      const below = cam.y < 200;
      text(cam.name, cam.x, below ? cam.y + 28 : cam.y - 16, 16, online ? PALETTE.warning : '#999', 'center', 'bold');
      if (!online) {
        const left = Math.max(0, Math.ceil(game.tools.empUntil - game.time));
        text(`OFF ${left}s`, cam.x, below ? cam.y + 48 : cam.y - 36, 16, '#bbb', 'center', 'bold');
      }
    }
  }

  // --- guards ---
  function renderGuardCone(g) {
    if (g.state === 'STUNNED') return;
    const hot = g.state === 'CHASE' || g.suspicion > 50;
    const pts = conePolygon(g.x, g.y, g.facing, CONFIG.CONE_RANGE, CONFIG.CONE_HALF_DEG);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = hot ? 'rgba(255, 59, 48, 0.22)' : 'rgba(255, 214, 10, 0.16)';
    ctx.fill();
    ctx.strokeStyle = hot ? 'rgba(255, 59, 48, 0.5)' : 'rgba(255, 214, 10, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function renderGuard(g) {
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y + 12, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // body: dark blue uniform
    const body = g.state === 'STUNNED' ? '#555' : '#2e4a7a';
    circle(g.x, g.y, CONFIG.GUARD_R, body);
    ctx.strokeStyle = '#16233d';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(g.x, g.y, CONFIG.GUARD_R, 0, Math.PI * 2); ctx.stroke();
    // head + cap
    circle(g.x, g.y - 4, 6, '#d9a06b');
    rect(g.x - 7, g.y - 11, 14, 4, '#16233d');
    // facing tick
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.facing) * 18, g.y + Math.sin(g.facing) * 18);
    ctx.stroke();
    // name + state mark
    text(g.name, g.x, g.y - 24, 16, PALETTE.text, 'center', 'bold');
    if (g.state === 'CHASE') text('!', g.x, g.y - 38, 22, PALETTE.danger, 'center', 'bold');
    else if (g.state === 'SUSPICIOUS' || g.state === 'SEARCH') text('?', g.x, g.y - 38, 22, PALETTE.gold, 'center', 'bold');
    else if (g.state === 'STUNNED') text('zZ', g.x, g.y - 38, 16, '#bbb', 'center', 'bold');
    // suspicion bar when alerted
    if (g.suspicion > 5) {
      rect(g.x - 16, g.y + 20, 32, 5, 'rgba(0,0,0,0.5)');
      rect(g.x - 16, g.y + 20, 32 * Math.min(1, g.suspicion / 100), 5, g.suspicion >= 60 ? PALETTE.danger : PALETTE.gold);
    }
  }

  // --- player ---
  function renderPlayer(game) {
    const p = game.player;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 12, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // body: dark silhouette
    circle(p.x, p.y, CONFIG.PLAYER_R, '#1f1a2e');
    ctx.strokeStyle = '#8a7fd6';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, CONFIG.PLAYER_R, 0, Math.PI * 2); ctx.stroke();
    // head + wide-brim hat
    circle(p.x, p.y - 4, 6, '#e8b98a');
    ctx.fillStyle = '#1f1a2e';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 8, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // facing tick
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.facing) * 18, p.y + Math.sin(p.facing) * 18);
    ctx.stroke();
    text('Sari', p.x, p.y - 24, 16, '#cbb8ff', 'center', 'bold');
    if (p.sneak) text('sneak', p.x, p.y + 30, 14, 'rgba(245,239,230,0.7)', 'center');
  }

  // --- HUD ---
  function renderAlarmMeter(game) {
    const v = game.alarm.value;
    text('ALARM', 280, 24, 16, PALETTE.muted, 'left', 'bold');
    rect(280, 30, 200, 14, 'rgba(0,0,0,0.5)');
    rect(280, 30, 200 * Math.min(1, v / 100), 14, alarmColor(v));
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(280, 30, 200, 14);
    text(String(Math.round(v)), 490, 42, 24, alarmColor(v), 'left', 'bold');
    // state word at 16px: "SUSPICIOUS" ends ~623, clear of LOOT at 660.
    text(alarmLabel(v), 528, 40, 16, alarmColor(v), 'left', 'bold');
  }

  function renderHud(game) {
    rect(0, 0, W, CONFIG.HUD_H, PALETTE.hud);
    rect(0, CONFIG.HUD_H - 2, W, 2, PALETTE.hudLine);
    text('MERAH MUSEUM', 16, 36, 20, PALETTE.text, 'left', 'bold');
    renderAlarmMeter(game);
    text(`◆ LOOT ${totalLootValue(game.loot)}`, 660, 36, 20, PALETTE.gold, 'left', 'bold');
    // tools: EMP / Smoke / Coin with remaining counts
    const tools = [
      { label: 'EMP', n: game.tools.emp, key: '1' },
      { label: 'SMOKE', n: game.tools.smoke, key: '2' },
      { label: 'COIN', n: game.tools.coin, key: '3' },
    ];
    let x = 840;
    for (const t of tools) {
      rect(x, 10, 72, 36, t.n > 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)');
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, 10, 72, 36);
      text(t.label, x + 6, 26, 14, PALETTE.muted, 'left', 'bold');
      text(`×${t.n}`, x + 6, 42, 18, t.n > 0 ? PALETTE.text : '#666', 'left', 'bold');
      text(t.key, x + 62, 26, 14, '#888', 'right');
      x += 80;
    }
    text(fmtTime(game.time), 1100, 36, 20, PALETTE.text, 'left', 'bold');
  }

  function renderSpotted(game) {
    if (game.spottedTimer <= 0 || !game.spottedName) return;
    // red sight line from the spotting guard to Sari
    const g = game.guards.find((gd) => gd.name === game.spottedName);
    if (g) {
      ctx.strokeStyle = 'rgba(255, 59, 48, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(game.player.x, game.player.y);
      ctx.stroke();
    }
    // banner (shake is a function of game.time: deterministic for shots)
    const shake = Math.sin(game.time * 40) * 2;
    ctx.save();
    ctx.translate(shake, 0);
    rect(W / 2 - 130, 64, 260, 44, 'rgba(255, 59, 48, 0.92)');
    text(`SPOTTED! ${game.spottedName}`, W / 2, 94, 24, '#fff', 'center', 'bold');
    ctx.restore();
  }

  function renderMessage(game) {
    if (!game.message) return;
    const w = ctx.measureText(game.message).width + 40;
    rect((W - w) / 2, 600, w, 40, 'rgba(0,0,0,0.75)');
    text(game.message, W / 2, 627, 18, PALETTE.text, 'center');
  }

  function renderGetawayDoor(game) {
    const komet = game.loot.find((l) => l.id === 'komet');
    const lit = komet && komet.taken;
    // doorway glow when the Komet is in hand
    if (lit) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.1 * Math.sin(game.time * 4);
      circle(GETAWAY.x, GETAWAY.y, 46, PALETTE.ok);
      ctx.restore();
    }
    ctx.strokeStyle = lit ? PALETTE.ok : 'rgba(48, 209, 88, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(GETAWAY.x, GETAWAY.y, CONFIG.GETAWAY_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    // label to the right of the ring: above it sits the ticket desk.
    text('GETAWAY', GETAWAY.x + 48, GETAWAY.y + 6, 16, lit ? PALETTE.ok : 'rgba(48,209,88,0.7)', 'left', 'bold');
  }

  // --- screens ---
  function renderPanel(title, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(10, 8, 14, 0.82)';
    ctx.fillRect(0, 0, W, H);
    const w = 760;
    const h = 150 + lines.length * 34 + 70;
    const x = (W - w) / 2;
    const y = (H - h) / 2;
    rect(x, y, w, h, '#1c1216');
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    text(title, W / 2, y + 72, 48, accent, 'center', 'bold');
    lines.forEach((ln, i) => text(ln, W / 2, y + 128 + i * 34, 20, PALETTE.text, 'center'));
    text(prompt, W / 2, y + h - 32, 22, PALETTE.gold, 'center', 'bold');
  }

  function renderTitle(game) {
    // mini-map of the museum behind the title
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.5;
    const s = 0.34;
    const ox = (W - 1280 * s) / 2;
    const oy = 165;
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    rect(0, 56, 1280, 640, PALETTE.floor);
    rect(240, 420, 640, 80, PALETTE.carpet);
    rect(980, 56, 260, 304, PALETTE.vaultFloor);
    for (const r of WALLS) rect(r.x, r.y, r.w, r.h, PALETTE.wall);
    for (const r of COVERS) rect(r.x, r.y, r.w, r.h, PALETTE.cover);
    for (const r of GLASS) { ctx.fillStyle = PALETTE.glass; ctx.fillRect(r.x, r.y, r.w, r.h); }
    circle(1120, 140, 16, PALETTE.komet);
    circle(80, 640, 12, PALETTE.ok);
    circle(640, 420, 10, '#8a7fd6');
    ctx.restore();
    text('MIDNIGHT AT THE', W / 2, 64, 28, PALETTE.muted, 'center', 'bold');
    text('MERAH MUSEUM', W / 2, 116, 56, PALETTE.text, 'center', 'bold');
    text('One night. One gem. No alarms.', W / 2, 150, 20, PALETTE.gold, 'center');
    const lines = [
      'Sari steals one thing a night, hurts no one, and never leaves a trace —',
      'tonight it is the Komet Biru, a $5,000 gem in the vault.',
      'Dodge the guards, slip past the cameras, grab the gem, reach the van.',
      '',
      'Move WASD / arrows · Sneak Shift · Grab hold E · EMP 1 · Smoke 2 · Coin click / 3',
      'Pause P · Restart R · Mute M',
    ];
    const w = 860;
    const h = 305;
    const x = (W - w) / 2;
    const y = 395;
    rect(x, y, w, h, 'rgba(28, 18, 22, 0.94)');
    ctx.strokeStyle = PALETTE.goldDark;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    lines.forEach((ln, i) => text(ln, W / 2, y + 38 + i * 26, 18, PALETTE.text, 'center'));
    text('Start the heist — Space or click', W / 2, y + h - 22, 22, PALETTE.gold, 'center', 'bold');
    void game;
  }

  function renderBriefing() {
    renderPanel('THE JOB', [
      'The Komet Biru sits in the vault, north-east, behind Dewi and CAM 2.',
      'Three ways in: the Red Carpet, the West Corridor, the East Wing.',
      'EMP kills the cameras for 8s (+12 alarm). Smoke blinds everyone for 5s (+5).',
      'A tossed coin pulls a guard away for 4s. Every coin you carry slows you 3%.',
      'Alarm 60 means HUNT — every guard chases you. Alarm 100 means lockdown.',
    ], 'Press Space to begin', PALETTE.gold);
  }

  function renderPaused() {
    renderPanel('PAUSED', ['The guards will wait. The alarm will not rise.'], 'Press P to resume', PALETTE.text);
  }

  function renderCaught(game) {
    const lines = [
      game.cause || 'Caught in the act.',
      `Loot ${totalLootValue(game.loot)} · Time ${fmtTime(game.time)} · Alarm ${Math.round(game.alarm.value)}`,
    ];
    renderPanel('CAUGHT!', lines, 'Press R to try again', PALETTE.danger);
  }

  function renderGetaway(game) {
    const lines = [
      `Loot $${totalLootValue(game.loot)}  −  time ${Math.floor(game.time)}s  −  alarm ${Math.round(game.alarm.value)}`,
      `Final score: ${game.score}`,
      'The van pulls away into the night. No trace left behind.',
    ];
    renderPanel('GETAWAY!', lines, 'Press R to steal again', PALETTE.ok);
  }

  // --- main draw ---
  function draw(game) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    if (game.state === 'TITLE') {
      renderTitle(game);
      return;
    }
    renderFloor(game);
    renderGlass();
    renderCover();
    renderWalls();
    renderPaintings();
    renderLoot(game);
    renderToolsOnFloor(game);
    renderCameraZones(game);
    for (const g of game.guards) renderGuardCone(g);
    renderCameras(game);
    renderGetawayDoor(game);
    for (const g of game.guards) renderGuard(g);
    renderPlayer(game);
    renderSpotted(game);
    renderHud(game);
    renderMessage(game);
    if (game.state === 'BRIEFING') renderBriefing();
    else if (game.state === 'PAUSED') renderPaused();
    else if (game.state === 'CAUGHT') renderCaught(game);
    else if (game.state === 'GETAWAY') renderGetaway(game);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize };
}
