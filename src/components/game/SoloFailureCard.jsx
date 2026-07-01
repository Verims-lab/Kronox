import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  RotateCcw, ListChecks, TimerReset, MoveHorizontal, Layers, Gem, Play,
} from 'lucide-react';
import SoloResultMetricCard from './SoloResultMetricCard';
import { formatCompactDuration } from '@/lib/soloTimeFormat';
import { SOLO_FAILURE_MESSAGE } from '@/lib/soloResultMessages';
import { sounds } from '@/lib/gameSounds';

/**
 * Solo FAILURE level-end screen — redesigned per the reference:
 *
 *   • Dark-blue full-screen panel with a controlled red accent frame.
 *   • Title:  "N. SEVİYE GEÇİLEMEDİ!"  (Bangers, red)
 *   • Star area: two passive side stars + a broken/cracked center star.
 *   • Message: "Yeniden denemeye ne dersin?"
 *   • Three vertical metric cards: SÜRE, TAMAMLANAN (e.g. 4/7), HAMLE.
 *   • "OYNAMAYA DEVAM ET" section with two continuation cards:
 *       - "60 ELMAS" (diamond continuation)
 *       - "ÜCRETSİZ" (rewarded-ad continuation)
 *     Neither continuation flow is implemented in the project, so both
 *     cards render DISABLED with safe "Yakında" copy. No client-only
 *     grants, no fake rewarded-ad SDK. Current failure behavior (retry /
 *     levels) is preserved.
 *   • Two CTAs: "TEKRAR OYNA", "SEVİYELER".
 */
