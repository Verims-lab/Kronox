import React from 'react';
import { motion } from 'framer-motion';

// Per-index neon colors cycling
const cardColors = [
  { border: '#22c55e', year: '#22c55e', bg: 'rgba(34,197,94,0.08)' },    // green
  { border: '#818cf8', year: '#818cf8', bg: 'rgba(129,140,248,0.08)' },  // indigo
  { border: '#f87171', year: '#f87171', bg: 'rgba(248,113,113,0.08)' },  // red
  { border: '#06b6d4', year: '#06b6d4', bg: 'rgba(6,182,212,0.08)' },    // cyan
  { border: '#facc15', year: '#facc15', bg: 'rgba(250,204,21,0.08)' },   // yellow
  { border: '#c084fc', year: '#c084fc', bg: 'rgba(192,132,252,0.08)' },  // purple
];

export default function TimelineCard({ card, index, distanceFromCenter = 0 }) {
  const stackCount = card.stackCount || 1;
  const color = cardColors[index % cardColors.length];
  // Subtle de-emphasis for cards far from the center viewport (max 30% opacity reduction)
  const fadeOpacity = Math.max(0.7, 1 - Math.min(distanceFromCenter, 1) * 0.3);

  const lines = (card.question || '').split('\n');
  const title = lines[0] || card.question || '';
  const artist = lines[1] || card.artist || '';

  return (
    <div className="relative flex-shrink-0" style={{ width: 80, opacity: fadeOpacity, transition: 'opacity 0.4s ease' }}>
      {/* Stack shadow layers */}
      {stackCount > 1 && (
        <>
          <div className="absolute rounded-2xl" style={{
            inset: 0,
            background: 'rgba(15,20,40,0.9)',
            border: `1.5px solid ${color.border}`,
            transform: 'translate(4px, 4px)',
            opacity: 0.4,
            zIndex: 0,
          }} />
          <div className="absolute rounded-2xl" style={{
            inset: 0,
            background: 'rgba(15,20,40,0.9)',
            border: `1.5px solid ${color.border}`,
            transform: 'translate(8px, 8px)',
            opacity: 0.2,
            zIndex: 0,
          }} />
        </>
      )}

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
        className="relative flex flex-col items-center rounded-2xl select-none z-10"
        style={{
          width: 80,
          minHeight: 108,
          background: `linear-gradient(160deg, rgba(15,20,40,0.95) 0%, rgba(10,15,35,0.98) 100%)`,
          border: `2px solid ${color.border}`,
          boxShadow: `0 0 12px ${color.border}50, 0 0 4px ${color.border}30`,
          padding: '8px 6px 6px',
        }}
      >
        {/* Album art */}
        {card.media_url && (card.type === 'gorsel' || card.type === 'muzik') && (
          <div className="w-full rounded-xl overflow-hidden mb-1" style={{ height: 44 }}>
            <img
              src={card.media_url}
              alt=""
              className="w-full h-full object-cover"
              onError={e => { e.target.style.display = 'none'; }}
            />
          </div>
        )}

        {/* Title */}
        <p className="w-full text-center font-inter font-bold leading-tight line-clamp-3"
          style={{ fontSize: 8, color: '#ffffff', letterSpacing: '0.02em', marginBottom: 2 }}>
          {title}
        </p>

        {/* Artist */}
        {artist && (
          <p className="w-full text-center font-inter leading-tight line-clamp-1"
            style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginBottom: 3 }}>
            {artist}
          </p>
        )}

        {/* Year */}
        <div className="mt-auto">
          <span className="font-bangers tracking-wider" style={{ fontSize: 18, color: color.year, lineHeight: 1 }}>
            {card.year}
          </span>
        </div>

        {/* Stack badge */}
        {stackCount > 1 && (
          <div
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center font-inter font-bold"
            style={{ fontSize: 9, background: color.border, color: '#000' }}
          >
            {stackCount}
          </div>
        )}
      </motion.div>
    </div>
  );
}