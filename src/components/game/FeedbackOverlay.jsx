import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';

export default function FeedbackOverlay({ result, year, songTitle, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1800);
    return () => clearTimeout(timer);
  }, [onDone]);

  const isCorrect = result === 'correct';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDone}
        className="fixed inset-0 z-40 flex items-center justify-center backdrop-blur-sm cursor-pointer"
        style={{ background: 'rgba(11,31,58,0.85)' }}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={`mx-6 w-full max-w-xs rounded-3xl border-2 overflow-hidden shadow-2xl
            ${isCorrect ? 'bg-emerald-900/90 border-emerald-400' : 'bg-red-900/90 border-red-400'}
          `}
        >
          <div className={`py-6 px-6 text-center ${isCorrect ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 border-4
              ${isCorrect ? 'bg-emerald-500 border-emerald-300' : 'bg-red-500 border-red-300'}
            `}>
              {isCorrect
                ? <Check className="w-9 h-9 text-white" strokeWidth={3} />
                : <X className="w-9 h-9 text-white" strokeWidth={3} />
              }
            </div>
            <h2 className={`font-bangers text-3xl tracking-wider mb-1 ${isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
              {isCorrect ? 'Doğru!' : 'Yanlış!'}
            </h2>
            <p className="font-inter text-white/70 text-sm">
              {isCorrect ? '+1 kart eklendi' : `Doğru yer gösteriliyor.`}
            </p>
            <p className="font-inter text-white/50 text-xs mt-1">
              Doğru cevap: <span className={`font-bold ${isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>{year}</span>
            </p>
            {songTitle && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20"
              >
                <p className="font-inter text-white/40 text-[10px] uppercase tracking-wider mb-0.5">🎵 Şarkı</p>
                <p className="font-inter text-white text-xs font-semibold text-center leading-snug">{songTitle}</p>
              </motion.div>
            )}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}