export default function SoloFailureCard({
  levelNumber,
  mistakes,
  usedMoves,
  remainingMoves,
  maxMoves,
  timeSeconds,
  levelScore = 0,
  cardsCompleted,
  cardTarget,
  failReason,
  onRetry,
  onBackToPath,
}) {
  const reduceMotion = useReducedMotion();
  const formattedTime = formatCompactDuration(timeSeconds);
  const moveValue = Math.max(0, Math.floor(Number(usedMoves) || 0));
  const completed = Math.max(0, Math.floor(Number(cardsCompleted) || 0));
  const target = Math.max(0, Math.floor(Number(cardTarget) || 0));
  const completedLabel = target > 0 ? `${completed}/${target}` : String(completed);
  void mistakes; void remainingMoves; void maxMoves; void levelScore; void failReason;

  // Soft failure feedback on mount (no harsh alarm).
  useEffect(() => {
    try { sounds.wrong(); } catch { /* audio unavailable — ignore */ }
  }, []);

  const panelInitial = reduceMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0, y: 24 };
  const panelAnimate = reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 35%, rgba(120,20,40,0.3) 0%, rgba(4,7,20,0.96) 62%)',
        backdropFilter: 'blur(8px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${levelNumber}. seviye geçilemedi`}
    >
      <motion.div
        initial={panelInitial}
        animate={panelAnimate}
        transition={reduceMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 280, damping: 24 }}
        className="w-full max-w-sm rounded-[28px] overflow-hidden relative"
        style={{
          background: 'linear-gradient(165deg, #0d1430 0%, #060a1e 100%)',
          boxShadow:
            'inset 0 0 0 1.5px rgba(248,113,113,0.3), 0 30px 60px rgba(0,0,0,0.6), 0 0 40px rgba(248,113,113,0.15)',
        }}
      >
        <div className="px-5 pt-6 pb-5">
          <motion.h1
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="font-bangers text-center tracking-[0.04em]"
            style={{
              color: '#ff4d6d',
              fontSize: 'clamp(20px, 6vw, 26px)',
              textShadow: '0 0 14px rgba(255,77,109,0.5), 0 2px 4px rgba(0,0,0,0.6)',
              lineHeight: 1.1,
            }}
          >
            {levelNumber}. SEVİYE GEÇİLEMEDİ!
          </motion.h1>

          <FailedStarsRow reduceMotion={reduceMotion} />

          <p
            className="mt-1 text-center font-inter text-white/85"
            style={{ fontSize: 'clamp(14px, 4vw, 16px)', fontWeight: 500 }}
          >
            {SOLO_FAILURE_MESSAGE}
          </p>

          {/* Three vertical metric cards: SÜRE · TAMAMLANAN · HAMLE */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <SoloResultMetricCard
              icon={TimerReset}
              iconColor="#5aa9ff"
              ringColor="rgba(90,169,255,0.55)"
              label="SÜRE"
              value={formattedTime}
              valueColor="#ffffff"
            />
            <SoloResultMetricCard
              icon={Layers}
              iconColor="#ff4d6d"
              ringColor="rgba(255,77,109,0.55)"
              label="TAMAMLANAN"
              labelColor="rgba(252,165,165,0.85)"
              value={completedLabel}
              valueColor="#ff4d6d"
            />
            <SoloResultMetricCard
              icon={MoveHorizontal}
              iconColor="#38bdf8"
              ringColor="rgba(56,189,248,0.55)"
              label="HAMLE"
              value={String(moveValue)}
              valueColor="#38bdf8"
            />
          </div>

          {/* OYNAMAYA DEVAM ET section header */}
          <div className="mt-5 mb-3 flex items-center justify-center gap-2" aria-hidden="true">
            <span style={{ display: 'block', height: 2, width: 18, background: 'linear-gradient(90deg, transparent, #38bdf8)' }} />
            <span
              className="font-bangers"
              style={{ color: '#e2e8f0', fontSize: 'clamp(13px, 3.8vw, 15px)', letterSpacing: '0.08em' }}
            >
              OYNAMAYA DEVAM ET
            </span>
            <span style={{ display: 'block', height: 2, width: 18, background: 'linear-gradient(90deg, #38bdf8, transparent)' }} />
          </div>

          {/* Continuation cards — DISABLED: no diamond/ad continuation flow
              exists in the project, so we never grant free continuation. */}
          <div className="grid grid-cols-2 gap-2.5">
            <ContinuationCard
              icon={Gem}
              iconColor="#fbbf24"
              iconFill="#fbbf24"
              title="60"
              titleColor="#ffffff"
            />
            <ContinuationCard
              icon={Play}
              iconColor="#38bdf8"
              iconFill="#38bdf8"
              title="ÜCRETSİZ"
              titleColor="#ffffff"
            />
          </div>

          {/* CTAs */}
          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <SecondaryButton onClick={onRetry} icon={RotateCcw}>TEKRAR OYNA</SecondaryButton>
            <SecondaryButton onClick={onBackToPath} icon={ListChecks}>SEVİYELER</SecondaryButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────── Pieces ─────────── */

/**
 * Continuation card. Disabled until a safe server-backed diamond flow and a
 * real rewarded-ad flow exist. Shows a small "Yakında" badge so players
 * understand it is coming rather than broken.
 */
function ContinuationCard({ icon: Icon, iconColor, iconFill, title, titleColor }) {
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-2xl px-3 py-4"
      style={{
        background: 'linear-gradient(180deg, rgba(20,32,66,0.6), rgba(8,16,40,0.75))',
        boxShadow: 'inset 0 0 0 1.5px rgba(96,165,250,0.22)',
        opacity: 0.55,
        minHeight: 104,
      }}
      aria-disabled="true"
    >
      <span
        className="absolute top-2 right-2 rounded-full px-1.5 py-0.5 font-inter"
        style={{
          color: '#cbd5e1', background: 'rgba(15,23,42,0.85)',
          fontSize: '8.5px', fontWeight: 800, letterSpacing: '0.05em',
          boxShadow: 'inset 0 0 0 1px rgba(148,163,184,0.35)',
        }}
      >
        YAKINDA
      </span>
      <Icon
        className="w-9 h-9"
        strokeWidth={2}
        style={{ color: iconColor, fill: iconFill || 'transparent' }}
      />
      <span
        className="kronox-number mt-2 leading-none"
        style={{ color: titleColor, fontSize: 'clamp(18px, 5vw, 22px)', letterSpacing: '0.04em' }}
      >
        {title}
      </span>
    </div>
  );
}

