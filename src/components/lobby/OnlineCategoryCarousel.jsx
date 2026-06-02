import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Crown, Radio, Trophy, Gamepad2 } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';

/**
 * Kronox Online — Compact category carousel (Codex159).
 *
 * Smaller, horizontally-scrollable category cards that match the target
 * design: rounded square card with a category icon at the top, the
 * category name in bold below it, and a short description label at the
 * bottom. Selected card gets a gold ring + a soft gold halo.
 *
 * Props
 *   categories  : Array<{ id, label, description }>
 *   selectedIds : string[]
 *   onToggle(id): toggle handler — parent owns the selection state.
 */

const CATEGORY_ICONS = {
  chronicle: Calendar,
  flashback: Clock,
  kult: Crown,
  viral: Radio,
  arena: Trophy,
  level_up: Gamepad2,
};

const ICON_COLOR = {
  chronicle: '#facc15',
  flashback: '#60a5fa',
  kult: '#c084fc',
  viral: '#f472b6',
  arena: '#34d399',
  level_up: '#fb923c',
};

export default function OnlineCategoryCarousel({ categories, selectedIds, onToggle }) {
  const scrollerRef = useRef(null);
  const [activeDot, setActiveDot] = useState(0);

  const updateDot = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || !categories.length) return;
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
        className="flex gap-3 overflow-x-auto pb-1"
        style={{
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x',
          scrollbarWidth: 'none',
        }}
      >
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id] || Calendar;
          const tint = ICON_COLOR[cat.id] || '#facc15';
          const isSelected = selectedIds.includes(cat.id);
          return (
            <motion.button
              key={cat.id}
              type="button"
              onClick={() => { sounds.tick(); onToggle(cat.id); }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 520, damping: 24 }}
              className="relative shrink-0 rounded-2xl flex flex-col items-center justify-between"
              style={{
                width: '32vw',
                maxWidth: '132px',
                minWidth: '108px',
                aspectRatio: '0.85',
                padding: '12px 10px 10px',
                scrollSnapAlign: 'start',
                background: 'linear-gradient(180deg, rgba(20,32,68,0.9) 0%, rgba(10,18,42,0.96) 60%, rgba(6,10,24,0.98) 100%)',
                boxShadow: isSelected
                  ? 'inset 0 0 0 2px rgba(250,204,21,0.95), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -10px 14px rgba(0,0,0,0.42), 0 0 22px rgba(250,204,21,0.40)'
                  : 'inset 0 0 0 1.5px rgba(120,170,255,0.30), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -10px 14px rgba(0,0,0,0.42), 0 6px 14px rgba(2,6,23,0.5)',
              }}
              aria-pressed={isSelected}
              aria-label={`${cat.label} kategorisini ${isSelected ? 'kaldır' : 'seç'}`}
            >
              {/* Icon */}
              <div className="flex items-center justify-center" style={{ height: 32 }}>
                <Icon
                  style={{
                    width: 26,
                    height: 26,
                    color: tint,
                    filter: `drop-shadow(0 0 6px ${hexAlpha(tint, 0.55)})`,
                  }}
                  strokeWidth={2.2}
                />
              </div>

              {/* Name */}
              <p
                className="font-inter font-black text-center mt-2"
                style={{
                  color: isSelected ? '#ffe066' : '#f1f4ff',
                  fontSize: 'clamp(11px, 3.2vw, 13px)',
                  letterSpacing: '0.05em',
                  textShadow: isSelected ? '0 0 8px rgba(250,204,21,0.55)' : 'none',
                  lineHeight: 1.1,
                }}
              >
                {cat.label}
              </p>

              {/* Description */}
              {cat.description && (
                <p
                  className="font-inter text-center mt-1 line-clamp-2"
                  style={{
                    color: 'rgba(207,224,255,0.65)',
                    fontSize: 'clamp(9px, 2.6vw, 10.5px)',
                    lineHeight: 1.15,
                  }}
                >
                  {cat.description}
                </p>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Pagination dots */}
      <div className="flex justify-center gap-1.5 mt-2" aria-hidden="true">
        {categories.map((_, idx) => (
          <span
            key={idx}
            className="h-1 rounded-full transition-all"
            style={{
              width: idx === activeDot ? '14px' : '4px',
              background: idx === activeDot ? 'rgba(250,204,21,0.85)' : 'rgba(125,211,252,0.30)',
              boxShadow: idx === activeDot ? '0 0 6px rgba(250,204,21,0.55)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function hexAlpha(hex, alpha) {
  const m = String(hex || '').replace('#', '').match(/^([\da-f]{6})$/i);
  if (!m) return `rgba(250,204,21,${alpha})`;
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}