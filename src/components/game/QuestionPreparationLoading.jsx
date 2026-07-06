import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export const QUESTION_PREPARATION_HOURGLASS_SRC = '/assets/ui/kronox-hourglass-home.png';

export const QUESTION_PREPARATION_LOADING_CONTRACT = Object.freeze({
  visualOnly: true,
  noArtificialDelay: true,
  noMinimumDisplayDuration: true,
  doesNotBlockGameplayStart: true,
  reducedMotionSafe: true,
});

export default function QuestionPreparationLoading({ ariaLabel = 'Oyun hazırlanıyor' }) {
  const prefersReducedMotion = useReducedMotion();
  const hourglassAnimation = prefersReducedMotion
    ? { opacity: 1 }
    : {
      rotate: [-7, 7, -7],
      y: [0, -5, 0],
      scale: [0.99, 1.02, 0.99],
    };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className="flex min-h-[100dvh] w-full items-center justify-center overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        background:
          'radial-gradient(circle at 50% 50%, rgba(35,122,255,0.28) 0%, rgba(8,30,70,0.18) 23%, rgba(4,13,33,0) 52%), linear-gradient(180deg, #050d23 0%, #071a3b 44%, #040916 100%)',
      }}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: 'clamp(8rem, 34vw, 13rem)', aspectRatio: '1 / 1' }}
      >
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          animate={prefersReducedMotion ? { opacity: 0.48 } : { opacity: [0.28, 0.58, 0.28], scale: [0.92, 1.08, 0.92] }}
          transition={prefersReducedMotion ? undefined : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background:
              'radial-gradient(circle, rgba(247,190,55,0.24) 0%, rgba(40,166,255,0.16) 38%, rgba(40,166,255,0) 70%)',
            filter: 'blur(10px)',
          }}
        />
        <motion.img
          src={QUESTION_PREPARATION_HOURGLASS_SRC}
          alt=""
          aria-hidden="true"
          draggable="false"
          decoding="async"
          loading="eager"
          className="relative z-10 h-full w-full select-none object-contain"
          animate={hourglassAnimation}
          transition={prefersReducedMotion ? undefined : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            filter: 'drop-shadow(0 0 20px rgba(48,158,255,0.28)) drop-shadow(0 14px 32px rgba(0,0,0,0.34))',
            transformOrigin: '50% 50%',
            WebkitUserDrag: 'none',
          }}
        />
      </div>
    </div>
  );
}
