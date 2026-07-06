// Verims comment-2 23.06.2026
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';
import QuestionCard from './QuestionCard.jsx';
import Timeline from './Timeline.jsx';
import TurnTimer from './TurnTimer.jsx';
import SoloLevelTimer from './SoloLevelTimer.jsx';
import SoloJokerBar from './SoloJokerBar.jsx';
import SoloHintButton from './SoloHintButton.jsx';
import OnlineTurnIndicator from './OnlineTurnIndicator.jsx';
import OnlineScoreboard from './OnlineScoreboard.jsx';
import TutorialHandPointer from './TutorialHandPointer.jsx';
import { playerTextColors } from './playerColors';

const CTA_ACTIVE_SHADOW = [
  '0 9px 0 rgba(143,94,0,0.92), 0 18px 32px rgba(0,0,0,0.34), 0 0 16px rgba(255,201,40,0.28)',
  '0 9px 0 rgba(143,94,0,0.92), 0 20px 36px rgba(0,0,0,0.38), 0 0 22px rgba(255,201,40,0.36)',
  '0 9px 0 rgba(143,94,0,0.92), 0 18px 32px rgba(0,0,0,0.34), 0 0 16px rgba(255,201,40,0.28)',
];

function CTAButton({ active, onClick, disabled }) {
  return (
    <motion.button
      onClick={() => { if (active && onClick) { sounds.tap(); onClick(); } }}
      disabled={disabled}
      aria-disabled={disabled}
      animate={active ? {
        boxShadow: CTA_ACTIVE_SHADOW,
        scale: [1, 1.012, 1],
      } : {
        boxShadow: '0 5px 0 rgba(6,10,26,0.82), 0 12px 24px rgba(0,0,0,0.22)',
        scale: 1,
      }}
      whileTap={active ? { scale: 0.965, y: 3 } : { scale: 0.99 }}
      transition={active ? { duration: 1.25, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.18 }}
      className="relative isolate h-12 w-full max-w-[320px] overflow-hidden rounded-2xl from-primary text-xl tracking-[0.05em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
      style={{
        background: active
          ? 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.08) 18%, transparent 19%), linear-gradient(180deg, #FFE26A 0%, #FFC928 52%, #E7A900 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.045))',
        border: active ? '1px solid rgba(255,255,255,0.42)' : '1px solid rgba(255,255,255,0.1)',
        color: active ? '#0a0f23' : 'rgba(255,255,255,0.28)',
        cursor: active ? 'pointer' : 'not-allowed',
        textShadow: active ? '0 1px 0 rgba(255,255,255,0.34)' : 'none',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1/2"
        style={{
          background: active
            ? 'linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0))',
        }}
      />
      <motion.span
        aria-hidden="true"
        className="absolute -inset-x-10 top-0 h-full skew-x-[-18deg]"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.42), transparent)' }}
        animate={active ? { x: ['-34%', '34%'], opacity: [0.08, 0.24, 0.08] } : { opacity: 0 }}
        transition={active ? { duration: 1.55, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.16 }}
      />
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-5 bottom-1 h-1 rounded-full"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.84), transparent)' }}
        animate={active ? { opacity: [0.36, 0.72, 0.36], scaleX: [0.82, 1, 0.82] } : { opacity: 0.08, scaleX: 0.72 }}
        transition={active ? { duration: 1.25, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.16 }}
      />
      <span className="relative z-10 block translate-y-[1px]">Kartı Yerleştir</span>
    </motion.button>
  );
}

