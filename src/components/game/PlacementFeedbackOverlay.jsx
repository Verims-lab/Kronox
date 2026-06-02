import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Codex163 — Placement Feedback Overlay (visual-only).
 *
 * Renders a brief green pulse over the correctly-placed slot, or a brief
 * red glow + shake + "void rejection" drift over the slot a wrong card
 * was dropped on. This component is PURELY decorative:
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
 */
export default function PlacementFeedbackOverlay({
  feedbackKey,
  result,
  targetRect,
  reducedMotion = false,
}) {
  // Internal one-shot key so a stale feedback doesn't keep replaying.
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    if (!result || !targetRect) return undefined;
    setActiveKey(feedbackKey);
    // Self-clear after the longest possible animation finishes so the
    // overlay doesn't linger if the parent forgets to clear `feedback`.
    const timer = window.setTimeout(() => setActiveKey(null), 700);
    return () => window.clearTimeout(timer);
  }, [feedbackKey, result, targetRect]);

  if (!activeKey || !targetRect || (result !== 'correct' && result !== 'wrong')) {
    return null;
  }

  const isCorrect = result === 'correct';
  const color = isCorrect ? '#22c55e' : '#ef4444';
  const glow = isCorrect
    ? '0 0 22px rgba(34,197,94,0.65), inset 0 0 18px rgba(34,197,94,0.45)'
    : '0 0 22px rgba(239,68,68,0.7), inset 0 0 18px rgba(239,68,68,0.5)';

  // Animation choreography:
  //   correct → green glow + soft settle pulse (~320ms)
  //   wrong   → red glow + shake (~160ms) → void-reject drift (~220ms)
  // Reduced motion: keep only the color flash (no shake, no drift).
  const correctAnim = {
    initial: { opacity: 0, scale: 1.03 },
    animate: { opacity: [0, 1, 0.85, 0], scale: [1.03, 1.0, 1.0, 1.0] },
    transition: { duration: 0.36, times: [0, 0.15, 0.55, 1], ease: 'easeOut' },
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
          className="rounded-2xl"
          style={{
            width: '100%',
            height: '100%',
            border: `2px solid ${color}`,
            boxShadow: glow,
            background: isCorrect
              ? 'radial-gradient(ellipse at center, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0) 70%)'
              : 'radial-gradient(ellipse at center, rgba(239,68,68,0.22) 0%, rgba(239,68,68,0) 72%)',
          }}
        />
      </AnimatePresence>
    </div>
  );
}