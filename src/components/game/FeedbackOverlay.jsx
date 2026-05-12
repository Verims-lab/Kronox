import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Check, X, ChevronRight, Plus } from 'lucide-react';
import { randomFlavor } from '@/lib/flavorText';
import { sounds } from '@/lib/gameSounds';

const MUSIC_WAIT = 10;

// ─── Particle burst for correct answers ─────────────────────────────────────
function CorrectParticles() {
  const particles = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    angle: (i / 10) * 360,
    dist: 55 + Math.random() * 35,
    size: 3 + Math.random() * 4,
    color: i % 3 === 0 ? '#facc15' : i % 3 === 1 ? '#4ade80' : '#fde68a',
  }));

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {particles.map(p => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.dist;
        const ty = Math.sin(rad) * p.dist;
        return (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{ width: p.size, height: p.size, background: p.color }}
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{ scale: [0, 1.2, 0.8], x: tx, y: ty, opacity: [1, 1, 0] }}
            transition={{ duration: 0.55, ease: [0.2, 0, 0.6, 1], delay: 0.05 }}
          />
        );
      })}
    </div>
  );
}

// ─── Screen shake wrapper for wrong answers ──────────────────────────────────
function ShakeWrapper({ trigger, children }) {
  const controls = useAnimation();
  const triggered = useRef(false);

  useEffect(() => {
    if (trigger && !triggered.current) {
      triggered.current = true;
      controls.start({
        x: [0, -10, 10, -8, 8, -4, 4, 0],
        transition: { duration: 0.42, ease: 'easeInOut' },
      });
    }
  }, [trigger, controls]);

  return <motion.div animate={controls}>{children}</motion.div>;
}

