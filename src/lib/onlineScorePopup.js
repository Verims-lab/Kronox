// Online result popup helpers extracted from Game.jsx.
// Pure functions — no React, no side effects.

export const normalizeOnlineEmail = (value) => String(value || '').trim().toLowerCase();

export const getOpponentEmailForOnlineResult = (players = [], localEmail = null) => {
  const normalizedLocal = normalizeOnlineEmail(localEmail);
  return players.find((player) => {
    const email = normalizeOnlineEmail(player?.email);
    return email && email !== normalizedLocal;
  })?.email || '';
};

// Codex477 — Popup state carries the elapsedSeconds used for audit/display,
// but Online scoring ignores time. Online has no speed bonus.
export const buildOnlineScorePopupState = ({ result, elapsedSeconds, response }) => {
  if (!response) return null;
  if (response.ok === false) {
    return {
      result,
      elapsedSeconds,
      pending: false,
      error: true,
      // Persistence failed — DO NOT show a successful +points message.
      message: 'Puan kaydedilemedi. Tekrar dene.',
    };
  }
  if (response.skipped && !response.applied) {
    return {
      result,
      elapsedSeconds,
      pending: false,
      skipped: true,
      noScoreDelta: true,
      message: 'Bu maçın puanı daha önce işlendi.',
    };
  }
  const applied = response.applied;
  if (!applied) return null;
  return {
    result: applied.result || result,
    // Prefer the elapsedSeconds reported back by the persistence layer
    // (idempotent replays read it from the audit row). Falls back to the
    // value we just passed in so first-apply still shows the local time.
    elapsedSeconds: Number.isFinite(Number(applied.elapsedSeconds))
      ? Number(applied.elapsedSeconds)
      : (Number.isFinite(Number(elapsedSeconds)) ? Number(elapsedSeconds) : null),
    pending: false,
    skipped: Boolean(response.skipped),
    delta: Number(applied.delta) || 0,
    effectiveDelta: Number(applied.effectiveDelta) || 0,
    baseDelta: Number(applied.base) || 0,
    timeBonus: Number(applied.timeBonus) || 0,
    scoreBefore: Number(applied.previousScore) || 0,
    scoreAfter: Number(applied.nextScore) || 0,
    checkpointApplied: Boolean(applied.clampedByCheckpoint),
    protectedFloor: Number(applied.floorCheckpoint) || 0,
    reconciled: Boolean(response.reconciled),
    saved: true,
  };
};