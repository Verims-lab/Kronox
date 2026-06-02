/**
 * getSoloLeaderboard
 *
 * Public-safe leaderboard projection for Kronox Puan.
 * Reads User.solo_progress + User.online_progress with service role, but
 * returns only rank-safe fields. No raw email, notification settings,
 * auth/private profile fields, push/device data, or full User rows leave
 * this function.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 500;
const TOTAL_LEVELS = 20;

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

function safeDisplayName(user: any, ownerKey: string) {
  const explicit = [
    user?.display_name,
    user?.full_name,
    user?.displayName,
    user?.username,
    user?.name,
  ].map(cleanDisplayText).find((value) => value && !value.includes('@'));

  if (explicit) return explicit;
  const suffix = ownerKey ? ownerKey.slice(-4).toLocaleUpperCase('tr-TR') : '';
  return suffix ? `Oyuncu ${suffix}` : 'Oyuncu';
}

function initialFromName(displayName: string) {
  return cleanDisplayText(displayName).charAt(0).toLocaleUpperCase('tr-TR') || 'O';
}

function starBaseScore(stars: number) {
  if (stars >= 3) return 10;
  if (stars === 2) return 8;
  if (stars === 1) return 5;
  return 0;
}

function timeBonus(bestTimeSeconds: unknown, passed: boolean) {
  if (!passed) return 0;
  const seconds = Number(bestTimeSeconds);
  if (!Number.isFinite(seconds)) return 0;
  // Codex139 — Keep backend projection aligned with
  // src/lib/soloProgressHelpers.calculateSoloTimeBonus and
  // docs/KRONOX_SCORING_RULES.md §2.4: 60.0s belongs to the +10 tier.
  if (seconds <= 60) return 10;
  if (seconds <= 90) return 5;
  return 0;
}

function scoreFromLevelEntry(entry: any) {
  const stars = Math.max(0, Math.floor(finiteNumber(entry?.bestStars, 0)));
  if (stars <= 0) return 0;
  const stored = Number(entry?.bestScore);
  if (Number.isFinite(stored) && stored >= 0) return Math.floor(stored);
  return starBaseScore(stars) + timeBonus(entry?.bestTimeSeconds, true);
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
    ? Math.floor(persistedTotal)
    : computedTotalKronoxScore;
  const displayName = safeDisplayName(user, ownerKey);

  // Codex152 — Optional per-level projection. When the caller passes
  // `levelNumber`, the row carries the user's best time/score/stars for
  // that level (when they have completed it). This powers the Solo
  // success popup's "YENİ REKOR! / ARKADAŞLAR ARASINDA 1." badge logic
  // without leaking other private user data. The field is omitted when
  // the user has not completed that level.
  const levelData = levelProjection(user?.solo_progress, levelNumber);

  return {
    owner_key: ownerKey,
    display_name: displayName,
    initial: initialFromName(displayName),
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
    // Codex152 — Optional per-level projection request from the Solo
    // success popup. Ignored when 0/absent (default leaderboard usage).
    const levelNumber = Math.max(0, Math.floor(finiteNumber(body?.levelNumber, 0)));

    // Codex168 — Query the persisted unified score projection directly.
    // This avoids ranking whichever 500 users happened to update most
    // recently and gives production an index-friendly leaderboard field.
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
      source: 'user_kronox_puan_service_role_projection',
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown getSoloLeaderboard error';
    return json({ ok: false, error: message }, 500);
  }
});