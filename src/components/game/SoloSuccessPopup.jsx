import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Star, ChevronRight, RotateCcw, ListChecks, TimerReset, MoveHorizontal, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildSoloGameConfigForLevel } from '@/lib/soloLevels';
import { buildSoloLevelRecordCongratulations, fetchSoloLevelRecordContext } from '@/lib/soloLevelRecord';
import { formatCompactDuration } from '@/lib/soloTimeFormat';
import { pickSoloSuccessMessage } from '@/lib/soloResultMessages';
import SoloResultMetricCard from './SoloResultMetricCard';
import { sounds } from '@/lib/gameSounds';

/**
 * Solo SUCCESS level-end screen — redesigned per the reference:
 *
 *   • Dark-blue full-screen panel with a controlled gold glow.
 *   • Title:  "N. SEVİYE TAMAMLANDI!"  (Bangers, gold, flanked by ornaments)
 *   • Three glowing stars stagger in, filled up to the earned star count.
 *   • Success message from the shared message pool.
 *   • Three vertical metric cards: SÜRE, HAMLE, PUAN.
 *       - PUAN card shows "Hız Bonusu +X ⚡" footer ONLY when a speed bonus
 *         was actually earned.
 *   • Primary gold CTA: "SONRAKİ SEVİYE" with a chevron.
 *   • Two secondary outline CTAs: "TEKRAR OYNA", "SEVİYELER".
 *
 * Product logic (stars, score, used moves, speed bonus, record badge,
 * onNextLevel/onRetry/onBackToPath) is untouched — this is a visual pass.
 */
