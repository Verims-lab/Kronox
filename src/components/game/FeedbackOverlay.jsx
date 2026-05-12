import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ChevronRight, Plus } from 'lucide-react';
import { randomFlavor } from '@/lib/flavorText';
import { sounds } from '@/lib/gameSounds';

const MUSIC_WAIT = 10;

export default function FeedbackOverlay({ result, year, songTitle, guessedYear, onDone }) {
  const isMusicQuestion = !!songTitle;
  const [countdown, setCountdown] = useState(isMusicQuestion ? MUSIC_WAIT : null);
  const [flavor] = useState(() => randomFlavor(result === 'correct'));

  const isCorrect = result === 'correct';
  const yearDiff = guessedYear && year ? Math.abs(guessedYear - year) : null;

  const finish = useCallback(() => {
    setCountdown(null);
    onDone();
  }, [onDone]);

  // Sound on mount
  useEffect(() => {
    if (isCorrect) sounds.correct();
    else sounds.wrong();
  }, [isCorrect]);

  // Auto-advance timer
  useEffect(() => {
    if (!isMusicQuestion) {
      const t = setTimeout(onDone, 2200);
      return () => clearTimeout(t);
    }
    if (countdown === null) return;
    if (countdown <= 0) { finish(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, isMusicQuestion, finish, onDone]);

  const handleExtend = (e) => { e.stopPropagation(); setCountdown(c => c + 10); };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={isMusicQuestion ? undefined : finish}
        className={`fixed inset-0 z-40 flex items-center justify-center backdrop-blur-sm ${isMusicQuestion ? '' : 'cursor-pointer'}`}
        style={{ background: isCorrect ? 'rgba(0,20,10,0.88)' : 'rgba(20,0,0,0.88)' }}
      >
        {/* Background flash */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{ background: isCorrect ? 'radial-gradient(ellipse at center, rgba(74,222,128,0.25) 0%, transparent 70%)' : 'radial-gradient(ellipse at center, rgba(248,113,113,0.3) 0%, transparent 70%)' }}
        />

        <motion.div
          initial={{ scale: 0.4, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          onClick={e => e.stopPropagation()}
          className="mx-6 w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl"
          style={{
            border: `2px solid ${isCorrect ? 'rgba(74,222,128,0.8)' : 'rgba(248,113,113,0.8)'}`,
            background: isCorrect
              ? 'linear-gradient(160deg, #052015 0%, #0a3020 100%)'
              : 'linear-gradient(160deg, #200505 0%, #300a0a 100%)',
            boxShadow: isCorrect
              ? '0 0 40px rgba(74,222,128,0.35), 0 20px 40px rgba(0,0,0,0.5)'
              : '0 0 40px rgba(248,113,113,0.35), 0 20px 40px rgba(0,0,0,0.5)',
          }}
        >
          <div className="py-6 px-6 text-center">
            {/* Icon with pulse ring */}
            <div className="relative w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full"
                initial={{ scale: 0.6, opacity: 0.8 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ background: isCorrect ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)' }}
              />
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center border-4"
                style={{
                  background: isCorrect ? '#16a34a' : '#dc2626',
                  borderColor: isCorrect ? '#4ade80' : '#f87171',
                  boxShadow: isCorrect ? '0 0 20px rgba(74,222,128,0.5)' : '0 0 20px rgba(248,113,113,0.5)',
                }}
              >
                {isCorrect
                  ? <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  : <X className="w-10 h-10 text-white" strokeWidth={3} />
                }
              </div>
            </div>

            {/* Result label */}
            <motion.h2
              initial={{ scale: 0.7 }}
              animate={{ scale: [1.15, 1] }}
              transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
              className="font-bangers text-4xl tracking-wider mb-1"
              style={{ color: isCorrect ? '#4ade80' : '#f87171' }}
            >
              {isCorrect ? 'DOĞRU!' : 'YANLIŞ!'}
            </motion.h2>

            {/* Flavor text */}
            <p className="font-inter text-sm font-medium mb-3" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {flavor}
            </p>

            {/* Year reveal */}
            <div
              className="rounded-2xl px-4 py-3 mb-2"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {!isCorrect && guessedYear && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="font-inter text-xs mb-1"
                  style={{ color: 'rgba(255,255,255,0.45)' }}
                >
                  {guessedYear} sandın…
                </motion.p>
              )}
              <motion.p
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25, type: 'spring', stiffness: 300 }}
                className="font-bangers text-3xl"
                style={{ color: isCorrect ? '#4ade80' : '#f87171' }}
              >
                {year}
              </motion.p>
              <p className="font-inter text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Doğru yıl
              </p>
              {/* Year diff badge for wrong */}
              {!isCorrect && yearDiff !== null && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4, type: 'spring', stiffness: 350 }}
                  className="inline-block mt-2 px-3 py-1 rounded-full font-bangers text-base"
                  style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.5)', color: '#f87171' }}
                >
                  +{yearDiff} yıl fark
                </motion.div>
              )}
            </div>

            {/* Song reveal */}
            {songTitle && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-2 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <p className="font-inter text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>🎵 Şarkı</p>
                <p className="font-inter text-white text-xs font-semibold text-center leading-snug">
                  {songTitle.includes('"')
                    ? songTitle.replace(/^.*?"([^"]+)"\s*-\s*(.+)$/, '$1 — $2')
                    : songTitle}
                </p>
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
                <p className="font-inter text-white/40 text-[10px] uppercase tracking-widest">💬 Sohbet molası</p>
                <div className="flex items-center justify-center gap-3">
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bangers text-lg
                    ${isCorrect ? 'border-emerald-400 text-emerald-300' : 'border-red-400 text-red-300'}`}>
                    {countdown}
                  </div>
                  <button
                    onClick={handleExtend}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white/70 font-inter text-xs hover:bg-white/20 transition-colors min-h-[36px]"
                  >
                    <Plus className="w-3 h-3" />+10s
                  </button>
                </div>
                <button
                  onClick={finish}
                  className="w-full py-2.5 rounded-2xl font-bangers text-lg tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ background: isCorrect ? '#16a34a' : '#dc2626', color: 'white' }}
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