function GuidedDragFingerHint({ active, reducedMotion, targetSlotPosition = null, containerRef = null }) {
  if (!active) return null;

  // The hand must travel from the question card DOWN INTO the actual correct
  // timeline slot. The Timeline reports that slot's live viewport-center X/Y
  // (targetSlotPosition) — we convert it to coordinates relative to the
  // gameplay container so the hand lands inside the real slot, not a guessed
  // dead-center position. If the position isn't available yet, we fall back
  // to the previous straight-down behavior. Visual-only; hit-testing is
  // unaffected (it reads finger coordinates).
  const container = containerRef?.current || null;
  let endX = null;
  let endY = null;
  if (targetSlotPosition && container) {
    const rect = container.getBoundingClientRect();
    endX = targetSlotPosition.centerX - rect.left;
    endY = targetSlotPosition.centerY - rect.top;
  }
  const hasResolvedTarget = endX !== null && endY !== null;

  // Start point: just under the question card area (~46% of container height),
  // centered. End point: the real slot center (or straight down as fallback).
  const startLeft = hasResolvedTarget ? endX : null;

  const pathAnimation = reducedMotion
    ? {
        opacity: [0.72, 1, 0.72],
        scale: [1, 1.04, 1],
      }
    : hasResolvedTarget
      ? {
          x: [0, 0, 0, 0],
          y: [0, 0, Math.max(40, endY - (container.getBoundingClientRect().height * 0.46)), Math.max(40, endY - (container.getBoundingClientRect().height * 0.46))],
          opacity: [0, 1, 1, 0],
          scale: [0.92, 1, 1, 0.96],
        }
      : {
          x: [0, 0, 0, 0],
          y: [0, 0, 188, 188],
          opacity: [0, 1, 1, 0],
          scale: [0.92, 1, 1, 0.96],
        };

  return (
    <motion.div
      aria-hidden="true"
      data-kronox-guided-drag-finger-hint="true"
      className="pointer-events-none absolute z-40 flex flex-col items-center gap-1"
      initial={reducedMotion
        ? { opacity: 0.72, scale: 1 }
        : { x: 0, y: 0, opacity: 0, scale: 0.92 }}
      animate={pathAnimation}
      transition={{
        delay: 0.55,
        duration: reducedMotion ? 1.4 : 2.35,
        repeat: Infinity,
        repeatDelay: reducedMotion ? 1.6 : 1.15,
        ease: 'easeInOut',
      }}
      style={{
        left: hasResolvedTarget ? startLeft : '50%',
        top: '46%',
        marginLeft: -24,
        marginTop: -24,
        willChange: 'transform, opacity',
      }}
    >
      <TutorialHandPointer mode="drag" size={46} />
    </motion.div>
  );
}

function GuidedTimelineSwipeHint({ active, reducedMotion }) {
  if (!active) return null;

  return (
    <motion.div
      aria-hidden="true"
      data-kronox-guided-timeline-swipe-hint="true"
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: reducedMotion ? [0.64, 1, 0.64] : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 1.35 : 0.18, repeat: reducedMotion ? Infinity : 0, ease: 'easeInOut' }}
    >
      <motion.span
        aria-hidden="true"
        className="absolute h-2 w-28 rounded-full"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(250,204,21,0.58), transparent)',
        }}
        animate={reducedMotion ? { opacity: [0.32, 0.7, 0.32] } : { scaleX: [0.72, 1.08, 0.72], opacity: [0.22, 0.74, 0.22] }}
        transition={{ duration: 1.55, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.span
        style={{ willChange: 'transform, opacity' }}
        initial={reducedMotion ? { scale: 1 } : { x: -52, y: 0, opacity: 0 }}
        animate={reducedMotion
          ? { scale: [1, 1.05, 1] }
          : { x: [-52, 52, -52], y: [0, -2, 0], opacity: [0, 1, 1, 0] }}
        transition={{
          delay: 0.3,
          duration: reducedMotion ? 1.45 : 2.1,
          repeat: Infinity,
          repeatDelay: reducedMotion ? 1.25 : 0.75,
          ease: 'easeInOut',
        }}
      >
        <TutorialHandPointer mode="swipe" size={46} />
      </motion.span>
    </motion.div>
  );
}

