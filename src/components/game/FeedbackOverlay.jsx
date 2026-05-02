import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ChevronRight, Plus } from 'lucide-react';

const MUSIC_WAIT = 10; // seconds discussion time for music questions

export default function FeedbackOverlay({ result, year, songTitle, onDone }) {
  const isMusicQuestion = !!songTitle;
  const [countdown, setCountdown] = useState(isMusicQuestion ? MUSIC_WAIT : null);

  const finish = useCallback(() => {
    setCountdown(null);
    onDone();
  }, [onDone]);

  // Auto-advance timer
  useEffect(() => {
    if (!isMusicQuestion) {
      // Non-music: auto close after 1.8s
      const t = setTimeout(onDone, 1800);
      return () => clearTimeout(t);
    }
    // Music: countdown
    if (countdown === null) return;
    if (countdown <= 0) {
      finish();
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, isMusicQuestion, finish, onDone]);

  const handleExtend = (e) => {
    e.stopPropagation();
    setCountdown(c => c + 10);
  };

  const isCorrect = result === 'correct';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={isMusicQuestion ? undefined : finish}
        className={`fixed inset-0 z-40 flex items-center justify-center backdrop-blur-sm ${isMusicQuestion ? '' : 'cursor-pointer'}`}
        style={{ background: 'rgba(11,31,58,0.85)' }}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          onClick={e => e.stopPropagation()}
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
              {isCorrect ? '+1 kart eklendi' : 'Doğru yer gösteriliyor.'}
            </p>
            <p className="font-inter text-white/50 text-xs mt-1">
              Doğru cevap: <span className={`font-bold ${isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>{year}</span>
            </p>

            {/* Song reveal */}
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

            {/* Music discussion controls */}
            {isMusicQuestion && countdown !== null && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-4 space-y-2"
              >
                <p className="font-inter text-white/40 text-[10px] uppercase tracking-widest">
                  💬 Sohbet molası
                </p>
                {/* Countdown ring */}
                <div className="flex items-center justify-center gap-3">
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bangers text-lg
                    ${isCorrect ? 'border-emerald-400 text-emerald-300' : 'border-red-400 text-red-300'}`}>
                    {countdown}
                  </div>
                  <button
                    onClick={handleExtend}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white/70 font-inter text-xs hover:bg-white/20 transition-colors min-h-[36px]"
                  >
                    <Plus className="w-3 h-3" />
                    +10s
                  </button>
                </div>
                {/* Skip button */}
                <button
                  onClick={finish}
                  className={`w-full py-2.5 rounded-2xl font-bangers text-lg tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95
                    ${isCorrect ? 'bg-emerald-500 text-white hover:bg-emerald-400' : 'bg-red-500 text-white hover:bg-red-400'}
                  `}
                >
                  Devam Et <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}