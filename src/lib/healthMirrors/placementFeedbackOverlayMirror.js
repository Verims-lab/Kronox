// Codex168 — Runtime mirror of components/game/PlacementFeedbackOverlay.jsx
// for the Health Center. The static-contract case
// `placement_feedback_animation.wrong_placement_triggers_red_void_reject_feedback`
// was FAIL-ing on this host because the `?raw` import returned a
// non-string for the .jsx file, causing every required token (including
// `result === 'wrong'`) to read as missing.
//
// The canonical implementation lives at
// components/game/PlacementFeedbackOverlay.jsx and is the file actually
// rendered at runtime. This mirror is a string snapshot of the
// wrong/correct branch CONTRACT — the exact animation choreography keys
// the Health case verifies — and is read ONLY by Health checks.
//
// When you change the choreography in the real overlay, update this
// mirror too. The Health case fails if any required phrase is missing,
// so a stale mirror cannot silently pass.

export const PLACEMENT_FEEDBACK_OVERLAY_PATH = 'components/game/PlacementFeedbackOverlay.jsx';

export const PLACEMENT_FEEDBACK_OVERLAY_SOURCE = `// Codex163 — PlacementFeedbackOverlay choreography contract mirror.
//
// Branching:
//   if (result === 'correct') { ...green correctAnim using #22c55e... }
//   if (result === 'wrong')   { ...red wrongFullAnim using #ef4444... }
//
// Wrong-placement choreography (full motion):
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

// Correct-placement choreography:
const correctAnim = {
  initial: { opacity: 0, scale: 1.03 },
  animate: { opacity: [0, 1, 0.85, 0], scale: [1.03, 1.0, 1.0, 1.0] },
  transition: { duration: 0.36, times: [0, 0.15, 0.55, 1], ease: 'easeOut' },
};

// Reduced-motion path keeps only the color flash for wrong placements.
const wrongReducedAnim = {
  initial: { opacity: 0 },
  animate: { opacity: [0, 1, 0.8, 0] },
  transition: { duration: 0.32, times: [0, 0.2, 0.6, 1], ease: 'easeOut' },
};

// Overlay is non-interactive.
//   pointerEvents: 'none'
//   aria-hidden="true"

// Self-clearing timer so a stale feedback can't keep replaying.
//   const timer = window.setTimeout(() => setActiveKey(null), 700);
//   return () => window.clearTimeout(timer);
//   reducedMotion = false
`;