// Codex106 — Solo Level Path local helper.
//
// PURPOSE
//   The new Solo entry screen is a vertical Level Path (no category select).
//   This module is a *local, UI-only* mapping for the level list and its
//   per-level star/progress display. It is intentionally lightweight:
//
//   - No backend writes.
//   - No mutation of User.hasCompletedTutorial or any profile field.
//   - No persistence of fake progress to the server.
//
//   Real persistent level progress + the final star scoring algorithm are
//   intentionally out of scope (see backlog in the Codex106 report).
//   When the real system lands, replace `loadLocalSoloProgress()` with the
//   real progress source — every other component on the Solo screen reads
//   only from `getSoloLevels()`'s return shape so the swap stays trivial.
//
// STORAGE
//   We read `localStorage["kx_solo_progress_v1"]` if present, otherwise we
//   return a safe empty progress map. We DO NOT write to it from this file;
//   game completion → progress update can be added in a later step without
//   any UI change here.
//
// SHAPE EXPECTED IN STORAGE (all optional):
//   {
//     "1": { stars: 3, bestTime: 87 },
//     "2": { stars: 2, bestTime: 142 },
//     ...
//   }

const STORAGE_KEY = 'kx_solo_progress_v1';

// Base level catalog — 8 levels is enough to fit the no-scroll constraint
// on common phone heights. Titles are intentionally minimal ("Level N") so
// the row layout matches the reference image. `subtitle` is shown only for
// the current/next challenge row.
const LEVEL_CATALOG = [
  { levelNumber: 1, title: 'Level 1' },
  { levelNumber: 2, title: 'Level 2' },
  { levelNumber: 3, title: 'Level 3' },
  { levelNumber: 4, title: 'Level 4' },
  { levelNumber: 5, title: 'Level 5' },
  { levelNumber: 6, title: 'Level 6' },
  { levelNumber: 7, title: 'Level 7' },
  { levelNumber: 8, title: 'Level 8' },
];

function safeReadProgress() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Returns the full level list with derived display state:
 *
 *   { levelNumber, title, status, stars, bestTime, isPlayable }
 *
 * Rules:
 *   - status = 'completed' when stored progress for that level exists AND
 *     stars > 0 (we treat stars > 0 as "you cleared it").
 *   - status = 'current'   for the lowest level that is not completed.
 *   - status = 'locked'    for every level after `current`.
 *   - completed and current are isPlayable = true (you can replay completed
 *     levels to improve stars).
 *   - locked levels are isPlayable = false.
 *
 * If there is no stored progress at all, level 1 is `current` and levels
 * 2..8 are `locked` — exactly the first-run state shown in the reference.
 */
export function getSoloLevels() {
  const progress = safeReadProgress();

  // First pass: completed levels (stars > 0).
  const annotated = LEVEL_CATALOG.map((lvl) => {
    const p = progress[String(lvl.levelNumber)] || null;
    const stars = Math.max(0, Math.min(3, Number(p?.stars) || 0));
    const isCompleted = stars > 0;
    return {
      ...lvl,
      stars,
      bestTime: typeof p?.bestTime === 'number' ? p.bestTime : null,
      _completed: isCompleted,
    };
  });

  // Second pass: assign current vs locked.
  let currentAssigned = false;
  const levels = annotated.map((lvl) => {
    if (lvl._completed) {
      // Completed but replayable.
      const { _completed, ...rest } = lvl;
      return { ...rest, status: 'completed', isPlayable: true };
    }
    if (!currentAssigned) {
      currentAssigned = true;
      const { _completed, ...rest } = lvl;
      return { ...rest, status: 'current', isPlayable: true };
    }
    const { _completed, ...rest } = lvl;
    return { ...rest, status: 'locked', isPlayable: false };
  });

  return levels;
}

/**
 * Maps a selected level to a safe solo game start config.
 *
 * The current Game page expects route state shaped like:
 *   { playerNames, category, yearStart, yearEnd, turnDuration }
 *
 * We intentionally do NOT introduce a new "level mode" into Game — that
 * would be a much larger change. Instead, every level starts the *existing*
 * solo game flow with category='karisik' (mixed) so question generation,
 * random selection, drag/drop, Timeline and QuestionCard stay untouched.
 *
 * Per-level pacing is mapped onto the existing turnDuration field:
 *   - level 1–2  → 0  (no turn timer, "rahat")
 *   - level 3–5  → 30
 *   - level 6+   → 15 (faster the deeper you go)
 *
 * Year window stays at the existing solo default (1900..2025). When real
 * level-to-config mapping is decided product-side, this is the only place
 * to change.
 */
export function buildSoloGameConfigForLevel(level) {
  const n = level?.levelNumber || 1;
  let turnDuration = 0;
  if (n >= 3 && n <= 5) turnDuration = 30;
  else if (n >= 6) turnDuration = 15;

  return {
    playerNames: ['Sen'],
    category: 'karisik',
    yearStart: 1900,
    yearEnd: 2025,
    turnDuration,
  };
}