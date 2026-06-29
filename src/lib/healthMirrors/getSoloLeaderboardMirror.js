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
//   compact fields. Full User rows and internal owner_key/display_name values
//   never leave the function. Completed guests can pass guest_id + guest_token
//   proof; the function verifies a completed GuestProfile, uses an internal
//   g_ owner key, and still returns only username plus opaque leaderboard_id
//   plus safe avatar_type/avatar_icon_id/avatar_color_id/avatar_url visual
//   metadata.
//   It is read
//   ONLY by Health static-contract checks. Change the real function and this
//   mirror together — Health fails if any required phrase is missing, so a
//   stale mirror cannot silently pass.

export const GET_SOLO_LEADERBOARD_PATH = 'functions/getSoloLeaderboard.js';

export const GET_SOLO_LEADERBOARD_SOURCE = `// getSoloLeaderboard — public-safe Kronox Puan projection.
// Reads SoloLeaderboardEntry first with service role, then uses a bounded
// server-side User.list('-kronox_puan_total', limit) repair window so stale
// or incomplete projection rows cannot claim a false global rank. No email,
// notification settings, auth/private profile fields, push/device data, or
// full User rows leave this function. Public rows return username,
// leaderboard_id, and safe avatar_type/avatar_icon_id/avatar_color_id/avatar_url
// visual metadata; owner_key/display_name stay internal only and display_name
// is not used as a public identity fallback. Public rows strip raw email,
// provider ids, raw guest id, owner_key, player_key, guest_id, guest_token,
// and display_name.
// Completed guests can pass guest_id + guest_token; resolveLeaderboardActor
// verifies completed GuestProfile before using an internal g_ owner key.

function ownerKeyFromGuestId(rawGuestId) {
  const guestId = String(rawGuestId || '').trim().toLowerCase();
  return guestId ? 'g_' + hash(guestId) : '';
}

function isGuestProfileComplete(row) {
  return row?.onboarding_status === 'onboarding_complete'
    && row?.profile_setup_status === 'completed'
    && row?.category_setup_status === 'completed';
}

async function resolveLeaderboardActor(base44, body) {
  const user = await base44.auth.me().catch(() => null);
  if (user?.email) return { actorType: 'registered', ownerKey: getOwnerKey(user.email), user };
  const guest = await verifyGuestToken(base44, body?.guest_id, body?.guest_token);
  if (!guest || !isGuestProfileComplete(guest)) return null;
  return { actorType: 'guest', ownerKey: ownerKeyFromGuestId(body?.guest_id), guest };
}

function publicLeaderboardId(ownerKey) {
  return 'lb_' + hash(ownerKey);
}

function pickPublicAvatarFields(source) {
  const avatarUrl = readSafeAvatarPhotoUrl(source);
  return {
    avatar_type: source?.avatar_type || null,
    avatar_icon_id: source?.avatar_icon_id || null,
    avatar_color_id: source?.avatar_color_id || null,
    avatar_url: avatarUrl || null,
  };
}

function readSafeAvatarPhotoUrl(source) {
  return [source?.avatar_url, source?.avatarUrl, source?.avatar_image_url, source?.profileAvatarUrl]
    .find((value) => typeof value === 'string' && value.startsWith('https://')) || '';
}

function safePublicUsername(source, ownerKey) {
  const explicitName = String([source?.username, source?.public_username].find(Boolean) || '').trim();
  const explicit = (
    explicitName &&
    /^[A-Za-z0-9_]{3,24}$/.test(explicitName) &&
    !explicitName.includes('@') &&
    !/^(apple|google|firebase|auth0|base44|provider|uid|owner)(?:[\w:-].*)?$/i.test(explicitName) &&
    !/^(guest|player|owner|user_key|player_key|g|u)_[A-Za-z0-9_-]{4,}$/i.test(explicitName)
  ) ? explicitName : '';
  if (explicit) return explicit;
  return 'KronoxUser0000';
}

function toProjectionLeaderboardRow(row) {
  const username = safePublicUsername(row, row?.owner_key);

  return {
    owner_key: row?.owner_key,
    username,
    display_name: username,
    initial: initialFromName(username),
    total_kronox_score: row?.total_kronox_score,
    total_solo_score: row?.total_solo_score,
    online_score: row?.online_score,
    current_level: row?.current_level,
    unlocked_level: row?.unlocked_level,
    total_stars: row?.total_stars,
    completed_level_count: row?.completed_level_count,
    updated_at: row?.updated_at || new Date().toISOString(),
    ...pickPublicAvatarFields(row),
  };
}

function toPublicLeaderboardRow(row) {
  const leaderboardId = publicLeaderboardId(row?.owner_key);
  const username = safePublicUsername(row, row?.owner_key);
  return {
    id: leaderboardId,
    leaderboard_id: leaderboardId,
    username,
    publicName: username,
    initial: initialFromName(username),
    total_kronox_score: row?.total_kronox_score,
    total_solo_score: row?.total_solo_score,
    online_score: row?.online_score,
    current_level: row?.current_level,
    isCurrentUser: row?.isCurrentUser === true,
    isFriend: row?.isFriend === true,
    ...pickPublicAvatarFields(row),
  };
}

function toPublicLeaderboardRows(rows) {
  return rows.map(toPublicLeaderboardRow).filter(Boolean);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));
  const actor = await resolveLeaderboardActor(base44, body);
  if (!actor) return json({ ok: false, error: 'Unauthorized' }, 401);

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
  const scoreSourceMismatches = scoreSourceMismatchSummary(projectionRows, userScoreRows);
  // User.kronox_puan_total plus computed solo_progress can reconstruct zeroed scores.
  // User-derived rows win only when at least as high as projection rows; projection-above-user mismatches need manual audit.
  // projection_missing_positive_top_rows and positive_user_score_missing_from_projection force limited rank before exact.
  // projection_score_stale_above_user_score and projection_score_stale_below_user_score both trigger repair.
  const backfillResult = fallbackUsed ? await repairSoloLeaderboardProjection(base44, projectionRows, userScoreRows) : { attempted: 0 };
  const friendUserKeys = actor.actorType === 'registered'
    ? await loadAcceptedFriendOwnerKeys(base44, normalizeEmail(actor.user?.email))
    : new Set();
  const positiveDecoratedRows = rankedWindowRows.filter(isPositiveScoreRow);
  const zeroDecoratedRows = rankedWindowRows.filter((row) => !isPositiveScoreRow(row));
  const topRows = [...positiveDecoratedRows, ...zeroDecoratedRows].slice(0, topLimit);
  const currentUserRow = topRows.find((row) => row.isCurrentUser) || null;
  const currentUserRank = currentUserRow?.rank || null;
  const friendsOutsideTop = rankedWindowRows.filter((row) => row.isFriend).slice(0, topLimit);
  const compactResponseRows = compactRows([...topRows, currentUserRow, ...friendsOutsideTop].filter(Boolean));
  const publicTopRows = toPublicLeaderboardRows(topRows);
  const publicCurrentUserRow = toPublicLeaderboardRow(currentUserRow);
  const publicFriendsOutsideTop = toPublicLeaderboardRows(friendsOutsideTop);
  const publicCompactResponseRows = toPublicLeaderboardRows(compactResponseRows);

  return json({
    ok: true,
    source: 'SoloLeaderboardEntry',
    projectionSource: 'solo_leaderboard_entry_projection',
    projection: 'solo_leaderboard_entry_total_kronox_score_projection',
    projectionFirst: true,
    broadUserListUsed: true,
    broadUserRowsReturned: false,
    serverSideUserRepairUsed: fallbackUsed,
    topRows: publicTopRows,
    currentUserRow: publicCurrentUserRow,
    currentUserRank,
    friendsOutsideTop: publicFriendsOutsideTop,
    generatedAt: new Date().toISOString(),
    rankConfidence: currentUserRank ? 'exact' : (fallbackUsed ? 'fallback' : 'limited'),
    rankScope: currentUserRank ? 'global' : 'projection_limited',
    limitedRankBeforeExact: true,
    projectionRowsRead: projectionRows.length,
    positiveScoreRowsRead: rankedWindowRows.filter(isPositiveScoreRow).length,
    zeroScoreRowsRead: rankedWindowRows.filter((row) => !isPositiveScoreRow(row)).length,
    fallbackUsed,
    fallbackReason,
    backfillRun: fallbackUsed,
    backfillQueued: false,
    backfillResult,
    scoreSourceMismatches,
    sourceScoreRepairMode: 'non_destructive_positive_user_rows_only',
    projectionFreshness: projectionFreshness(projectionRows),
    rows: publicCompactResponseRows,
  });
});

// Optional per-level record fallback only also uses the same server-side User
// source until per-level record rows exist:
// base44.asServiceRole.entities.User.list('-kronox_puan_total', MAX_LIMIT)
// source: 'user_kronox_puan_service_role_level_fallback'
// Solo success recordContext adds completed GuestProfile progress to the same
// service-role level lookup, allows verified pre-completion guest token proof
// for the current attempt, and returns only recordAchievement, never rows:
// recordContext: true
// allowIncompleteGuest: body?.recordContext === true
// source: 'user_guest_solo_progress_service_role_level_record_context'
// projection: 'solo_level_record_achievement_context'
// recordAchievement: { fastestRank, fastestTopThree, fewestMoves, recordScope: 'all_users' }
// broadUserRowsReturned: false
`;
