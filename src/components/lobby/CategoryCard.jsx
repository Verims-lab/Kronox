import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

/**
 * Kronox v2 — Premium fantasy collectible category card.
 * Stone-framed plate with royal-blue inner portal and gold trim.
 * Selected state lights up the gold frame and adds an embedded ribbon.
 *
 * Visual-only. Does not own business logic.
 */
export default function CategoryCard({ category, selected, onClick }) {
  const { Icon } = category;

  const frameColor = selected ? '#facc15' : 'rgba(148,168,210,0.55)';
  const frameGlow = selected
    ? 'rgba(250,204,21,0.62)'
    : 'rgba(59,130,246,0.34)';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.955, y: 3 }}
      animate={{ y: selected ? -3 : 0 }}
      transition={{ type: 'spring', stiffness: 560, damping: 26 }}
      className="relative h-full w-full overflow-visible border-0 bg-transparent text-white"
      style={{
        containerType: 'size',
        filter: selected
          ? `drop-shadow(0 0 22px ${frameGlow}) drop-shadow(0 16px 16px rgba(0,0,0,0.62))`
          : 'drop-shadow(0 0 12px rgba(59,130,246,0.22)) drop-shadow(0 12px 14px rgba(0,0,0,0.55))',
      }}
      aria-pressed={selected}
      aria-label={`${category.label} kategorisini seç`}
    >
      {/* Outer stone silhouette */}
      <span
        className="absolute inset-0"
        style={{
          clipPath:
            'polygon(7% 0, 93% 0, 100% 8%, 100% 92%, 93% 100%, 7% 100%, 0 92%, 0 8%)',
          background:
            'linear-gradient(180deg, rgba(54,68,108,0.96) 0%, rgba(28,36,68,1) 48%, rgba(12,18,38,1) 100%)',
          boxShadow: [
            `inset 0 0 0 ${selected ? '2px' : '1.5px'} ${frameColor}`,
            'inset 0 1px 0 rgba(255,255,255,0.18)',
            'inset 0 -22px 22px rgba(0,0,0,0.62)',
            `inset 0 0 26px ${frameGlow}`,
          ].join(', '),
        }}
      />

      {/* Inner portal frame */}
      <span
        className="absolute"
        style={{
          inset: '6%',
          clipPath:
            'polygon(8% 0, 92% 0, 100% 10%, 100% 90%, 92% 100%, 8% 100%, 0 90%, 0 10%)',
          background: [
            'radial-gradient(circle at 50% 30%, rgba(59,130,246,0.45), transparent 52%)',
            'linear-gradient(180deg, rgba(20,40,86,0.85) 0%, rgba(6,12,28,0.96) 72%)',
          ].join(', '),
          boxShadow: [
            `inset 0 0 0 1px ${selected ? 'rgba(255,236,140,0.55)' : 'rgba(120,170,255,0.32)'}`,
            'inset 0 0 22px rgba(0,0,0,0.55)',
            'inset 0 0 18px rgba(59,130,246,0.22)',
          ].join(', '),
        }}
      />

      <CategoryScene category={category} selected={selected} />

      {/* Diagonal highlight ridge */}
      <span
        className="pointer-events-none absolute"
        aria-hidden="true"
        style={{
          inset: '6%',
          background:
            'linear-gradient(118deg, transparent 0 18%, rgba(255,255,255,0.16) 19% 22%, transparent 23% 100%)',
          clipPath:
            'polygon(8% 0, 92% 0, 100% 10%, 100% 90%, 92% 100%, 8% 100%, 0 90%, 0 10%)',
          opacity: 0.7,
        }}
      />

      {/* Icon medallion — gold-rimmed */}
      <span
        className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full"
        style={{
          top: '22%',
          width: '36%',
          aspectRatio: '1',
          color: selected ? '#fff7c2' : '#fde68a',
          background:
            'radial-gradient(circle at 35% 28%, rgba(255,236,140,0.32), rgba(8,12,28,0.85) 62%, rgba(0,0,0,0))',
          boxShadow: [
            `inset 0 0 0 1.5px ${selected ? '#facc15' : 'rgba(250,204,21,0.55)'}`,
            'inset 0 1px 0 rgba(255,236,140,0.55)',
            `0 0 14px ${selected ? 'rgba(250,204,21,0.7)' : 'rgba(59,130,246,0.45)'}`,
          ].join(', '),
        }}
      >
        <Icon className="h-[54%] w-[54%]" strokeWidth={selected ? 2.8 : 2.3} />
      </span>

      {/* Label ridge separator */}
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        aria-hidden="true"
        style={{
          bottom: '28%',
          width: '54%',
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${
            selected ? '#facc15' : 'rgba(120,170,255,0.7)'
          }, transparent)`,
          opacity: selected ? 0.95 : 0.6,
          boxShadow: `0 0 8px ${frameGlow}`,
        }}
      />

      {/* Label */}
      <span
        className="absolute inset-x-[8%] block truncate text-center font-cinzel font-black"
        style={{
          bottom: '12%',
          fontSize: '12cqw',
          lineHeight: 1,
          letterSpacing: 0,
          color: selected ? '#fff7c2' : '#ffffff',
          textShadow: `0 0 12px ${frameGlow}, 0 2px 5px rgba(0,0,0,0.82)`,
        }}
      >
        {category.label}
      </span>

      {/* Integrated selected ribbon (gold triangular badge with check) */}
      {selected && (
        <>
          <span
            className="pointer-events-none absolute right-0 top-0"
            aria-hidden="true"
            style={{
              width: '28%',
              aspectRatio: '1',
              clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
              background:
                'linear-gradient(225deg, #ffe066 0%, #d97706 70%, transparent 71%)',
              boxShadow: '0 0 14px rgba(250,204,21,0.7)',
            }}
          />
          <span
            className="absolute right-[6%] top-[6%] flex items-center justify-center"
            style={{ width: '14%', aspectRatio: '1', color: '#1a0a00' }}
          >
            <Check className="h-full w-full" strokeWidth={3.4} />
          </span>
        </>
      )}
    </motion.button>
  );
}

function CategoryScene({ category, selected }) {
  const blue = '#60a5fa';
  const cyan = '#22d3ee';
  const opacity = selected ? 0.95 : 0.7;

  return (
    <svg
      className="absolute inset-[6%] h-[88%] w-[88%]"
      viewBox="0 0 220 260"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${category.id}-pulse`} cx="50%" cy="30%" r="58%">
          <stop offset="0%" stopColor={blue} stopOpacity={selected ? '0.55' : '0.36'} />
          <stop offset="100%" stopColor={blue} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="220" height="260" fill={`url(#${category.id}-pulse)`} opacity={opacity} />

      {/* Portal energy arcs */}
      <g stroke={cyan} strokeWidth="1.4" fill="none" opacity={selected ? 0.62 : 0.4}>
        <path d="M18 198 C58 148 162 148 202 198" />
        <path d="M36 208 C74 172 146 172 184 208" />
      </g>

      {/* Floating sparkles */}
      <g fill={cyan} opacity={selected ? 0.5 : 0.32}>
        <circle cx="38" cy="50" r="2" />
        <circle cx="178" cy="70" r="1.8" />
        <circle cx="64" cy="112" r="1.5" />
        <circle cx="192" cy="130" r="1.4" />
      </g>

      {/* Scene-specific motifs */}
      {category.scene === 'portal' && (
        <g fill="none" stroke={cyan} strokeWidth="5" opacity={selected ? 0.7 : 0.48}>
          <circle cx="110" cy="92" r="46" />
          <circle cx="110" cy="92" r="28" strokeWidth="3" opacity={0.6} />
        </g>
      )}
      {category.scene === 'ritual' && (
        <path
          d="M110 44 L150 116 H70 Z M110 68 L132 106 H88 Z"
          fill="none"
          stroke={cyan}
          strokeWidth="5"
          opacity={selected ? 0.7 : 0.48}
        />
      )}
      {category.scene === 'signal' && (
        <g fill="none" stroke={cyan} strokeWidth="5" opacity={selected ? 0.66 : 0.46}>
          <path d="M60 86 L166 58 L178 124 L72 152 Z" />
          <path d="M78 102 L160 82" strokeWidth="3" opacity={0.7} />
        </g>
      )}
      {category.scene === 'arena' && (
        <path
          d="M72 82 H148 V110 C148 146 125 164 110 170 C95 164 72 146 72 110 Z"
          fill="none"
          stroke={cyan}
          strokeWidth="5"
          opacity={selected ? 0.7 : 0.48}
        />
      )}
      {category.scene === 'ascent' && (
        <path
          d="M70 144 L110 102 L150 144 M74 108 L110 72 L146 108"
          fill="none"
          stroke={cyan}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={selected ? 0.7 : 0.48}
        />
      )}
      {category.scene === 'hourglass' && (
        <path
          d="M78 54 H142 C136 92 123 102 110 116 C97 102 84 92 78 54 Z M78 178 H142 C136 140 123 130 110 116 C97 130 84 140 78 178 Z"
          fill="none"
          stroke={cyan}
          strokeWidth="5"
          opacity={selected ? 0.7 : 0.48}
        />
      )}

      {/* Bottom shadow */}
      <path d="M0 260 C42 226 178 226 220 260 Z" fill="rgba(0,0,0,0.66)" />
    </svg>
  );
}