export default function SoloSuccessPopup({
  levelNumber,
  stars,
  mistakes,
  usedMoves,
  remainingMoves,
  maxMoves,
  timeSeconds,
  levelScore,
  timeBonus,
  hasNextLevel,
  userEmail,
  guestRecordPayload,
  onNextLevel,
  onRetry,
  onBackToPath,
  primaryActionLabel = 'SONRAKİ SEVİYE',
  backToPathLabel = 'SEVİYELER',
  tutorialCompletion = false,
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  // Tutorial completion → "Seviye 2" continues into the real Level 2 with
  // the username already given (guest profile persists).
  const goToLevelTwo = () => {
    navigate('/game', { replace: true, state: buildSoloGameConfigForLevel({ levelNumber: 2 }) });
  };

  // Record context: only computed on success, silent on error.
  const [recordAchievement, setRecordAchievement] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchSoloLevelRecordContext({ levelNumber, timeSeconds, usedMoves, guestRecordPayload })
      .then((res) => { if (!cancelled) setRecordAchievement(res); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [guestRecordPayload, levelNumber, timeSeconds, usedMoves]);

  // Short, subtle success feedback on mount.
  useEffect(() => {
    try { sounds.rewardReveal(); } catch { /* audio unavailable — ignore */ }
  }, []);

  const speedBonusEarned = Number(timeBonus) > 0;
  const speedBonusValue = Math.max(0, Math.floor(Number(timeBonus) || 0));
  const compactTime = formatCompactDuration(timeSeconds);
  const moveValue = Math.max(0, Math.floor(Number(usedMoves) || 0));
  const scoreValue = Math.max(0, Math.floor(Number(levelScore) || 0));
  const successMessage = pickSoloSuccessMessage(levelNumber);
  const recordCongratulations = buildSoloLevelRecordCongratulations(recordAchievement);
  void userEmail; void mistakes; void remainingMoves; void maxMoves;

  const panelInitial = reduceMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0, y: 24 };
  const panelAnimate = reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md p-4"
      style={{ background: 'rgba(3,8,22,0.94)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`${levelNumber}. seviye tamamlandı, ${stars} yıldız`}
    >
      <motion.div
        initial={panelInitial}
        animate={panelAnimate}
        transition={reduceMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 280, damping: 24 }}
        className="w-full max-w-sm rounded-[28px] overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.14), transparent 60%), linear-gradient(180deg, #0a1c46 0%, #061332 100%)',
          boxShadow:
            'inset 0 0 0 1.5px rgba(96,165,250,0.32), 0 24px 60px rgba(2,6,23,0.65), 0 0 40px rgba(250,204,21,0.12)',
        }}
      >
        <div className="px-5 pt-6 pb-5">
          <TitleRow levelNumber={levelNumber} />

          <StarsRow stars={stars} reduceMotion={reduceMotion} />

          <p
            className="mt-3 text-center font-inter"
            style={{ color: '#e2e8f0', fontSize: 'clamp(14px, 4vw, 16px)', fontWeight: 500 }}
          >
            {successMessage}
          </p>

          {recordCongratulations ? (
            <p
              className="mt-2.5 rounded-xl px-3 py-2 text-center font-inter"
              style={{
                color: '#fef3c7',
                background: 'linear-gradient(180deg, rgba(30,64,175,0.48), rgba(15,23,42,0.38))',
                boxShadow: 'inset 0 0 0 1px rgba(250,204,21,0.28), 0 0 16px rgba(250,204,21,0.12)',
                fontSize: 'clamp(12px, 3.4vw, 14px)', fontWeight: 800, lineHeight: 1.35,
              }}
            >
              {recordCongratulations}
            </p>
          ) : null}

          {/* Gold diamond divider */}
          <div className="mt-3.5 mb-3.5 flex items-center justify-center gap-2" aria-hidden="true">
            <span style={{ display: 'block', height: 1, width: 56, background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.55), transparent)' }} />
            <span style={{ display: 'block', width: 7, height: 7, background: '#facc15', transform: 'rotate(45deg)', boxShadow: '0 0 8px rgba(250,204,21,0.7)' }} />
            <span style={{ display: 'block', height: 1, width: 56, background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.55), transparent)' }} />
          </div>

          {/* Three vertical metric cards: SÜRE · HAMLE · PUAN */}
          <div className="grid grid-cols-3 gap-2">
            <SoloResultMetricCard
              icon={TimerReset}
              iconColor="#60a5fa"
              ringColor="rgba(96,165,250,0.55)"
              label="SÜRE"
              value={compactTime}
              valueColor="#ffffff"
            />
            <SoloResultMetricCard
              icon={MoveHorizontal}
              iconColor="#38bdf8"
              ringColor="rgba(56,189,248,0.55)"
              label="HAMLE"
              value={String(moveValue)}
              valueColor="#38bdf8"
            />
            <SoloResultMetricCard
              icon={Star}
              iconColor="#facc15"
              iconFill="#facc15"
              ringColor="rgba(250,204,21,0.55)"
              label="PUAN"
              ariaLabel={`Puan: ${scoreValue}`}
              value={String(levelScore || 0)}
              valueColor="#facc15"
              footer={speedBonusEarned ? (
                <span
                  className="flex items-center gap-0.5 font-inter"
                  style={{ color: '#4ade80', fontSize: '10px', fontWeight: 800, whiteSpace: 'nowrap' }}
                >
                  <span style={{ color: 'rgba(203,213,225,0.85)' }}>HIZ BONUSU</span>
                  <span>+{speedBonusValue}</span>
                  <Zap className="w-3 h-3" strokeWidth={2.6} style={{ fill: '#4ade80' }} />
                </span>
              ) : null}
            />
          </div>

          {/* Buttons */}
          <div className="mt-5 flex flex-col gap-2.5">
            <Button
              onClick={onNextLevel}
              disabled={!hasNextLevel}
              className="w-full h-[52px] rounded-2xl font-bangers tracking-[0.1em] disabled:opacity-60 flex items-center justify-between px-5"
              style={{
                background: hasNextLevel
                  ? 'linear-gradient(180deg, #ffe066 0%, #facc15 55%, #d99e00 100%)'
                  : 'linear-gradient(180deg, rgba(250,204,21,0.3), rgba(185,122,6,0.2))',
                color: '#1a0a00',
                fontSize: 'clamp(16px, 4.4vw, 19px)',
                boxShadow: hasNextLevel
                  ? 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(120,75,0,0.35), 0 6px 18px rgba(250,204,21,0.35)'
                  : 'inset 0 0 0 1px rgba(250,204,21,0.35)',
              }}
            >
              <span className="w-5" aria-hidden="true" />
              <span className="flex-1 text-center">{primaryActionLabel}</span>
              <ChevronRight className="w-5 h-5" strokeWidth={3} />
            </Button>

            <div className="grid grid-cols-2 gap-2.5">
              {tutorialCompletion ? (
                <SecondaryButton onClick={goToLevelTwo} icon={ChevronRight}>SEVİYE 2</SecondaryButton>
              ) : (
                <SecondaryButton onClick={onRetry} icon={RotateCcw}>TEKRAR OYNA</SecondaryButton>
              )}
              <SecondaryButton onClick={onBackToPath} icon={ListChecks}>{backToPathLabel}</SecondaryButton>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────── helpers ─────────────────────────── */

function SecondaryButton({ children, onClick, icon: Icon }) {
  return (
    <Button
      onClick={onClick}
      className="w-full h-11 rounded-2xl font-bangers text-white flex items-center justify-center gap-2"
      style={{
        background: 'linear-gradient(180deg, rgba(20,30,60,0.85), rgba(10,18,40,0.95))',
        boxShadow: 'inset 0 0 0 1.5px rgba(96,165,250,0.32)',
        fontSize: 'clamp(13px, 3.6vw, 15px)', letterSpacing: '0.06em',
      }}
    >
      <Icon className="w-4 h-4" strokeWidth={2.6} style={{ color: '#60a5fa' }} />
      {children}
    </Button>
  );
}

function TitleRow({ levelNumber }) {
  return (
    <div className="flex items-center justify-center gap-2 px-1">
      <TitleOrnament side="left" />
      <h1
        className="font-bangers text-center whitespace-nowrap"
        style={{
          color: '#facc15',
          fontSize: 'clamp(19px, 5.6vw, 24px)',
          letterSpacing: '0.04em',
          fontWeight: 400,
          textShadow: '0 0 14px rgba(250,204,21,0.45), 0 1px 4px rgba(0,0,0,0.55)',
        }}
      >
        {levelNumber}. SEVİYE TAMAMLANDI!
      </h1>
      <TitleOrnament side="right" />
    </div>
  );
}

function TitleOrnament({ side }) {
  const line = (
    <span
      style={{
        display: 'block', height: 1, width: 18,
        background: side === 'left'
          ? 'linear-gradient(90deg, transparent, rgba(250,204,21,0.7))'
          : 'linear-gradient(90deg, rgba(250,204,21,0.7), transparent)',
      }}
    />
  );
  const star = (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block', width: 10, height: 10,
        background: 'radial-gradient(circle at 50% 50%, #fff6c2 0%, #facc15 35%, rgba(250,204,21,0) 70%)',
        filter: 'drop-shadow(0 0 6px rgba(250,204,21,0.85))',
        borderRadius: '2px', transform: 'rotate(45deg)',
      }}
    />
  );
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      {side === 'left' ? <>{star}{line}</> : <>{line}{star}</>}
    </span>
  );
}

