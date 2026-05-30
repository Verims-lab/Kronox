// Codex110 — Single-source-of-truth helpers for Solo progress.
//
// WHY THIS FILE EXISTS
//   Codex109 fixed the "multiple current levels" picker but the actual
//   shipped product still showed:
//     • Level 9 locked after Levels 1-8 completed.
//     • CTA stuck on "Level 1".
//     • Solo screen opening at the wrong scroll position.
//
//   Root cause was NOT the picker — it was that `currentLevel` (a single
//   number) and the per-level `bestStars` map can desync. If a write
//   partially succeeded, or the user is on a new device where `currentLevel`
//   is 1 but server has stars for Levels 1-8, the picker would still
//   compute `unlocked = 1` and lock everything.
//
//   This module derives unlock state from BOTH signals:
//     - persisted `currentLevel` (the unlocked frontier writer)
//     - the highest level with `bestStars > 0` (what the player has
//       actually proven they completed)
//   The effective unlock = max(currentLevel, highestCompleted + 1).
//
//   That self-heals all three production bugs without changing the
//   storage shape, without backend migrations, and without touching
//   gameplay code.
//
// USED BY
//   - lib/soloLevels.js  (getSoloLevels, applyLevelAttempt)
//   - pages/SoloChallenge.jsx  (default selection)
//   - components/game/simulationPanelSoloUnlockCases.js  (Health)
//   - pages/ProfilePage.jsx  (Level tile, indirectly via readSoloProgress
//     → getCurrentPlayableLevel)

/**
 * Highest level number for which the user has at least 1 best star.
 * Returns 0 when the user has never passed a level.
 */
export function getHighestCompletedLevel(progress) {
  const map = progress?.levels;
  if (!map || typeof map !== 'object') return 0;
  let highest = 0;
  for (const key of Object.keys(map)) {
    const n = Number(key);
    if (!Number.isFinite(n) || n <= 0) continue;
    const stars = Number(map[key]?.bestStars) || 0;
    if (stars > 0 && n > highest) highest = n;
  }
  return highest;
}

/**
 * Effective unlock frontier — the LARGEST level number the user is
 * allowed to play right now.
 *
 *   unlocked = max(persisted currentLevel, highestCompleted + 1)
 *
 * Capped to `totalLevels` so we never return a level beyond the catalog.
 * This is the formula every consumer (status, default selection, CTA,
 * Profile tile) must use.
 */
export function getEffectiveUnlockedLevel(progress, totalLevels) {
  const cap = Math.max(1, Number(totalLevels) || 1);
  const persisted = Math.max(1, Number(progress?.currentLevel) || 1);
  const fromHistory = getHighestCompletedLevel(progress) + 1;
  return Math.min(cap, Math.max(persisted, fromHistory));
}

/**
 * The level the user should be focused on right now.
 *
 *   - If the unlock frontier has bestStars === 0 → that level (next
 *     real challenge).
 *   - Otherwise (every unlocked level already completed) → the frontier
 *     itself, so the user can replay it explicitly.
 *
 * NEVER returns 0; lowest is 1.
 */
export function getCurrentPlayableLevel(progress, totalLevels) {
  const frontier = getEffectiveUnlockedLevel(progress, totalLevels);
  const stars = Number(progress?.levels?.[String(frontier)]?.bestStars) || 0;
  return stars === 0 ? frontier : frontier;
}

/**
 * Default level number to highlight in the CTA when the Solo screen
 * first lands. Identical to `getCurrentPlayableLevel` today, but kept
 * as its own export so future product tweaks (e.g. "default to the
 * lowest 1-star level so the user can chase 3 stars") don't ripple.
 */
export function getDefaultSelectedLevel(progress, totalLevels) {
  return getCurrentPlayableLevel(progress, totalLevels);
}

/**
 * Status for a single level number, given current progress.
 * Returns one of: 'completed' | 'current' | 'locked'.
 *
 *   completed : levelNumber ≤ highestCompleted (has bestStars > 0)
 *   current   : levelNumber === effective unlock frontier AND not completed
 *               (or the frontier itself when everything below is completed)
 *   locked    : levelNumber > effective unlock frontier
 */
export function getLevelStatus(levelNumber, progress, totalLevels) {
  const frontier = getEffectiveUnlockedLevel(progress, totalLevels);
  if (levelNumber > frontier) return 'locked';
  const stars = Number(progress?.levels?.[String(levelNumber)]?.bestStars) || 0;
  if (stars > 0) return 'completed';
  return 'current';
}

/**
 * Can the user start an attempt on this level right now?
 *   - locked  → no
 *   - current → yes
 *   - completed → yes (replay)
 */
export function canPlayLevel(levelNumber, progress, totalLevels) {
  return getLevelStatus(levelNumber, progress, totalLevels) !== 'locked';
}