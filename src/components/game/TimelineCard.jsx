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
        ${compact ? 'w-14 h-20 min-w-14' : 'w-16 h-24 min-w-16'}
        rounded-lg border-2 border-primary/60 bg-gradient-to-b from-secondary to-card
        shadow-lg shadow-primary/10
        ${isDragging ? 'ring-2 ring-primary scale-105' : ''}
        select-none
      `}
    >
      <Clock className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-primary/60 mb-1`} />
      <span className={`font-cinzel font-bold text-primary ${compact ? 'text-xs' : 'text-sm'}`}>
        {card.year}
      </span>
      {!compact && (
        <p className="text-muted-foreground text-center px-1 leading-tight mt-1" style={{ fontSize: '6px' }}>
          {card.question?.length > 30 ? card.question.slice(0, 30) + '…' : card.question}
        </p>
      )}
    </motion.div>
  );
}