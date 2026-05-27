import React from 'react';
import { Timer } from 'lucide-react';

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
 *   - totalSeconds:    number  total budget (120 for solo levels)
 *   - elapsedSeconds:  number  seconds elapsed so far
 *
 * Styling rules:
 *   - Mobile-friendly: fixed compact size, lives in the existing top-right
 *     slot so it does NOT overlap card/timeline/drag UI.
 *   - Color hardens (amber → red glow) when ≤ 10 s remain so the player
 *     gets a clear danger cue.
 */
export default function SoloLevelTimer({ totalSeconds = 120, elapsedSeconds = 0 }) {
  const remaining = Math.max(0, Math.ceil(totalSeconds - elapsedSeconds));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const label = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const danger = remaining <= 10;

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bangers text-base tracking-wider"
      style={{
        background: danger
          ? 'linear-gradient(180deg, rgba(220,38,38,0.92), rgba(127,29,29,0.96))'
          : 'linear-gradient(180deg, rgba(20,30,58,0.92), rgba(4,8,22,0.96))',
        color: danger ? '#fff5f5' : '#facc15',
        boxShadow: danger
          ? '0 0 0 1px rgba(248,113,113,0.65), 0 0 16px rgba(220,38,38,0.55)'
          : '0 0 0 1px rgba(250,204,21,0.45), 0 0 12px rgba(250,204,21,0.25)',
        minWidth: 78,
        justifyContent: 'center',
      }}
      aria-label={`Kalan süre ${label}`}
    >
      <Timer className="h-4 w-4" strokeWidth={2.4} />
      <span style={{ letterSpacing: '0.04em' }}>{label}</span>
    </div>
  );
}