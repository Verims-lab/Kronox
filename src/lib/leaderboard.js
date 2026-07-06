import { base44 } from '@/api/base44Client';
import { backfillSoloScores, summarizeSoloProgress } from './soloProgressHelpers';
import { getDiamondBalance } from './diamondEconomy';
import { isSafePublicUsername, resolveSafePublicUsername } from './guestProfile';
import { getKronoxUserId } from './kronoxUserId';
import { getKronoxVisibleScore } from './kronoxScore';
import { pickPublicAvatarFields } from './avatarOptions';

export const LEADERBOARD_TOP_LIMIT = 10;
export const LEADERBOARD_FETCH_LIMIT = 100;
export const LEADERBOARD_CACHE_STALE_MS = 45 * 1000;
export const LEADERBOARD_FAST_SNAPSHOT_OPTIONS = Object.freeze({
  repairMode: 'skip',
  includeFriendBadges: false,
});
export const LEADERBOARD_SOLO_LEVEL_COUNT = 20;
const SOLO_LEADERBOARD_ENTITY = 'SoloLeaderboardEntry';
const leaderboardSnapshotCache = new Map();

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

export function getGuestLeaderboardOwnerKey(rawGuestId) {
  const guestId = String(rawGuestId || '').trim().toLowerCase();
  if (!guestId) return '';

  let hash = 2166136261;
  for (let i = 0; i < guestId.length; i += 1) {
    hash ^= guestId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `g_${(hash >>> 0).toString(36)}`;
}

function cleanDisplayText(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 28);
}

export function getSafeLeaderboardName(userOrEntry) {
  const explicitName = [
    userOrEntry?.username,
    userOrEntry?.public_username,
    userOrEntry?.publicName,
  ].map(cleanDisplayText).find(isSafePublicUsername);
  const ownerKey = String(userOrEntry?.owner_key || getLeaderboardOwnerKey(userOrEntry?.email || userOrEntry?.user_email));
  return resolveSafePublicUsername(explicitName, ownerKey || userOrEntry?.id || userOrEntry?._id);
}

export function getLeaderboardDiamondValue(user) {
  return getDiamondBalance(user);
}

export function getLeaderboardSnapshotCacheKey(ownerKey = '') {
  const key = String(ownerKey || '').trim();
  if (key.startsWith('leaderboard:')) return key;
  return key ? `leaderboard:${key}` : 'leaderboard:anonymous';
}

export function getPublicLeaderboardId(ownerKey = '') {
  const text = String(ownerKey || '').trim();
  if (!text) return '';
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `lb_${(hash >>> 0).toString(36)}`;
}

export function getCachedSoloLeaderboardSnapshot(cacheKey, now = Date.now()) {
  const key = getLeaderboardSnapshotCacheKey(cacheKey);
  const cached = leaderboardSnapshotCache.get(key);
  if (!cached) return null;
  if (now - cached.cachedAt > LEADERBOARD_CACHE_STALE_MS) {
    leaderboardSnapshotCache.delete(key);
    return null;
  }
  return cached.snapshot || null;
}

export function setCachedSoloLeaderboardSnapshot(cacheKey, snapshot, now = Date.now()) {
  const key = getLeaderboardSnapshotCacheKey(cacheKey);
  if (!snapshot || typeof snapshot !== 'object') return null;
  leaderboardSnapshotCache.set(key, { cachedAt: now, snapshot });
  return snapshot;
}

