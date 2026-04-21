import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';

export default function FeedbackOverlay({ result, year, onDone }) {
  React.useEffect(() => {
    const timer = setTimeout(onDone, 1800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="text-center space-y-3"
        >
          <div className={`
            w-20 h-20 mx-auto rounded-full flex items-center justify-center
            ${result === 'correct'
              ? 'bg-emerald-500/20 border-2 border-emerald-500'
              : 'bg-destructive/20 border-2 border-destructive'}
          `}>
            {result === 'correct' ? (
              <Check className="w-10 h-10 text-emerald-500" />
            ) : (
              <X className="w-10 h-10 text-destructive" />
            )}
          </div>

          <div>
            <p className={`font-cinzel text-xl font-bold ${result === 'correct' ? 'text-emerald-400' : 'text-destructive'}`}>
              {result === 'correct' ? 'Doğru!' : 'Yanlış!'}
            </p>
            <p className="font-inter text-muted-foreground text-sm mt-1">
              Doğru cevap: <span className="text-primary font-bold">{year}</span>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}