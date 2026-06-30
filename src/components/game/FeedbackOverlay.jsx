import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { sounds } from '@/lib/gameSounds';

/**
 * FeedbackOverlay — shared Solo + Online auto-closing result popup.
 *
 * Behavior contract:
 *   • Opens automatically when a placement result lands.
 *   • Shows a brief result animation, stays visible for a FIXED short
 *     duration, then closes itself and calls onDone(). No tap-to-continue,
 *     no continue button, no close icon.
 *   • Taps on the popup or the backdrop do NOT close it early. The backdrop
 *     captures pointer events so the underlying game can't be touched while
 *     the popup is active.
 *   • Correct and wrong states share one layout and differ only by theme.
 *   • Shows ONLY: icon, title (DOĞRU!/YANLIŞ!), short feedback sentence,
 *     correct year, and the "DOĞRU YIL" label. No guessed year, no interval,
 *     no year difference.
 *
 * Timer freeze + next-card readiness are owned by Game.jsx; this component
 * is purely the visual feedback + its own auto-close timer.
 */

// Single source of truth for the auto-close duration (1400–1600ms window).
//   open animation ≈ 280ms · reading ≈ 1000ms · close animation ≈ 200ms.
const RESULT_POPUP_DURATION = 1500;
const RESULT_POPUP_EXIT_MS = 200;

const CORRECT_MESSAGES = [
  'Tam yerine oturdu',
  'İyi gidiyorsun',
  'Güzel yerleştirme',
  'Böyle devam et',
  'Kart doğru yerde',
  'Zamanı yakaladın',
  'Zaman çizgisi senden yana',
  'Doğru ritmi buldun',
  'Patron sensin',
];

const WRONG_MESSAGES = [
  'Zaman çizgisi şaştı',
  'Bir dahaki sefere',
  'Zamanı kaçırdın',
  'Çizgi bu kez tutmadı',
  'Yaklaştın ama olmadı',
  'Kart yanlış yerde',
];

function pickMessage(list, fallback) {
  if (!Array.isArray(list) || list.length === 0) return fallback;
  return list[Math.floor(Math.random() * list.length)] || fallback;
}

