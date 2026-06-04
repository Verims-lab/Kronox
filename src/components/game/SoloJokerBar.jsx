import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Shield, Timer } from 'lucide-react';

const JOKERS = [
  { type: 'mistakeShield', label: 'Hata Affı', icon: Shield },
  { type: 'swapCard', label: 'Kart Değiştir', icon: RefreshCw },
  { type: 'freezeTime', label: 'Zaman Dondur', icon: Timer },
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

  return (
    <div className="flex-shrink-0 px-3 pt-1">
      <div
        className="relative overflow-hidden rounded-2xl px-3 py-2"
        style={{
          background: 'linear-gradient(180deg, rgba(8,17,39,0.94), rgba(6,12,31,0.9))',
          border: '1px solid rgba(250,204,21,0.46)',
          boxShadow: timerFrozen
            ? '0 0 18px rgba(56,189,248,0.22), inset 0 0 18px rgba(250,204,21,0.08)'
            : '0 0 14px rgba(250,204,21,0.12), inset 0 0 18px rgba(255,255,255,0.04)',
        }}
      >
        <div className="mb-1 flex items-center justify-center gap-2">
          <span className="h-px min-w-8 flex-1 bg-gradient-to-r from-transparent to-yellow-400/42" />
          <p className="font-inter text-[11px] font-semibold tracking-wide text-yellow-300">
            Jokerler • 1 hak
          </p>
          <span className="h-px min-w-8 flex-1 bg-gradient-to-l from-transparent to-yellow-400/42" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {JOKERS.map(({ type, label, icon: Icon }) => {
            const isUsed = usedJokerType === type;
            const isDisabled = disabled || (jokerConsumed && !isUsed);
            const active = !disabled && !jokerConsumed;
            return (
              <motion.button
                key={type}
                type="button"
                disabled={isDisabled || isUsed}
                aria-pressed={isUsed}
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
                className="group flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-2 font-inter text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
                style={{
                  background: isUsed
                    ? 'linear-gradient(180deg, rgba(250,204,21,0.18), rgba(56,189,248,0.10))'
                    : isDisabled
                      ? 'rgba(148,163,184,0.09)'
                      : 'linear-gradient(180deg, rgba(250,204,21,0.10), rgba(255,255,255,0.04))',
                  border: isUsed
                    ? '1px solid rgba(250,204,21,0.78)'
                    : isDisabled
                      ? '1px solid rgba(148,163,184,0.24)'
                      : '1px solid rgba(250,204,21,0.54)',
                  color: isDisabled && !isUsed ? 'rgba(203,213,225,0.48)' : '#f8fafc',
                  cursor: active ? 'pointer' : 'default',
                }}
              >
                <Icon
                  className="h-5 w-5 flex-shrink-0"
                  style={{ color: isDisabled && !isUsed ? 'rgba(203,213,225,0.48)' : '#facc15' }}
                  strokeWidth={2.4}
                />
                <span className="leading-tight">{label}</span>
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
                ? 'Hata Affı aktif.'
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
