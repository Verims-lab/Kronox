import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Hourglass, Zap, Landmark, Radio, Trophy, Gamepad2, ScrollText, Check } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';

/**
 * Kronox Online — Horizontal category carousel (Codex127).
 *
 * Multiple-select horizontal scroller for the six Online categories.
 * Each card uses the Kronox premium fantasy frame: gold gradient + stone
 * bevel when selected, blue stone when unselected. The whole row scrolls
 * horizontally with snap; pagination dots reflect the currently centered
 * card group for orientation only (purely visual).
 *
 * Props:
 *   categories         : Array<{ id, label }>
 *   selectedIds        : Array<string>
 *   onToggle(id)       : selection toggle (parent owns state)
 *
 * Layout contract: zero vertical scroll. Width = 100% of parent; cards
 * sized to fit ~2.6 per viewport on mobile, snap to start.
 */

const CATEGORY_ICONS = {
  flashback: Zap,
  kult: Landmark,
  viral: Radio,
  arena: Trophy,
  level_up: Gamepad2,
  chronicle: ScrollText,
};

export default function OnlineCategoryCarousel({ categories, selectedIds, onToggle }) {
  const scrollerRef = useRef(null);
  const [activeDot, setActiveDot] = useState(0);

  // Update active dot based on scroll position (purely visual).
  const updateDot = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.scrollWidth / categories.length;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveDot(Math.min(categories.length - 1, Math.max(0, idx)));
  }, [categories.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateDot, { passive: true });
    return () => el.removeEventListener('scroll', updateDot);
  }, [updateDot]);

  return (
    <div className="w-full">
      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto pb-2"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x',
          scrollbarWidth: 'none',
        }}
      >
        <style>{`.kx-cat-scroll::-webkit-scrollbar{display:none}`}</style>
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] || Hourglass;
          const isSelected = selectedIds.includes(cat.id);
          return (
            <motion.button
              key={cat.id}
              type="button"
              onClick={() => { sounds.tick(); onToggle(cat.id); }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 520, damping: 24 }}
              className="relative shrink-0 rounded-2xl p-3 flex flex-col items-center justify-between"
              style={{
                width: '38vw',
                maxWidth: '160px',
                minWidth: '120px',
                aspectRatio: '0.78',
                scrollSnapAlign: 'start',
                background: isSelected
                  ? 'linear-gradient(180deg, rgba(250,204,21,0.16) 0%, rgba(120,80,8,0.10) 50%, rgba(6,10,24,0.95) 100%)'
                  : 'linear-gradient(180deg, rgba(30,41,75,0.92) 0%, rgba(14,22,46,0.96) 60%, rgba(6,10,24,0.98) 100%)',
                boxShadow: isSelected
                  ? 'inset 0 0 0 2px rgba(250,204,21,0.95), inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -12px 16px rgba(0,0,0,0.45), 0 0 22px rgba(250,204,21,0.45), 0 8px 18px rgba(2,6,23,0.55)'
                  : 'inset 0 0 0 1.5px rgba(120,170,255,0.32), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -10px 14px rgba(0,0,0,0.42), 0 6px 14px rgba(2,6,23,0.5)',
              }}
              aria-pressed={isSelected}
              aria-label={`${cat.label} kategorisini ${isSelected ? 'kaldır' : 'seç'}`}
            >
              {isSelected && (
                <div
                  className="absolute -top-1.5 -right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full"
                  style={{
                    background: 'linear-gradient(180deg,#ffe066,#b97a06)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 0 10px rgba(250,204,21,0.6)',
                  }}
                >
                  <Check className="h-3.5 w-3.5 text-amber-950" strokeWidth={3.2} />
                </div>
              )}

              {/* Icon disc */}
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{
                  background: isSelected
                    ? 'radial-gradient(circle at 35% 28%, #ffe066, #b97a06 75%)'
                    : 'radial-gradient(circle at 35% 28%, rgba(125,211,252,0.85), rgba(30,58,138,0.95) 75%)',
                  boxShadow: isSelected
                    ? 'inset 0 1px 0 rgba(255,255,255,0.5), 0 0 16px rgba(250,204,21,0.5)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.32), 0 0 12px rgba(59,130,246,0.4)',
                }}
              >
                <Icon className={isSelected ? 'h-7 w-7 text-amber-950' : 'h-7 w-7 text-blue-50'} strokeWidth={2.2} />
              </div>

              {/* Label */}
              <p
                className="font-cinzel text-[12px] font-black tracking-[0.16em] text-center mt-2"
                style={{
                  color: isSelected ? '#ffe066' : '#cfe0ff',
                  textShadow: isSelected ? '0 0 10px rgba(250,204,21,0.55)' : 'none',
                }}
              >
                {cat.label}
              </p>

              {/* Selected ribbon (subtle) */}
              {isSelected && (
                <p
                  className="font-inter text-[9px] font-black tracking-widest uppercase mt-1"
                  style={{ color: 'rgba(255,224,102,0.85)' }}
                >
                  SEÇİLDİ
                </p>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Pagination dots — purely visual orientation hint */}
      <div className="flex justify-center gap-1.5 mt-1.5" aria-hidden="true">
        {categories.map((_, idx) => (
          <span
            key={idx}
            className="h-1 rounded-full transition-all"
            style={{
              width: idx === activeDot ? '14px' : '4px',
              background: idx === activeDot ? 'rgba(250,204,21,0.85)' : 'rgba(125,211,252,0.35)',
              boxShadow: idx === activeDot ? '0 0 6px rgba(250,204,21,0.55)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}