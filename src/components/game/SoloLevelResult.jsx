import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, ArrowLeft, Star, Trophy, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDuration } from './GameOverTimer';

/**
 * Codex106 — Solo level attempt result overlay.
 *
 * Shows pass (with stars) or fail state with retry + back-to-path actions.
 * Pure presentational; the calling Game page is responsible for persisting
 * the best stars and unlocking the next level before mounting this overlay.
 *
 * Props:
 *   - levelNumber: number
 *   - passed: boolean
 *   - stars: 0..3
 *   - mistakes: number
 *   - timeSeconds: number
 *   - cardsCompleted: number
 *   - cardTarget: number (10)
 *   - failReason: 'mistakes' | 'timeout' | null
 *   - onRetry: () => void
 *   - onBackToPath: () => void
 */
export default function SoloLevelResult({
  levelNumber,
  passed,
  stars,
  mistakes,
  timeSeconds,
  cardsCompleted,
  cardTarget,
  failReason,
  onRetry,
  onBackToPath,
}) {
  const accentColor = passed ? '#facc15' : '#f87171';
  const headline = passed ? 'Seviye Tamamlandı!' : 'Seviye Başarısız';
  const subline = passed
    ? `Level ${levelNumber} geçildi.`
    : failReason === 'timeout'
      ? 'Süren doldu. Bir dahaki sefere!'
      : 'Çok fazla hata. Tekrar dene!';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md p-6"
      style={{ background: 'rgba(5,11,28,0.92)' }}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.1 }}
        className="w-full max-w-xs rounded-3xl overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #12185e 0%, #0a0e2e 100%)',
          border: `2px solid ${accentColor}`,
          boxShadow: `0 0 32px ${passed ? 'rgba(250,204,21,0.35)' : 'rgba(248,113,113,0.32)'}`,
        }}
      >
        <div className="relative pt-10 pb-6 px-6 text-center">
          <motion.div
            animate={passed ? { rotate: [0, -6, 6, -6, 0], scale: [1, 1.12, 1] } : { scale: [1, 1.05, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.8 }}
            className="w-16 h-16 mx-auto mb-4 flex items-center justify-center"
          >
            {passed ? (
              <Trophy className="w-16 h-16" style={{ color: accentColor }} />
            ) : (
              <XCircle className="w-16 h-16 text-rose-300" />
            )}
          </motion.div>

          <h1
            className="font-bangers text-3xl tracking-wider mb-1"
            style={{ color: accentColor }}
          >
            {headline}
          </h1>
          <p className="font-inter text-white/80 text-sm">{subline}</p>

          {/* Stars row */}
          <div className="mt-5 flex items-center justify-center gap-2" aria-label={`${stars} yıldız`}>
            {[1, 2, 3].map((i) => {
              const filled = i <= stars;
              return (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.25 + i * 0.12, type: 'spring', stiffness: 320, damping: 18 }}
                >
                  <Star
                    className="w-9 h-9"
                    strokeWidth={1.8}
                    style={{
                      color: filled ? '#facc15' : 'rgba(226,232,240,0.22)',
                      fill: filled ? '#facc15' : 'transparent',
                      filter: filled ? 'drop-shadow(0 0 8px rgba(250,204,21,0.65))' : 'none',
                    }}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label="Hata" value={mistakes} />
            <Stat label="Kart" value={`${cardsCompleted}/${cardTarget}`} />
            <Stat label="Süre" value={formatDuration(timeSeconds)} compact />
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-7">
          <Button
            onClick={onBackToPath}
            variant="outline"
            className="flex-1 h-11 rounded-2xl border-white/20 bg-white/10 text-white hover:bg-white/20 font-inter text-sm gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Level Path
          </Button>
          <Button
            onClick={onRetry}
            className="flex-1 h-11 rounded-2xl font-bangers text-lg tracking-wider gap-2"
            style={{
              background: 'linear-gradient(135deg, #f5c400 0%, #facc15 50%, #e6b800 100%)',
              color: '#1a0a00',
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Tekrar
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value, compact = false }) {
  return (
    <div
      className="rounded-xl py-2 px-1"
      style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
    >
      <p className={`font-bangers tracking-wider text-white ${compact ? 'text-sm' : 'text-base'}`}>
        {value}
      </p>
      <p className="font-inter text-[10px] font-black uppercase tracking-widest text-white/50">
        {label}
      </p>
    </div>
  );
}