function StarsRow({ stars, reduceMotion }) {
  const sparkles = [
    { top: '8%', left: '6%', size: 6, delay: 0.25 },
    { top: '14%', left: '94%', size: 5, delay: 0.45 },
    { top: '70%', left: '4%', size: 5, delay: 0.55 },
    { top: '78%', left: '96%', size: 6, delay: 0.35 },
    { top: '0%', left: '38%', size: 4, delay: 0.6 },
    { top: '2%', left: '64%', size: 4, delay: 0.5 },
  ];

  return (
    <div
      className="relative mt-4 flex items-center justify-center gap-3"
      style={{ minHeight: 'clamp(72px, 22vw, 92px)' }}
      aria-hidden="true"
    >
      {!reduceMotion && sparkles.map((sp, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0.5, 1], scale: [0, 1.1, 0.9, 1] }}
          transition={{ delay: sp.delay, duration: 1.2, repeat: Infinity, repeatDelay: 1.8 }}
          style={{
            position: 'absolute', top: sp.top, left: sp.left, width: sp.size, height: sp.size,
            transform: 'translate(-50%, -50%) rotate(45deg)',
            background: 'radial-gradient(circle at 50% 50%, #fff6c2 0%, #facc15 45%, rgba(250,204,21,0) 75%)',
            filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.9))',
            borderRadius: '2px', pointerEvents: 'none',
          }}
        />
      ))}

      {[1, 2, 3].map((i) => {
        const filled = i <= stars;
        const initial = reduceMotion ? { scale: 1, opacity: 0 } : { scale: 0, rotate: -180 };
        const animate = reduceMotion ? { scale: 1, opacity: 1 } : { scale: 1, rotate: 0 };
        return (
          <motion.div
            key={i}
            initial={initial}
            animate={animate}
            transition={reduceMotion
              ? { delay: i * 0.05, duration: 0.2 }
              : { delay: 0.15 + i * 0.12, type: 'spring', stiffness: 320, damping: 18 }}
            style={{ position: 'relative', zIndex: 1 }}
          >
            <Star
              style={{
                width: 'clamp(54px, 18vw, 72px)',
                height: 'clamp(54px, 18vw, 72px)',
                color: filled ? '#facc15' : 'rgba(40,55,95,0.65)',
                fill: filled ? '#facc15' : 'rgba(20,30,60,0.55)',
                filter: filled
                  ? 'drop-shadow(0 0 14px rgba(250,204,21,0.85)) drop-shadow(0 0 28px rgba(250,204,21,0.45))'
                  : 'none',
              }}
              strokeWidth={2.2}
            />
          </motion.div>
        );
      })}
    </div>
  );
}