export default function FeedbackOverlay({ result, year, onDone }) {
  const prefersReducedMotion = useReducedMotion();
  const isCorrect = result === 'correct';
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const [message] = useState(() => (
    isCorrect ? pickMessage(CORRECT_MESSAGES, 'Zamanı yakaladın') : pickMessage(WRONG_MESSAGES, 'Zaman çizgisi şaştı')
  ));
  const [visible, setVisible] = useState(true);

  // One-shot sound on mount.
  useEffect(() => {
    if (isCorrect) sounds.correct(); else sounds.wrong();
  }, [isCorrect]);

  // Fixed-duration auto-close: start the exit animation, then call onDone()
  // after the exit finishes so the next card loads only once the popup is
  // fully gone. No tap can trigger this earlier.
  useEffect(() => {
    const closeTimer = window.setTimeout(() => setVisible(false), RESULT_POPUP_DURATION - RESULT_POPUP_EXIT_MS);
    const doneTimer = window.setTimeout(() => { onDoneRef.current?.(); }, RESULT_POPUP_DURATION);
    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  // Theme tokens.
  const theme = isCorrect
    ? {
        backdrop: 'linear-gradient(rgba(7, 35, 23, 0.28), rgba(2, 9, 20, 0.72))',
        surface: 'linear-gradient(180deg, #08261A 0%, #051B12 100%)',
        border: '1.5px solid rgba(67, 209, 122, 0.70)',
        shadow: '0 0 24px rgba(67, 209, 122, 0.22), 0 18px 38px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        iconBg: '#178844',
        iconBorder: '5px solid #57F091',
        iconShadow: '0 0 20px rgba(87, 240, 145, 0.34)',
        bright: '#57F091',
        titleShadow: '0 0 12px rgba(87, 240, 145, 0.22)',
        secondary: '#C8DCCF',
        haloBorder: 'rgba(87, 240, 145, 0.55)',
        title: 'DOĞRU!',
        iconRotate: [-6, 2, 0],
        scaleIn: [0.72, 1.12, 1],
      }
    : {
        backdrop: 'linear-gradient(rgba(55, 12, 18, 0.30), rgba(2, 9, 20, 0.72))',
        surface: 'linear-gradient(180deg, #2A070B 0%, #180305 100%)',
        border: '1.5px solid rgba(255, 100, 109, 0.70)',
        shadow: '0 0 24px rgba(255, 100, 109, 0.22), 0 18px 38px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        iconBg: '#C81E2B',
        iconBorder: '5px solid #FF7A82',
        iconShadow: '0 0 20px rgba(255, 122, 130, 0.34)',
        bright: '#FF7A82',
        titleShadow: '0 0 12px rgba(255, 122, 130, 0.22)',
        secondary: '#E7C2C5',
        haloBorder: 'rgba(255, 122, 130, 0.55)',
        title: 'YANLIŞ!',
        iconRotate: [6, -2, 0],
        scaleIn: [0.72, 1.10, 1],
      };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          // Backdrop captures pointer events so taps never reach the game.
          // It intentionally has no onClick — tapping does NOT close early.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
          className="fixed inset-0 z-40 flex items-center justify-center"
          style={{
            background: 'rgba(2, 9, 20, 0.72)',
            backgroundImage: theme.backdrop,
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            touchAction: 'none',
          }}
          aria-live="assertive"
          role="status"
        >
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.86, opacity: 0, y: 16 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0.92, opacity: 0, y: 8 }}
            transition={prefersReducedMotion
              ? { duration: 0.12 }
              : { type: 'spring', stiffness: 460, damping: 28 }}
            className="flex flex-col items-center text-center"
            style={{
              width: 'min(78vw, 360px)',
              minHeight: 390,
              padding: '26px 24px 28px',
              borderRadius: 28,
              gap: 15,
              background: theme.surface,
              border: theme.border,
              boxShadow: theme.shadow,
            }}
          >
            {/* Icon + one-shot halo */}
            <div className="relative flex items-center justify-center" style={{ width: 84, height: 84 }}>
              {!prefersReducedMotion && (
                <motion.div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full"
                  initial={{ scale: 0.8, opacity: 0.55 }}
                  animate={{ scale: 1.45, opacity: 0 }}
                  transition={{ duration: 0.42, ease: 'easeOut', delay: 0.12 }}
                  style={{ border: `2px solid ${theme.haloBorder}` }}
                />
              )}
              <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.72, opacity: 0, rotate: theme.iconRotate[0] }}
                animate={prefersReducedMotion
                  ? { opacity: 1 }
                  : { scale: theme.scaleIn, opacity: [0, 1, 1], rotate: theme.iconRotate }}
                transition={{ duration: prefersReducedMotion ? 0.12 : 0.34, ease: 'easeOut' }}
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 84,
                  height: 84,
                  background: theme.iconBg,
                  border: theme.iconBorder,
                  boxShadow: theme.iconShadow,
                }}
              >
                {isCorrect
                  ? <Check style={{ width: 40, height: 40, color: '#FFFFFF' }} strokeWidth={4} />
                  : <X style={{ width: 40, height: 40, color: '#FFFFFF' }} strokeWidth={4} />}
              </motion.div>
            </div>

            {/* Title */}
            <h2
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 800,
                fontStyle: 'italic',
                fontSize: 'clamp(42px, 11vw, 58px)',
                lineHeight: 0.95,
                color: theme.bright,
                textShadow: theme.titleShadow,
                margin: 0,
              }}
            >
              {theme.title}
            </h2>

            {/* Short feedback sentence */}
            <p
              className="font-inter"
              style={{ color: theme.secondary, fontSize: 15, fontWeight: 500, margin: 0 }}
            >
              {message}
            </p>

            {/* Correct year — main numeric focus */}
            <div className="flex flex-col items-center" style={{ gap: 2 }}>
              <span
                className="kronox-timeline-number"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontWeight: 400,
                  fontSize: 'clamp(64px, 18vw, 92px)',
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                  color: theme.bright,
                }}
              >
                {year}
              </span>
              <span
                className="font-inter"
                style={{
                  color: '#F4F7FB',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  opacity: 0.72,
                }}
              >
                Doğru Yıl
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}