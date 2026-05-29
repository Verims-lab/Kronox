import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Star, Play } from 'lucide-react';

/**
 * Codex108 — Single node on the Solo Level Map.
 *
 * Presentational only. Receives:
 *   level    : { levelNumber, title, status, stars, isPlayable }
 *   selected : boolean — currently armed for the Play button
 *   onSelect : () => void
 *
 * Visual states:
 *   - completed → gold tone, dimmed, stars filled per level.stars, still tappable
 *   - current   → bright amber, glow ring, "Sıradaki Mücadele" hint, pulse
 *   - locked    → muted slate, lock icon, NOT interactive
 *
 * Tap target: ~88px circle so it stays comfortable on small phones and
 * never conflicts with vertical scroll (no horizontal drag).
 */
export default function LevelMapNode({ level, selected, onSelect }) {
  const { levelNumber, status, stars } = level;
  const isLocked = status === 'locked';
  const isCurrent = status === 'current';
  const isCompleted = status === 'completed';

  // Circle (node) appearance.
  const circleStyle = isCurrent
    ? {
        background: 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 75%)',
        color: '#231405',
        boxShadow:
          '0 0 0 4px rgba(250,204,21,0.30), 0 0 28px rgba(250,204,21,0.65), inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -8px 10px rgba(140,80,8,0.5)',
      }
    : isCompleted
    ? {
        background: 'radial-gradient(circle at 35% 28%, rgba(250,204,21,0.55), rgba(120,80,12,0.55) 75%)',
        color: '#facc15',
        boxShadow:
          '0 0 0 2px rgba(250,204,21,0.30), 0 0 14px rgba(250,204,21,0.30), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -6px 8px rgba(60,40,10,0.55)',
      }
    : {
        background: 'radial-gradient(circle at 35% 28%, rgba(80,100,140,0.45), rgba(20,30,50,0.85) 75%)',
        color: 'rgba(226,232,240,0.55)',
        boxShadow:
          'inset 0 0 0 1.5px rgba(120,140,180,0.25), inset 0 -6px 8px rgba(0,0,0,0.5)',
      };

  return (
    <motion.button
      type="button"
      onClick={isLocked ? undefined : onSelect}
      disabled={isLocked}
      whileTap={isLocked ? undefined : { scale: 0.92 }}
      animate={
        isCurrent
          ? { scale: [1, 1.06, 1] }
          : selected && !isLocked
          ? { scale: 1.04 }
          : { scale: 1 }
      }
      transition={
        isCurrent
          ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 360, damping: 22 }
      }
      aria-label={`Level ${levelNumber}${isLocked ? ' (kilitli)' : ''}`}
      aria-pressed={selected ? 'true' : 'false'}
      aria-disabled={isLocked ? 'true' : 'false'}
      className="relative flex flex-col items-center disabled:cursor-not-allowed"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Selected outer ring */}
      {selected && !isLocked && (
        <span
          aria-hidden="true"
          className="absolute -inset-1.5 rounded-full"
          style={{
            boxShadow: '0 0 0 2px rgba(250,204,21,0.85), 0 0 22px rgba(250,204,21,0.45)',
          }}
        />
      )}

      {/* Stars above the node — only for completed levels */}
      {isCompleted && (
        <div
          className="mb-1 flex items-center gap-0.5"
          aria-label={`${stars} yıldız`}
        >
          {[1, 2, 3].map((i) => {
            const filled = i <= stars;
            return (
              <Star
                key={i}
                className="h-3.5 w-3.5"
                strokeWidth={1.8}
                style={{
                  color: filled ? '#facc15' : 'rgba(226,232,240,0.25)',
                  fill: filled ? '#facc15' : 'transparent',
                  filter: filled ? 'drop-shadow(0 0 4px rgba(250,204,21,0.55))' : 'none',
                }}
              />
            );
          })}
        </div>
      )}

      {/* The circular node */}
      <div
        className="flex h-[78px] w-[78px] items-center justify-center rounded-full font-bangers text-[28px] leading-none"
        style={circleStyle}
      >
        {isLocked ? (
          <Lock className="h-7 w-7" strokeWidth={2.4} />
        ) : isCurrent ? (
          <span className="flex flex-col items-center gap-0.5">
            <span>{levelNumber}</span>
          </span>
        ) : (
          <span>{levelNumber}</span>
        )}
      </div>

      {/* Hint under the node */}
      {isCurrent && (
        <span
          className="mt-1 rounded-full px-2 py-0.5 font-inter text-[10px] font-black uppercase tracking-widest text-amber-100"
          style={{
            background: 'rgba(250,204,21,0.12)',
            boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.45)',
          }}
        >
          Sıradaki
        </span>
      )}
      {!isCurrent && !isLocked && !isCompleted && (
        <span className="mt-1 font-inter text-[10px] text-blue-100/50">Hazır</span>
      )}
      {isLocked && (
        <span className="mt-1 font-inter text-[10px] text-blue-100/35">Kilitli</span>
      )}
      {isCompleted && selected && (
        <span className="mt-1 flex items-center gap-1 font-inter text-[10px] font-black uppercase tracking-widest text-amber-200">
          <Play className="h-2.5 w-2.5" fill="currentColor" /> Tekrar
        </span>
      )}
    </motion.button>
  );
}