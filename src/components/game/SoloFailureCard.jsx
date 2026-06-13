import React from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, ListChecks, TimerReset, Star, X, Zap } from 'lucide-react';
// Codex164 — Solo failure popup now uses the same compact MM:SS time
// format and the same SoloStatCard layout as the success popup so the
// two screens stay visually identical. We deliberately keep
// GameOverTimer.formatDuration around for its other callers.
import SoloStatCard from './SoloStatCard';
import { formatCompactDuration } from '@/lib/soloTimeFormat';

/**
 * Solo FAILURE result popup.
 *
 * Pixel-faithful to the provided reference:
 *   • Red headline: "N. SEVİYE GEÇİLEMEDİ!"
 *   • Three stone stars (left + right intact, center cracked with red glow)
 *   • Two-line subline: "Üzgünüm, süre bitti." / "Tekrar deneyebilirsin!"
 *     (or "çok fazla hata yaptın." for the mistakes branch)
 *   • Red diamond divider
 *   • 2x2 stat grid:
 *       TL: SÜRE (blue clock)   • TR: PUAN (yellow star)
 *       BL: HATA (red X)        • BR: HIZ BONUSU (red ✕)
 *   • Two CTAs: yellow "TEKRAR OYNA", outline "SEVİYELER"
 *
 * Props are unchanged so SoloLevelResult keeps delegating without
 * touching its public contract.
 */
export default function SoloFailureCard({
  levelNumber,
  mistakes,
  timeSeconds,
  levelScore = 0,
  failReason,
  onRetry,
  onBackToPath,
}) {
  const formattedTime = formatCompactDuration(timeSeconds);

  const sublinePrimary = failReason === 'timeout'
    ? 'Üzgünüm, süre bitti.'
    : 'Üzgünüm, çok fazla hata yaptın.';
  const sublineSecondary = 'Tekrar deneyebilirsin!';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, rgba(120,20,40,0.35) 0%, rgba(5,8,22,0.96) 60%)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.82, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="w-full max-w-sm rounded-[28px] overflow-hidden relative"
        style={{
          background: 'linear-gradient(165deg, #0d1430 0%, #060a1e 100%)',
          border: '1px solid rgba(248,113,113,0.28)',
          boxShadow:
            '0 30px 60px rgba(0,0,0,0.6), 0 0 40px rgba(248,113,113,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="px-5 pt-7 pb-5">
          {/* Headline — red, glowing */}
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="font-bangers text-center tracking-[0.05em]"
            style={{
              color: '#ff4d6d',
              fontSize: 'clamp(20px, 6vw, 26px)',
              textShadow:
                '0 0 14px rgba(255,77,109,0.55), 0 0 28px rgba(255,77,109,0.35), 0 2px 4px rgba(0,0,0,0.6)',
              lineHeight: 1.1,
            }}
          >
            {levelNumber}. SEVİYE GEÇİLEMEDİ!
          </motion.h1>

          {/* Three stone stars — center one cracked w/ red glow */}
          <FailedStarsRow />

          {/* Subline */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.3 }}
            className="text-center px-3"
            style={{ marginTop: 4 }}
          >
            <p
              className="font-inter text-white/85"
              style={{ fontSize: 'clamp(13px, 3.8vw, 15px)', fontWeight: 400 }}
            >
              {sublinePrimary}
            </p>
            <p
              className="font-inter text-white/85"
              style={{ fontSize: 'clamp(13px, 3.8vw, 15px)', fontWeight: 400 }}
            >
              {sublineSecondary}
            </p>
          </motion.div>

          {/* Red diamond divider */}
          <div className="mt-3 mb-4 flex items-center justify-center gap-2" aria-hidden="true">
            <span
              style={{
                display: 'block',
                height: 1,
                width: 64,
                background: 'linear-gradient(90deg, transparent, rgba(255,77,109,0.55), transparent)',
              }}
            />
            <span
              style={{
                display: 'block',
                width: 7,
                height: 7,
                background: '#ff4d6d',
                transform: 'rotate(45deg)',
                boxShadow: '0 0 8px rgba(255,77,109,0.7)',
              }}
            />
            <span
              style={{
                display: 'block',
                height: 1,
                width: 64,
                background: 'linear-gradient(90deg, transparent, rgba(255,77,109,0.55), transparent)',
              }}
            />
          </div>

          {/* 2x2 stat grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <SoloStatCard
              icon={TimerReset}
              iconColor="#5aa9ff"
              iconRingColor="rgba(90,169,255,0.55)"
              label="SÜRE"
              value={formattedTime}
              valueColor="#ffffff"
            />
            <SoloStatCard
              icon={Star}
              iconColor="#facc15"
              iconFill="#facc15"
              iconRingColor="rgba(250,204,21,0.55)"
              label="PUAN"
              value={String(levelScore)}
              valueColor="#facc15"
            />
            <SoloStatCard
              icon={X}
              iconColor="#ff4d6d"
              iconRingColor="rgba(255,77,109,0.55)"
              label="HATA"
              value={String(mistakes)}
              valueColor="#ff4d6d"
            />
            <SoloStatCard
              icon={Zap}
              iconColor="#ff4d6d"
              iconRingColor="rgba(255,77,109,0.55)"
              label="HIZ BONUSU"
              valueNode={<X className="w-7 h-7" strokeWidth={3.4} style={{ color: '#ff4d6d' }} />}
              valueColor="#ff4d6d"
            />
          </div>

          {/* CTAs */}
          <div className="mt-5 flex flex-col gap-2.5">
            <PrimaryButton onClick={onRetry}>
              <RotateCcw className="w-5 h-5" strokeWidth={2.6} />
              <span>TEKRAR OYNA</span>
            </PrimaryButton>
            <OutlineButton onClick={onBackToPath}>
              <ListChecks className="w-5 h-5" strokeWidth={2.4} />
              <span>SEVİYELER</span>
            </OutlineButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────── Pieces ─────────── */

/**
 * Three stone-grey stars. Left and right are whole; the center one is
 * fractured with a red inner glow + small shard splinters around it,
 * matching the reference artwork.
 */
function FailedStarsRow() {
  return (
    <div
      className="relative mt-5 mb-3 flex items-end justify-center"
      style={{ gap: 'clamp(10px, 4vw, 18px)', height: 'clamp(110px, 30vw, 140px)' }}
    >
      <StoneStar size="clamp(60px, 18vw, 78px)" dim />
      <CrackedCenterStar size="clamp(82px, 24vw, 104px)" />
      <StoneStar size="clamp(60px, 18vw, 78px)" dim />
    </div>
  );
}

function StoneStar({ size, dim = false }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -25, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.2 }}
      style={{ width: size, height: size, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))' }}
    >
      <Star
        className="w-full h-full"
        strokeWidth={1.6}
        style={{
          color: 'rgba(120,135,165,0.55)',
          fill: dim ? '#3a4566' : '#475070',
          opacity: 0.92,
        }}
      />
    </motion.div>
  );
}

