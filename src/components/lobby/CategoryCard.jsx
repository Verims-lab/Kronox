import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

/**
 * Premium poster-style category card for the Online Challenge landing screen.
 * Visual-only component. Does not own any business logic.
 */
export default function CategoryCard({ category, selected, onClick }) {
  const { Icon, tone, glow } = category;

  const frameColor = selected ? '#facc15' : tone;
  const frameGlow = selected ? 'rgba(250,204,21,0.78)' : glow;

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
          ? `drop-shadow(0 0 22px ${frameGlow}) drop-shadow(0 16px 16px rgba(0,0,0,0.74))`
          : `drop-shadow(0 0 14px ${glow}) drop-shadow(0 12px 14px rgba(0,0,0,0.64))`,
      }}
      aria-pressed={selected}
      aria-label={`${category.label} kategorisini seç`}
    >
      {/* Outer poster silhouette */}
      <span
        className="absolute inset-0"
        style={{
          clipPath: 'polygon(7% 0, 93% 0, 100% 8%, 100% 92%, 93% 100%, 7% 100%, 0 92%, 0 8%)',
          background: 'linear-gradient(180deg, rgba(28,10,52,0.98) 0%, rgba(10,4,22,1) 58%, rgba(2,1,8,1) 100%)',
          boxShadow: [
            `inset 0 0 0 ${selected ? '2px' : '1px'} ${frameColor}`,
            `inset 0 0 28px ${selected ? frameGlow : 'rgba(168,85,247,0.22)'}`,
            'inset 0 1px 0 rgba(255,255,255,0.16)',
            'inset 0 -22px 22px rgba(0,0,0,0.7)',
          ].join(', '),
        }}
      />

      {/* Inner frame */}
      <span
        className="absolute"
        style={{
          inset: '6%',
          clipPath: 'polygon(8% 0, 92% 0, 100% 10%, 100% 90%, 92% 100%, 8% 100%, 0 90%, 0 10%)',
          background: [
            `radial-gradient(circle at 50% 28%, ${glow}, transparent 48%)`,
            'linear-gradient(180deg, rgba(58,18,96,0.62) 0%, rgba(8,4,20,0.92) 72%)',
          ].join(', '),
          boxShadow: [
            `inset 0 0 0 1px ${selected ? 'rgba(255,236,140,0.55)' : 'rgba(216,180,254,0.28)'}`,
            'inset 0 0 22px rgba(0,0,0,0.62)',
          ].join(', '),
          opacity: selected ? 1 : 0.92,
        }}
      />

      <CategoryScene category={category} selected={selected} />

      {/* Diagonal highlight */}
      <span
        className="pointer-events-none absolute"
        aria-hidden="true"
        style={{
          inset: '6%',
          background: 'linear-gradient(118deg, transparent 0 18%, rgba(255,255,255,0.18) 19% 22%, transparent 23% 100%)',
          clipPath: 'polygon(8% 0, 92% 0, 100% 10%, 100% 90%, 92% 100%, 8% 100%, 0 90%, 0 10%)',
          opacity: 0.7,
        }}
      />

      {/* Icon medallion */}
      <span
        className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full"
        style={{
          top: '24%',
          width: '34%',
          aspectRatio: '1',
          color: selected ? '#fff7c2' : tone,
          background: selected
            ? 'radial-gradient(circle, rgba(255,247,194,0.22), rgba(0,0,0,0.6) 62%, rgba(0,0,0,0))'
            : 'radial-gradient(circle, rgba(255,255,255,0.12), rgba(0,0,0,0.62) 60%, rgba(0,0,0,0))',
          filter: `drop-shadow(0 0 14px ${frameGlow})`,
        }}
      >
        <Icon className="h-[56%] w-[56%]" strokeWidth={selected ? 2.7 : 2.2} />
      </span>

      {/* Label ridge */}
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2"
        aria-hidden="true"
        style={{
          bottom: '28%',
          width: '52%',
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${frameColor}, transparent)`,
          opacity: selected ? 0.9 : 0.55,
          boxShadow: `0 0 8px ${frameGlow}`,
        }}
      />

      {/* Label */}
      <span
        className="absolute inset-x-[8%] block truncate text-center font-cinzel font-black"
        style={{
          bottom: '12%',
          fontSize: '13cqw',
          lineHeight: 1,
          letterSpacing: 0,
          color: selected ? '#fff7c2' : '#ffffff',
          textShadow: `0 0 12px ${frameGlow}, 0 2px 5px rgba(0,0,0,0.82)`,
        }}
      >
        {category.label}
      </span>

      {/* Integrated selected ribbon */}
      {selected && (
        <>
          <span
            className="pointer-events-none absolute right-0 top-0"
            aria-hidden="true"
            style={{
              width: '28%',
              aspectRatio: '1',
              clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
              background: 'linear-gradient(225deg, #facc15 0%, #d97706 70%, transparent 71%)',
              boxShadow: '0 0 14px rgba(250,204,21,0.7)',
            }}
          />
          <span
            className="absolute right-[6%] top-[6%] flex items-center justify-center"
            style={{
              width: '14%',
              aspectRatio: '1',
              color: '#1a0a00',
            }}
          >
            <Check className="h-full w-full" strokeWidth={3.4} />
          </span>
        </>
      )}
    </motion.button>
  );
}

function CategoryScene({ category, selected }) {
  const opacity = selected ? 0.92 : 0.62;
  return (
    <svg className="absolute inset-[6%] h-[88%] w-[88%]" viewBox="0 0 220 260" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id={`${category.id}-pulse`} cx="50%" cy="32%" r="58%">
          <stop offset="0%" stopColor={category.tone} stopOpacity={selected ? '0.74' : '0.44'} />
          <stop offset="100%" stopColor={category.tone} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="220" height="260" fill={`url(#${category.id}-pulse)`} opacity={opacity} />
      <g stroke={category.tone} strokeWidth="1.4" fill="none" opacity={selected ? 0.72 : 0.46}>
        <path d="M18 198 C58 148 162 148 202 198" />
        <path d="M36 208 C74 172 146 172 184 208" />
        <path d="M110 64 V208" strokeOpacity="0.42" />
        <path d="M32 220 H188" strokeOpacity="0.32" />
      </g>
      <g fill={category.tone} opacity={selected ? 0.34 : 0.22}>
        <circle cx="38" cy="50" r="2" />
        <circle cx="178" cy="70" r="1.8" />
        <circle cx="64" cy="112" r="1.5" />
        <circle cx="192" cy="130" r="1.4" />
      </g>
      {category.scene === 'portal' && (
        <g fill="none" stroke={category.tone} strokeWidth="5" opacity={selected ? 0.66 : 0.46}>
          <circle cx="110" cy="92" r="46" />
          <circle cx="110" cy="92" r="28" strokeWidth="3" opacity={0.55} />
        </g>
      )}
      {category.scene === 'ritual' && (
        <path d="M110 44 L150 116 H70 Z M110 68 L132 106 H88 Z" fill="none" stroke={category.tone} strokeWidth="5" opacity={selected ? 0.68 : 0.46} />
      )}
      {category.scene === 'signal' && (
        <g fill="none" stroke={category.tone} strokeWidth="5" opacity={selected ? 0.62 : 0.44}>
          <path d="M60 86 L166 58 L178 124 L72 152 Z" />
          <path d="M78 102 L160 82" strokeWidth="3" opacity={0.7} />
        </g>
      )}
      {category.scene === 'arena' && (
        <path d="M72 82 H148 V110 C148 146 125 164 110 170 C95 164 72 146 72 110 Z" fill="none" stroke={category.tone} strokeWidth="5" opacity={selected ? 0.66 : 0.46} />
      )}
      {category.scene === 'ascent' && (
        <path d="M70 144 L110 102 L150 144 M74 108 L110 72 L146 108" fill="none" stroke={category.tone} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity={selected ? 0.66 : 0.46} />
      )}
      {category.scene === 'hourglass' && (
        <path d="M78 54 H142 C136 92 123 102 110 116 C97 102 84 92 78 54 Z M78 178 H142 C136 140 123 130 110 116 C97 130 84 140 78 178 Z" fill="none" stroke={category.tone} strokeWidth="5" opacity={selected ? 0.68 : 0.46} />
      )}
      <path d="M0 260 C42 226 178 226 220 260 Z" fill="rgba(0,0,0,0.62)" />
    </svg>
  );
}