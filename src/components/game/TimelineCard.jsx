import React from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

export default function TimelineCard({ card, index }) {
  const stackCount = card.stackCount || 1;
  const isStacked = stackCount > 1;

  return (
    <div className="relative w-full">
      {/* Stack shadow layers */}
      {isStacked && (
        <>
          <div className="absolute inset-0 rounded-xl border border-primary/20 bg-card translate-y-1 translate-x-1" style={{ zIndex: 0 }} />
          {stackCount > 2 && (
            <div className="absolute inset-0 rounded-xl border border-primary/15 bg-card translate-y-2 translate-x-2" style={{ zIndex: 0 }} />
          )}
        </>
      )}

      <motion.div
        initial={{ x: 30, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: index * 0.04, type: 'spring', stiffness: 280, damping: 26 }}
        className={`
          relative flex items-center gap-3 w-full
          rounded-xl border px-3 py-2.5
          ${isStacked
            ? 'border-primary/50 bg-gradient-to-r from-primary/15 to-card shadow-md shadow-primary/10'
            : 'border-border/50 bg-gradient-to-r from-secondary/50 to-card shadow-sm'}
          select-none
        `}
        style={{ zIndex: 1 }}
      >
        {/* Year badge */}
        <div className={`flex-shrink-0 flex flex-col items-center justify-center rounded-lg
          ${isStacked ? 'bg-primary/20 border border-primary/40' : 'bg-secondary border border-border/40'}
          w-11 h-11`}
        >
          <Clock className="w-3 h-3 text-primary/70 mb-0.5" />
          <span className="font-cinzel font-bold text-primary text-sm leading-none">{card.year}</span>
        </div>

        {/* Question text */}
        <p className="flex-1 font-inter text-xs text-foreground/80 leading-relaxed line-clamp-2">
          {card.question}
        </p>

        {/* Stack badge */}
        {isStacked && (
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground font-inter font-bold text-[9px] flex items-center justify-center shadow">
            {stackCount}
          </div>
        )}
      </motion.div>
    </div>
  );
}