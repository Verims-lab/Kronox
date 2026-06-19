/**
 * getSoloLeaderboard
 *
 * Public-safe leaderboard projection for Kronox Puan.
 * Reads SoloLeaderboardEntry first and returns only rank-safe fields. A
 * bounded service-role User top-score repair window is used only server-side
 * to prevent stale/incomplete projection rows from lying about global rank;
 * full User rows never leave this function.
 * No raw email, notification settings, auth/private profile fields,
 * push/device data, or full User rows leave this function.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const DEFAULT_TOP_LIMIT = 10;
const MAX_TOP_LIMIT = 50;
const TOTAL_LEVELS = 20;
const PROJECTION_REPAIR_UPSERT_LIMIT = 50;
const USERNAME_PREFIX = 'KronoxUser';

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(raw: unknown) {
  return String(raw || '').trim().toLowerCase();
}

function ownerKeyFromEmail(rawEmail: unknown) {
  const email = normalizeEmail(rawEmail);
  if (!email) return '';

  let hash = 2166136261;
  for (let i = 0; i < email.length; i += 1) {
    hash ^= email.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function publicLeaderboardId(ownerKey: string) {
  const text = String(ownerKey || '').trim();
  if (!text) return '';
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `lb_${(hash >>> 0).toString(36)}`;
}

function makeKronoxUserFallback(seed: unknown = '') {
  const text = String(seed || '').trim();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${USERNAME_PREFIX}${1000 + ((hash >>> 0) % 90000)}`;
}

function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function onlineScoreFromUser(user: any) {
  return Math.max(0, Math.floor(finiteNumber(user?.online_progress?.score, 0)));
}

function cleanDisplayText(raw: unknown) {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 28);
}

function isSafePublicUsername(value: string) {
  return Boolean(
    value &&
    !value.includes('@') &&
    !/^(apple|google|firebase|auth0|base44|provider|uid)[\w:-]*$/i.test(value),
  );
}

function safePublicUsername(source: any, ownerKey: string) {
  const explicit = [
    source?.username,
    source?.public_username,
  ].map(cleanDisplayText).find(isSafePublicUsername);
  if (explicit) return explicit;

  // Legacy projection rows only have display_name. Treat that field as an
  // internal migration mirror, never as a returned public field.
  const legacyDisplayNameMigrationSource = cleanDisplayText(source?.display_name || source?.displayName);
  if (isSafePublicUsername(legacyDisplayNameMigrationSource)) return legacyDisplayNameMigrationSource;

  return makeKronoxUserFallback(ownerKey || source?.id || source?._id);
}


function initialFromName(displayName: string) {
  return cleanDisplayText(displayName).charAt(0).toLocaleUpperCase('tr-TR') || 'O';
}

function starBaseScore(stars: number, rulesVersion = 1) {
  if (rulesVersion >= 2) {
    if (stars >= 3) return 15;
    if (stars === 2) return 10;
    if (stars === 1) return 5;
    return 0;
  }
  if (stars >= 3) return 10;
  if (stars === 2) return 8;
  if (stars === 1) return 5;
  return 0;
}

function timeBonus(bestTimeSeconds: unknown, passed: boolean, rulesVersion = 1) {
  if (!passed) return 0;
  const seconds = Number(bestTimeSeconds);
  if (!Number.isFinite(seconds)) return 0;
  // Keep backend projection aligned with src/lib/soloProgressHelpers.
  // Stored bestScore is preferred; this fallback only derives missing
  // scores and preserves legacy entries unless soloRulesVersion >= 2.
  if (rulesVersion >= 2) {
    if (seconds <= 60) return 15;
    if (seconds <= 90) return 10;
    if (seconds <= 120) return 5;
    return 0;
  }
  if (seconds <= 60) return 10;
  if (seconds <= 90) return 5;
  return 0;
}

function scoreFromLevelEntry(entry: any) {
  const stars = Math.max(0, Math.floor(finiteNumber(entry?.bestStars, 0)));
  if (stars <= 0) return 0;
  const stored = Number(entry?.bestScore);
  if (Number.isFinite(stored) && stored >= 0) return Math.floor(stored);
  const rulesVersion = Math.max(1, Math.floor(finiteNumber(entry?.soloRulesVersion ?? entry?.rulesVersion, 1)));
  return starBaseScore(stars, rulesVersion) + timeBonus(entry?.bestTimeSeconds, true, rulesVersion);
}

function summarizeProgress(progress: any) {
  const levels = progress?.levels && typeof progress.levels === 'object' ? progress.levels : {};
  let totalSoloScore = 0;
  let totalStars = 0;
  let completedLevelCount = 0;
  let highestCompletedLevel = 0;
  let aggregateBestTimeSeconds = 0;
  let reliableTimeCount = 0;

  Object.entries(levels).forEach(([levelKey, entry]) => {
    const stars = Math.max(0, Math.floor(finiteNumber((entry as any)?.bestStars, 0)));
    if (stars <= 0) return;

    const levelNumber = Math.max(0, Math.floor(finiteNumber(levelKey, 0)));
    highestCompletedLevel = Math.max(highestCompletedLevel, levelNumber);
    completedLevelCount += 1;
    totalStars += stars;
    totalSoloScore += scoreFromLevelEntry(entry);

    const time = Number((entry as any)?.bestTimeSeconds);
    if (Number.isFinite(time)) {
      aggregateBestTimeSeconds += Math.max(0, time);
      reliableTimeCount += 1;
    }
  });

  const summary = progress?.summary && typeof progress.summary === 'object' ? progress.summary : {};
  const summaryScore = finiteNumber(summary.totalSoloScore, NaN);
  if (totalSoloScore <= 0 && Number.isFinite(summaryScore) && summaryScore > 0) {
    totalSoloScore = Math.floor(summaryScore);
  }

  const declaredCurrent = Math.max(
    1,
    Math.floor(finiteNumber(summary.currentLevel, 1)),
    Math.floor(finiteNumber(summary.unlockedLevel, 1)),
    Math.floor(finiteNumber(progress?.currentLevel, 1)),
  );
  const derivedCurrent = Math.min(TOTAL_LEVELS, Math.max(1, highestCompletedLevel + 1));
  const currentLevel = Math.max(declaredCurrent, derivedCurrent);

  return {
    totalSoloScore: Math.max(0, totalSoloScore),
    currentLevel,
    unlockedLevel: Math.max(currentLevel, Math.floor(finiteNumber(summary.unlockedLevel, currentLevel))),
    totalStars: Math.max(0, totalStars || finiteNumber(summary.totalStars, 0)),
    completedLevelCount: Math.max(0, completedLevelCount || finiteNumber(summary.completedLevelCount, 0)),
    aggregateBestTimeSeconds: reliableTimeCount > 0 ? aggregateBestTimeSeconds : null,
  };
}

function levelProjection(progress: any, levelNumber: number) {
  if (!levelNumber || levelNumber <= 0) return null;
  const entry = progress?.levels?.[String(levelNumber)];
  if (!entry) return null;
  const stars = Math.max(0, Math.floor(finiteNumber(entry?.bestStars, 0)));
  if (stars <= 0) return null;
  const time = Number(entry?.bestTimeSeconds);
  return {
    stars,
    best_time_seconds: Number.isFinite(time) ? time : null,
    best_score: scoreFromLevelEntry(entry),
  };
}

function toLeaderboardRow(user: any, levelNumber = 0) {
  const ownerKey = ownerKeyFromEmail(user?.email || user?.user_email);
  if (!ownerKey) return null;

  const summary = summarizeProgress(user?.solo_progress || {});
  const onlineScore = onlineScoreFromUser(user);
  const computedTotalKronoxScore = summary.totalSoloScore + onlineScore;
  const persistedTotal = finiteNumber(user?.kronox_puan_total, NaN);
  const totalKronoxScore = Number.isFinite(persistedTotal) && persistedTotal >= 0
    ? Math.max(Math.floor(persistedTotal), computedTotalKronoxScore)
    : computedTotalKronoxScore;
  const username = safePublicUsername(user, ownerKey);

  // Codex152 — Optional per-level projection. When the caller passes
  // `levelNumber`, the row carries the user's best time/score/stars for
  // that level (when they have completed it). This powers the Solo
  // success popup's "YENİ REKOR! / ARKADAŞLAR ARASINDA 1." badge logic
  // without leaking other private user data. The field is omitted when
  // the user has not completed that level.
  const levelData = levelProjection(user?.solo_progress, levelNumber);

  return {
    owner_key: ownerKey,
    username,
    display_name: username,
    initial: initialFromName(username),
    total_kronox_score: totalKronoxScore,
    total_solo_score: summary.totalSoloScore,
    online_score: onlineScore,
    current_level: summary.currentLevel,
    unlocked_level: summary.unlockedLevel,
    total_stars: summary.totalStars,
    completed_level_count: summary.completedLevelCount,
    ...(summary.aggregateBestTimeSeconds !== null
      ? { aggregate_best_time_seconds: summary.aggregateBestTimeSeconds }
      : {}),
    ...(levelData ? { level: levelData } : {}),
    updated_at: user?.updated_date || user?.updated_at || user?.created_date || new Date().toISOString(),
  };
}

function toProjectionLeaderboardRow(row: any) {
  const ownerKey = String(row?.owner_key || row?.ownerKey || '').trim();
  if (!ownerKey) return null;

  const username = safePublicUsername(row, ownerKey);
  const totalKronoxScore = Math.max(0, Math.floor(finiteNumber(row?.total_kronox_score ?? row?.totalKronoxScore, 0)));
  const totalSoloScore = Math.max(0, Math.floor(finiteNumber(row?.total_solo_score ?? row?.totalSoloScore, 0)));
  const onlineScore = Math.max(0, Math.floor(finiteNumber(row?.online_score ?? row?.onlineScore, 0)));
  const currentLevel = Math.max(1, Math.floor(finiteNumber(row?.current_level ?? row?.currentLevel, 1)));
  const unlockedLevel = Math.max(currentLevel, Math.floor(finiteNumber(row?.unlocked_level ?? row?.unlockedLevel, currentLevel)));
  const totalStars = Math.max(0, Math.floor(finiteNumber(row?.total_stars ?? row?.totalStars, 0)));
  const completedLevelCount = Math.max(0, Math.floor(finiteNumber(row?.completed_level_count ?? row?.completedLevelCount, 0)));
  const aggregateBestTimeSeconds = Number(row?.aggregate_best_time_seconds ?? row?.aggregateBestTimeSeconds);

  return {
    owner_key: ownerKey,
    username,
    display_name: username,
    initial: cleanDisplayText(row?.initial) || initialFromName(username),
    total_kronox_score: totalKronoxScore,
    total_solo_score: totalSoloScore,
    online_score: onlineScore,
    current_level: currentLevel,
    unlocked_level: unlockedLevel,
    total_stars: totalStars,
    completed_level_count: completedLevelCount,
    ...(Number.isFinite(aggregateBestTimeSeconds)
      ? { aggregate_best_time_seconds: Math.max(0, aggregateBestTimeSeconds) }
      : {}),
    updated_at: row?.updated_at || row?.updatedAt || row?.updated_date || row?.created_at || row?.created_date || new Date().toISOString(),
  };
}

async function backfillKronoxPuanProjection(base44: any, user: any, row: any) {
  const userId = user?.id || user?._id;
  if (!userId || !row) return false;
  const persistedTotal = finiteNumber(user?.kronox_puan_total, NaN);
  if (Number.isFinite(persistedTotal) && persistedTotal >= 0) return false;
  try {
    await base44.asServiceRole.entities.User.update(userId, {
      kronox_puan_total: Math.max(0, Math.floor(finiteNumber(row.total_kronox_score, 0))),
    });
    return true;
  } catch {
    // Best-effort projection backfill. The row still returns the computed
    // unified score; a later leaderboard read can retry the idempotent write.
    return false;
  }
}

function compareRows(a: any, b: any) {
  const scoreDiff = finiteNumber(b.total_kronox_score) - finiteNumber(a.total_kronox_score);
  if (scoreDiff) return scoreDiff;
  const levelDiff = finiteNumber(b.current_level) - finiteNumber(a.current_level);
  if (levelDiff) return levelDiff;
  const starsDiff = finiteNumber(b.total_stars) - finiteNumber(a.total_stars);
  if (starsDiff) return starsDiff;
  const aTime = Number.isFinite(Number(a.aggregate_best_time_seconds)) ? Number(a.aggregate_best_time_seconds) : Infinity;
  const bTime = Number.isFinite(Number(b.aggregate_best_time_seconds)) ? Number(b.aggregate_best_time_seconds) : Infinity;
  const timeDiff = aTime - bTime;
  if (Number.isFinite(timeDiff) && timeDiff) return timeDiff;
  const updatedDiff = (Date.parse(b.updated_at || '') || 0) - (Date.parse(a.updated_at || '') || 0);
  if (updatedDiff) return updatedDiff;
  return String(a.owner_key || '').localeCompare(String(b.owner_key || ''), 'tr');
}

function dedupeProjectionRows(rows: any[] = []) {
  const byOwnerKey = new Map<string, any>();
  for (const row of rows || []) {
    const ownerKey = String(row?.owner_key || '').trim();
    if (!ownerKey) continue;
    const current = byOwnerKey.get(ownerKey);
    if (!current || compareRows(row, current) < 0) {
      byOwnerKey.set(ownerKey, row);
    }
  }
  return Array.from(byOwnerKey.values()).sort(compareRows);
}

function isPositiveScoreRow(row: any) {
  return finiteNumber(row?.total_kronox_score, 0) > 0;
}

function buildProjectionWritePayload(row: any) {
  const ownerKey = String(row?.owner_key || '').trim();
  const username = safePublicUsername(row, ownerKey);
  return {
    owner_key: ownerKey,
    display_name: username,
    initial: cleanDisplayText(row?.initial).slice(0, 1) || initialFromName(username),
    total_kronox_score: Math.max(0, Math.floor(finiteNumber(row?.total_kronox_score, 0))),
    total_solo_score: Math.max(0, Math.floor(finiteNumber(row?.total_solo_score, 0))),
    online_score: Math.max(0, Math.floor(finiteNumber(row?.online_score, 0))),
    current_level: Math.max(1, Math.floor(finiteNumber(row?.current_level, 1))),
    unlocked_level: Math.max(1, Math.floor(finiteNumber(row?.unlocked_level, row?.current_level || 1))),
    total_stars: Math.max(0, Math.floor(finiteNumber(row?.total_stars, 0))),
    completed_level_count: Math.max(0, Math.floor(finiteNumber(row?.completed_level_count, 0))),
    ...(Number.isFinite(Number(row?.aggregate_best_time_seconds))
      ? { aggregate_best_time_seconds: Math.max(0, Number(row.aggregate_best_time_seconds)) }
      : {}),
    updated_at: new Date().toISOString(),
  };
}

async function upsertSoloLeaderboardProjection(base44: any, row: any) {
  const entity = base44?.asServiceRole?.entities?.SoloLeaderboardEntry;
  const ownerKey = String(row?.owner_key || '').trim();
  if (!entity?.filter || !entity?.update || !entity?.create || !ownerKey) return 'skipped';

  const payload = buildProjectionWritePayload(row);
  const existing = await entity.filter({ owner_key: ownerKey }, '-updated_at', 1).catch(() => []);
  const existingId = existing?.[0]?.id;
  if (existingId) {
    await entity.update(existingId, payload);
    return 'updated';
  }
  await entity.create(payload);
  return 'created';
}

function selectNonDestructiveRepairRows(projectionRows: any[] = [], userRows: any[] = []) {
  const projectionByOwner = new Map(dedupeProjectionRows(projectionRows)
    .map((row) => [String(row?.owner_key || '').trim(), row]));

  return dedupeProjectionRows(userRows)
    .filter(isPositiveScoreRow)
    .filter((row) => {
      const ownerKey = String(row?.owner_key || '').trim();
      const projected = projectionByOwner.get(ownerKey);
      if (!projected) return true;
      return finiteNumber(row?.total_kronox_score, 0) >= finiteNumber(projected?.total_kronox_score, 0);
    });
}

async function repairSoloLeaderboardProjection(base44: any, projectionRows: any[] = [], userRows: any[] = []) {
  const candidates = selectNonDestructiveRepairRows(projectionRows, userRows)
    .slice(0, PROJECTION_REPAIR_UPSERT_LIMIT);
  let created = 0;
  let updated = 0;
  let failed = 0;

  await Promise.all(candidates.map(async (row) => {
    try {
      const result = await upsertSoloLeaderboardProjection(base44, row);
      if (result === 'created') created += 1;
      if (result === 'updated') updated += 1;
    } catch {
      failed += 1;
    }
  }));

  return {
    attempted: candidates.length,
    created,
    updated,
    failed,
  };
}

function projectionFreshness(rows: any[] = []) {
  const timestamps = (rows || [])
    .map((row) => Date.parse(row?.updated_at || row?.updatedAt || row?.updated_date || row?.created_at || row?.created_date || ''))
    .filter((value) => Number.isFinite(value));
  if (!timestamps.length) {
    return {
      newestUpdatedAt: null,
      oldestUpdatedAt: null,
    };
  }
  return {
    newestUpdatedAt: new Date(Math.max(...timestamps)).toISOString(),
    oldestUpdatedAt: new Date(Math.min(...timestamps)).toISOString(),
  };
}

function findProjectionRepairReason(projectionRows: any[], userRows: any[], topLimit: number) {
  const projectionTop = dedupeProjectionRows(projectionRows).slice(0, topLimit);
  const userTop = dedupeProjectionRows(userRows).filter(isPositiveScoreRow).slice(0, topLimit);
  const projectionByOwner = new Map(projectionRows.map((row) => [String(row?.owner_key || '').trim(), row]));

  if (!projectionTop.length && userTop.length) return 'projection_empty_with_positive_user_scores';
  if (projectionTop.filter(isPositiveScoreRow).length < Math.min(topLimit, userTop.length)) {
    return 'projection_missing_positive_top_rows';
  }

  for (const userRow of userTop) {
    const ownerKey = String(userRow?.owner_key || '').trim();
    const projected = projectionByOwner.get(ownerKey);
    if (!projected) return 'positive_user_score_missing_from_projection';
    if (finiteNumber(userRow?.total_kronox_score, 0) > finiteNumber(projected?.total_kronox_score, 0)) {
      return 'projection_score_stale_below_user_score';
    }
    if (finiteNumber(userRow?.total_kronox_score, 0) < finiteNumber(projected?.total_kronox_score, 0)) {
      return 'projection_score_stale_above_user_score';
    }
  }

  return null;
}

function mergeProjectionAndUserScoreRows(projectionRows: any[], userRows: any[]) {
  const byOwnerKey = new Map<string, any>();
  for (const row of dedupeProjectionRows(projectionRows)) {
    const ownerKey = String(row?.owner_key || '').trim();
    if (ownerKey) byOwnerKey.set(ownerKey, row);
  }

  // User.kronox_puan_total is a persisted score projection and solo_progress
  // can reconstruct it when the field was accidentally zeroed. Prefer the
  // User-derived row only when it is at least as high as the public projection.
  // If User/Profile data looks reset while SoloLeaderboardEntry still has a
  // higher score, keep the projection row and surface diagnostics for manual
  // recovery instead of down-writing a possible recovery signal.
  for (const row of dedupeProjectionRows(userRows)) {
    const ownerKey = String(row?.owner_key || '').trim();
    if (!ownerKey) continue;
    const projected = byOwnerKey.get(ownerKey);
    if (!projected || finiteNumber(row?.total_kronox_score, 0) >= finiteNumber(projected?.total_kronox_score, 0)) {
      byOwnerKey.set(ownerKey, row);
    }
  }

  return Array.from(byOwnerKey.values()).sort(compareRows);
}

function scoreSourceMismatchSummary(projectionRows: any[], userRows: any[]) {
  const projectionByOwner = new Map(dedupeProjectionRows(projectionRows)
    .map((row) => [String(row?.owner_key || '').trim(), row]));
  const mismatches = dedupeProjectionRows(userRows)
    .map((row) => {
      const ownerKey = String(row?.owner_key || '').trim();
      const projected = projectionByOwner.get(ownerKey);
      if (!ownerKey || !projected) return null;
      const userScore = finiteNumber(row?.total_kronox_score, 0);
      const projectionScore = finiteNumber(projected?.total_kronox_score, 0);
      if (userScore === projectionScore) return null;
      return {
        leaderboard_id: publicLeaderboardId(ownerKey),
        userScore,
        projectionScore,
        direction: userScore > projectionScore ? 'user_above_projection' : 'projection_above_user',
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  return {
    count: mismatches.length,
    projectionAboveUserCount: mismatches.filter((row) => row.direction === 'projection_above_user').length,
    userAboveProjectionCount: mismatches.filter((row) => row.direction === 'user_above_projection').length,
    sample: mismatches.slice(0, 10),
  };
}

function decorateRows(rows: any[] = [], currentOwnerKey = '', friendOwnerKeys = new Set<string>()) {
  return rows.map((row, index) => {
    const ownerKey = String(row?.owner_key || '').trim();
    return {
      ...row,
      rank: index + 1,
      isCurrentUser: Boolean(currentOwnerKey && ownerKey === currentOwnerKey),
      isFriend: Boolean(ownerKey && friendOwnerKeys.has(ownerKey)),
    };
  });
}

function toPublicLeaderboardRow(row: any) {
  const ownerKey = String(row?.owner_key || '').trim();
  const leaderboardId = publicLeaderboardId(ownerKey);
  if (!leaderboardId) return null;
  const username = safePublicUsername(row, ownerKey);
  const rank = Number(row?.rank);
  const aggregateBestTimeSeconds = Number(row?.aggregate_best_time_seconds);
  return {
    id: leaderboardId,
    leaderboard_id: leaderboardId,
    username,
    publicName: username,
    initial: cleanDisplayText(row?.initial).slice(0, 1) || initialFromName(username),
    total_kronox_score: Math.max(0, Math.floor(finiteNumber(row?.total_kronox_score, 0))),
    total_solo_score: Math.max(0, Math.floor(finiteNumber(row?.total_solo_score, 0))),
    online_score: Math.max(0, Math.floor(finiteNumber(row?.online_score, 0))),
    current_level: Math.max(1, Math.floor(finiteNumber(row?.current_level, 1))),
    unlocked_level: Math.max(1, Math.floor(finiteNumber(row?.unlocked_level, row?.current_level || 1))),
    total_stars: Math.max(0, Math.floor(finiteNumber(row?.total_stars, 0))),
    completed_level_count: Math.max(0, Math.floor(finiteNumber(row?.completed_level_count, 0))),
    ...(Number.isFinite(aggregateBestTimeSeconds)
      ? { aggregate_best_time_seconds: Math.max(0, aggregateBestTimeSeconds) }
      : {}),
    ...(row?.level ? { level: row.level } : {}),
    ...(Number.isFinite(rank) ? { rank: Math.max(1, Math.floor(rank)) } : {}),
    isCurrentUser: row?.isCurrentUser === true,
    isFriend: row?.isFriend === true,
    updated_at: row?.updated_at || row?.updatedAt || row?.updated_date || row?.created_at || row?.created_date || new Date().toISOString(),
  };
}

function toPublicLeaderboardRows(rows: any[] = []) {
  return (rows || []).map((row) => toPublicLeaderboardRow(row)).filter(Boolean);
}

function compactRows(rows: any[] = []) {
  const byOwnerKey = new Map<string, any>();
  for (const row of rows || []) {
    const ownerKey = String(row?.owner_key || '').trim();
    if (!ownerKey || byOwnerKey.has(ownerKey)) continue;
    byOwnerKey.set(ownerKey, row);
  }
  return Array.from(byOwnerKey.values()).sort((a, b) => finiteNumber(a?.rank, Number.MAX_SAFE_INTEGER) - finiteNumber(b?.rank, Number.MAX_SAFE_INTEGER));
}

async function loadAcceptedFriendOwnerKeys(base44: any, email: string) {
  const friendEntity = base44?.asServiceRole?.entities?.FriendRequest || base44?.entities?.FriendRequest;
  if (!friendEntity?.filter || !email) return [];
  const [outgoing, incoming] = await Promise.all([
    friendEntity.filter({ from_email: email, status: 'accepted' }, '-updated_date', 200).catch(() => []),
    friendEntity.filter({ to_email: email, status: 'accepted' }, '-updated_date', 200).catch(() => []),
  ]);
  return Array.from(new Set([
    ...(Array.isArray(outgoing) ? outgoing : []).map((row: any) => ownerKeyFromEmail(row?.to_email)),
    ...(Array.isArray(incoming) ? incoming : []).map((row: any) => ownerKeyFromEmail(row?.from_email)),
  ].filter(Boolean)));
}

async function loadCurrentProjectionRow(base44: any, currentOwnerKey: string) {
  const projectionEntity = base44?.asServiceRole?.entities?.SoloLeaderboardEntry;
  if (!projectionEntity?.filter || !currentOwnerKey) return null;
  const rows = await projectionEntity
    .filter({ owner_key: currentOwnerKey }, '-total_kronox_score', 5)
    .catch(() => []);
  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row) => toProjectionLeaderboardRow(row))
    .filter(Boolean);
  return dedupeProjectionRows(normalized)[0] || null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Math.floor(finiteNumber(body?.limit, DEFAULT_LIMIT))),
    );
    const topLimit = Math.min(
      MAX_TOP_LIMIT,
      Math.max(1, Math.floor(finiteNumber(body?.topLimit, DEFAULT_TOP_LIMIT))),
    );
    // Codex152 — Optional per-level projection request from the Solo
    // success popup. Ignored when 0/absent (default leaderboard usage).
    const levelNumber = Math.max(0, Math.floor(finiteNumber(body?.levelNumber, 0)));

    if (!levelNumber) {
      const currentOwnerKey = ownerKeyFromEmail(user?.email || user?.user_email);
      const friendUserKeys = await loadAcceptedFriendOwnerKeys(base44, normalizeEmail(user?.email));
      const friendOwnerKeySet = new Set(friendUserKeys);
      const projectionEntity = base44?.asServiceRole?.entities?.SoloLeaderboardEntry;
      const projectionRows = projectionEntity?.list
        ? await projectionEntity.list('-total_kronox_score', limit).catch(() => [])
        : [];
      const projectionWindowRows = dedupeProjectionRows((Array.isArray(projectionRows) ? projectionRows : [])
        .map((row) => toProjectionLeaderboardRow(row))
        .filter(Boolean));
      const userRows = await base44.asServiceRole.entities.User
        .list('-kronox_puan_total', limit)
        .catch(() => []);
      const userScoreRows = dedupeProjectionRows((Array.isArray(userRows) ? userRows : [])
        .map((row) => toLeaderboardRow(row, 0))
        .filter(Boolean));
      const fallbackReason = findProjectionRepairReason(projectionWindowRows, userScoreRows, topLimit);
      const fallbackUsed = Boolean(fallbackReason);
      const rankedWindowRows = mergeProjectionAndUserScoreRows(projectionWindowRows, userScoreRows).slice(0, limit);
      const backfillResult = fallbackUsed
        ? await repairSoloLeaderboardProjection(base44, projectionWindowRows, userScoreRows)
        : { attempted: 0, created: 0, updated: 0, failed: 0 };
      const scoreSourceMismatches = scoreSourceMismatchSummary(projectionWindowRows, userScoreRows);
      const decoratedRows = decorateRows(rankedWindowRows, currentOwnerKey, friendOwnerKeySet);
      const positiveDecoratedRows = decoratedRows.filter(isPositiveScoreRow);
      const zeroDecoratedRows = decoratedRows.filter((row) => !isPositiveScoreRow(row));
      const topRows = [
        ...positiveDecoratedRows,
        ...zeroDecoratedRows,
      ].slice(0, topLimit);
      const topOwnerKeys = new Set(topRows.map((row) => row.owner_key).filter(Boolean));
      const currentInWindow = decoratedRows.find((row) => row.owner_key === currentOwnerKey) || null;
      const fetchedCurrentRow = currentInWindow
        ? null
        : await loadCurrentProjectionRow(base44, currentOwnerKey);
      const currentUserRow = currentInWindow || (fetchedCurrentRow
        ? { ...fetchedCurrentRow, rank: null, isCurrentUser: true, isFriend: false }
        : null);
      const friendsOutsideTop = decoratedRows
        .filter((row) => row.isFriend && !topOwnerKeys.has(row.owner_key))
        .slice(0, topLimit);
      const compactResponseRows = compactRows([
        ...topRows,
        ...(currentUserRow ? [currentUserRow] : []),
        ...friendsOutsideTop,
      ]);
      const publicTopRows = toPublicLeaderboardRows(topRows);
      const publicCurrentUserRow = currentUserRow ? toPublicLeaderboardRow(currentUserRow) : null;
      const publicFriendsOutsideTop = toPublicLeaderboardRows(friendsOutsideTop);
      const publicCompactResponseRows = toPublicLeaderboardRows(compactResponseRows);
      const currentUserRank = Number.isFinite(Number(currentUserRow?.rank))
        ? Math.max(1, Math.floor(Number(currentUserRow.rank)))
        : null;
      const rankConfidence = currentUserRank
        ? 'exact'
        : (fallbackUsed ? 'fallback' : (currentUserRow ? 'limited' : 'stale_projection'));
      const rankScope = currentUserRank
        ? 'global'
        : (currentUserRow ? 'projection_limited' : (fallbackUsed ? 'fallback' : 'projection_limited'));
      const positiveScoreRowsRead = rankedWindowRows.filter(isPositiveScoreRow).length;
      const zeroScoreRowsRead = rankedWindowRows.filter((row) => !isPositiveScoreRow(row)).length;

      return json({
        ok: true,
        source: fallbackUsed
          ? 'SoloLeaderboardEntry_with_user_score_repair'
          : 'SoloLeaderboardEntry',
        projectionSource: 'solo_leaderboard_entry_projection',
        projection: 'solo_leaderboard_entry_total_kronox_score_projection',
        projectionFirst: true,
        broadUserListUsed: true,
        broadUserRowsReturned: false,
        serverSideUserRepairUsed: fallbackUsed,
        topRows: publicTopRows,
        currentUserRow: publicCurrentUserRow,
        currentUserRank,
        currentUserInTop: Boolean(currentUserRank && currentUserRank <= topLimit),
        friendsOutsideTop: publicFriendsOutsideTop,
        friendCount: friendUserKeys.length,
        generatedAt: new Date().toISOString(),
        rankConfidence,
        rankScope,
        limitedRankBeforeExact: true,
        rankWindowLimit: limit,
        topLimit,
        projectionRowsRead: Array.isArray(projectionRows) ? projectionRows.length : 0,
        userScoreRowsRead: userScoreRows.length,
        positiveScoreRowsRead,
        zeroScoreRowsRead,
        topRowsCount: topRows.length,
        fallbackUsed,
        fallbackReason,
        backfillRun: fallbackUsed,
        backfillQueued: false,
        backfillResult,
        scoreSourceMismatches,
        sourceScoreRepairMode: 'non_destructive_positive_user_rows_only',
        projectionFreshness: projectionFreshness(projectionWindowRows),
        rows: publicCompactResponseRows,
      });
    }

    // Codex366 — Per-level friend-record lookup still needs User.solo_progress
    // until SoloLeaderboardEntry grows a rank-safe per-level projection. This
    // fallback is not used by the main Liderlik table.
    const users = await base44.asServiceRole.entities.User.list('-kronox_puan_total', MAX_LIMIT);
    const rowPairs = (users || [])
      .map((u) => ({ user: u, row: toLeaderboardRow(u, levelNumber) }))
      .filter((entry) => Boolean(entry.row));

    await Promise.all(
      rowPairs
        .filter(({ user }) => !Number.isFinite(Number(user?.kronox_puan_total)))
        .slice(0, 25)
        .map(({ user, row }) => backfillKronoxPuanProjection(base44, user, row)),
    );

    const rows = rowPairs
      .map(({ row }) => row)
      .sort(compareRows)
      .slice(0, limit);

    return json({
      ok: true,
      // Codex169 — Public-safe service-role projection signal. Solo +
      // Online are unified server-side into total_kronox_score; only
      // rank-safe fields leave this function.
      source: 'user_kronox_puan_service_role_level_fallback',
      // Codex170 — Named persisted unified projection contract. The rows
      // are sorted by the persisted User.kronox_puan_total field
      // (user_kronox_puan_total_projection) which already represents
      // unified Kronox Puan (Solo component + Online score), so the public
      // leaderboard never ranks/returns raw private User rows or emails.
      projection: 'user_kronox_puan_total_projection_level_fallback',
      projectionFirst: false,
      broadUserListUsed: true,
      fallbackReason: 'level_projection_requires_user_solo_progress',
      rows: toPublicLeaderboardRows(rows),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown getSoloLeaderboard error';
    return json({ ok: false, error: message }, 500);
  }
});
