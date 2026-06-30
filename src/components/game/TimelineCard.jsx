import React from 'react';
import { motion } from 'framer-motion';
import {
  OLD_PAPER_CARD_BACKGROUND,
  OLD_PAPER_INSET_SHADOW,
} from './cardSurfaceStyles';

// Per-index neon colors cycling (non-yearOnly media cards keep the legacy
// palette so question artwork variety is preserved).
const cardColors = [
  { border: '#22c55e', year: '#22c55e', bg: 'rgba(34,197,94,0.08)' },    // green
  { border: '#818cf8', year: '#818cf8', bg: 'rgba(129,140,248,0.08)' },  // indigo
  { border: '#f87171', year: '#f87171', bg: 'rgba(248,113,113,0.08)' },  // red
  { border: '#06b6d4', year: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },    // cyan
  { border: '#facc15', year: '#facc15', bg: 'rgba(250,204,21,0.08)' },   // yellow
  { border: '#c084fc', year: '#c084fc', bg: 'rgba(192,132,252,0.08)' },  // purple
];

// Unified cyan timeline year-card visual contract (Solo + Online share this).
const TIMELINE_YEAR_CARD_BORDER = '1.5px solid rgba(85, 216, 255, 0.45)';
const TIMELINE_YEAR_CARD_SHADOW = [
  '0 5px 14px rgba(0, 0, 0, 0.20)',
  'inset 0 1px 0 rgba(255, 255, 255, 0.16)',
].join(', ');
const TIMELINE_YEAR_TEXT_COLOR = '#123A63';

const TIMELINE_CARD_WIDTH = 'var(--solo-timeline-card-width, 80px)';
const TIMELINE_CARD_HEIGHT = 'var(--solo-timeline-card-height, 120px)';
const TIMELINE_CARD_ASPECT_RATIO = '2 / 3';

