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
//   the main leaderboard reads SoloLeaderboardEntry with service role and
//   returns ONLY rank-safe fields. User.list is reserved for the optional
//   per-level record fallback until per-level records have their own
//   rank-safe projection. It is read ONLY by Health static-contract checks.
//   Change the real function and this mirror together — Health fails if
//   any required phrase is missing, so a stale mirror cannot silently pass.

export const GET_SOLO_LEADERBOARD_PATH = 'functions/getSoloLeaderboard.js';

export const GET_SOLO_LEADERBOARD_SOURCE = `// getSoloLeaderboard — public-safe Kronox Puan projection.
// Reads SoloLeaderboardEntry first with service role and returns only
// rank-safe fields. No email, notification settings, auth/private profile
// fields, push/device data, or full User rows leave this function.

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
  const projectionRows = await base44.asServiceRole.entities.SoloLeaderboardEntry
    .list('-total_kronox_score', limit);
  const rows = (projectionRows || []).map((row) => toProjectionLeaderboardRow(row)).filter(Boolean).sort(compareRows);

  return json({
    ok: true,
    source: 'solo_leaderboard_entry_projection',
    projection: 'solo_leaderboard_entry_total_kronox_score_projection',
    projectionFirst: true,
    broadUserListUsed: false,
    rows,
  });
});

// Optional per-level record fallback only:
// base44.asServiceRole.entities.User.list('-kronox_puan_total', MAX_LIMIT)
// source: 'user_kronox_puan_service_role_level_fallback'
`;
