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
        ${compact ? 'w-16 h-22 min-w-16 landscape:w-14 landscape:h-20 landscape:min-w-14' : 'w-24 h-32 min-w-24 landscape:w-16 landscape:h-24 landscape:min-w-16'}
        rounded-lg border-2 border-primary/60 bg-gradient-to-b from-secondary to-card
        shadow-lg shadow-primary/10
        ${isDragging ? 'ring-2 ring-primary scale-105' : ''}
        select-none p-1.5 landscape:p-1
      `}
    >
      <Clock className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-primary/60 mb-1`} />
      <span className={`font-cinzel font-bold text-primary ${compact ? 'text-sm' : 'text-base'}`}>
        {card.year}
      </span>
      {!compact && (
        <p className="text-muted-foreground text-center px-1 leading-tight mt-1 text-xs">
          {card.question?.length > 25 ? card.question.slice(0, 25) + '…' : card.question}
        </p>
      )}
      {compact && (
        <p className="text-muted-foreground text-center px-1 leading-tight mt-1 text-[10px]">
          {card.question?.length > 20 ? card.question.slice(0, 20) + '…' : card.question}
        </p>
      )}
    </motion.div>
  );
}