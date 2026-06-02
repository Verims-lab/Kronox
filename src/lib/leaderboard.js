import { base44 } from '@/api/base44Client';
import { backfillSoloScores, summarizeSoloProgress } from './soloProgressHelpers';
import { getDiamondBalance } from './diamondEconomy';

export const LEADERBOARD_TOP_LIMIT = 10;
export const LEADERBOARD_FETCH_LIMIT = 500;
export const LEADERBOARD_SOLO_LEVEL_COUNT = 20;
const SOLO_LEADERBOARD_ENTITY = 'SoloLeaderboardEntry';

export function isMissingSoloLeaderboardEntityError(error) {
  const message = String(error?.message || error || '');
  return message.includes(`Entity schema ${SOLO_LEADERBOARD_ENTITY} not found`) ||
    message.includes('SoloLeaderboardEntry not found') ||
    message.includes('schema SoloLeaderboardEntry');
}

export function normalizeLeaderboardEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function getLeaderboardOwnerKey(rawEmail) {
  const email = normalizeLeaderboardEmail(rawEmail);
  if (!email) return '';

  let hash = 2166136261;
  for (let i = 0; i < email.length; i += 1) {
    hash ^= email.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function cleanDisplayText(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 28);
}

export function getSafeLeaderboardName(userOrEntry) {
  const explicitName = [
    userOrEntry?.display_name,
    userOrEntry?.full_name,
    userOrEntry?.displayName,
    userOrEntry?.username,
    userOrEntry?.name,
  ].map(cleanDisplayText).find(Boolean);

  if (explicitName && !explicitName.includes('@')) return explicitName;

  const ownerKey = String(userOrEntry?.owner_key || getLeaderboardOwnerKey(userOrEntry?.email || userOrEntry?.user_email));
  const suffix = ownerKey ? ownerKey.slice(-4).toLocaleUpperCase('tr-TR') : '';
  return suffix ? `Oyuncu ${suffix}` : 'Oyuncu';
}

export function getLeaderboardDiamondValue(user) {
  return getDiamondBalance(user);
}

function getLeaderboardOnlineScore(userOrEntry) {
  const score = Number(
    userOrEntry?.online_score ??
    userOrEntry?.online_progress?.score ??
    0,
  );
  return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
}

function normalizeSoloProgressForLeaderboard(progress, totalLevels = LEADERBOARD_SOLO_LEVEL_COUNT) {
  return backfillSoloScores(progress || {}, totalLevels).progress;
}

function getAggregateBestTimeSeconds(progress) {
  const levels = progress?.levels && typeof progress.levels === 'object'
    ? progress.levels
    : {};
  let total = 0;
  let count = 0;

  Object.values(levels).forEach((entry) => {
    const stars = Math.max(0, Number(entry?.bestStars) || 0);
    const time = Number(entry?.bestTimeSeconds);
    if (stars > 0 && Number.isFinite(time)) {
      total += Math.max(0, time);
      count += 1;
    }
  });

  return count > 0 ? total : null;
}

function initialFromName(displayName) {
  return cleanDisplayText(displayName).charAt(0).toLocaleUpperCase('tr-TR') || 'O';
}

export function buildSoloLeaderboardPayload(user, progress, totalLevels = LEADERBOARD_SOLO_LEVEL_COUNT) {
  const ownerKey = getLeaderboardOwnerKey(user?.email || user?.user_email);
  const normalizedProgress = normalizeSoloProgressForLeaderboard(progress || user?.solo_progress, totalLevels);
  const summary = summarizeSoloProgress(normalizedProgress, totalLevels);
  const totalSoloScore = Math.max(0, Number(summary.totalSoloScore) || 0);
  const onlineScore = getLeaderboardOnlineScore(user);
  // Codex169 — Unified Kronox Puan in the leaderboard row projection.
  // Online win/loss delta is added to the same Solo total used everywhere
  // (Profile/Header/Leaderboard), so rows never split Solo vs Online:
  //   totalKronoxScore = summary.totalSoloScore + onlineScore
  const totalKronoxScore = totalSoloScore + onlineScore;
  const displayName = getSafeLeaderboardName(user);
  const aggregateBestTimeSeconds = getAggregateBestTimeSeconds(normalizedProgress);

  return {
    owner_key: ownerKey,
    display_name: displayName,
    initial: initialFromName(displayName),
    total_kronox_score: totalKronoxScore,
    total_solo_score: totalSoloScore,
    online_score: onlineScore,
    current_level: Math.max(1, Number(summary.currentLevel) || 1),
    unlocked_level: Math.max(1, Number(summary.unlockedLevel) || Number(summary.currentLevel) || 1),
    total_stars: Math.max(0, Number(summary.totalStars) || 0),
    completed_level_count: Math.max(0, Number(summary.completedLevelCount) || 0),
    ...(aggregateBestTimeSeconds !== null ? { aggregate_best_time_seconds: aggregateBestTimeSeconds } : {}),
    updated_at: new Date().toISOString(),
  };
}

export async function publishSoloLeaderboardEntry(user, progress, totalLevels = LEADERBOARD_SOLO_LEVEL_COUNT) {
  const payload = buildSoloLeaderboardPayload(user, progress, totalLevels);
  if (!payload.owner_key) return null;

  try {
    const existing = await base44.entities.SoloLeaderboardEntry.filter(
      { owner_key: payload.owner_key },
      '-updated_at',
      5,
    );
    const ownRow = existing?.[0] || null;
    if (ownRow?.id) {
      return base44.entities.SoloLeaderboardEntry.update(ownRow.id, payload);
    }
    return base44.entities.SoloLeaderboardEntry.create(payload);
  } catch (error) {
    if (isMissingSoloLeaderboardEntityError(error)) return null;
    throw error;
  }
}

export async function loadSoloLeaderboardEntries(limit = LEADERBOARD_FETCH_LIMIT) {
  try {
    const response = await base44.functions.invoke('getSoloLeaderboard', { limit });
    const rows = response?.data?.rows || response?.rows;
    if (Array.isArray(rows)) return rows;
  } catch {
    // Fall through to the entity source for older deployments where the
    // function has not landed yet.
  }

  try {
    const rows = await base44.entities.SoloLeaderboardEntry.list('-total_kronox_score', limit);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    if (isMissingSoloLeaderboardEntityError(error)) return [];
    throw error;
  }
}

export function getFriendLeaderboardKeys(friendEmails = []) {
  return new Set(
    (friendEmails || [])
      .map(getLeaderboardOwnerKey)
      .filter(Boolean),
  );
}

export function toSoloLeaderboardEntry(publicRow, friendKeySet = new Set(), currentOwnerKey = '') {
  const ownerKey = String(publicRow?.owner_key || '').trim();
  const displayName = getSafeLeaderboardName(publicRow);
  const soloScore = Math.max(0, Number(publicRow?.total_solo_score) || 0);
  const onlineScore = getLeaderboardOnlineScore(publicRow);
  const hasUnifiedScore = Number.isFinite(Number(publicRow?.total_kronox_score));
  const totalKronoxScore = hasUnifiedScore
    ? Math.max(0, Math.floor(Number(publicRow.total_kronox_score)))
    : soloScore + onlineScore;
  const currentLevel = Math.max(1, Number(publicRow?.current_level) || 1);
  const totalStars = Math.max(0, Number(publicRow?.total_stars) || 0);
  const aggregateBestTimeSeconds = Number(publicRow?.aggregate_best_time_seconds);

  return {
    id: ownerKey || String(publicRow?.id || publicRow?._id || displayName).toLowerCase(),
    ownerKey,
    displayName,
    initial: cleanDisplayText(publicRow?.initial).slice(0, 1) || initialFromName(displayName),
    summary: {
      totalKronoxScore,
      totalSoloScore: soloScore,
      onlineScore,
      currentLevel,
      unlockedLevel: Math.max(1, Number(publicRow?.unlocked_level) || currentLevel),
      totalStars,
      completedLevelCount: Math.max(0, Number(publicRow?.completed_level_count) || 0),
    },
    updatedAt: publicRow?.updated_at || publicRow?.updated_date || publicRow?.created_date || '',
    aggregateBestTimeSeconds: Number.isFinite(aggregateBestTimeSeconds) ? aggregateBestTimeSeconds : null,
    isCurrentUser: Boolean(currentOwnerKey && ownerKey && ownerKey === currentOwnerKey),
    isFriend: Boolean(ownerKey && friendKeySet.has(ownerKey)),
  };
}

export function rankSoloLeaderboardEntries(publicRows, friendKeys = new Set(), currentOwnerKey = '') {
  const byOwnerKey = new Map();

  (publicRows || []).forEach((row) => {
    const ownerKey = String(row?.owner_key || '').trim();
    if (!ownerKey) return;
    const current = byOwnerKey.get(ownerKey);
    if (!current || comparePublicLeaderboardRows(row, current) < 0) {
      byOwnerKey.set(ownerKey, row);
    }
  });

  const ranked = Array.from(byOwnerKey.values())
    .map((row) => toSoloLeaderboardEntry(row, friendKeys, currentOwnerKey))
    .filter((entry) => entry.id)
    .sort(compareLeaderboardEntries);

  return ranked.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function comparePublicLeaderboardRows(a, b) {
  const entryA = toSoloLeaderboardEntry(a);
  const entryB = toSoloLeaderboardEntry(b);
  return compareLeaderboardEntries(entryA, entryB);
}

function compareLeaderboardEntries(a, b) {
  const scoreDiff = b.summary.totalKronoxScore - a.summary.totalKronoxScore;
  if (scoreDiff) return scoreDiff;

  const levelDiff = b.summary.currentLevel - a.summary.currentLevel;
  if (levelDiff) return levelDiff;

  const starsDiff = b.summary.totalStars - a.summary.totalStars;
  if (starsDiff) return starsDiff;

  const aTime = Number.isFinite(a.aggregateBestTimeSeconds) ? a.aggregateBestTimeSeconds : Infinity;
  const bTime = Number.isFinite(b.aggregateBestTimeSeconds) ? b.aggregateBestTimeSeconds : Infinity;
  const timeDiff = aTime - bTime;
  if (Number.isFinite(timeDiff) && timeDiff) return timeDiff;

  const bUpdated = Date.parse(b.updatedAt || '') || 0;
  const aUpdated = Date.parse(a.updatedAt || '') || 0;
  const updatedDiff = bUpdated - aUpdated;
  if (updatedDiff) return updatedDiff;

  return a.id.localeCompare(b.id, 'tr');
}

export function selectLeaderboardSections(rankedRows, currentOwnerKey, topLimit = LEADERBOARD_TOP_LIMIT) {
  const topRows = (rankedRows || []).slice(0, topLimit);
  const topIds = new Set(topRows.map((row) => row.id));
  const currentUserRow = (rankedRows || []).find((row) => row.ownerKey && row.ownerKey === currentOwnerKey) || null;
  const currentUserInTop = Boolean(currentUserRow && topIds.has(currentUserRow.id));
  const friendsOutsideTop = (rankedRows || [])
    .filter((row) => row.isFriend && !topIds.has(row.id))
    .slice(0, topLimit);

  return {
    topRows,
    currentUserRow,
    currentUserInTop,
    friendsOutsideTop,
  };
}