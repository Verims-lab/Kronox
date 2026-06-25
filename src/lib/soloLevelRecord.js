// Solo success popup record context helper.
//
// The client never scans User/GuestProfile rows for records. It sends only the
// completed run metadata to getSoloLeaderboard's recordContext path, and the
// backend returns the current player's achievement summary.

import { base44 } from '@/api/base44Client';

function normalizeRank(value) {
  const rank = Math.floor(Number(value) || 0);
  return rank >= 1 && rank <= 3 ? rank : null;
}

export function normalizeSoloLevelRecordAchievement(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const fastestRank = normalizeRank(source.fastestRank);
  return {
    fastestRank,
    fastestTopThree: Boolean(source.fastestTopThree) && Boolean(fastestRank),
    fewestMoves: source.fewestMoves === true,
    recordScope: 'all_users',
  };
}

export function buildSoloLevelRecordCongratulations(achievement) {
  const normalized = normalizeSoloLevelRecordAchievement(achievement);
  const hasFastest = normalized.fastestTopThree;
  const isFastestFirst = normalized.fastestRank === 1;
  const hasFewestMoves = normalized.fewestMoves;

  if (hasFastest && hasFewestMoves) {
    return 'Mükemmel! Bu seviyede hem en hızlı oyuncular arasındasın hem de en az hamle rekoru sende.';
  }
  if (isFastestFirst) {
    return 'Bravo! Bu seviyeyi en hızlı çözen sensin.';
  }
  if (hasFastest) {
    return 'Tebrikler! Bu seviyeyi en hızlı çözen ilk 3 oyuncu arasındasın.';
  }
  if (hasFewestMoves) {
    return 'Harika! Bu seviyeyi en az hamleyle çözen sensin.';
  }
  return '';
}

/**
 * @param {{ levelNumber: number, timeSeconds: number, usedMoves: number, guestRecordPayload?: object|null }} params
 * @returns {Promise<{ fastestRank: number|null, fastestTopThree: boolean, fewestMoves: boolean, recordScope: 'all_users' }>}
 */
export async function fetchSoloLevelRecordContext({
  levelNumber,
  timeSeconds,
  usedMoves,
  guestRecordPayload = null,
}) {
  const level = Math.max(0, Math.floor(Number(levelNumber) || 0));
  const attemptTimeSeconds = Number(timeSeconds);
  const attemptUsedMoves = Math.max(0, Math.floor(Number(usedMoves) || 0));
  if (!level || !Number.isFinite(attemptTimeSeconds) || attemptTimeSeconds <= 0 || attemptUsedMoves <= 0) {
    return normalizeSoloLevelRecordAchievement(null);
  }

  try {
    const response = await base44.functions.invoke('getSoloLeaderboard', {
      ...(guestRecordPayload && typeof guestRecordPayload === 'object' ? guestRecordPayload : {}),
      levelNumber: level,
      recordContext: true,
      attemptTimeSeconds,
      usedMoves: attemptUsedMoves,
    });
    const payload = response?.data || response || {};
    return normalizeSoloLevelRecordAchievement(payload.recordAchievement);
  } catch {
    return normalizeSoloLevelRecordAchievement(null);
  }
}
