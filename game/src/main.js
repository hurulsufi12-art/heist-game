// Boot and the one loop for Midnight at the Merah Museum.
// Input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints
// what is there. The game moves between TITLE, BRIEFING, PLAYING, PAUSED,
// CAUGHT and GETAWAY — the state machine lives in game.js, this file only
// drives it.
//
// ?shot=cover|alarm|tools|title&seed=1 stages a deterministic pose instead
// of running the loop, paints it twice and sets window.__shotReady for the
// screenshot harness. Poses are built by shots.js from the same constructors
// as a fresh game, so a shot is a real frame of the game, not a mock-up.
import { createGame, beginPlaying, updateGame } from './game.js';
import { buildShotGame } from './shots.js';
import { createRenderer } from './render.js';
import {
  createInput,
  ACTION_START,
  ACTION_PAUSE,
  ACTION_RESTART,
  ACTION_MUTE,
} from './input.js';
import { createAudio } from './audio.js';

const STEP = 1 / 60;
/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
// Exposed for debugging and playtesting from the console.
window.__game = null;

function runShot(name) {
  const { game } = buildShotGame(name, seed);
  window.__game = game;
  let painted = 0;
  function paint() {
    renderer.draw(game);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const game = createGame();
  window.__game = game;
  const input = createInput(canvas);
  const audio = createAudio();
  let accumulator = 0;
  let last = performance.now();
  let wasSpotted = false;
  let alarmWasHunt = false;
  let announced = '';

  function announce(message) {
    if (message === announced) return;
    announced = message;
    status.textContent = message;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      game.muted = muted;
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART) {
      audio.click();
      const fresh = createGame();
      Object.assign(game, fresh);
      beginPlaying(game);
      accumulator = 0;
      announce('New night. Steal the Komet Biru.');
      return;
    }
    if (actions & ACTION_START) {
      audio.unlock();
      audio.click();
      if (game.state === 'TITLE' || game.state === 'BRIEFING') {
        updateGame(game, { start: true }, STEP);
        if (game.state === 'PLAYING') announce('Playing. Steal the Komet Biru and reach the van.');
      } else if (game.state === 'CAUGHT' || game.state === 'GETAWAY') {
        const fresh = createGame();
        Object.assign(game, fresh);
        beginPlaying(game);
        accumulator = 0;
        announce('New night. Steal the Komet Biru.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (game.state === 'PLAYING') {
        updateGame(game, { pause: true }, STEP);
        announce('Paused.');
      } else if (game.state === 'PAUSED') {
        updateGame(game, { pause: true }, STEP);
        announce('Playing.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (game.state === 'PLAYING' || game.state === 'TITLE' || game.state === 'BRIEFING') {
      while (accumulator >= STEP) {
        const before = { spotted: game.spottedTimer > 0, hunt: game.huntActive, state: game.state };
        const inp = game.state === 'PLAYING'
          ? input.readInput(game.player.facing, game.player)
          : {};
        updateGame(game, inp, STEP);
        accumulator -= STEP;
        // sound cues on state changes (never on a timer)
        if (game.state === 'PLAYING') {
          if (game.spottedTimer > 0 && !wasSpotted) {
            audio.spotted();
            announce(`Spotted by ${game.spottedName}. Break line of sight.`);
          }
          wasSpotted = game.spottedTimer > 0;
          if (game.huntActive && !alarmWasHunt) audio.alarm();
          alarmWasHunt = game.huntActive;
          if (game.grabInfo && game.grabInfo.progress > 0) {
            const top = Math.max(...game.guards.map((g) => g.suspicion));
            if (top > 20) audio.tick(top);
          }
        }
        if (game.state === 'GETAWAY' && before.state === 'PLAYING') {
          audio.fanfare();
          announce(`Getaway. Score ${game.score}.`);
        }
        if (game.state === 'CAUGHT' && before.state === 'PLAYING') {
          audio.fail();
          announce(`Caught. ${game.cause || ''}`);
        }
        if (game.state !== 'PLAYING') break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'PLAYING') {
      updateGame(game, { pause: true }, STEP);
      announce('Paused.');
    }
  });

  announce('Midnight at the Merah Museum. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
