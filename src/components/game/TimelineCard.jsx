import React from 'react';
import { motion } from 'framer-motion';

// Category emoji mapping
const categoryEmoji = {
  tarih: '🏰',
  bilim: '🔬',
  spor: '⚽',
  sanat: '🎨',
  teknoloji: '💡',
  genel: '🌍',
};

// Purple/violet cards for placed cards (like the screenshot)
const cardColors = [
  { bg: 'from-violet-600 to-violet-800', border: 'border-violet-400', shadow: 'shadow-violet-500/40' },
  { bg: 'from-blue-600 to-blue-800', border: 'border-blue-400', shadow: 'shadow-blue-500/40' },
  { bg: 'from-indigo-600 to-indigo-800', border: 'border-indigo-400', shadow: 'shadow-indigo-500/40' },
];

export default function TimelineCard({ card, index, isActive = false }) {
  const stackCount = card.stackCount || 1;
  const color = cardColors[index % cardColors.length];
  const emoji = categoryEmoji[card.category] || '🌍';

  return (
    <div className="relative flex-shrink-0 flex flex-col items-center" style={{ width: 72 }}>
      {/* Stack layers */}
      {stackCount > 1 && (
        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-b ${color.bg} opacity-50 translate-x-1 translate-y-1 border ${color.border}`} />
      )}

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
        className={`
          relative flex flex-col items-center justify-between w-full rounded-2xl border-2 p-1.5 pb-2
          bg-gradient-to-b ${color.bg} ${color.border}
          shadow-lg ${color.shadow}
          ${isActive ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-transparent' : ''}
          select-none
        `}
        style={{ minHeight: 90 }}
      >
        {/* Year */}
        <div className="w-full text-center">
          <span className="font-bangers text-white text-xl tracking-wider leading-none">{card.year}</span>
        </div>

        {/* Emoji */}
        <div className="flex items-center justify-center my-0.5">
          <span className="text-2xl">{emoji}</span>
        </div>

        {/* Label */}
        <p className="text-white text-[9px] font-inter font-semibold text-center leading-tight line-clamp-2 px-0.5">
          {card.question}
        </p>

        {/* Stack badge */}
        {stackCount > 1 && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground font-inter font-bold text-[9px] flex items-center justify-center shadow">
            {stackCount}
          </div>
        )}
      </motion.div>
    </div>
  );
}