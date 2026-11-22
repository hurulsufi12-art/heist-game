// WebAudio synth for Midnight at the Merah Museum: no sound files, no
// network — every effect is an oscillator built on the fly. All calls are
// safe when audio is unavailable: the AudioContext is created lazily on the
// first user gesture and every call is wrapped in try/catch, so the game
// always runs with or without sound. M toggles mute.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let lastTick = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.12, when = 0, slideTo = null) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    try {
      if (c.state === 'suspended') void c.resume();
      const t0 = c.currentTime + when;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    get muted() { return muted; },
    toggleMute() { muted = !muted; return muted; },
    /** Unlock audio on a user gesture (browsers block sound before one). */
    unlock() { ensure(); },
    click() { tone(660, 0.06, 'triangle', 0.08); },
    /** Short heartbeat tick while a guard's suspicion climbs (pitch rises). */
    tick(suspicion) {
      const now = Date.now();
      if (now - lastTick < 220) return;
      lastTick = now;
      tone(220 + suspicion * 3, 0.07, 'square', 0.05);
    },
    coinTing() { tone(1320, 0.12, 'sine', 0.1); tone(1760, 0.16, 'sine', 0.08, 0.07); },
    grab() { tone(520, 0.1, 'triangle', 0.1); tone(780, 0.14, 'triangle', 0.1, 0.08); },
    smoke() { tone(180, 0.35, 'sawtooth', 0.05, 0, 90); },
    emp() { tone(880, 0.2, 'square', 0.06, 0, 220); },
    /** Low warning pulse when the alarm crosses into HUNT. */
    alarm() { tone(196, 0.4, 'sawtooth', 0.09); tone(147, 0.4, 'sawtooth', 0.09, 0.2); },
    spotted() { tone(1046, 0.12, 'square', 0.09); tone(784, 0.18, 'square', 0.09, 0.1); },
    /** Short fanfare on getaway: four rising notes. */
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.11, i * 0.11));
    },
    /** Low descending tone on being caught. */
    fail() {
      tone(220, 0.5, 'sawtooth', 0.1, 0, 110);
      tone(165, 0.7, 'sawtooth', 0.1, 0.25, 82);
    },
  };
}
