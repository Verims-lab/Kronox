import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Shield, Snowflake } from 'lucide-react';
import { JOKER_TYPES, normalizeJokerQuantity } from '@/lib/jokerInventory';
import TutorialHandPointer from './TutorialHandPointer.jsx';

const JOKERS = [
  {
    type: 'mistakeShield',
    inventoryType: JOKER_TYPES.MISTAKE_SHIELD,
    label: 'Kronokalkan',
    icon: Shield,
    accent: '#60a5fa',
    glow: 'rgba(96,165,250,0.38)',
  },
  {
    type: 'swapCard',
    inventoryType: JOKER_TYPES.CARD_SWAP,
    label: 'Kart Değiştir',
    icon: RefreshCw,
    accent: '#8bd85d',
    glow: 'rgba(139,216,93,0.36)',
  },
  {
    type: 'freezeTime',
    inventoryType: JOKER_TYPES.TIME_FREEZE,
    label: 'Zaman Dondur',
    icon: Snowflake,
    accent: '#facc15',
    glow: 'rgba(250,204,21,0.36)',
  },
];

function TutorialJokerTapHint({ active }) {
  if (!active) return null;

  return (
    <motion.div
      aria-hidden="true"
      data-kronox-guided-joker-finger-hint="true"
      className="pointer-events-none absolute left-1/2 top-0 z-30 flex -translate-x-1/2 items-center justify-center"
      initial={{ x: 22, y: 28, opacity: 0, scale: 0.92 }}
      animate={{
        x: [22, 0, 0, 0],
        y: [28, 2, 2, 10],
        opacity: [0, 1, 1, 0],
        scale: [0.92, 1, 0.86, 0.94],
      }}
      transition={{
        delay: 0.45,
        duration: 1.75,
        repeat: Infinity,
        repeatDelay: 1.25,
        ease: 'easeInOut',
      }}
      style={{ willChange: 'transform, opacity' }}
    >
      <TutorialHandPointer mode="tap" size={44} />
    </motion.div>
  );
}

