import React from 'react';
import { motion } from 'framer-motion';

// Color palette for cards (matching reference design)
const cardStyles = [
  { bg: '#1a2a1a', border: '#22c55e', yearColor: '#22c55e' },   // green
  { bg: '#1a1a2e', border: '#818cf8', yearColor: '#818cf8' },   // indigo
  { bg: '#2a1a1a', border: '#f87171', yearColor: '#f87171' },   // red
  { bg: '#1a2a2a', border: '#06b6d4', yearColor: '#06b6d4' },   // cyan
  { bg: '#2a2a1a', border: '#facc15', yearColor: '#facc15' },   // yellow
  { bg: '#2a1a2a', border: '#c084fc', yearColor: '#c084fc' },   // purple
];

export default function TimelineCard({ card, index }) {
  const stackCount = card.stackCount || 1;
  const style = cardStyles[index % cardStyles.length];

  // Parse title/artist from question text if possible
  // Format expected: "TITLE\nARTIST" or just question text
  const lines = (card.question || '').split('\n');
  const title = lines[0] || '';
  const artist = lines[1] || card.artist || '';

  return (
    <div className="relative flex-shrink-0 flex flex-col items-center" style={{ width: 76 }}>
      {/* Stack shadow layers */}
      {stackCount > 1 && (
        <>
          <div
            className="absolute rounded-xl"
            style={{
              inset: 0,
              background: style.bg,
              border: `1.5px solid ${style.border}`,
              transform: 'translate(3px, 3px)',
              opacity: 0.4,
              zIndex: 0,
            }}
          />
          <div
            className="absolute rounded-xl"
            style={{
              inset: 0,
              background: style.bg,
              border: `1.5px solid ${style.border}`,
              transform: 'translate(6px, 6px)',
              opacity: 0.2,
              zIndex: 0,
            }}
          />
        </>
      )}

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: index * 0.04, type: 'spring', stiffness: 350, damping: 26 }}
        className="relative flex flex-col items-center justify-between w-full rounded-xl p-1.5 select-none z-10"
        style={{
          minHeight: 88,
          background: style.bg,
          border: `1.5px solid ${style.border}`,
          boxShadow: `0 0 8px ${style.border}40`,
        }}
      >
        {/* Album art / thumbnail if available */}
        {card.media_url && card.type === 'gorsel' && (
          <div className="w-full rounded-lg overflow-hidden mb-1" style={{ height: 36 }}>
            <img src={card.media_url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
          </div>
        )}

        {/* Title */}
        <p className="w-full text-center font-inter font-bold leading-tight line-clamp-2 px-0.5"
          style={{ fontSize: 8, color: '#ffffff', letterSpacing: '0.02em' }}>
          {title}
        </p>

        {/* Artist */}
        {artist && (
          <p className="w-full text-center font-inter leading-tight line-clamp-1 px-0.5 mt-0.5"
            style={{ fontSize: 7, color: 'rgba(255,255,255,0.55)' }}>
            {artist}
          </p>
        )}

        {/* Year */}
        <div className="mt-1">
          <span className="font-bangers tracking-wider" style={{ fontSize: 15, color: style.yearColor }}>
            {card.year}
          </span>
        </div>

        {/* Stack count badge */}
        {stackCount > 1 && (
          <div
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center font-inter font-bold"
            style={{ fontSize: 8, background: style.border, color: '#000' }}
          >
            {stackCount}
          </div>
        )}
      </motion.div>
    </div>
  );
}