import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, RefreshCw, Shield, Snowflake } from 'lucide-react';
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

function TutorialJokerTapHint({ active }) {
  if (!active) return null;

  return (
    <motion.div
      aria-hidden="true"
      data-kronox-guided-joker-finger-hint="true"
      className="pointer-events-none absolute left-1/2 top-0 z-20 flex -translate-x-1/2 flex-col items-center gap-1"
      initial={{ x: 18, y: 34, opacity: 0, scale: 0.92 }}
      animate={{
        x: [18, 0, 0, 0],
        y: [34, 8, 8, 16],
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
        className="grid h-10 w-10 place-items-center rounded-full border text-amber-950"
        style={{
          background: 'linear-gradient(180deg, #fff4b8 0%, #facc15 52%, #d99e00 100%)',
          borderColor: 'rgba(255,255,255,0.56)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.62), inset 0 -3px 0 rgba(120,75,0,0.28), 0 0 16px rgba(250,204,21,0.46)',
        }}
      >
        <Hand className="h-5 w-5" strokeWidth={2.7} />
      </span>
      <span
        className="whitespace-nowrap rounded-full px-2 py-0.5 font-inter text-[9px] font-black text-yellow-100"
        style={{
          background: 'rgba(7,10,31,0.84)',
          border: '1px solid rgba(250,204,21,0.36)',
          boxShadow: '0 0 12px rgba(250,204,21,0.18)',
        }}
      >
        Dokun
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
    <div className="flex-shrink-0 px-4 pt-0.5">
      <div className="mx-auto grid grid-cols-3 w-full max-w-[280px] gap-0">
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