function CrackedCenterStar({ size }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -10, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.32 }}
      className="relative"
      style={{ width: size, height: size }}
    >
      {/* Red inner glow behind the star */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 55%, rgba(255,77,109,0.55) 0%, rgba(255,77,109,0.18) 40%, transparent 70%)',
          filter: 'blur(2px)',
        }}
      />
      {/* Small red shard splinters around the star */}
      <Shard top="14%" left="6%" rotate={-25} />
      <Shard top="22%" right="4%" rotate={35} />
      <Shard bottom="14%" left="-2%" rotate={20} />
      <Shard bottom="6%" right="10%" rotate={-15} />

      {/* Stone star body */}
      <Star
        className="relative w-full h-full"
        strokeWidth={1.6}
        style={{
          color: 'rgba(140,155,185,0.7)',
          fill: '#3f4a6b',
          filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.65))',
        }}
      />

      {/* Crack overlay — thin red lightning-like lines down the middle */}
      <svg
        className="absolute inset-0 pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="crackGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4d6d" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ff8fa3" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* Main jagged crack */}
        <polyline
          points="48,22 52,38 44,50 56,62 46,76"
          fill="none"
          stroke="url(#crackGrad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 3px rgba(255,77,109,0.85))' }}
        />
        {/* Secondary branch */}
        <polyline
          points="52,38 60,44 62,52"
          fill="none"
          stroke="url(#crackGrad)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
          style={{ filter: 'drop-shadow(0 0 2px rgba(255,77,109,0.7))' }}
        />
        {/* Tertiary branch */}
        <polyline
          points="44,50 36,56"
          fill="none"
          stroke="url(#crackGrad)"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    </motion.div>
  );
}

function Shard({ top, bottom, left, right, rotate = 0 }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        top,
        bottom,
        left,
        right,
        width: 6,
        height: 10,
        background: 'linear-gradient(180deg, #ff4d6d, #b91d3d)',
        clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
        transform: `rotate(${rotate}deg)`,
        filter: 'drop-shadow(0 0 4px rgba(255,77,109,0.7))',
        opacity: 0.9,
      }}
    />
  );
}

function PrimaryButton({ children, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="w-full flex items-center justify-center gap-2 font-bangers"
      style={{
        height: 52,
        borderRadius: 14,
        background: 'linear-gradient(180deg, #ffd84a 0%, #f5c400 55%, #e0ad00 100%)',
        color: '#1a1003',
        fontSize: 'clamp(15px, 4.2vw, 18px)',
        letterSpacing: '0.06em',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -3px 0 rgba(120,75,0,0.35), 0 8px 22px rgba(250,204,21,0.28)',
      }}
    >
      {children}
    </motion.button>
  );
}

function OutlineButton({ children, onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="w-full flex items-center justify-center gap-2 font-bangers text-white"
      style={{
        height: 48,
        borderRadius: 14,
        background: 'rgba(15,22,46,0.85)',
        fontSize: 'clamp(14px, 3.8vw, 16px)',
        letterSpacing: '0.06em',
        boxShadow: 'inset 0 0 0 1.5px rgba(120,140,190,0.45)',
      }}
    >
      {children}
    </motion.button>
  );
}
