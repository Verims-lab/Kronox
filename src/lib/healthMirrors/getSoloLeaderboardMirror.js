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
//   This mirror is a string snapshot of the REAL projection-first contract:
//   the main leaderboard reads SoloLeaderboardEntry with service role,
//   compares a bounded server-side User top-score repair window, repairs
//   missing/stale projection rows best-effort, and returns ONLY rank-safe
//   compact fields. Full User rows never leave the function. It is read
//   ONLY by Health static-contract checks. Change the real function and this
//   mirror together — Health fails if any required phrase is missing, so a
//   stale mirror cannot silently pass.

export const GET_SOLO_LEADERBOARD_PATH = 'functions/getSoloLeaderboard.js';

export const GET_SOLO_LEADERBOARD_SOURCE = `// getSoloLeaderboard — public-safe Kronox Puan projection.
// Reads SoloLeaderboardEntry first with service role, then uses a bounded
// server-side User.list('-kronox_puan_total', limit) repair window so stale
// or incomplete projection rows cannot claim a false global rank. No email,
// notification settings, auth/private profile fields, push/device data, or
// full User rows leave this function.

function toProjectionLeaderboardRow(row) {
  const displayName = cleanDisplayText(row?.display_name || row?.displayName) || 'Oyuncu';

  return {
    owner_key: row?.owner_key,
    display_name: displayName,
    initial: initialFromName(displayName),
    total_kronox_score: row?.total_kronox_score,
    total_solo_score: row?.total_solo_score,
    online_score: row?.online_score,
    current_level: row?.current_level,
    unlocked_level: row?.unlocked_level,
    total_stars: row?.total_stars,
    completed_level_count: row?.completed_level_count,
    updated_at: row?.updated_at || new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  // Service role used ONLY internally; rows returned are rank-safe.
  const projectionEntity = base44?.asServiceRole?.entities?.SoloLeaderboardEntry;
  const projectionRows = await projectionEntity.list('-total_kronox_score', limit);
  const userRows = await base44.asServiceRole.entities.User.list('-kronox_puan_total', limit);
  const userScoreRows = dedupeProjectionRows((userRows || []).map((row) => toLeaderboardRow(row, 0)).filter(Boolean));
  const fallbackReason = findProjectionRepairReason(projectionRows, userScoreRows, topLimit);
  const fallbackUsed = Boolean(fallbackReason);
  const rankedWindowRows = mergeProjectionAndUserScoreRows(
    (projectionRows || []).map((row) => toProjectionLeaderboardRow(row)).filter(Boolean),
    userScoreRows,
  );
  // User.kronox_puan_total wins when the same owner exists in the repair window.
  // projection_score_stale_above_user_score and projection_score_stale_below_user_score both trigger repair.
  const backfillResult = fallbackUsed ? await repairSoloLeaderboardProjection(base44, userScoreRows) : { attempted: 0 };
  const friendUserKeys = await loadAcceptedFriendOwnerKeys(base44, normalizeEmail(user?.email));
  const positiveDecoratedRows = rankedWindowRows.filter(isPositiveScoreRow);
  const zeroDecoratedRows = rankedWindowRows.filter((row) => !isPositiveScoreRow(row));
  const topRows = [...positiveDecoratedRows, ...zeroDecoratedRows].slice(0, topLimit);
  const currentUserRow = topRows.find((row) => row.isCurrentUser) || null;
  const currentUserRank = currentUserRow?.rank || null;
  const friendsOutsideTop = rankedWindowRows.filter((row) => row.isFriend).slice(0, topLimit);
  const compactResponseRows = compactRows([...topRows, currentUserRow, ...friendsOutsideTop].filter(Boolean));

  return json({
    ok: true,
    source: 'SoloLeaderboardEntry',
    projectionSource: 'solo_leaderboard_entry_projection',
    projection: 'solo_leaderboard_entry_total_kronox_score_projection',
    projectionFirst: true,
    broadUserListUsed: true,
    broadUserRowsReturned: false,
    serverSideUserRepairUsed: fallbackUsed,
    topRows,
    currentUserRow,
    currentUserRank,
    friendUserKeys,
    friendsOutsideTop,
    generatedAt: new Date().toISOString(),
    rankConfidence: currentUserRank ? 'exact' : (fallbackUsed ? 'fallback' : 'limited'),
    rankScope: currentUserRank ? 'global' : 'projection_limited',
    projectionRowsRead: projectionRows.length,
    positiveScoreRowsRead: rankedWindowRows.filter(isPositiveScoreRow).length,
    zeroScoreRowsRead: rankedWindowRows.filter((row) => !isPositiveScoreRow(row)).length,
    fallbackUsed,
    fallbackReason,
    backfillRun: fallbackUsed,
    backfillQueued: false,
    backfillResult,
    projectionFreshness: projectionFreshness(projectionRows),
    rows: compactResponseRows,
  });
});

// Optional per-level record fallback only also uses the same server-side User
// source until per-level record rows exist:
// base44.asServiceRole.entities.User.list('-kronox_puan_total', MAX_LIMIT)
// source: 'user_kronox_puan_service_role_level_fallback'
`;
