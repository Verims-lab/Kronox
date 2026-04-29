import React from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

export default function TimelineCard({ card, index, isDragging, compact = false }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 300 }}
      className={`
        relative flex flex-col items-center justify-center
        ${compact ? 'w-14 h-16 min-w-14 landscape:w-12 landscape:h-14 landscape:min-w-12' : 'w-20 h-20 min-w-20 landscape:w-14 landscape:h-16 landscape:min-w-14'}
        rounded-lg border-2 border-primary/60 bg-gradient-to-b from-secondary to-card
        shadow-lg shadow-primary/10
        ${isDragging ? 'ring-2 ring-primary scale-105' : ''}
        select-none p-1.5 landscape:p-1
      `}
    >
      <Clock className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-primary/60 mb-1`} />
      <span className={`font-cinzel font-bold text-primary ${compact ? 'text-sm' : 'text-lg'}`}>
        {card.year}
      </span>
    </motion.div>
  );
}