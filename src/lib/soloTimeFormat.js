// Codex164 — Shared compact duration formatter for Solo result popups.
//
// Both SoloSuccessPopup and SoloFailureCard must render time in the same
// compact MM:SS digital format ("01:28", "02:00"). The success popup
// already had a local formatCompactDuration; failure was leaning on
// GameOverTimer.formatDuration which produces verbose "2 DAK 0 SANİYE"
// strings that don't fit the popup card.
//
// SCOPE
//   Visual-only. Do NOT change game logic, scoring, or timer behavior
//   anywhere else — GameOverTimer.formatDuration stays intact for its
//   existing callers.

export function formatCompactDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}