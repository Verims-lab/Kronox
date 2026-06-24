import React from 'react';
import { motion } from 'framer-motion';

// Kronox guided-tutorial hand pointer.
//
// A clean, natural touch-guide hand (index finger extended, other fingers
// curled) drawn as inline SVG. Replaces the old heavy yellow circular badge:
// the hand carries its own crisp outline + a SUBTLE glow that sits BEHIND the
// hand only — no dominant yellow disk.
//
// Tutorial-only / decorative: the wrapper is always pointer-events:none so it
// never blocks drag, tap, hit-testing, or timeline scroll. `mode` only tweaks
// the press micro-animation feel (drag / tap / swipe); positioning and path
// motion stay owned by the caller.

const PRESS_BY_MODE = {
  drag: { scale: [1, 0.92, 1], duration: 1.1 },
  tap: { scale: [1, 0.82, 1], duration: 0.9 },
  swipe: { scale: [1, 0.95, 1], duration: 1.2 },
};

function HandGlyph({ size = 44 }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 80"
      width={size}
      height={size * (80 / 64)}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Index finger extended, other three fingers + thumb curled into the
          palm — a natural pointing/tapping hand. Light warm fill, crisp navy
          outline so it reads cleanly on the dark blue Kronox background. */}
      <path
        d="M27 6
           c-3 0-5.4 2.4-5.4 5.4
           v25.8
           l-6.1-3.4
           c-2.6-1.4-5.8-0.4-7 2.2
           c-1 2.3-0.3 5 1.7 6.6
           l9.4 7.4
           c1.2 4.4 3.1 9.4 6.4 13.2
           c3.1 3.6 7.4 5.6 12 5.6
           h3.1
           c8 0 13.9-5.9 14.6-13.6
           l1.1-12.4
           c0.3-3-1.9-5.6-4.9-5.8
           c-1.6-0.1-3.1 0.5-4.1 1.6
           l0.2-2.1
           c0.3-3-1.9-5.6-4.9-5.8
           c-1.7-0.1-3.2 0.6-4.2 1.7
           c-0.2-2.8-2.5-5-5.3-5
           c-1.2 0-2.3 0.4-3.2 1.1
           v-15.1
           c0-3-2.4-5.4-5.4-5.4z"
        fill="#fdf3d3"
        stroke="#0c1226"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Soft top highlight on the index finger for a tactile, lit look. */}
      <path
        d="M27 10.5
           c-1.4 0-2.4 1-2.4 2.4
           v22"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.65"
      />
      {/* Subtle knuckle creases on the curled fingers. */}
      <path d="M37 36.5c1.4-1.4 4-1.4 5.4 0" fill="none" stroke="#d7b56a" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      <path d="M44.5 38c1.3-1.2 3.6-1.2 4.8 0" fill="none" stroke="#d7b56a" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export default function TutorialHandPointer({
  mode = 'drag',
  size = 44,
  className = '',
  style = null,
}) {
  const press = PRESS_BY_MODE[mode] || PRESS_BY_MODE.drag;

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none relative inline-flex items-center justify-center ${className}`}
      style={style || undefined}
    >
      {/* Subtle accent glow — behind the hand only, never a hard disk. */}
      <span
        aria-hidden="true"
        className="absolute rounded-full"
        style={{
          width: size * 0.9,
          height: size * 0.9,
          background:
            'radial-gradient(circle, rgba(250,204,21,0.45) 0%, rgba(250,204,21,0.16) 45%, rgba(250,204,21,0) 72%)',
          filter: 'blur(1px)',
        }}
      />
      <motion.span
        className="relative"
        style={{
          transformOrigin: '28% 18%',
          filter: 'drop-shadow(0 4px 8px rgba(2,6,23,0.55))',
          willChange: 'transform',
        }}
        animate={{ scale: press.scale, rotate: -22 }}
        transition={{ duration: press.duration, repeat: Infinity, ease: 'easeInOut' }}
      >
        <HandGlyph size={size} />
      </motion.span>
    </span>
  );
}