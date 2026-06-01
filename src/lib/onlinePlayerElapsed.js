// Codex146 — Online player-own elapsed seconds helper.
//
// PRODUCT RULE
//   The time used for Online score time bonus AND shown in the result
//   popup MUST be the CURRENT player's own gameplay time, NOT:
//     • lobby.created_at duration
//     • total match duration (host + guest sync time)
//     • invite/lobby waiting duration
//     • time since both joined
//
//   The popup time and the scoring time MUST be the same value.
//
// SOURCE PRIORITY
//   1) explicit playerResult.elapsedSeconds (when a per-player result
//      record exists on the lobby — future-friendly)
//   2) the local gameplay timer snapshot captured at win/loss moment
//   3) null when nothing reliable is available
//
//   Returning null is intentional: callers (Game.jsx) pass null straight
//   into the scoring helper which then returns +15 base only for the
//   winner (no fake speed bonus from a 0 fallback).
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