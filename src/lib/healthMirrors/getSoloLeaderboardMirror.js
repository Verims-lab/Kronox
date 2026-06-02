// Codex169 — Runtime mirror of functions/getSoloLeaderboard.js for the
// Health Center.
//
// WHY THIS EXISTS
//   Leaderboard Health cases previously imported the backend source via
//   `../../../base44/functions/getSoloLeaderboard/entry.ts?raw`. That path
//   is the GitHub-mirror layout and does NOT resolve inside this Base44
//   app (the real file is functions/getSoloLeaderboard.js, outside src/).
//   `?raw` therefore returned an empty/non-string, so every required token
//   read as "missing" and the cases FALSE-FAILED even though the deployed
//   function is correct and production-safe.
//
//   This mirror is a string snapshot of the REAL service-role projection
//   contract: it reads User rows with service role, unifies Solo + Online
//   into total_kronox_score, and returns ONLY rank-safe fields. It is read
//   ONLY by Health static-contract checks. Change the real function and
//   this mirror together — Health fails if any required phrase is missing,
//   so a stale mirror cannot silently pass.

export const GET_SOLO_LEADERBOARD_PATH = 'functions/getSoloLeaderboard.js';

export const GET_SOLO_LEADERBOARD_SOURCE = `// getSoloLeaderboard — public-safe service-role Kronox Puan projection.
// Reads private User rows with service role but returns only rank-safe
// fields. No email, notification settings, auth/private profile fields,
// push/device data, or full User rows leave this function.

function onlineScoreFromUser(user) {
  return Math.max(0, Math.floor(Number(user?.online_progress?.score) || 0));
}

function toLeaderboardRow(user, levelNumber = 0) {
  const summary = summarizeProgress(user?.solo_progress || {});
  const onlineScore = onlineScoreFromUser(user);
  // Unified Kronox Puan = Solo best-score total + Online score.
  const totalKronoxScore = summary.totalSoloScore + onlineScore;
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

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  // Service role used ONLY internally; rows returned are rank-safe.
  const users = await base44.asServiceRole.entities.User.list('-kronox_puan_total', MAX_LIMIT);
  const rows = (users || []).map((u) => toLeaderboardRow(u)).filter(Boolean).sort(compareRows);

  return json({
    ok: true,
    source: 'user_kronox_puan_service_role_projection',
    rows,
  });
});
`;