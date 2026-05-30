import { getSoloLevelCount, normalizeSoloProgress } from './soloLevels';
import { summarizeSoloProgress } from './soloProgressHelpers';

export const LEADERBOARD_TOP_LIMIT = 10;
export const LEADERBOARD_FETCH_LIMIT = 500;

export function normalizeLeaderboardEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function cleanDisplayText(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 28);
}

export function getSafeLeaderboardName(user) {
  const explicitName = [
    user?.full_name,
    user?.display_name,
    user?.username,
    user?.name,
  ].map(cleanDisplayText).find(Boolean);

  if (explicitName && !explicitName.includes('@')) return explicitName;

  const email = normalizeLeaderboardEmail(user?.email || user?.user_email);
  const localPart = cleanDisplayText(email.split('@')[0]);
  return localPart || 'Oyuncu';
}

export function getLeaderboardDiamondValue(user) {
  const candidates = [
    user?.diamonds,
    user?.diamondCount,
    user?.diamond_count,
    user?.elmas,
    user?.elmasCount,
    user?.elmas_count,
    user?.gems,
    user?.gemCount,
    user?.gem_count,
    user?.economy?.diamonds,
    user?.economy?.elmas,
    user?.wallet?.diamonds,
    user?.wallet?.elmas,
  ];
  const realValue = candidates.find((value) => (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value))
  ));
  return realValue === undefined ? 0 : Math.max(0, Math.floor(Number(realValue)));
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

export function toSoloLeaderboardEntry(user, friendEmailSet = new Set(), currentUserEmail = '') {
  const email = normalizeLeaderboardEmail(user?.email || user?.user_email);
  const identityKey = email || String(user?.id || user?._id || getSafeLeaderboardName(user)).toLowerCase();
  const progress = normalizeSoloProgress(user?.solo_progress);
  const summary = summarizeSoloProgress(progress, getSoloLevelCount());

  return {
    id: identityKey,
    email,
    displayName: getSafeLeaderboardName(user),
    initial: getSafeLeaderboardName(user).charAt(0).toLocaleUpperCase('tr-TR') || 'O',
    summary,
    aggregateBestTimeSeconds: getAggregateBestTimeSeconds(progress),
    isCurrentUser: Boolean(currentUserEmail && email && email === normalizeLeaderboardEmail(currentUserEmail)),
    isFriend: Boolean(email && friendEmailSet.has(email)),
  };
}

export function rankSoloLeaderboardUsers(users, friendEmails = [], currentUser = null) {
  const currentUserEmail = normalizeLeaderboardEmail(currentUser?.email || currentUser?.user_email);
  const friendEmailSet = new Set((friendEmails || []).map(normalizeLeaderboardEmail).filter(Boolean));
  const byIdentity = new Map();

  (users || []).forEach((user) => {
    const key = normalizeLeaderboardEmail(user?.email || user?.user_email) || String(user?.id || user?._id || '').toLowerCase();
    if (!key) return;
    byIdentity.set(key, user);
  });

  if (currentUserEmail) {
    byIdentity.set(currentUserEmail, currentUser);
  }

  const ranked = Array.from(byIdentity.values())
    .map((user) => toSoloLeaderboardEntry(user, friendEmailSet, currentUserEmail))
    .filter((entry) => entry.id)
    .sort((a, b) => {
      const scoreDiff = b.summary.totalSoloScore - a.summary.totalSoloScore;
      if (scoreDiff) return scoreDiff;

      const levelDiff = b.summary.currentLevel - a.summary.currentLevel;
      if (levelDiff) return levelDiff;

      const starsDiff = b.summary.totalStars - a.summary.totalStars;
      if (starsDiff) return starsDiff;

      const aTime = Number.isFinite(a.aggregateBestTimeSeconds) ? a.aggregateBestTimeSeconds : Infinity;
      const bTime = Number.isFinite(b.aggregateBestTimeSeconds) ? b.aggregateBestTimeSeconds : Infinity;
      const timeDiff = aTime - bTime;
      if (Number.isFinite(timeDiff) && timeDiff) return timeDiff;

      return a.id.localeCompare(b.id, 'tr');
    });

  return ranked.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function selectLeaderboardSections(rankedRows, currentUserEmail, topLimit = LEADERBOARD_TOP_LIMIT) {
  const topRows = (rankedRows || []).slice(0, topLimit);
  const topIds = new Set(topRows.map((row) => row.id));
  const normalizedCurrent = normalizeLeaderboardEmail(currentUserEmail);
  const currentUserRow = (rankedRows || []).find((row) => row.email && row.email === normalizedCurrent) || null;
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
