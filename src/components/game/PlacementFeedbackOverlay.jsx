import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Codex163 — Placement Feedback Overlay (visual-only).
 *
 * Renders a brief gold/cyan lock-in pulse over the correctly-placed slot,
 * or a brief red glow + shake + "void rejection" drift over the slot a
 * wrong card was dropped on. This component is PURELY decorative:
 *   • It does NOT touch the timeline cards array.
 *   • It does NOT decide correct/wrong (`useGameActions` already did).
 *   • It does NOT interact with drag/drop hit-testing or auto-scroll.
 *   • It renders inside an absolutely-positioned, pointer-events:none
 *     wrapper so it can never block touches or clicks.
 *
 * Props
 *   feedbackKey  — monotonic key (`feedback.year + result`) so the
 *                  overlay re-animates for every new feedback event.
 *   result       — "correct" | "wrong" | null (null/anything else hides).
 *   targetRect   — DOMRect-like { left, top, width, height } in
 *                  coordinates of the overlay's positioning parent.
 *                  Pass null to hide.
 *   reducedMotion — true to skip shake/drift; keeps only the color flash.
 *   correctStreak — local visual-only Solo streak count for microcopy.
 */
export default function PlacementFeedbackOverlay({
  feedbackKey,
  result,
  targetRect,
  reducedMotion = false,
  correctStreak = 0,
}) {
  // Internal one-shot key so a stale feedback doesn't keep replaying.
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    if (!result || !targetRect) return undefined;
    setActiveKey(feedbackKey);
    // Self-clear after the longest possible animation finishes so the
    // overlay doesn't linger if the parent forgets to clear `feedback`.
    const timer = window.setTimeout(() => setActiveKey(null), 820);
    return () => window.clearTimeout(timer);
  }, [feedbackKey, result, targetRect]);

  if (!activeKey || !targetRect || (result !== 'correct' && result !== 'wrong')) {
    return null;
  }

  const isCorrect = result === 'correct';
  const color = isCorrect ? '#facc15' : '#ef4444';
  const accentColor = isCorrect ? '#38bdf8' : '#ef4444';
  const glow = isCorrect
    ? '0 0 24px rgba(250,204,21,0.70), 0 0 34px rgba(56,189,248,0.24), inset 0 0 18px rgba(250,204,21,0.44)'
    : '0 0 22px rgba(239,68,68,0.7), inset 0 0 18px rgba(239,68,68,0.5)';
  const safeCorrectStreak = Math.max(0, Number(correctStreak) || 0);
  const successSparkAngles = [-74, -42, -16, 18, 46, 76];

  // Animation choreography:
  //   correct → gold/cyan lock-in pulse + snap/bounce + light sparks
  //   wrong   → red glow + shake (~160ms) → void-reject drift (~220ms)
  // Reduced motion: keep only the color flash (no shake, no drift).
  const correctAnim = {
    initial: { opacity: 0, scale: reducedMotion ? 1 : 0.94 },
    animate: {
      opacity: [0, 1, 0.9, 0],
      scale: reducedMotion ? [1, 1, 1, 1] : [0.94, 1.08, 0.985, 1.0],
    },
    transition: { duration: reducedMotion ? 0.32 : 0.48, times: [0, 0.18, 0.58, 1], ease: 'easeOut' },
  };

  const wrongFullAnim = {
    initial: { opacity: 0, x: 0, y: 0, scale: 1, rotate: 0 },
    animate: {
      opacity: [0, 1, 1, 0.55, 0],
      x: [0, -6, 6, -4, 0, 0],
      y: [0, 0, 0, 8, 22],
      scale: [1, 1, 1, 0.96, 0.92],
      rotate: [0, -1.5, 1.5, -1, 0],
    },
    transition: { duration: 0.6, times: [0, 0.12, 0.28, 0.55, 1], ease: 'easeOut' },
  };

  const wrongReducedAnim = {
    initial: { opacity: 0 },
    animate: { opacity: [0, 1, 0.8, 0] },
    transition: { duration: 0.32, times: [0, 0.2, 0.6, 1], ease: 'easeOut' },
  };

  const motionProps = isCorrect
    ? correctAnim
    : reducedMotion
      ? wrongReducedAnim
      : wrongFullAnim;

  const padding = 4; // expand slightly so the glow reads outside the card
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none"
      style={{
        position: 'absolute',
        left: targetRect.left - padding,
        top: targetRect.top - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
        zIndex: 30,
      }}
    >
      <AnimatePresence>
        <motion.div
          key={activeKey}
          {...motionProps}
          className="relative rounded-2xl"
          style={{
            width: '100%',
            height: '100%',
            border: `2px solid ${color}`,
            boxShadow: glow,
            background: isCorrect
              ? 'radial-gradient(ellipse at center, rgba(250,204,21,0.20) 0%, rgba(56,189,248,0.12) 38%, rgba(250,204,21,0) 72%)'
              : 'radial-gradient(ellipse at center, rgba(239,68,68,0.22) 0%, rgba(239,68,68,0) 72%)',
          }}
        >
          {isCorrect && !reducedMotion && (
            <>
              <motion.div
                aria-hidden="true"
                className="absolute inset-0 rounded-2xl"
                initial={{ opacity: 0, scale: 0.82 }}
                animate={{ opacity: [0, 0.9, 0], scale: [0.82, 1.22, 1.36] }}
                transition={{ duration: 0.58, ease: 'easeOut' }}
                style={{
                  border: `1px solid ${accentColor}`,
                  boxShadow: '0 0 18px rgba(56,189,248,0.36)',
                }}
              />
              {successSparkAngles.map((angle, index) => (
                <motion.span
                  key={`${activeKey}:spark:${angle}`}
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                  initial={{ opacity: 0, x: '-50%', y: '-50%', scale: 0.6 }}
                  animate={{
                    opacity: [0, 1, 0],
                    x: `calc(-50% + ${Math.cos((angle * Math.PI) / 180) * (28 + index * 2)}px)`,
                    y: `calc(-50% + ${Math.sin((angle * Math.PI) / 180) * (20 + index)}px)`,
                    scale: [0.6, 1.18, 0.55],
                  }}
                  transition={{ duration: 0.46, delay: index * 0.018, ease: 'easeOut' }}
                  style={{
                    background: index % 2 === 0 ? color : accentColor,
                    boxShadow: index % 2 === 0
                      ? '0 0 10px rgba(250,204,21,0.72)'
                      : '0 0 10px rgba(56,189,248,0.62)',
                  }}
                />
              ))}
              {safeCorrectStreak >= 2 && (
                <motion.div
                  aria-hidden="true"
                  className="absolute left-1/2 top-0 whitespace-nowrap rounded-full px-2 py-0.5 font-bangers tracking-wider"
                  initial={{ opacity: 0, y: -4, x: '-50%', scale: 0.9 }}
                  animate={{ opacity: [0, 1, 0], y: [-4, -16, -22], x: '-50%', scale: [0.9, 1.06, 1] }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  style={{
                    color: '#0a0f23',
                    background: 'linear-gradient(90deg, #facc15, #38bdf8)',
                    boxShadow: '0 0 12px rgba(250,204,21,0.38)',
                    fontSize: 12,
                  }}
                >
                  {safeCorrectStreak >= 3 ? 'Harika!' : 'Seri!'}
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
