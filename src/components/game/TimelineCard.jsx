import React from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

export default function TimelineCard({ card, index, isDragging, compact = false }) {
  const stackCount = card.stackCount || 1;
  const isStacked = stackCount > 1;

  return (
    <div className="relative flex-shrink-0" style={{ width: compact ? 56 : 80 }}>
      {/* Stack shadow layers */}
      {isStacked && (
        <>
          <div
            className={`absolute rounded-lg border-2 border-primary/30 bg-gradient-to-b from-secondary to-card
              ${compact ? 'w-14 h-16' : 'w-20 h-20'}`}
            style={{ top: -4, left: 4, zIndex: 0 }}
          />
          {stackCount > 2 && (
            <div
              className={`absolute rounded-lg border-2 border-primary/20 bg-gradient-to-b from-secondary to-card
                ${compact ? 'w-14 h-16' : 'w-20 h-20'}`}
              style={{ top: -8, left: 8, zIndex: 0 }}
            />
          )}
        </>
      )}

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
        className={`
          relative flex flex-col items-center justify-center
          ${compact ? 'w-14 h-16 landscape:w-12 landscape:h-14' : 'w-20 h-20 landscape:w-14 landscape:h-16'}
          rounded-lg border-2
          ${isStacked ? 'border-primary bg-gradient-to-b from-primary/20 to-card' : 'border-primary/60 bg-gradient-to-b from-secondary to-card'}
          shadow-lg shadow-primary/10
          ${isDragging ? 'ring-2 ring-primary scale-105' : ''}
          select-none p-1.5 landscape:p-1
        `}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <Clock className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-primary/60 mb-1`} />
        <span className={`font-cinzel font-bold text-primary ${compact ? 'text-sm' : 'text-lg'}`}>
          {card.year}
        </span>
        {isStacked && (
          <span className={`
            absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full
            font-inter font-bold leading-none flex items-center justify-center
            ${compact ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]'}
          `}>
            {stackCount}
          </span>
        )}
      </motion.div>
    </div>
  );
}