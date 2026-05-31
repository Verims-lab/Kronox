/**
 * getSoloLeaderboard
 *
 * Public-safe leaderboard projection for Solo progress.
 * Reads User.solo_progress with service role, but returns only rank-safe
 * fields. No raw email, notification settings, auth/private profile fields,
 * push/device data, or full User rows leave this function.
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
  if (seconds < 60) return 10;
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

function toLeaderboardRow(user: any) {
  const ownerKey = ownerKeyFromEmail(user?.email || user?.user_email);
  if (!ownerKey) return null;

  const summary = summarizeProgress(user?.solo_progress || {});
  const displayName = safeDisplayName(user, ownerKey);

  return {
    owner_key: ownerKey,
    display_name: displayName,
    initial: initialFromName(displayName),
    total_solo_score: summary.totalSoloScore,
    current_level: summary.currentLevel,
    unlocked_level: summary.unlockedLevel,
    total_stars: summary.totalStars,
    completed_level_count: summary.completedLevelCount,
    ...(summary.aggregateBestTimeSeconds !== null
      ? { aggregate_best_time_seconds: summary.aggregateBestTimeSeconds }
      : {}),
    updated_at: user?.updated_date || user?.updated_at || user?.created_date || new Date().toISOString(),
  };
}

function compareRows(a: any, b: any) {
  const scoreDiff = finiteNumber(b.total_solo_score) - finiteNumber(a.total_solo_score);
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

    const users = await base44.asServiceRole.entities.User.list('-updated_date', MAX_LIMIT);
    const rows = (users || [])
      .map(toLeaderboardRow)
      .filter(Boolean)
      .sort(compareRows)
      .slice(0, limit);

    return json({
      ok: true,
      source: 'user_solo_progress_service_role_projection',
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown getSoloLeaderboard error';
    return json({ ok: false, error: message }, 500);
  }
});
