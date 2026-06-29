// Codex146 — Online player-own elapsed seconds helper.
//
// PRODUCT RULE
//   Online has no speed bonus. The time shown in the result popup and
//   retained for audit/diagnostics should still be the CURRENT player's own
//   gameplay time, NOT:
//     • lobby.created_at duration
//     • total match duration (host + guest sync time)
//     • invite/lobby waiting duration
//     • time since both joined
//
//   The popup/audit time must not be used as a score bonus.
//
// SOURCE PRIORITY
//   1) explicit playerResult.elapsedSeconds (when a per-player result
//      record exists on the lobby — future-friendly)
//   2) the local gameplay timer snapshot captured at win/loss moment
//   3) null when nothing reliable is available
//
//   Returning null is intentional: callers (Game.jsx) pass null straight
//   into the scoring helper, which still returns +15 for the winner because
//   elapsed time does not affect Online scoring.
//
// PURITY
//   No React, no DOM, no SDK. Same input → same output.

export function getOnlinePlayerElapsedSeconds(playerResult, fallbackElapsedSeconds) {
  const explicit = playerResult?.elapsedSeconds;
  if (isUsableSeconds(explicit)) return Number(explicit);

  if (isUsableSeconds(fallbackElapsedSeconds)) return Number(fallbackElapsedSeconds);

  return null;
}

function isUsableSeconds(value) {
  if (value === null || value === undefined) return false;
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  if (n < 0) return false;
  return true;
}
