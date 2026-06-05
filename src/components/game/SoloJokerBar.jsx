import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Shield, Snowflake } from 'lucide-react';

const JOKERS = [
  {
    type: 'mistakeShield',
    label: 'Kronokalkan',
    icon: Shield,
    accent: '#60a5fa',
    glow: 'rgba(96,165,250,0.38)',
  },
  {
    type: 'swapCard',
    label: 'Kart Değiştir',
    icon: RefreshCw,
    accent: '#8bd85d',
    glow: 'rgba(139,216,93,0.36)',
  },
  {
    type: 'freezeTime',
    label: 'Zaman Dondur',
    icon: Snowflake,
    accent: '#facc15',
    glow: 'rgba(250,204,21,0.36)',
  },
];

export default function SoloJokerBar({
  enabled = false,
  usedJokerType = null,
  mistakeShieldActive = false,
  timerFrozen = false,
  message = '',
  error = '',
  disabled = false,
  onUseJoker,
}) {
  if (!enabled) return null;

  const jokerConsumed = Boolean(usedJokerType);
  const remainingUses = jokerConsumed ? 0 : 1;

  return (
    <div className="flex-shrink-0 px-3 pt-1">
      <div
        className="relative overflow-hidden rounded-[26px] px-3 py-2.5"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(37,99,235,0.20), transparent 52%), linear-gradient(180deg, rgba(8,17,39,0.96), rgba(6,12,31,0.92))',
          border: '1px solid rgba(250,204,21,0.46)',
          boxShadow: timerFrozen
            ? '0 0 20px rgba(56,189,248,0.24), inset 0 0 20px rgba(250,204,21,0.08)'
            : '0 0 16px rgba(250,204,21,0.13), inset 0 0 20px rgba(255,255,255,0.045)',
        }}
      >
        <div className="mb-1.5 flex items-center justify-center gap-2">
          <span className="h-px min-w-8 flex-1 bg-gradient-to-r from-transparent to-yellow-400/42" />
          <p className="font-inter text-[11px] font-semibold tracking-wide text-yellow-300">
            Jokerler • 1 hak
          </p>
          <span className="h-px min-w-8 flex-1 bg-gradient-to-l from-transparent to-yellow-400/42" />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {JOKERS.map(({ type, label, icon: Icon, accent, glow }) => {
            const isUsed = usedJokerType === type;
            const isDisabled = disabled || (jokerConsumed && !isUsed);
            const active = !disabled && !jokerConsumed;
            const dimmed = isDisabled && !isUsed;
            const circleSize = 'clamp(52px, 15.2vw, 62px)';
            return (
              <motion.button
                key={type}
                type="button"
                disabled={isDisabled || isUsed}
                aria-pressed={isUsed}
                aria-label={`${label}, kalan hak ${remainingUses}`}
                onClick={() => {
                  if (!active || !onUseJoker) return;
                  onUseJoker(type);
                }}
                whileTap={active ? { scale: 0.96 } : undefined}
                animate={isUsed ? {
                  boxShadow: [
                    '0 0 0 1px rgba(250,204,21,0.70), 0 0 12px rgba(250,204,21,0.22)',
                    '0 0 0 1px rgba(56,189,248,0.58), 0 0 16px rgba(56,189,248,0.20)',
                    '0 0 0 1px rgba(250,204,21,0.70), 0 0 12px rgba(250,204,21,0.22)',
                  ],
                } : { boxShadow: '0 0 0 rgba(0,0,0,0)' }}
                transition={isUsed ? { duration: 1.35, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.16 }}
                className="group flex min-h-[84px] flex-col items-center justify-start gap-1.5 rounded-2xl px-1 py-1.5 font-inter transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
                style={{
                  background: isUsed
                    ? 'linear-gradient(180deg, rgba(250,204,21,0.12), rgba(56,189,248,0.08))'
                    : dimmed
                      ? 'rgba(148,163,184,0.045)'
                      : 'linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))',
                  border: isUsed
                    ? '1px solid rgba(250,204,21,0.54)'
                    : dimmed
                      ? '1px solid rgba(148,163,184,0.12)'
                      : '1px solid rgba(250,204,21,0.16)',
                  color: dimmed ? 'rgba(203,213,225,0.44)' : '#f8fafc',
                  cursor: active ? 'pointer' : 'default',
                  opacity: dimmed ? 0.74 : 1,
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
                      ? 'inset 0 0 14px rgba(255,255,255,0.035), 0 4px 12px rgba(0,0,0,0.28)'
                      : `0 0 16px ${glow}, inset 0 0 16px rgba(255,255,255,0.06), inset 0 -6px 14px rgba(0,0,0,0.30)`,
                  }}
                >
                  <Icon
                    className="h-[30px] w-[30px] sm:h-8 sm:w-8"
                    style={{ color: dimmed ? 'rgba(203,213,225,0.48)' : accent }}
                    strokeWidth={2.45}
                  />
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-inter text-[11px] font-black leading-none"
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
                    {remainingUses}
                  </span>
                </span>
                <span
                  className="max-w-full text-center text-[10.5px] font-black leading-tight"
                  style={{
                    color: dimmed ? 'rgba(203,213,225,0.52)' : (isUsed ? '#fde68a' : accent),
                    textShadow: dimmed ? 'none' : `0 0 8px ${glow}`,
                  }}
                >
                  {label}
                </span>
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {(message || error || jokerConsumed || mistakeShieldActive || timerFrozen) && (
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
                  : 'Bu level’da joker hakkımı kullandım.')}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
