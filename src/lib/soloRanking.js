// Codex106-23 — Solo level ranking helper.
//
// PURPOSE
//   Single place to ask "what is the player's rank for this level?".
//   The SoloLevelResult popup calls `fetchSoloLevelRank({ levelNumber,
//   timeSeconds })` after a passing attempt and renders either the
//   real rank or a safe placeholder.
//
// PRODUCT DECISION
//   There is NO per-level completion record in the data model yet:
//     - GameRecord stores generic single-player duration + cards_won
//       but does NOT include solo level number or star count, so it
//       cannot be safely filtered for "users who completed Level N".
//     - User.solo_progress is per-user only — we don't run cross-user
//       aggregation from the client (no service-role on frontend).
//
//   Faking a permanent backend ranking from this client would lie to
//   the user, so we intentionally return `{ ready: false, rank: null }`
//   for now. The popup then renders the placeholder copy:
//     "Sıralama verisi hazırlanıyor"
//
// BACKLOG (recorded for the next product pass — NOT in scope here)
//   To enable real ranking, we'd need one of:
//     a) A new entity (e.g. SoloLevelCompletion) storing
//        { user_email, level_number, stars, time_seconds, created_at }.
//        Then a backend function rankSoloLevel({ levelNumber, timeSeconds })
//        does an indexed query and returns the position.
//     b) Or extend GameRecord with `solo_level_number` + `stars`, and
//        write a backend function that filters by both.
//   Either requires a server-side aggregation function — we do NOT
//   want each client doing a full-table list to compute a rank.
//
//   This file is the single edit point: when (a) or (b) lands, swap
//   the implementation below to call the backend function and return
//   `{ ready: true, rank }`. SoloLevelResult.jsx needs zero changes.

/**
 * @param {{ levelNumber: number, timeSeconds: number }} params
 * @returns {Promise<{ ready: boolean, rank: number|null }>}
 *
 *   ready=true  → use rank directly ("Level X sıralamasında N. oldun")
 *   ready=false → caller renders the placeholder copy. Never lie.
 */
// eslint-disable-next-line no-unused-vars
export async function fetchSoloLevelRank({ levelNumber, timeSeconds }) {
  // Reserved to match the future backend signature; no-op today.
  void levelNumber;
  void timeSeconds;
  return { ready: false, rank: null };
}