export default function SoloJokerBar({
  enabled = false,
  usedJokerType = null,
  balances = null,
  loading = false,
  pendingType = null,
  error = '',
  disabled = false,
  tutorialDemoType = null,
  tutorialDemoHintActive = false,
  tutorialFocusActive = false,
  layout = 'bottom',
  dragLocked = false,
  onUseJoker,
}) {
  const [recentlyUsedType, setRecentlyUsedType] = useState(null);
  const [pressedType, setPressedType] = useState(null);
  const pressedTimerRef = useRef(null);

  useEffect(() => {
    if (!usedJokerType) {
      setRecentlyUsedType(null);
      return undefined;
    }

    setRecentlyUsedType(usedJokerType);
    const timeout = window.setTimeout(() => setRecentlyUsedType(null), 900);
    return () => window.clearTimeout(timeout);
  }, [usedJokerType]);

  useEffect(() => () => {
    if (pressedTimerRef.current) window.clearTimeout(pressedTimerRef.current);
  }, []);

  if (!enabled) return null;

  const jokerUsedOnCurrentCard = Boolean(usedJokerType);
  const isQuestionRail = layout === 'questionRail';
  const rootClassName = isQuestionRail
    ? 'relative flex w-[var(--solo-joker-rail-width,64px)] shrink-0 items-center justify-center px-0 py-0'
    : 'relative flex-shrink-0 px-4 pt-0.5';
  const listClassName = isQuestionRail
    ? `relative mx-auto flex w-full flex-col items-center justify-center gap-[clamp(7px,1.15vh,11px)] ${tutorialFocusActive ? 'z-[50]' : ''}`
    : `relative mx-auto grid grid-cols-3 w-full max-w-[280px] gap-0 ${tutorialFocusActive ? 'z-[50]' : ''}`;
  const buttonClassName = isQuestionRail
    ? 'group flex min-h-[clamp(56px,8vh,70px)] w-full flex-col items-center justify-start gap-0.5 bg-transparent px-0 py-0 font-inter transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70'
    : 'group flex min-h-[62px] w-full flex-col items-center justify-start gap-1 bg-transparent px-0 py-0.5 font-inter transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70';
  const circleSize = isQuestionRail ? 'clamp(40px, 11vw, 48px)' : 'clamp(38px, 10.8vw, 44px)';
  const labelStyleBase = isQuestionRail
    ? { fontSize: 'clamp(8px, 2.15vw, 10px)', maxWidth: 'calc(var(--solo-joker-rail-width,64px) + 18px)' }
    : { fontSize: '10px', maxWidth: '100%' };

  return (
    <div
      className={rootClassName}
      data-kronox-solo-joker-right-rail={isQuestionRail ? 'true' : undefined}
      data-kronox-solo-joker-drag-locked={dragLocked ? 'true' : undefined}
    >
      <AnimatePresence>
        {tutorialFocusActive && (
          <motion.div
            aria-hidden="true"
            data-kronox-guided-joker-focus-backdrop="true"
            className="pointer-events-none fixed inset-0 z-[39] bg-slate-950/72"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
        )}
      </AnimatePresence>
      <div className={listClassName}>
        {JOKERS.map(({ type, inventoryType, label, icon: Icon, accent, glow }) => {
          const isRecentlyUsed = recentlyUsedType === type;
          const balance = normalizeJokerQuantity(balances?.[inventoryType]);
          const isPending = pendingType === type;
          const isLocked = disabled || dragLocked || loading || jokerUsedOnCurrentCard || isPending || balance <= 0;
          const active = !isLocked;
          const dimmed = isLocked && !isRecentlyUsed;
          const isTutorialDemoTarget = tutorialDemoType === type;
          const shouldPlayTap = pressedType === type;
          return (
            <div key={type} className="relative flex justify-center">
              <motion.button
              key={type}
              type="button"
              disabled={isLocked}
              aria-disabled={isLocked}
              aria-pressed={isRecentlyUsed}
              aria-busy={isPending}
              aria-label={`${label}, kalan ${balance}`}
              data-kronox-guided-joker-demo-target={isTutorialDemoTarget ? 'true' : undefined}
              onClick={() => {
                if (!active || !onUseJoker) return;
                if (pressedTimerRef.current) window.clearTimeout(pressedTimerRef.current);
                setPressedType(type);
                pressedTimerRef.current = window.setTimeout(() => {
                  setPressedType(null);
                  pressedTimerRef.current = null;
                }, 260);
                onUseJoker(type);
              }}
              animate={shouldPlayTap ? { scale: [1, 0.90, 1.08, 1] } : { scale: 1 }}
              transition={shouldPlayTap ? { duration: 0.26, times: [0, 0.31, 0.66, 1], ease: 'easeOut' } : { duration: 0.12 }}
              className={buttonClassName}
              style={{
                color: dimmed ? 'rgba(203,213,225,0.44)' : '#f8fafc',
                cursor: active ? 'pointer' : 'default',
                opacity: dimmed ? 0.62 : 1,
                pointerEvents: dragLocked ? 'none' : 'auto',
              }}
            >
              <span
                className="relative flex shrink-0 items-center justify-center rounded-full"
                style={{
                  width: circleSize,
                  height: circleSize,
                  background: dimmed
                    ? 'linear-gradient(180deg, rgba(30,41,59,0.88), rgba(15,23,42,0.92))'
                    : `radial-gradient(circle at 34% 24%, rgba(255,255,255,0.18), transparent 36%), linear-gradient(180deg, rgba(18,42,80,0.96), rgba(7,15,36,0.98))`,
                  border: `1.5px solid ${dimmed ? 'rgba(148,163,184,0.28)' : accent}`,
                  boxShadow: dimmed
                    ? 'inset 0 0 10px rgba(255,255,255,0.032), 0 3px 9px rgba(0,0,0,0.26)'
                    : isRecentlyUsed
                      ? `0 0 16px rgba(250,204,21,0.34), 0 0 13px ${glow}, inset 0 0 12px rgba(255,255,255,0.06), inset 0 -5px 10px rgba(0,0,0,0.30)`
                      : `0 0 12px ${glow}, inset 0 0 12px rgba(255,255,255,0.06), inset 0 -5px 10px rgba(0,0,0,0.30)`,
                }}
              >
                <AnimatePresence>
                  {isRecentlyUsed && (
                    <motion.span
                      key={`${type}-${usedJokerType || 'used'}`}
                      aria-hidden="true"
                      className="pointer-events-none absolute"
                      initial={{ scale: 0.75, opacity: 0.75 }}
                      animate={{ scale: [0.75, 1.35], opacity: [0.75, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.42, ease: 'easeOut' }}
                      style={{
                        inset: '-5px',
                        borderRadius: '50%',
                        border: `2px solid ${accent}`,
                      }}
                    />
                  )}
                </AnimatePresence>
                <Icon
                  className="h-5 w-5"
                  style={{ color: dimmed ? 'rgba(203,213,225,0.48)' : accent }}
                  strokeWidth={2.45}
                />
                <span
                  className="kronox-number absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] leading-none"
                  style={{
                    color: dimmed ? 'rgba(226,232,240,0.66)' : '#fff7d1',
                    background: dimmed
                      ? 'linear-gradient(180deg, rgba(71,85,105,0.96), rgba(30,41,59,0.98))'
                      : 'linear-gradient(180deg, #171923, #050816)',
                    border: `1px solid ${dimmed ? 'rgba(148,163,184,0.44)' : 'rgba(250,204,21,0.82)'}`,
                    boxShadow: dimmed
                      ? '0 2px 8px rgba(0,0,0,0.34)'
                      : '0 0 10px rgba(250,204,21,0.32), 0 2px 8px rgba(0,0,0,0.45)',
                  }}
                >
                  {balance}
                </span>
              </span>
              <span
                className="max-w-full text-center font-black leading-tight"
                style={{
                  ...labelStyleBase,
                  color: dimmed ? 'rgba(203,213,225,0.52)' : (isRecentlyUsed ? '#fde68a' : accent),
                  textShadow: dimmed ? 'none' : `0 0 8px ${glow}`,
                }}
              >
                {label}
              </span>
              </motion.button>
              <TutorialJokerTapHint active={Boolean(tutorialDemoHintActive && isTutorialDemoTarget && active)} />
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {Boolean(error) && (
          <motion.div
            key={error}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="mt-1.5 text-center font-inter text-[10px] font-semibold"
            style={{
              color: '#fca5a5',
              ...(isQuestionRail ? {
                position: 'absolute',
                right: 0,
                top: '100%',
                width: 128,
                marginTop: 2,
                textAlign: 'right',
              } : null),
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
