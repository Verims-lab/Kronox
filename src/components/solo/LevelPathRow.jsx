import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Star } from 'lucide-react';

/**
 * Codex106 — Single row in the Solo Level Path.
 *
 * Pure presentational. Receives:
 *   - level: { levelNumber, title, status, stars, isPlayable }
 *   - selected: boolean (this row is the current target of Play)
 *   - onSelect: () => void
 *
 * Status visual states:
 *   - 'completed' → dimmed but readable; stars filled per level.stars
 *   - 'current'   → highlighted (amber ring + glow), "Sıradaki Mücadele"
 *   - 'locked'    → muted, lock icon, not interactive
 */
export default function LevelPathRow({ level, selected, onSelect }) {
  const { levelNumber, title, status, stars } = level;
  const isLocked = status === 'locked';
  const isCurrent = status === 'current';
  const isCompleted = status === 'completed';

  // Number bubble appearance.
  const bubbleStyle = isCurrent
    ? {
        background: 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 75%)',
        color: '#231405',
        boxShadow:
          '0 0 0 3px rgba(250,204,21,0.35), 0 0 18px rgba(250,204,21,0.55), inset 0 1px 0 rgba(255,255,255,0.45)',
      }
    : isLocked
    ? {
        background: 'rgba(148,163,184,0.10)',
        color: 'rgba(226,232,240,0.45)',
        boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.18)',
      }
    : {
        background: 'rgba(120,160,230,0.10)',
        color: 'rgba(226,232,240,0.55)',
        boxShadow: 'inset 0 0 0 1px rgba(120,160,230,0.28)',
      };

  // Row container appearance.
  const rowStyle = isCurrent
    ? {
        background: 'linear-gradient(180deg, rgba(30,41,75,0.95), rgba(8,14,32,0.98))',
        boxShadow:
          'inset 0 0 0 1.5px rgba(250,204,21,0.65), 0 0 22px rgba(250,204,21,0.28), 0 8px 16px rgba(2,6,23,0.55)',
      }
    : isLocked
    ? {
        background: 'rgba(15,23,42,0.55)',
        boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.10)',
      }
    : {
        background: 'rgba(20,30,58,0.65)',
        boxShadow: 'inset 0 0 0 1px rgba(120,160,230,0.18)',
      };

  const titleOpacity = isLocked ? 0.42 : isCompleted ? 0.72 : 1;

  return (
    <motion.button
      type="button"
      onClick={isLocked ? undefined : onSelect}
      disabled={isLocked}
      whileTap={isLocked ? undefined : { scale: 0.985 }}
      aria-label={`${title}${isLocked ? ' (kilitli)' : ''}`}
      aria-pressed={selected ? 'true' : 'false'}
      aria-disabled={isLocked ? 'true' : 'false'}
      className="relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left disabled:cursor-not-allowed"
      style={{
        ...rowStyle,
        outline: selected && !isLocked ? '1.5px solid rgba(250,204,21,0.85)' : 'none',
        outlineOffset: selected && !isLocked ? '0px' : undefined,
      }}
    >
      {/* Number bubble */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bangers text-base"
        style={bubbleStyle}
      >
        {isLocked ? <Lock className="h-4 w-4" strokeWidth={2.4} /> : levelNumber}
      </div>

      {/* Title block */}
      <div className="min-w-0 flex-1">
        <p
          className="truncate font-inter text-sm font-bold text-white"
          style={{ opacity: titleOpacity }}
        >
          {title}
        </p>
        {isCurrent && (
          <p className="truncate font-inter text-[11px] text-amber-200/80">
            Sıradaki Mücadele
          </p>
        )}
        {isLocked && (
          <p className="truncate font-inter text-[11px] text-blue-100/40">Kilitli</p>
        )}
      </div>

      {/* Stars */}
      <div className="flex shrink-0 items-center gap-0.5" aria-label={`${stars} yıldız`}>
        {[1, 2, 3].map((i) => {
          const filled = !isLocked && i <= stars;
          return (
            <Star
              key={i}
              className="h-4 w-4"
              strokeWidth={1.8}
              style={{
                color: filled ? '#facc15' : 'rgba(226,232,240,0.28)',
                fill: filled ? '#facc15' : 'transparent',
                filter: filled ? 'drop-shadow(0 0 4px rgba(250,204,21,0.55))' : 'none',
              }}
            />
          );
        })}
      </div>
    </motion.button>
  );
}