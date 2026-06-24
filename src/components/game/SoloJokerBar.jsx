import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Shield, Snowflake } from 'lucide-react';
import { JOKER_TYPES, normalizeJokerQuantity } from '@/lib/jokerInventory';

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

function TutorialPointerHand({ className = '', style = null }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 72 72" className={className} style={style}>
      <path
        d="M30.6 9.7c-3.2 0-5.8 2.6-5.8 5.8v22.1l-4.7-4.7c-2.4-2.4-6.2-2.4-8.5 0-2.3 2.4-2.3 6.2 0.1 8.6l13.6 13.8c3.3 3.4 7.8 5.2 12.5 5.2h8.5c8.1 0 14.7-6.6 14.7-14.7V31.2c0-3.1-2.5-5.6-5.6-5.6-1.5 0-2.9 0.6-3.9 1.6-0.8-2.1-2.8-3.6-5.2-3.6-1.6 0-3 0.7-4 1.7-0.8-2.1-2.8-3.7-5.2-3.7-1.3 0-2.5 0.4-3.4 1.2v-7.3c0-3.2-2.6-5.8-5.8-5.8z"
        fill="#facc15"
        stroke="#3a2600"
        strokeWidth="4.2"
        strokeLinejoin="round"
      />
      <path
        d="M30.6 9.7c-3.2 0-5.8 2.6-5.8 5.8v22.1l-4.7-4.7c-2.4-2.4-6.2-2.4-8.5 0-2.3 2.4-2.3 6.2 0.1 8.6"
        fill="none"
        stroke="#fff4bd"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path d="M33.9 23.2v16.2" stroke="#a66c00" strokeWidth="2.8" strokeLinecap="round" opacity="0.72" />
      <path d="M42.6 25.8v14.4" stroke="#a66c00" strokeWidth="2.8" strokeLinecap="round" opacity="0.62" />
      <path d="M51.6 28.1v13.6" stroke="#a66c00" strokeWidth="2.8" strokeLinecap="round" opacity="0.56" />
      <path d="M25 14.6c1.8-2.4 6.2-2.4 8.1 0" stroke="#fff4bd" strokeWidth="2.4" strokeLinecap="round" opacity="0.72" />
    </svg>
  );
}

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
      style={{
        filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.42))',
        willChange: 'transform, opacity',
      }}
    >
      <span
        className="grid h-14 w-14 place-items-center rounded-full border"
        style={{
          background: 'linear-gradient(180deg, #fff4b8 0%, #facc15 52%, #d99e00 100%)',
          borderColor: 'rgba(255,255,255,0.56)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.62), inset 0 -3px 0 rgba(120,75,0,0.28), 0 0 16px rgba(250,204,21,0.46)',
        }}
      >
        <TutorialPointerHand
          className="h-11 w-11"
          style={{
            transform: 'translate(1px, -2px) rotate(-18deg)',
            filter: 'drop-shadow(0 2px 0 rgba(255,255,255,0.42))',
          }}
        />
      </span>
    </motion.div>
  );
}

export default function SoloJokerBar({
  enabled = false,
  usedJokerType = null,
  balances = null,
  loading = false,
  pendingType = null,
  mistakeShieldActive = false,
  timerFrozen = false,
  message = '',
  error = '',
  disabled = false,
  tutorialDemoType = null,
  tutorialDemoHintActive = false,
  tutorialFocusActive = false,
  onUseJoker,
}) {
  const [recentlyUsedType, setRecentlyUsedType] = useState(null);

  useEffect(() => {
    if (!usedJokerType) {
      setRecentlyUsedType(null);
      return undefined;
    }

    setRecentlyUsedType(usedJokerType);
    const timeout = window.setTimeout(() => setRecentlyUsedType(null), 900);
    return () => window.clearTimeout(timeout);
  }, [usedJokerType]);

  if (!enabled) return null;

  const jokerUsedOnCurrentCard = Boolean(usedJokerType);

  return (
    <div className="relative flex-shrink-0 px-4 pt-0.5">
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
      <div className={`relative mx-auto grid grid-cols-3 w-full max-w-[280px] gap-0 ${tutorialFocusActive ? 'z-[50]' : ''}`}>
        {JOKERS.map(({ type, inventoryType, label, icon: Icon, accent, glow }) => {
          const isRecentlyUsed = recentlyUsedType === type;
          const balance = normalizeJokerQuantity(balances?.[inventoryType]);
          const isPending = pendingType === type;
          const isLocked = disabled || loading || jokerUsedOnCurrentCard || isPending || balance <= 0;
          const active = !isLocked;
          const dimmed = isLocked && !isRecentlyUsed;
          const isTutorialDemoTarget = tutorialDemoType === type;
          const circleSize = 'clamp(38px, 10.8vw, 44px)';
          return (
            <div key={type} className="relative flex justify-center">
              <motion.button
              key={type}
              type="button"
              disabled={isLocked}
              aria-pressed={isRecentlyUsed}
              aria-busy={isPending}
              aria-label={`${label}, kalan ${balance}`}
              data-kronox-guided-joker-demo-target={isTutorialDemoTarget ? 'true' : undefined}
              onClick={() => {
                if (!active || !onUseJoker) return;
                onUseJoker(type);
              }}
              whileTap={active ? { scale: 0.96 } : undefined}
              className="group flex min-h-[62px] w-full flex-col items-center justify-start gap-1 bg-transparent px-0 py-0.5 font-inter transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
              style={{
                color: dimmed ? 'rgba(203,213,225,0.44)' : '#f8fafc',
                cursor: active ? 'pointer' : 'default',
                opacity: dimmed ? 0.62 : 1,
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
                className="max-w-full text-center text-[10px] font-black leading-tight"
                style={{
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
        {(message || error || loading || jokerUsedOnCurrentCard || mistakeShieldActive || timerFrozen) && (
          <motion.div
            key={error || message || usedJokerType || String(mistakeShieldActive) || String(timerFrozen)}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="mt-1.5 text-center font-inter text-[10px] font-semibold"
            style={{ color: error ? '#fca5a5' : '#fde68a' }}
          >
            {error || message || (mistakeShieldActive
              ? 'Kronokalkan aktif.'
              : timerFrozen
                ? 'Süre donduruldu.'
                : loading
                  ? 'Joker Çantası hazırlanıyor.'
                  : 'Bu kartta joker kullandın.')}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
