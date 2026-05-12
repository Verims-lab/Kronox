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

  // Card snap onto timeline — tactile magnetic lock:
  // Layer 1: sub-bass punch (impact body)
  // Layer 2: mid transient click (the "lock" moment)
  // Layer 3: neon shimmer tail (futuristic sheen)
  snap() {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime;
    try {
      // ── Layer 1: sub-bass thud ──────────────────────────────
      // Short sine burst pitched low, fast exponential decay → felt more than heard
      const bass = c.createOscillator();
      const bassGain = c.createGain();
      bass.connect(bassGain);
      bassGain.connect(c.destination);
      bass.type = 'sine';
      bass.frequency.setValueAtTime(90, t);
      bass.frequency.exponentialRampToValueAtTime(42, t + 0.08);
      bassGain.gain.setValueAtTime(0, t);
      bassGain.gain.linearRampToValueAtTime(0.28, t + 0.004);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      bass.start(t);
      bass.stop(t + 0.12);

      // ── Layer 2: mid transient click ───────────────────────
      // Triangle wave, slightly pitched, very tight envelope → the "snap" click
      const click = c.createOscillator();
      const clickGain = c.createGain();
      click.connect(clickGain);
      clickGain.connect(c.destination);
      click.type = 'triangle';
      click.frequency.setValueAtTime(420, t + 0.003);
      click.frequency.exponentialRampToValueAtTime(210, t + 0.045);
      clickGain.gain.setValueAtTime(0, t);
      clickGain.gain.linearRampToValueAtTime(0.18, t + 0.005);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      click.start(t + 0.002);
      click.stop(t + 0.08);

      // ── Layer 3: neon shimmer tail ──────────────────────────
      // High sine sweep upward, very low gain, slow-ish decay → glassy shimmer
      const shimmer = c.createOscillator();
      const shimmerGain = c.createGain();
      shimmer.connect(shimmerGain);
      shimmerGain.connect(c.destination);
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(1800, t + 0.012);
      shimmer.frequency.linearRampToValueAtTime(2600, t + 0.18);
      shimmerGain.gain.setValueAtTime(0, t + 0.010);
      shimmerGain.gain.linearRampToValueAtTime(0.055, t + 0.022);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
      shimmer.start(t + 0.010);
      shimmer.stop(t + 0.22);
    } catch {}
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