export default function TimelineCard({ card, index, distanceFromCenter = 0, yearOnly = false }) {
  const stackCount = card.stackCount || 1;
  const color = cardColors[index % cardColors.length];
  const yearOnlyBackground = OLD_PAPER_CARD_BACKGROUND;
  // Subtle de-emphasis for cards far from the center viewport (max 30% opacity reduction)
  const fadeOpacity = Math.max(0.7, 1 - Math.min(distanceFromCenter, 1) * 0.3);

  const lines = (card.question || '').split('\n');
  const title = lines[0] || card.question || '';
  const artist = lines[1] || card.artist || '';

  return (
    <div className="relative flex-shrink-0" style={{ width: TIMELINE_CARD_WIDTH, opacity: fadeOpacity, transition: 'opacity 0.4s ease' }}>
      {/* Stack shadow layers */}
      {stackCount > 1 && (
        <>
          <div className="absolute rounded-2xl" style={{
            inset: 0,
            background: yearOnly ? yearOnlyBackground : 'rgba(15,20,40,0.9)',
            border: `1.5px solid ${color.border}`,
            transform: 'translate(4px, 4px)',
            opacity: 0.4,
            zIndex: 0,
          }} />
          <div className="absolute rounded-2xl" style={{
            inset: 0,
            background: yearOnly ? yearOnlyBackground : 'rgba(15,20,40,0.9)',
            border: `1.5px solid ${color.border}`,
            transform: 'translate(8px, 8px)',
            opacity: 0.2,
            zIndex: 0,
          }} />
        </>
      )}

      <motion.div
        initial={yearOnly ? { scale: 0.96, opacity: 0.85 } : { scale: 0.5, opacity: 0 }}
        animate={yearOnly ? { scale: [0.96, 1.03, 1], opacity: [0.85, 1, 1] } : { scale: 1, opacity: 1 }}
        transition={yearOnly ? { duration: 0.24 } : { delay: index * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
        className="relative flex flex-col items-center rounded-2xl select-none z-10"
        style={{
          width: TIMELINE_CARD_WIDTH,
          height: TIMELINE_CARD_HEIGHT,
          minHeight: TIMELINE_CARD_HEIGHT,
          aspectRatio: TIMELINE_CARD_ASPECT_RATIO,
          background: card.media_url
            ? (yearOnly ? yearOnlyBackground : 'transparent')
            : (yearOnly ? yearOnlyBackground : `linear-gradient(160deg, rgba(15,20,40,0.95) 0%, rgba(10,15,35,0.98) 100%)`),
          border: yearOnly ? TIMELINE_YEAR_CARD_BORDER : `2px solid ${color.border}`,
          boxShadow: yearOnly
            ? `${TIMELINE_YEAR_CARD_SHADOW}, ${OLD_PAPER_INSET_SHADOW}`
            : `0 0 12px ${color.border}50, 0 0 4px ${color.border}30`,
          padding: yearOnly ? 0 : (card.media_url ? '0' : '8px 6px 6px'),
          overflow: 'hidden',
          justifyContent: yearOnly ? 'center' : undefined,
        }}
      >
        {yearOnly ? (
          <div className="flex h-full w-full items-center justify-center px-2">
            <span
              className="kronox-timeline-number"
              style={{
                fontSize: 'clamp(30px, 8vw, 42px)',
                color: TIMELINE_YEAR_TEXT_COLOR,
                lineHeight: 1,
                letterSpacing: '0.03em',
                maxWidth: '100%',
                textAlign: 'center',
                textShadow: '0 1px 0 rgba(255,255,255,0.34)',
                WebkitTextStroke: '0.25px rgba(18,58,99,0.28)',
              }}
            >
              {card.year}
            </span>
          </div>
        ) : card.media_url ? (
          <>
            {/* Image section — 45% */}
            <div className="w-full relative" style={{ height: '45%', background: 'linear-gradient(160deg, rgba(15,20,40,0.95) 0%, rgba(10,15,35,0.98) 100%)' }}>
              <img
                src={card.media_url}
                alt=""
                className="w-full h-full object-cover"
                onError={e => { e.target.style.display = 'none'; }}
              />
              {/* Subtle fade bottom */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '12px',
                background: 'linear-gradient(to bottom, rgba(15,20,40,0) 0%, rgba(10,15,35,0.95) 100%)',
                pointerEvents: 'none',
              }} />
            </div>

            {/* Info section — 55% */}
            <div className="w-full flex flex-col items-center justify-between flex-1 px-1.5 py-1.5 relative z-10" style={{ background: 'linear-gradient(to bottom, rgba(15,20,40,0.9) 0%, rgba(10,15,35,0.98) 100%)' }}>
              {/* Short label max 1 line */}
              {title && (
                <p className="w-full text-center font-inter font-bold leading-tight line-clamp-1"
                  style={{ fontSize: 7, color: '#ffffff', marginBottom: 2 }}>
                  {title}
                </p>
              )}

              {/* Year prominent */}
              <span className="kronox-timeline-number" style={{ fontSize: 20, color: color.year, lineHeight: 1 }}>
                {card.year}
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Fallback: no image layout */}
            <p className="w-full text-center font-inter font-bold leading-tight line-clamp-2"
              style={{ fontSize: 8, color: '#ffffff', letterSpacing: '0.02em', marginBottom: 2, padding: '0 4px' }}>
              {title}
            </p>

            {artist && (
              <p className="w-full text-center font-inter leading-tight line-clamp-1"
                style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>
                {artist}
              </p>
            )}

            <div className="mt-auto">
              <span className="kronox-timeline-number" style={{ fontSize: 18, color: color.year, lineHeight: 1 }}>
                {card.year}
              </span>
            </div>
          </>
        )}

        {/* Stack badge */}
        {stackCount > 1 && (
          <div
            className="kronox-number absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ fontSize: 9, background: color.border, color: '#000' }}
          >
            {stackCount}
          </div>
        )}
      </motion.div>
    </div>
  );
}