// ─── Year diff badge ─────────────────────────────────────────────────────────
function YearDiffBadge({ diff }) {
  if (!diff) return null;
  return (
    <motion.div
      initial={{ scale: 0, rotate: -8 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.55 }}
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-bangers text-base tracking-wider"
      style={{
        background: 'rgba(248,113,113,0.18)',
        border: '1px solid rgba(248,113,113,0.5)',
        color: '#f87171',
        boxShadow: '0 0 14px rgba(248,113,113,0.2)',
      }}
    >
      {diff === 1 ? '1 yıl fark' : `${diff} yıl fark`}
    </motion.div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function FeedbackOverlay({ result, year, songTitle, guessedYear, onDone }) {
  const isMusicQuestion = !!songTitle;
  const [countdown, setCountdown] = useState(isMusicQuestion ? MUSIC_WAIT : null);
  const [flavor] = useState(() => randomFlavor(result === 'correct'));
  const [shakeActive, setShakeActive] = useState(false);

  const isCorrect = result === 'correct';
  const yearDiff = guessedYear && year ? Math.abs(guessedYear - year) : null;

  const finish = useCallback(() => {
    setCountdown(null);
    onDone();
  }, [onDone]);

  // Sound + shake on mount
  useEffect(() => {
    if (isCorrect) {
      sounds.correct();
    } else {
      sounds.wrong();
      // Slight delay so the overlay is visible before shake
      const t = setTimeout(() => setShakeActive(true), 80);
      return () => clearTimeout(t);
    }
  }, [isCorrect]);

  // Auto-advance
  useEffect(() => {
    if (!isMusicQuestion) {
      const t = setTimeout(onDone, 2400);
      return () => clearTimeout(t);
    }
    if (countdown === null) return;
    if (countdown <= 0) { finish(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, isMusicQuestion, finish, onDone]);

  const handleExtend = (e) => { e.stopPropagation(); setCountdown(c => c + 10); };

  // ── Colors ──────────────────────────────────────────────────────────────
  const accentColor  = isCorrect ? '#4ade80' : '#f87171';
  const glowColor    = isCorrect ? 'rgba(74,222,128,0.28)' : 'rgba(248,113,113,0.32)';
  const bgGrad       = isCorrect
    ? 'linear-gradient(160deg, #031a0d 0%, #062015 60%, #041510 100%)'
    : 'linear-gradient(160deg, #1a0303 0%, #200505 60%, #150404 100%)';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={isMusicQuestion ? undefined : finish}
        className={`fixed inset-0 z-40 flex items-center justify-center ${isMusicQuestion ? '' : 'cursor-pointer'}`}
        style={{ background: isCorrect ? 'rgba(0,14,6,0.9)' : 'rgba(14,0,0,0.9)' }}
      >
        {/* Full-screen radial flash on entry */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ background: `radial-gradient(ellipse at 50% 50%, ${glowColor} 0%, transparent 65%)` }}
        />

        <ShakeWrapper trigger={shakeActive}>
          <motion.div
            initial={{ scale: 0.72, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.82, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            onClick={e => e.stopPropagation()}
            className="mx-5 w-full max-w-xs rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: bgGrad,
              border: `1.5px solid ${accentColor}55`,
              boxShadow: `0 0 50px ${glowColor}, 0 24px 48px rgba(0,0,0,0.6)`,
            }}
          >
            <div className="px-6 pt-7 pb-6 flex flex-col items-center text-center gap-4">

              {/* ── Icon ─────────────────────────────────────────── */}
              <div className="relative w-[72px] h-[72px] flex items-center justify-center">
                {/* Pulse ring */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  initial={{ scale: 0.5, opacity: 0.9 }}
                  animate={{ scale: 1.9, opacity: 0 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                  style={{ background: `${accentColor}30` }}
                />
                {/* Outer ring */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                  style={{ border: `2px solid ${accentColor}40` }}
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.06 }}
                  className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                  style={{
                    background: isCorrect ? '#15803d' : '#b91c1c',
                    border: `3px solid ${accentColor}`,
                    boxShadow: `0 0 24px ${accentColor}55`,
                  }}
                >
                  {isCorrect
                    ? <Check className="w-9 h-9 text-white" strokeWidth={3} />
                    : <X className="w-9 h-9 text-white" strokeWidth={3} />
                  }
                </motion.div>
                {isCorrect && <CorrectParticles />}
              </div>

              {/* ── Result label ──────────────────────────────────── */}
              <motion.h2
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [1.18, 1], opacity: 1 }}
                transition={{ type: 'spring', stiffness: 450, damping: 16, delay: 0.12 }}
                className="font-bangers text-4xl tracking-wider leading-none"
                style={{ color: accentColor, textShadow: `0 0 20px ${accentColor}60` }}
              >
                {isCorrect ? 'DOĞRU!' : 'YANLIŞ!'}
              </motion.h2>

              {/* ── Flavor text ───────────────────────────────────── */}
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.3 }}
                className="font-inter text-sm font-medium"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                {flavor}
              </motion.p>

              {/* ── Year reveal card ──────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.28 }}
                className="w-full rounded-2xl px-4 py-3 flex flex-col items-center gap-2"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {/* Guessed year (wrong only) */}
                {!isCorrect && guessedYear && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="flex items-center gap-2"
                  >
                    <span className="font-inter text-xs text-white/35">Tahmin ettiğin:</span>
                    <span className="font-bangers text-xl text-white/50 line-through">{guessedYear}</span>
                  </motion.div>
                )}

                {/* Actual year */}
                <div className="flex flex-col items-center gap-0.5">
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.38 }}
                    className="font-bangers text-5xl leading-none tracking-wide"
                    style={{
                      color: accentColor,
                      textShadow: `0 0 24px ${accentColor}50`,
                    }}
                  >
                    {year}
                  </motion.span>
                  <span className="font-inter text-[10px] uppercase tracking-widest text-white/30">
                    Doğru yıl
                  </span>
                </div>

                {/* Year diff */}
                {!isCorrect && yearDiff !== null && (
                  <YearDiffBadge diff={yearDiff} />
                )}
              </motion.div>

              {/* ── Song title (music mode) ───────────────────────── */}
              {songTitle && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42 }}
                  className="w-full px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <p className="font-inter text-[10px] uppercase tracking-wider mb-0.5 text-white/35">🎵 Şarkı</p>
                  <p className="font-inter text-white text-xs font-semibold leading-snug">
                    {songTitle.includes('"')
                      ? songTitle.replace(/^.*?"([^"]+)"\s*-\s*(.+)$/, '$1 — $2')
                      : songTitle}
                  </p>
                </motion.div>
              )}

              {/* ── Music discussion controls ─────────────────────── */}
              {isMusicQuestion && countdown !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="w-full space-y-2"
                >
                  <p className="font-inter text-white/35 text-[10px] uppercase tracking-widest">💬 Sohbet molası</p>
                  <div className="flex items-center justify-center gap-3">
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bangers text-lg`}
                      style={{ borderColor: accentColor, color: accentColor }}>
                      {countdown}
                    </div>
                    <button
                      onClick={handleExtend}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl font-inter text-xs transition-colors min-h-[36px]"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}
                    >
                      <Plus className="w-3 h-3" />+10s
                    </button>
                  </div>
                  <button
                    onClick={finish}
                    className="w-full py-2.5 rounded-2xl font-bangers text-lg tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95"
                    style={{ background: isCorrect ? '#15803d' : '#b91c1c', color: 'white' }}
                  >
                    Devam Et <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* ── Tap to continue hint (non-music) ─────────────── */}
              {!isMusicQuestion && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="font-inter text-[10px] text-white/20"
                >
                  devam etmek için dokun
                </motion.p>
              )}
            </div>
          </motion.div>
        </ShakeWrapper>
      </motion.div>
    </AnimatePresence>
  );
}