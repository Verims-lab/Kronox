import React, { useEffect, useRef } from 'react';
import { Timer } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';

/**
 * Codex106-24 — Solo Level total countdown timer (visible in gameplay).
 *
 * Pure presentational. The single source of truth for elapsed time lives in
 * Game.jsx (`overallSeconds`, updated by GameOverTimer at 1 Hz). This
 * component just formats `total - elapsed` and styles it for the top-right
 * slot of GameLayout. Expiration / fail logic is owned by Game.jsx — this
 * file never decides anything game-rule-related.
 *
 * Props:
 *   - totalSeconds:    number  total budget (180 for solo levels)
 *   - elapsedSeconds:  number  seconds elapsed so far
 *   - frozen:          boolean Zaman Dondur visual-only timer state
 *
 * Styling rules:
 *   - Mobile-friendly: fixed compact size, lives in the existing top-right
 *     slot so it does NOT overlap card/timeline/drag UI.
 *   - Color hardens (amber → red glow) when ≤ 10 s remain so the player
 *     gets a clear danger cue.
 */
export default function SoloLevelTimer({ totalSeconds = 180, elapsedSeconds = 0, frozen = false }) {
  const remaining = Math.max(0, Math.ceil(totalSeconds - elapsedSeconds));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const label = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const danger = remaining <= 10;

  // Codex106-25 — Last 10 seconds audio countdown.
  //   • Plays exactly once per second from remaining=10 down to remaining=1.
  //   • Dedupes by `lastTickedRef` so the same second can't double-fire.
  //   • Cleanup: when this component unmounts (result popup mounts, route
  //     change, replay/next-level reset), the effect captures nothing
  //     ongoing — `sounds.urgencyTick` is one-shot Web Audio. There is no
  //     timer/interval to clear. The parent GameLayout already stops
  //     rendering this component when `winner` is set or solo level mode
  //     ends, so further ticks naturally stop.
  //   • Audio failure is non-blocking: gameSounds.js wraps every oscillator
  //     in try/catch and returns silently if AudioContext is unavailable.
  //   • Resets on unmount via React's normal lifecycle — new mount =
  //     fresh ref starting at null.
  const lastTickedRef = useRef(null);
  useEffect(() => {
    if (remaining < 1 || remaining > 10) return;
    if (lastTickedRef.current === remaining) return;
    lastTickedRef.current = remaining;
    try { sounds.urgencyTick(); } catch { /* non-blocking */ }
  }, [remaining]);

  return (
    <div
      className="flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-1 text-base"
      style={{
        background: 'rgba(6, 18, 37, 0.88)',
        borderColor: danger ? 'rgba(248,113,113,0.72)' : (frozen ? 'rgba(56,189,248,0.68)' : '#FFC928'),
        color: danger ? '#fca5a5' : (frozen ? '#7dd3fc' : '#FFC928'),
        boxShadow: danger
          ? '0 0 12px rgba(220,38,38,0.30), inset 0 1px 0 rgba(255,255,255,0.04)'
          : frozen
            ? '0 0 12px rgba(56,189,248,0.26), inset 0 1px 0 rgba(255,255,255,0.04)'
          : '0 0 12px rgba(255, 201, 40, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        minWidth: frozen ? 118 : 78,
        justifyContent: 'center',
      }}
      aria-label={`Kalan süre ${label}${frozen ? ', donduruldu' : ''}`}
    >
      <Timer className="h-4 w-4" strokeWidth={2.4} />
      <span className="kronox-number" style={{ letterSpacing: '0.02em' }}>{label}</span>
      {frozen && (
        <span className="font-inter text-[9px] font-black uppercase tracking-wide text-sky-100">
          Donduruldu
        </span>
      )}
    </div>
  );
}
