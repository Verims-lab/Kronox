// Kronox shared style tokens — Phase 3 (Codex123 UI consolidation).
//
// PURPOSE
//   Many screens repeat the same fantasy-panel gradients, gold border
//   shadows, and dark-blue card surfaces. This module exposes a tiny,
//   READABLE set of tokens we can reuse from low-risk screens (Profile,
//   Leaderboard, Friends, Settings) WITHOUT inventing a full design
//   system or forcing existing screens to change.
//
// RULES
//   - Keep this module STATIC. No runtime conditional logic, no
//     React state, no dependency on hooks. Tokens are plain strings or
//     style objects so callers can inline them with zero risk.
//   - Do NOT touch GameLayout / Timeline / QuestionCard styling in this
//     phase. Those surfaces are gameplay-critical and out of scope.
//   - Do NOT add tokens "just in case" — every export below was a
//     real, repeated literal inside Profile, Leaderboard, or Settings.
//
// SOURCE-OF-TRUTH NOTE
//   Color values match index.css and tailwind.config.js token math
//   (gold = hsl 43 95% 54% ≈ #facc15; portal blue ≈ #60a5fa). When
//   the design system tokens change in CSS, this file should be
//   updated to match. Health case `ui_kronox_style_tokens_present`
//   asserts these exports exist so accidental deletion is caught.

/* ------------------------------------------------------------------
 * Gradient backgrounds
 * ------------------------------------------------------------------ */

/** Dark royal-blue stone panel background (Profile/Leaderboard cards). */
export const stonePanelBackground =
  'linear-gradient(180deg, rgba(30,41,75,0.9), rgba(10,16,36,0.95))';

/** Strong stone panel used by Identity card / large hero panels. */
export const heroPanelBackground =
  'linear-gradient(180deg, rgba(30,41,75,0.95) 0%, rgba(14,22,46,0.98) 70%, rgba(6,10,24,1) 100%)';

/** Page background — radial-night-sky used by Profile, Leaderboard, Solo. */
export const fantasyPageBackground =
  'radial-gradient(ellipse at 50% 12%, rgba(59,130,246,0.30), transparent 45%), radial-gradient(ellipse at 50% 92%, rgba(34,211,238,0.10), transparent 55%), linear-gradient(180deg, #050b1c 0%, #0a1738 55%, #03060f 100%)';

/* ------------------------------------------------------------------
 * Border / glow shadows
 * ------------------------------------------------------------------ */

/** Inset gold border + soft outer gold glow (CTA/avatar accent). */
export const goldBorderShadow =
  'inset 0 0 0 1.5px rgba(250,204,21,0.55), 0 0 14px rgba(250,204,21,0.30)';

/** Inset portal-blue border + soft outer blue glow (row cards). */
export const portalBorderShadow =
  'inset 0 0 0 1.5px rgba(120,170,255,0.32), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 16px rgba(59,130,246,0.18), 0 8px 16px rgba(2,6,23,0.45)';

/** Identity hero — strong inset + ambient blue glow + deep drop shadow. */
export const heroPanelShadow =
  'inset 0 0 0 1.5px rgba(120,170,255,0.35), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -14px 18px rgba(0,0,0,0.55), 0 0 24px rgba(59,130,246,0.22), 0 12px 24px rgba(2,6,23,0.55)';

/* ------------------------------------------------------------------
 * Text / typography helpers
 * ------------------------------------------------------------------ */

/** Gold heading color with subtle drop-glow — matches ScreenHeader title. */
export const goldHeadingTextStyle = {
  color: '#facc15',
  textShadow: '0 0 14px rgba(250,204,21,0.45), 0 2px 4px rgba(0,0,0,0.6)',
};

/* ------------------------------------------------------------------
 * Layout helpers
 * ------------------------------------------------------------------ */

/** Safe-area bottom inset used by pages that host BottomNav. */
export const safeAreaBottomPadding = 'calc(5rem + env(safe-area-inset-bottom))';

/** Standard top padding under a fixed ScreenHeader. */
export const headerTopPadding = 'calc(4rem + env(safe-area-inset-top))';

/* ------------------------------------------------------------------
 * Helper builders
 * ------------------------------------------------------------------ */

/**
 * Build a tinted ring shadow from a tint hex (e.g. "#facc15").
 * Used by KronoxStatTile compact variant. Inlined so other surfaces
 * can build matching stat rings without re-deriving the math.
 */
export function tintRingShadow(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('#')) return undefined;
  return `inset 0 0 0 1px ${hex}55`;
}