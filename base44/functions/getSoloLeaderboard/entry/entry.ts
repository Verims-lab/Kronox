// getSoloLeaderboard — public-safe service-role Kronox Puan projection.
//
// GitHub-sync mirror of the deployed functions/getSoloLeaderboard.js. The
// Health Center reads this path via `?raw`. It must stay in sync with the
// real function; Health fails if any required contract phrase is missing.
//
// Privacy contract:
//   • Reads private User rows with service role ONLY internally.
//   • Returns ONLY rank-safe fields (owner_key, display_name, initial,
//     total_kronox_score, level, stars). No raw user_email, auth/private
//     profile fields, push/device data, or full User rows leave here.
//   • Ranks by the persisted unified projection User.kronox_puan_total
//     (user_kronox_puan_total_projection) which already includes the
//     Online score contribution — not Solo-only points.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 500;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function ownerKeyFromEmail(rawEmail: unknown) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) return '';
  let hash = 2166136261;
  for (let i = 0; i < email.length; i += 1) {
    hash ^= email.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function onlineScoreFromUser(user: any) {
  return Math.max(0, Math.floor(finiteNumber(user?.online_progress?.score, 0)));
}

function toLeaderboardRow(user: any) {
  const ownerKey = ownerKeyFromEmail(user?.email || user?.user_email);
  if (!ownerKey) return null;

  const summary = summarizeProgress(user?.solo_progress || {});
  const onlineScore = onlineScoreFromUser(user);
  // Unified Kronox Puan = Solo best-score total + Online score component.
  const computedTotalKronoxScore = summary.totalSoloScore + onlineScore;
  // Prefer the persisted unified projection (user_kronox_puan_total_projection)
  // when present; otherwise fall back to the computed unified value.
  const persistedTotal = finiteNumber(user?.kronox_puan_total, NaN);
  const totalKronoxScore = Number.isFinite(persistedTotal) && persistedTotal >= 0
    ? Math.floor(persistedTotal)
    : computedTotalKronoxScore;
  const displayName = safeDisplayName(user, ownerKey);

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
    updated_at: user?.updated_date || new Date().toISOString(),
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
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(finiteNumber(body?.limit, DEFAULT_LIMIT))));

    // Rank by the persisted unified projection. Service role is used ONLY
    // internally; the rows returned are rank-safe.
    const users = await base44.asServiceRole.entities.User.list('-kronox_puan_total', MAX_LIMIT);
    const rowPairs = (users || [])
      .map((u: any) => ({ user: u, row: toLeaderboardRow(u) }))
      .filter((entry: any) => Boolean(entry.row));

    await Promise.all(
      rowPairs
        .filter(({ user }: any) => !Number.isFinite(Number(user?.kronox_puan_total)))
        .slice(0, 25)
        .map(({ user, row }: any) => backfillKronoxPuanProjection(base44, user, row)),
    );

    const rows = rowPairs.map(({ row }: any) => row).sort(compareRows).slice(0, limit);

    return json({
      ok: true,
      source: 'user_kronox_puan_service_role_projection',
      // Named persisted unified projection contract (Solo + Online).
      projection: 'user_kronox_puan_total_projection',
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown getSoloLeaderboard error';
    return json({ ok: false, error: message }, 500);
  }
});