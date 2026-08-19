export const STANDARD_RANDOM_MODE = 'random_online';
export const SAME_QUESTION_DUEL_MODE = 'same_question_duel';
export const MATCHMAKING_MODES = Object.freeze([
  STANDARD_RANDOM_MODE,
  SAME_QUESTION_DUEL_MODE,
]);

const MATCHMAKING_MODE_SET = new Set(MATCHMAKING_MODES);

export function normalizeMatchmakingMode(value) {
  const mode = String(value || STANDARD_RANDOM_MODE).trim().toLowerCase();
  return MATCHMAKING_MODE_SET.has(mode) ? mode : STANDARD_RANDOM_MODE;
}

export function readMatchmakingTime(value) {
  const text = String(value || '').trim();
  if (!text) return NaN;
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`);
}

export function isQueueRowExpired(row, nowMs, fallbackTtlMs = 30 * 1000) {
  const expiresAt = readMatchmakingTime(row?.expires_at);
  if (Number.isFinite(expiresAt)) return expiresAt <= nowMs;
  const createdAt = readMatchmakingTime(row?.created_at);
  return Number.isFinite(createdAt) && createdAt + fallbackTtlMs <= nowMs;
}

export function selectOwnActiveQueueRow(rows, actorKeyHash, mode) {
  const canonicalMode = normalizeMatchmakingMode(mode);
  return (rows || []).find((row) => (
    String(row?.actor_key_hash || '') === String(actorKeyHash || '')
    && normalizeMatchmakingMode(row?.mode) === canonicalMode
    && (row?.status === 'waiting' || row?.status === 'matched')
  )) || null;
}

export function selectCompatibleWaitingRow(rows, actorKeyHash, mode, nowMs) {
  const canonicalMode = normalizeMatchmakingMode(mode);
  return (rows || [])
    .filter((row) => (
      row?.status === 'waiting'
      && normalizeMatchmakingMode(row?.mode) === canonicalMode
      && String(row?.actor_key_hash || '') !== String(actorKeyHash || '')
      && !isQueueRowExpired(row, nowMs)
    ))
    .sort((left, right) => (
      readMatchmakingTime(left?.created_at) - readMatchmakingTime(right?.created_at)
      || String(left?.id || left?._id || '').localeCompare(String(right?.id || right?._id || ''))
    ))[0] || null;
}

export function expiredWaitingRows(rows, nowMs) {
  return (rows || []).filter((row) => row?.status === 'waiting' && isQueueRowExpired(row, nowMs));
}

export function selectLiveLockWinner(rows, nowMs) {
  return (rows || [])
    .filter((row) => row?.status === 'active' && readMatchmakingTime(row?.expires_at) > nowMs)
    .sort((left, right) => (
      readMatchmakingTime(left?.acquired_at) - readMatchmakingTime(right?.acquired_at)
      || String(left?.id || left?._id || '').localeCompare(String(right?.id || right?._id || ''))
    ))[0] || null;
}