/**
 * Two passive stone side stars + a broken/cracked red center star. The
 * broken star appears without shaking the whole screen.
 */
function FailedStarsRow({ reduceMotion }) {
  return (
    <div
      className="relative mt-4 mb-2 flex items-center justify-center"
      style={{ gap: 'clamp(10px, 4vw, 18px)', height: 'clamp(96px, 26vw, 120px)' }}
      aria-hidden="true"
    >
      <StoneStar size="clamp(56px, 17vw, 72px)" reduceMotion={reduceMotion} />
      <CrackedCenterStar size="clamp(78px, 22vw, 98px)" reduceMotion={reduceMotion} />
      <StoneStar size="clamp(56px, 17vw, 72px)" reduceMotion={reduceMotion} />
    </div>
  );
}

function StoneStar({ size, reduceMotion }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      initial={reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
      animate={reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
      transition={reduceMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 280, damping: 18, delay: 0.2 }}
      style={{ width: size, height: size, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))' }}
    >
      <path
        d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 21.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"
        fill="#3a4566"
        stroke="rgba(120,135,165,0.5)"
        strokeWidth="1"
      />
    </motion.svg>
  );
}

function CrackedCenterStar({ size, reduceMotion }) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
      animate={reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
      transition={reduceMotion ? { duration: 0.25 } : { type: 'spring', stiffness: 240, damping: 16, delay: 0.32 }}
      className="relative"
      style={{ width: size, height: size }}
    >
      {/* Red glow behind the star */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 55%, rgba(255,77,109,0.55) 0%, rgba(255,77,109,0.18) 42%, transparent 72%)',
          filter: 'blur(2px)',
        }}
      />
      {/* Split star halves separated by a jagged gap */}
      <svg viewBox="0 0 100 100" className="relative w-full h-full" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="brokenStarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff6b85" />
            <stop offset="100%" stopColor="#c81e3c" />
          </linearGradient>
        </defs>
        {/* Left half of the star */}
        <path
          d="M50 8 L61 38 L50 40 L44 62 L50 78 L26 92 L31 66 L8 46 L38 42 L50 8 Z"
          fill="url(#brokenStarGrad)"
          stroke="#ff8fa3"
          strokeWidth="1.5"
          transform="translate(-3,0) rotate(-6 50 50)"
          style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.55))' }}
        />
        {/* Right half of the star */}
        <path
          d="M50 8 L62 42 L92 46 L69 66 L74 92 L50 78 L56 62 L50 40 L61 38 L50 8 Z"
          fill="url(#brokenStarGrad)"
          stroke="#ff8fa3"
          strokeWidth="1.5"
          transform="translate(3,0) rotate(6 50 50)"
          style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.55))' }}
        />
      </svg>
      {/* Red shard splinters */}
      <Shard top="16%" left="4%" rotate={-25} />
      <Shard top="24%" right="2%" rotate={35} />
      <Shard bottom="16%" left="0%" rotate={20} />
      <Shard bottom="8%" right="8%" rotate={-15} />
    </motion.div>
  );
}

function Shard({ top, bottom, left, right, rotate = 0 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute', top, bottom, left, right, width: 6, height: 10,
        background: 'linear-gradient(180deg, #ff4d6d, #b91d3d)',
        clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
        transform: `rotate(${rotate}deg)`,
        filter: 'drop-shadow(0 0 4px rgba(255,77,109,0.7))',
        opacity: 0.9,
      }}
    />
  );
}

function SecondaryButton({ children, onClick, icon: Icon }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="w-full flex items-center justify-center gap-2 font-bangers text-white"
      style={{
        height: 48, borderRadius: 14,
        background: 'rgba(15,22,46,0.85)',
        fontSize: 'clamp(13px, 3.6vw, 15px)', letterSpacing: '0.06em',
        boxShadow: 'inset 0 0 0 1.5px rgba(96,165,250,0.4)',
      }}
    >
      <Icon className="w-4 h-4" strokeWidth={2.6} style={{ color: '#60a5fa' }} />
      <span>{children}</span>
    </motion.button>
  );
}