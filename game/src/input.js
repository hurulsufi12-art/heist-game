// Keyboard + mouse input for Midnight at the Merah Museum.
// Held keys give a steering direction; one-shot presses (start, pause,
// restart, mute, EMP, Smoke, coin toss) are queued as flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.
// Movement: WASD / arrows. Shift: sneak. E (hold): grab loot. 1: EMP.
// 2: Smoke. 3 or click: throw a coin at the click point (or ahead of Sari).
// Space / Enter: start. R: restart. P / Esc: pause. M: mute.

export const ACTION_START = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_EMP = 16;
export const ACTION_SMOKE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const START = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sneak: false, interact: false };
  let actions = 0;
  let coinTarget = null; // {x, y} in canvas coordinates, consumed by readInput

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 1280;
    const y = ((event.clientY - rect.top) / rect.height) * 720;
    return { x, y };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sneak = true;
    else if (event.code === 'KeyE') held.interact = true;
    else if (START.has(event.code)) { if (!event.repeat) actions |= ACTION_START; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (event.code === 'KeyR') { if (!event.repeat) actions |= ACTION_RESTART; }
    else if (event.code === 'KeyM') { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (event.code === 'Digit1') { if (!event.repeat) actions |= ACTION_EMP; }
    else if (event.code === 'Digit2') { if (!event.repeat) actions |= ACTION_SMOKE; }
    else if (event.code === 'Digit3') {
      if (!event.repeat) coinTarget = { ahead: true };
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sneak = false;
    else if (event.code === 'KeyE') held.interact = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = false; held.down = false; held.left = false; held.right = false;
    held.sneak = false; held.interact = false;
  });
  // Click: throw a coin at that spot (also starts the game from the title).
  canvas.addEventListener('pointerdown', (event) => {
    const pt = canvasPoint(event);
    coinTarget = pt;
    actions |= ACTION_START;
  });

  return {
    /** Held movement keys as a unit-ish direction vector. */
    direction() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      return { x, y };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /**
     * Build the input object for one updateGame tick. One-shot tool flags
     * are consumed here; held keys are read live. `facing` is Sari's current
     * facing and `playerPos` her position, used when key 3 throws a coin
     * straight ahead of her.
     */
    readInput(facing, playerPos) {
      const coin = coinTarget;
      coinTarget = null;
      const out = {
        up: held.up, down: held.down, left: held.left, right: held.right,
        sneak: held.sneak, interact: held.interact,
      };
      if (actions & ACTION_EMP) out.emp = true;
      if (actions & ACTION_SMOKE) out.smoke = true;
      if (coin) {
        if (coin.ahead) {
          out.coin = {
            x: playerPos.x + Math.cos(facing) * 150,
            y: playerPos.y + Math.sin(facing) * 150,
          };
        } else {
          out.coin = coin;
        }
      }
      actions &= ~(ACTION_EMP | ACTION_SMOKE);
      return out;
    },
    /** True while the sneak key is held. */
    get sneak() { return held.sneak; },
  };
}
