/**
 * Lightweight Web Audio API sound engine for Kronox.
 * No external dependencies. GPU-friendly (no DOM). ~2KB.
 */

let ctx = null;

function getCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
  return ctx;
}

function playTone({ freq = 440, type = 'sine', duration = 0.08, gain = 0.18, attack = 0.005, decay = 0.07, freq2 = null }) {
  const c = getCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g);
    g.connect(c.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (freq2) osc.frequency.linearRampToValueAtTime(freq2, c.currentTime + duration);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(gain, c.currentTime + attack);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + attack + decay);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration + 0.05);
  } catch {}
}

export const sounds = {
  // Card pickup — soft click
  pickup() { playTone({ freq: 520, type: 'sine', duration: 0.06, gain: 0.12, decay: 0.05 }); },

  // Drop zone hover tick
  tick() { playTone({ freq: 660, type: 'square', duration: 0.04, gain: 0.06, decay: 0.03 }); },

  // Card snap onto timeline
  snap() {
    playTone({ freq: 300, type: 'sine', duration: 0.05, gain: 0.14, decay: 0.04 });
    setTimeout(() => playTone({ freq: 600, type: 'sine', duration: 0.08, gain: 0.10, decay: 0.06 }), 40);
  },

  // Correct answer chime — bright upward sweep
  correct() {
    playTone({ freq: 520, freq2: 880, type: 'sine', duration: 0.15, gain: 0.2, decay: 0.13 });
    setTimeout(() => playTone({ freq: 880, type: 'sine', duration: 0.12, gain: 0.15, decay: 0.10 }), 120);
  },

  // Wrong answer — low thud
  wrong() {
    playTone({ freq: 180, freq2: 90, type: 'sawtooth', duration: 0.18, gain: 0.22, decay: 0.15 });
  },

  // Button tap
  tap() { playTone({ freq: 400, type: 'sine', duration: 0.05, gain: 0.08, decay: 0.04 }); },

  // Timer urgency tick
  urgencyTick() { playTone({ freq: 800, type: 'square', duration: 0.03, gain: 0.07, decay: 0.025 }); },
};