export default function GameLayout({
  // Game state
  players,
  currentPlayerIndex,
  currentPlayer,
  currentQuestion,
  winCardCount,
  selectedZone,
  isDragging,
  touchDragPos,
  touchDragEnd,
  isMyTurn,
  isOnline,
  myEmail,
  feedback,
  winner,
  turnDuration,
  timerKey,
  isTimeUp,
  progressCardCount,
  progressCardTarget,
  remainingMoves,
  maxMoves,
  // Codex106-24 — Solo Level mode countdown. When provided, GameLayout
  // shows a total-level countdown in the top-right slot instead of the
  // per-question TurnTimer. Other modes (online, legacy solo) pass
  // undefined and behave unchanged.
  soloLevelTotalSeconds,
  soloLevelElapsedSeconds,
  soloLevelTimerFrozen = false,
  soloJokers: rawSoloJokers = null,
  soloHint = null,
  balances = null,
  beginnerPlacementHintZone,
  guidedDragHintActive = false,
  guidedDragTargetZone = null,
  guidedTimelineScrollHintActive = false,
  guidedTimelineSwipeHintMinimumElapsed = false,
  interactionPaused = false,
  correctStreak = 0,
  // Handlers
  onSelectZone,
  onDropOnZone,
  onConfirmPlacement,
  onImageError,
  onAudioError,
  onDragStart,
  onDragEnd,
  onTouchDragMove,
  onTouchDragEnd,
  onTouchDragCancel,
  onTimelineSwipeHintInteraction,
  onTimeUp,
  onSoloBack,
}) {
  const soloJokers = rawSoloJokers
    ? { ...rawSoloJokers, balances: balances || rawSoloJokers?.balances || null }
    : null;
  // Ghost card follows the raw finger position (viewport coords) — no scroll correction needed
  // Timeline uses world coords internally for hit-testing
  const isSpectatingQuestion = Boolean(isOnline && !isMyTurn && currentQuestion && !winner);
  const visibleProgressCount = Number.isFinite(Number(progressCardCount))
    ? Math.max(0, Number(progressCardCount))
    : (currentPlayer?.cards?.length || 0);
  const visibleProgressTarget = Number.isFinite(Number(progressCardTarget))
    ? Math.max(1, Number(progressCardTarget))
    : Math.max(1, Number(winCardCount) || 10);
  const progressPercent = Math.min(100, (visibleProgressCount / visibleProgressTarget) * 100);
  const showRemainingMoves = Number.isFinite(Number(remainingMoves));
  const showSoloLevelHeader = showRemainingMoves && typeof soloLevelTotalSeconds === 'number';
  const visibleRemainingMoves = Math.max(0, Math.floor(Number(remainingMoves) || 0));
  const visibleMaxMoves = Math.max(1, Math.floor(Number(maxMoves) || 10));
  const previousProgressCountRef = useRef(visibleProgressCount);
  const [progressPulseKey, setProgressPulseKey] = useState(0);
  const [progressPulseActive, setProgressPulseActive] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const gameplayRootRef = useRef(null);
  const [guidedTargetSlotPosition, setGuidedTargetSlotPosition] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPrefersReducedMotion(Boolean(media.matches));
    sync();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync);
      return () => media.removeEventListener('change', sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  useEffect(() => {
    if (visibleProgressCount > previousProgressCountRef.current) {
      setProgressPulseKey((key) => key + 1);
      setProgressPulseActive(true);
      const timer = window.setTimeout(() => setProgressPulseActive(false), 520);
      previousProgressCountRef.current = visibleProgressCount;
      return () => window.clearTimeout(timer);
    }
    previousProgressCountRef.current = visibleProgressCount;
    return undefined;
  }, [visibleProgressCount]);

  const timelineSwipeHintVisible = Boolean(
    guidedTimelineScrollHintActive &&
    isMyTurn &&
    !feedback &&
    !winner &&
    !interactionPaused &&
    !isTimeUp &&
    (!isDragging || !guidedTimelineSwipeHintMinimumElapsed)
  );
  const showSoloQuestionJokerRail = Boolean(
    !isOnline &&
    soloJokers?.enabled &&
    currentQuestion &&
    !winner
  );
  const showSoloQuestionHintRail = Boolean(
    !isOnline &&
    soloHint?.enabled &&
    currentQuestion &&
    !winner
  );
  const showSoloQuestionSideRails = showSoloQuestionJokerRail || showSoloQuestionHintRail;
  const isSoloKronokalkanActive = Boolean(
    !isOnline &&
    soloJokers?.mistakeShieldActive &&
    currentQuestion &&
    !winner
  );

  return (
    <div
      ref={gameplayRootRef}
      className={`kx-viewport-lock kronox-gameplay-root flex flex-col ${isDragging ? 'kronox-game-drag-lock' : ''} ${showSoloQuestionSideRails ? 'kronox-solo-joker-right-layout' : ''}`}
      data-kronox-gameplay-root="true"
      data-kronox-solo-joker-right-layout={showSoloQuestionJokerRail ? 'true' : undefined}
      data-kronox-solo-hint-left-layout={showSoloQuestionHintRail ? 'true' : undefined}
      style={{
        minHeight: '100dvh',
        '--solo-game-scale': showSoloQuestionSideRails ? '1' : undefined,
        '--solo-joker-rail-width': showSoloQuestionSideRails ? 'clamp(58px, 16vw, 76px)' : undefined,
        '--solo-active-question-card-width': showSoloQuestionSideRails ? 'clamp(156px, 40vw, 184px)' : undefined,
        '--solo-active-question-card-height': showSoloQuestionSideRails ? 'clamp(252px, 33vh, 292px)' : undefined,
        '--solo-timeline-card-width': showSoloQuestionSideRails ? 'clamp(80px, 21vw, 94px)' : undefined,
        '--solo-timeline-card-height': showSoloQuestionSideRails ? 'clamp(112px, 14.25vh, 126px)' : undefined,
        '--solo-timeline-card-line-offset': showSoloQuestionSideRails ? 'clamp(56px, 7.125vh, 63px)' : undefined,
        '--solo-timeline-panel-padding-y': showSoloQuestionSideRails ? 'clamp(0.55rem, 1.2vh, 0.85rem)' : undefined,
        backgroundColor: '#061225',
        backgroundImage: `
          radial-gradient(
            ellipse at 50% 32%,
            rgba(58, 137, 220, 0.28) 0%,
            rgba(25, 77, 139, 0.14) 32%,
            transparent 62%
          ),
          radial-gradient(
            ellipse at 50% 82%,
            rgba(35, 88, 160, 0.18) 0%,
            transparent 55%
          ),
          linear-gradient(
            180deg,
            #061225 0%,
            #0A2346 42%,
            #0B2852 67%,
            #061225 100%
          )
        `,
      }}
    >
      {/* TOP BAR */}
      <div
        className="relative flex-shrink-0 px-4 pt-2 pb-1"
        style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
      >
        {showRemainingMoves && !winner && (
          <div
            className="absolute left-4 top-2 flex min-w-[64px] items-center justify-center rounded-full border-[1.5px] px-2.5 py-1"
            style={{
              top: 'calc(0.5rem + env(safe-area-inset-top))',
              background: 'rgba(6, 18, 37, 0.88)',
              borderColor: visibleRemainingMoves <= 2 ? 'rgba(248,113,113,0.72)' : '#FFC928',
              boxShadow: visibleRemainingMoves <= 2
                ? '0 0 12px rgba(248,113,113,0.24), inset 0 1px 0 rgba(255,255,255,0.04)'
                : '0 0 12px rgba(255, 201, 40, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
            }}
            aria-label={`${visibleRemainingMoves} hamle kaldı`}
            data-kronox-solo-remaining-moves={visibleRemainingMoves}
            data-kronox-solo-max-moves={visibleMaxMoves}
          >
            <span
              className="kronox-number font-inter font-semibold"
              style={{
                color: '#F4F7FB',
                fontSize: 'clamp(13px, 3.6vw, 14px)',
              }}
            >
              <span style={{ color: visibleRemainingMoves <= 2 ? '#fca5a5' : '#FFC928' }}>{visibleRemainingMoves}</span> HAMLE
            </span>
          </div>
        )}

        {/* Center: Logo */}
        <div
          className="bg-transparent p-0"
          style={{ background: 'transparent', backgroundColor: 'transparent', boxShadow: 'none', border: 'none' }}
        >
          <img
            src="https://media.base44.com/images/public/6a05b47e401bb23c2f21a522/7f9f7c40d_LogoX.png"
            alt="Kronox"
            className="mx-auto mb-1 block h-12 w-auto max-w-[52vw] object-contain"
            style={{
              background: 'transparent',
              backgroundColor: 'transparent',
              boxShadow: 'none',
              border: 'none',
              objectFit: 'contain',
            }}
          />
          {showSoloLevelHeader ? (
            <div
              className="mt-1 flex items-center justify-between gap-3"
              data-kronox-solo-navigation-progress-row="true"
            >
              {onSoloBack ? (
                <button
                  type="button"
                  aria-label="Geri dön"
                  onClick={() => {
                    sounds.tap();
                    onSoloBack();
                  }}
                  className="kronox-solo-back-button flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
                  style={{
                    background: 'rgba(6, 18, 37, 0.86)',
                    border: '1px solid rgba(167, 196, 229, 0.52)',
                    boxShadow: '0 0 12px rgba(56, 189, 248, 0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
                    color: '#D7E7FF',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  data-kronox-solo-back-button="true"
                >
                  <ArrowLeft className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
                </button>
              ) : (
                <span aria-hidden="true" className="h-9 w-9 flex-shrink-0" />
              )}
              <div className="w-28 max-w-[32vw]" data-kronox-solo-progress-under-timer="true">
                <motion.div
                  key={progressPulseKey}
                  className="kronox-number mb-0.5 text-center font-inter font-semibold"
                  style={{ fontSize: 13, color: '#A7C4E5' }}
                  initial={progressPulseKey > 0 ? {
                    scale: prefersReducedMotion ? 1 : 1.16,
                  } : false}
                  animate={{ scale: 1 }}
                  transition={{ duration: prefersReducedMotion ? 0.18 : 0.34, ease: 'easeOut' }}
                >
                  {visibleProgressCount}/{visibleProgressTarget}
                </motion.div>
                <motion.div
                  className="h-[7px] overflow-hidden rounded-full"
                  style={{ background: '#29436C' }}
                  animate={{
                    boxShadow: progressPulseActive
                      ? '0 0 12px rgba(255,201,40,0.32)'
                      : '0 0 0 rgba(0,0,0,0)',
                  }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #FFE26A 0%, #FFC928 100%)' }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                  />
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="mt-1 w-28">
              <motion.div
                key={progressPulseKey}
                className="kronox-number mb-0.5 text-center font-inter font-semibold"
                style={{ fontSize: 13, color: '#A7C4E5' }}
                initial={progressPulseKey > 0 ? {
                  scale: prefersReducedMotion ? 1 : 1.16,
                } : false}
                animate={{ scale: 1 }}
                transition={{ duration: prefersReducedMotion ? 0.18 : 0.34, ease: 'easeOut' }}
              >
                {visibleProgressCount}/{visibleProgressTarget}
              </motion.div>
              <motion.div
                className="h-[7px] overflow-hidden rounded-full"
                style={{ background: '#29436C' }}
                animate={{
                  boxShadow: progressPulseActive
                    ? '0 0 12px rgba(255,201,40,0.32)'
                    : '0 0 0 rgba(0,0,0,0)',
                }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #FFE26A 0%, #FFC928 100%)' }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ type: 'spring', stiffness: 200, damping: 30 }}
                />
              </motion.div>
            </div>
          )}
        </div>

        {/* Right: Timer
            Codex106-24 — In Solo Level mode (soloLevelTotalSeconds set), we
            show a total-level countdown here instead of the per-question
            TurnTimer. Total-timer enforcement still lives in Game.jsx; this
            is purely the visible UI. */}
        <div
          className="absolute right-4 top-2 flex items-center gap-1.5"
          style={{ top: 'calc(0.5rem + env(safe-area-inset-top))' }}
        >
          {typeof soloLevelTotalSeconds === 'number' ? (
            !winner && (
              <SoloLevelTimer
                totalSeconds={soloLevelTotalSeconds}
                elapsedSeconds={soloLevelElapsedSeconds || 0}
                frozen={soloLevelTimerFrozen}
              />
            )
          ) : (
            isMyTurn && !winner && turnDuration > 0 && (
              <TurnTimer key={timerKey} active={!feedback && !winner} onTimeUp={isMyTurn ? onTimeUp : undefined} duration={turnDuration} size="lg" />
            )
          )}
        </div>
      </div>

      {/* ONLINE SCOREBOARD — Codex094 */}
      {isOnline && players.length > 1 && !winner && (
        <div className="flex-shrink-0 pb-1">
          <OnlineScoreboard
            players={players}
            currentPlayerIndex={currentPlayerIndex}
            myEmail={myEmail}
            winCardCount={winCardCount}
          />
        </div>
      )}

      {/* CURRENT PLAYER LABEL — online uses richer OnlineTurnIndicator (Codex092) */}
      {isOnline ? (
        currentQuestion && !winner ? (
          <div className="flex-shrink-0 flex items-center justify-center pb-1">
            <OnlineTurnIndicator
              isMyTurn={!!isMyTurn}
              currentPlayerName={currentPlayer?.name}
              currentPlayerIndex={currentPlayerIndex}
              hasWinner={!!winner}
            />
          </div>
        ) : null
      ) : (
        players.length > 1 && (
          <div className="flex-shrink-0 flex items-center justify-center gap-2 pb-1">
            <div className={`w-2 h-2 rounded-full animate-pulse ${['bg-blue-400','bg-rose-400','bg-emerald-400','bg-violet-400'][currentPlayerIndex % 4]}`} />
            <span className={`font-inter text-sm font-semibold ${playerTextColors[currentPlayerIndex % playerTextColors.length]}`}>
              {currentPlayer?.name}
            </span>
          </div>
        )
      )}

      {/* CENTER: Instruction + Question card */}
      <div
        className="flex-shrink-0 flex flex-col items-center px-3 py-1 gap-1"
        data-kronox-solo-question-joker-row={showSoloQuestionJokerRail ? 'true' : undefined}
        data-kronox-solo-question-hint-row={showSoloQuestionHintRail ? 'true' : undefined}
      >
        {/* Instruction text — online uses OnlineTurnIndicator above instead */}
        {!isOnline && isMyTurn && !winner && currentQuestion && !feedback ? (
          <div className="text-center">
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 18, letterSpacing: '0.03em', color: '#F4F7FB' }}>
              KARTI ZAMAN ÇİZGİSİNE
            </p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontStyle: 'italic', fontSize: 21, color: '#FFC928' }}>
              YERLEŞTİR!
            </p>
          </div>
        ) : null}

        {currentQuestion && !winner ? (
          <div
            className={showSoloQuestionSideRails ? 'grid w-full items-center' : 'flex w-full items-center justify-center'}
            data-kronox-solo-question-card-and-jokers={showSoloQuestionJokerRail ? 'true' : undefined}
            data-kronox-solo-question-card-and-hint={showSoloQuestionHintRail ? 'true' : undefined}
            style={showSoloQuestionSideRails ? {
              gridTemplateColumns: 'minmax(var(--solo-joker-rail-width,64px), 1fr) auto minmax(var(--solo-joker-rail-width,64px), 1fr)',
              columnGap: 'clamp(8px,2.4vw,14px)',
            } : undefined}
          >
            {showSoloQuestionHintRail && (
              <div
                data-kronox-solo-hint-gutter-center="true"
                style={{ gridColumn: 1, justifySelf: 'center' }}
              >
                <SoloHintButton
                  enabled={Boolean(soloHint?.enabled) && !winner && !isOnline && Boolean(currentQuestion)}
                  balance={soloHint?.balance}
                  loading={soloHint?.loading}
                  pending={soloHint?.pending}
                  disabled={Boolean(soloHint?.disabled) || !isMyTurn || Boolean(feedback) || interactionPaused || isDragging}
                  revealStage={soloHint?.revealStage}
                  onOpen={soloHint?.onOpen}
                />
              </div>
            )}
            <motion.div
              className="relative rounded-2xl"
              data-kx-active-turn={isOnline && isMyTurn && !feedback ? 'true' : 'false'}
              animate={isOnline && isMyTurn && !feedback ? {
                boxShadow: [
                  '0 0 0 1px rgba(16,185,129,0.45), 0 0 22px rgba(16,185,129,0.30), 0 0 38px rgba(5,150,105,0.18)',
                  '0 0 0 1px rgba(250,204,21,0.50), 0 0 26px rgba(16,185,129,0.42), 0 0 44px rgba(5,150,105,0.26)',
                  '0 0 0 1px rgba(16,185,129,0.45), 0 0 22px rgba(16,185,129,0.30), 0 0 38px rgba(5,150,105,0.18)',
                ],
              } : { boxShadow: '0 0 0 rgba(0,0,0,0)' }}
              transition={isOnline && isMyTurn && !feedback ? {
                duration: 2.2, repeat: Infinity, ease: 'easeInOut',
              } : { duration: 0.25 }}
              style={{
                willChange: 'box-shadow',
                ...(showSoloQuestionSideRails ? { gridColumn: 2, justifySelf: 'center' } : null),
              }}
            >
              {/* Active-turn green aura — behind card, never above it. Codex095 */}
              {isOnline && isMyTurn && !feedback && (
                <motion.div
                  aria-hidden="true"
                  className="absolute rounded-3xl pointer-events-none"
                  style={{
                    inset: '-14px',
                    zIndex: -1,
                    background:
                      'radial-gradient(120% 80% at 50% 50%, rgba(16,185,129,0.32) 0%, rgba(5,95,70,0.22) 38%, rgba(6,78,59,0.10) 65%, rgba(6,78,59,0) 100%)',
                    border: '1px solid rgba(52,211,153,0.35)',
                    boxShadow: 'inset 0 0 24px rgba(16,185,129,0.18), inset 0 0 0 1px rgba(250,204,21,0.10)',
                    willChange: 'opacity',
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.85, 1, 0.85] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <QuestionCard
                question={currentQuestion}
                onImageError={onImageError}
                onAudioError={onAudioError}
                draggable={isMyTurn && !feedback && !interactionPaused}
                readOnly={!isMyTurn || interactionPaused}
                readOnlyLabel={isSpectatingQuestion ? 'İZLEME MODU' : 'KİLİTLİ'}
                onDragStart={isMyTurn && !interactionPaused ? onDragStart : undefined}
                onDragEnd={isMyTurn && !interactionPaused ? onDragEnd : undefined}
                onTouchDragMove={isMyTurn && !interactionPaused ? onTouchDragMove : undefined}
                onTouchDragEnd={isMyTurn && !interactionPaused ? onTouchDragEnd : undefined}
                onTouchDragCancel={isMyTurn && !interactionPaused ? onTouchDragCancel : undefined}
                soloReadableCard={!isOnline}
                isKronokalkanActive={isSoloKronokalkanActive}
                onlineReadableCard={isOnline}
              />
              <GuidedDragFingerHint
                active={Boolean(guidedDragHintActive && isMyTurn && !isDragging && !feedback && !winner && !interactionPaused)}
                reducedMotion={prefersReducedMotion}
                targetSlotPosition={guidedTargetSlotPosition}
                containerRef={gameplayRootRef}
              />
              {isSpectatingQuestion && (
                <div
                  className="absolute inset-x-2 bottom-2 rounded-xl px-2 py-1.5 text-center font-inter text-[10px] font-semibold text-white/78"
                  style={{
                    background: 'rgba(7,10,31,0.78)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    pointerEvents: 'none',
                  }}
                >
                  Kartı yalnızca {currentPlayer?.name || 'aktif oyuncu'} yerleştirebilir.
                </div>
              )}
            </motion.div>
            {showSoloQuestionJokerRail && (
              <div
                data-kronox-solo-joker-gutter-center="true"
                style={{ gridColumn: 3, justifySelf: 'center' }}
              >
                <SoloJokerBar
                  enabled={Boolean(soloJokers?.enabled) && !winner && !isOnline && Boolean(currentQuestion)}
                  usedJokerType={soloJokers?.usedJokerType}
                  balances={soloJokers?.balances}
                  loading={soloJokers?.loading}
                  pendingType={soloJokers?.pendingType}
                  mistakeShieldActive={soloJokers?.mistakeShieldActive}
                  timerFrozen={soloJokers?.timerFrozen}
                  message={soloJokers?.message}
                  error={soloJokers?.error}
                  disabled={Boolean(soloJokers?.disabled) || !isMyTurn || Boolean(feedback) || interactionPaused || isDragging}
                  dragLocked={Boolean(soloJokers?.dragLocked || isDragging)}
                  tutorialDemoType={soloJokers?.tutorialDemoType}
                  tutorialDemoHintActive={soloJokers?.tutorialDemoHintActive}
                  tutorialFocusActive={soloJokers?.tutorialFocusActive}
                  layout="questionRail"
                  onUseJoker={soloJokers?.onUseJoker}
                />
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* TIMELINE */}
      <div className="flex-shrink-0 px-2 py-1">
        <div
          className="relative rounded-2xl overflow-hidden py-2 transition-all duration-300"
          style={{
            paddingTop: 'var(--solo-timeline-panel-padding-y, 0.5rem)',
            paddingBottom: 'var(--solo-timeline-panel-padding-y, 0.5rem)',
            background: isTimeUp
              ? 'linear-gradient(180deg, rgba(88,32,45,0.78), rgba(52,25,40,0.82))'
              : 'linear-gradient(180deg, #193D70 0%, #173763 100%)',
            border: isTimeUp
              ? '1.5px solid rgba(255,93,103,0.62)'
              : '1px solid rgba(85,216,255,0.20)',
            boxShadow: isTimeUp
              ? '0 0 16px rgba(255,93,103,0.18)'
              : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 26px rgba(0,0,0,0.20)',
          }}
        >
          {currentPlayer && (
            <Timeline
              cards={currentPlayer.cards}
              selectedZone={isMyTurn ? selectedZone : null}
              onSelectZone={isMyTurn && !interactionPaused ? onSelectZone : undefined}
              isDragMode={isDragging && isMyTurn && !interactionPaused}
              onPlaceCard={isMyTurn && !interactionPaused ? onDropOnZone : undefined}
              dragClientX={isMyTurn && !interactionPaused ? touchDragPos?.x : null}
              dragClientY={isMyTurn && !interactionPaused ? touchDragPos?.y : null}
              dragEndEvent={isMyTurn && !interactionPaused && touchDragEnd ? { clientX: touchDragEnd.x, clientY: touchDragEnd.y } : null}
              isTimeUp={isTimeUp}
              // Codex163 — Visual-only placement feedback. Timeline
              // forwards this to PlacementFeedbackOverlay; it does not
              // change which cards are rendered or their order.
              placementFeedback={
                feedback && (feedback.result === 'correct' || feedback.result === 'wrong')
                  ? { result: feedback.result, year: feedback.year, key: feedback.guessedYear ?? '' }
                  : null
              }
              beginnerPlacementHintZone={beginnerPlacementHintZone}
              guidedTargetZone={guidedDragHintActive ? guidedDragTargetZone : null}
              onGuidedTargetSlotPosition={guidedDragHintActive ? setGuidedTargetSlotPosition : undefined}
              guidedScrollHintActive={timelineSwipeHintVisible}
              onGuidedScrollHintInteraction={guidedTimelineScrollHintActive ? onTimelineSwipeHintInteraction : undefined}
              correctStreak={correctStreak}
              soloYearOnlyCards
            />
          )}
          <GuidedTimelineSwipeHint
            active={timelineSwipeHintVisible}
            reducedMotion={prefersReducedMotion}
          />
        </div>

        {/* SÜRE DOLDU uyarısı */}
        {isTimeUp && (
          <div className="flex items-center gap-2 mt-2 px-1">
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
              <span style={{ fontSize: 11 }}>⏱</span>
            </div>
            <div>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.05em", fontSize: 13, color: "#FF5D67" }}>SÜRE DOLDU!</p>
              <p className="font-inter text-red-400/70" style={{ fontSize: 10 }}>Bir seçim yapmadan süre bitti.</p>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM BUTTONS */}
      {isSpectatingQuestion ? (
        <div
          className="flex-shrink-0 px-3 pt-2"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div
            className="h-12 rounded-2xl flex items-center justify-center text-center font-inter text-xs font-semibold text-white/70"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(250,204,21,0.22)',
              boxShadow: '0 0 18px rgba(250,204,21,0.08)',
            }}
          >
            Sıra {currentPlayer?.name || 'oyuncu'} oyuncusunda. Yerleştirme kilitli.
          </div>
        </div>
      ) : (
        <div
          className="flex-shrink-0 flex justify-center px-3 pt-2"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          {/* Main action */}
          <CTAButton
            active={isMyTurn && selectedZone !== null && !feedback && !winner && !interactionPaused}
            onClick={isMyTurn && selectedZone !== null && !interactionPaused ? onConfirmPlacement : undefined}
            disabled={!isMyTurn || selectedZone === null || !!feedback || !!winner || interactionPaused}
          />
        </div>
      )}

      {/* Ghost drag card — compact, semi-transparent timeline-sized preview so
          the timeline years/slots stay readable behind it. The full question
          text is intentionally hidden during drag; it's already visible in the
          card above. Hit-testing uses the raw finger position (touchDragPos),
          not this preview's rectangle, so shrinking it never affects placement. */}
      <AnimatePresence>
        {isDragging && touchDragPos && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.58 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="fixed z-50 pointer-events-none"
            style={{ left: touchDragPos.x - 36, top: touchDragPos.y - 44, width: 72 }}
          >
            <div
              className="flex h-[88px] flex-col items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(160deg, rgba(15,20,40,0.72) 0%, rgba(10,15,35,0.72) 100%)',
                border: '1.5px solid rgba(255,201,40,0.85)',
                boxShadow: '0 0 12px rgba(255,201,40,0.28)',
              }}
            >
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, letterSpacing: "0.05em", color: "#FFC928" }}>↓ BIRAK</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
