import React, { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Hammer } from 'lucide-react';
import { normalizeHintQuantity, normalizeHintRevealStage } from '@/lib/hintInventory';

export default function SoloHintButton({
  enabled = false,
  balance = 0,
  loading = false,
  pending = false,
  disabled = false,
  revealStage = 0,
  trainingMode = false,
  onOpen,
}) {
  const quantity = normalizeHintQuantity(balance);
  const stage = normalizeHintRevealStage(revealStage);
  const canReopenExistingReveal = stage > 0;
  const isLocked = Boolean(disabled || loading || pending || (!trainingMode && quantity <= 0 && !canReopenExistingReveal));
  const active = !isLocked;
  const dimmed = isLocked;
  const quantityLabel = trainingMode ? '∞' : quantity;
  const accent = '#facc15';
  const glow = 'rgba(250,204,21,0.36)';
  const lastOpenAtRef = useRef(0);
  const triggerOpen = useCallback(() => {
    if (!active || !onOpen) return;
    const now = Date.now();
    if (now - lastOpenAtRef.current < 320) return;
    lastOpenAtRef.current = now;
    onOpen();
  }, [active, onOpen]);

  if (!enabled) return null;

  return (
    <div
      className="pointer-events-auto relative z-30 flex w-[var(--solo-joker-rail-width,64px)] shrink-0 items-center justify-center px-0 py-0"
      data-kronox-solo-hint-left-rail="true"
      data-kronox-solo-hint-touch-target="true"
      data-kronox-solo-hint-stage={stage}
      data-kronox-solo-hint-training-mode={trainingMode ? 'true' : undefined}
    >
      <motion.button
        type="button"
        disabled={isLocked}
        aria-disabled={isLocked}
        aria-busy={pending}
        aria-label={trainingMode ? 'İpucu, eğitimde hak harcamaz' : `İpucu, kalan ${quantity}`}
        data-kronox-solo-hint-button="true"
        onPointerUp={(event) => {
          if (event.pointerType === 'mouse') return;
          event.preventDefault();
          event.stopPropagation();
          triggerOpen();
        }}
        onClick={triggerOpen}
        whileTap={active ? { scale: 0.94 } : { scale: 1 }}
        animate={pending ? { scale: [1, 0.94, 1.04, 1] } : { scale: 1 }}
        transition={pending ? { duration: 0.34, ease: 'easeOut' } : { duration: 0.12 }}
        className="group relative z-10 flex min-h-[clamp(56px,8vh,70px)] min-w-[56px] w-full flex-col items-center justify-start gap-0.5 bg-transparent px-0 py-0 font-inter transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/70"
        style={{
          color: dimmed ? 'rgba(203,213,225,0.44)' : '#f8fafc',
          cursor: active ? 'pointer' : 'default',
          opacity: dimmed ? 0.62 : 1,
          pointerEvents: 'auto',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span
          className="relative flex shrink-0 items-center justify-center rounded-full"
          style={{
            width: 'clamp(40px, 11vw, 48px)',
            height: 'clamp(40px, 11vw, 48px)',
            background: dimmed
              ? 'linear-gradient(180deg, rgba(30,41,59,0.88), rgba(15,23,42,0.92))'
              : 'radial-gradient(circle at 34% 24%, rgba(255,255,255,0.20), transparent 38%), linear-gradient(180deg, rgba(58,38,12,0.96), rgba(7,15,36,0.98))',
            border: `1.5px solid ${dimmed ? 'rgba(148,163,184,0.28)' : accent}`,
            boxShadow: dimmed
              ? 'inset 0 0 10px rgba(255,255,255,0.032), 0 3px 9px rgba(0,0,0,0.26)'
              : `0 0 12px ${glow}, inset 0 0 12px rgba(255,255,255,0.06), inset 0 -5px 10px rgba(0,0,0,0.30)`,
          }}
        >
          <Hammer
            className="h-5 w-5"
            style={{ color: dimmed ? 'rgba(203,213,225,0.48)' : accent }}
            strokeWidth={2.55}
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
            {quantityLabel}
          </span>
        </span>
        <span
          className="max-w-full text-center font-black leading-tight"
          style={{
            color: dimmed ? 'rgba(203,213,225,0.52)' : accent,
            fontSize: 'clamp(8px, 2.15vw, 10px)',
            maxWidth: 'calc(var(--solo-joker-rail-width,64px) + 18px)',
            textShadow: dimmed ? 'none' : `0 0 8px ${glow}`,
          }}
        >
          İpucu
        </span>
      </motion.button>
    </div>
  );
}