export function normalizeLeaderboardRank(value) {
  if (value === null || value === undefined) return null;
  const raw = typeof value === 'string' ? value.trim() : value;
  if (raw === '') return null;
  const rank = Number(raw);
  return Number.isFinite(rank) && rank >= 1 ? Math.floor(rank) : null;
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
  const totalKronoxScore = getKronoxVisibleScore(user, {
    soloProgress: normalizedProgress,
    totalLevels,
  });
  const displayName = getSafeLeaderboardName(user);
  const aggregateBestTimeSeconds = getAggregateBestTimeSeconds(normalizedProgress);

  return {
    owner_key: ownerKey,
    ...(getKronoxUserId(user) ? { kronox_user_id: getKronoxUserId(user) } : {}),
    username: displayName,
    display_name: displayName,
    initial: initialFromName(displayName),
    ...pickPublicAvatarFields(user),
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

export function buildGuestSoloLeaderboardPayload(guestProfile, progress, totalLevels = LEADERBOARD_SOLO_LEVEL_COUNT) {
  const ownerKey = getGuestLeaderboardOwnerKey(guestProfile?.guest_id);
  const normalizedProgress = normalizeSoloProgressForLeaderboard(progress || guestProfile?.solo_progress, totalLevels);
  const summary = summarizeSoloProgress(normalizedProgress, totalLevels);
  const totalSoloScore = Math.max(0, Number(summary.totalSoloScore) || 0);
  const totalKronoxScore = getKronoxVisibleScore(guestProfile, {
    soloProgress: normalizedProgress,
    totalLevels,
  });
  const displayName = getSafeLeaderboardName({
    ...guestProfile,
    owner_key: ownerKey,
  });
  const aggregateBestTimeSeconds = getAggregateBestTimeSeconds(normalizedProgress);

  return {
    owner_key: ownerKey,
    ...(getKronoxUserId(guestProfile) ? { kronox_user_id: getKronoxUserId(guestProfile) } : {}),
    username: displayName,
    display_name: displayName,
    initial: initialFromName(displayName),
    ...pickPublicAvatarFields(guestProfile),
    total_kronox_score: totalKronoxScore,
    total_solo_score: totalSoloScore,
    online_score: 0,
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
    const created = await base44.entities.SoloLeaderboardEntry.create(payload);
    // Re-read after write: if a concurrent publish raced this create, converge
    // on the canonical (newest-updated) row for this owner_key instead of
    // treating the extra row as authoritative. getSoloLeaderboard additionally
    // dedupes owner_key rows server-side as the read-time safety fallback.
    const confirmed = await base44.entities.SoloLeaderboardEntry.filter(
      { owner_key: payload.owner_key },
      '-updated_at',
      5,
    ).catch(() => null);
    return confirmed?.[0] || created;
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

export async function loadSoloLeaderboardSnapshot(options = {}) {
  const limit = Math.max(1, Math.floor(Number(options.limit) || LEADERBOARD_FETCH_LIMIT));
  const topLimit = Math.max(1, Math.floor(Number(options.topLimit) || LEADERBOARD_TOP_LIMIT));
  const requestPayload = {
    ...(options.payload && typeof options.payload === 'object' ? options.payload : {}),
    limit,
    topLimit,
    ...(options.repairMode ? { repairMode: options.repairMode } : {}),
    ...(options.includeFriendBadges === false ? { includeFriendBadges: false } : {}),
  };
  try {
    const response = await base44.functions.invoke('getSoloLeaderboard', requestPayload);
    const payload = response?.data || response || {};
    const topRows = Array.isArray(payload.topRows) ? payload.topRows : [];
    const rows = Array.isArray(payload.rows) ? payload.rows : topRows;
    if (topRows.length || rows.length || payload.source) {
      return {
        ok: payload.ok !== false,
        source: payload.source || 'SoloLeaderboardEntry',
        projection: payload.projection || '',
        generatedAt: payload.generatedAt || '',
        topRows,
        rows,
        currentUserRow: payload.currentUserRow || null,
        currentUserRank: normalizeLeaderboardRank(payload.currentUserRank),
        currentUserInTop: Boolean(payload.currentUserInTop),
        friendUserKeys: Array.isArray(payload.friendUserKeys) ? payload.friendUserKeys : [],
        friendsOutsideTop: Array.isArray(payload.friendsOutsideTop) ? payload.friendsOutsideTop : [],
        friendCount: Math.max(0, Number(payload.friendCount) || 0),
        rankConfidence: payload.rankConfidence || '',
        rankScope: payload.rankScope || '',
        projectionFirst: payload.projectionFirst === true,
        broadUserListUsed: payload.broadUserListUsed === true,
        broadUserRowsReturned: payload.broadUserRowsReturned === true,
        serverSideUserRepairUsed: payload.serverSideUserRepairUsed === true,
        repairMode: payload.repairMode || '',
        repairSkipped: payload.repairSkipped === true,
        friendBadgesDeferred: payload.friendBadgesDeferred === true,
        fallbackUsed: payload.fallbackUsed === true,
        fallbackReason: payload.fallbackReason || null,
        projectionRowsRead: Number.isFinite(Number(payload.projectionRowsRead))
          ? Math.max(0, Math.floor(Number(payload.projectionRowsRead)))
          : null,
        positiveScoreRowsRead: Number.isFinite(Number(payload.positiveScoreRowsRead))
          ? Math.max(0, Math.floor(Number(payload.positiveScoreRowsRead)))
          : null,
        zeroScoreRowsRead: Number.isFinite(Number(payload.zeroScoreRowsRead))
          ? Math.max(0, Math.floor(Number(payload.zeroScoreRowsRead)))
          : null,
      };
    }
  } catch {
    // Fall through to the legacy compact client fallback for older deployments.
  }

  const rows = await loadSoloLeaderboardEntries(limit);
  return {
    ok: true,
    source: 'SoloLeaderboardEntry.client_fallback',
    projection: 'solo_leaderboard_entry_total_kronox_score_projection',
    generatedAt: new Date().toISOString(),
    topRows: [],
    rows,
    currentUserRow: null,
    currentUserRank: null,
    currentUserInTop: false,
    friendUserKeys: [],
    friendsOutsideTop: [],
    friendCount: 0,
    rankConfidence: 'client_projection_fallback',
    rankScope: `top_${limit}_client_projection_window`,
    projectionFirst: true,
    broadUserListUsed: false,
    broadUserRowsReturned: false,
    serverSideUserRepairUsed: false,
    fallbackUsed: true,
    fallbackReason: 'client_projection_entity_fallback',
    projectionRowsRead: rows.length,
    positiveScoreRowsRead: null,
    zeroScoreRowsRead: null,
  };
}

export function getFriendLeaderboardKeys(friendEmails = []) {
  return new Set(
    (friendEmails || [])
      .map(getLeaderboardOwnerKey)
      .filter(Boolean),
  );
}

function hasPublicAvatar(avatar) {
  return Boolean(
    (avatar?.avatar_type === 'photo' && avatar.avatar_url) ||
    (avatar?.avatar_type === 'icon' && avatar.avatar_icon_id),
  );
}

export function mergeLeaderboardAvatarFields(row, avatarSource) {
  if (!row || !avatarSource) return row;
  const avatar = pickPublicAvatarFields(avatarSource);
  if (!hasPublicAvatar(avatar)) return row;
  return {
    ...row,
    ...avatar,
  };
}

export function getFriendLeaderboardAvatarMap(friends = []) {
  const avatarByLeaderboardId = new Map();
  (Array.isArray(friends) ? friends : []).forEach((friend) => {
    const ownerKey = getLeaderboardOwnerKey(friend?.friend_email || friend?.email || friend?.user_email);
    const leaderboardId = getPublicLeaderboardId(ownerKey);
    const avatar = pickPublicAvatarFields(friend);
    if (leaderboardId && hasPublicAvatar(avatar)) {
      avatarByLeaderboardId.set(leaderboardId, avatar);
    }
  });
  return avatarByLeaderboardId;
}

export function toSoloLeaderboardEntry(publicRow, friendKeySet = new Set(), currentOwnerKey = '') {
  const ownerKey = String(publicRow?.owner_key || '').trim();
  const publicId = String(
    publicRow?.leaderboard_id ||
    publicRow?.leaderboardId ||
    publicRow?.public_id ||
    publicRow?.id ||
    '',
  ).trim();
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
    id: publicId || ownerKey || String(publicRow?._id || displayName).toLowerCase(),
    ownerKey,
    displayName,
    initial: cleanDisplayText(publicRow?.initial).slice(0, 1) || initialFromName(displayName),
    ...pickPublicAvatarFields(publicRow),
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
    isCurrentUser: publicRow?.isCurrentUser === true || Boolean(currentOwnerKey && ownerKey && ownerKey === currentOwnerKey),
    isFriend: publicRow?.isFriend === true || Boolean(ownerKey && friendKeySet.has(ownerKey)),
  };
}

export function rankSoloLeaderboardEntries(publicRows, friendKeys = new Set(), currentOwnerKey = '') {
  const byOwnerKey = new Map();

  (publicRows || []).forEach((row) => {
    const ownerKey = String(row?.owner_key || row?.leaderboard_id || row?.leaderboardId || row?.id || '').trim();
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
  const currentUserRow = (rankedRows || []).find((row) => row.isCurrentUser || (row.ownerKey && row.ownerKey === currentOwnerKey)) || null;
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
