import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const JOB_NAME = 'inactive_guest_username_cleanup';
const INACTIVE_DAYS = 10;
const MAX_GUEST_SCAN_ROWS = 5000;
const MAX_USER_SCAN_ROWS = 10000;
const MAX_LEADERBOARD_SCAN_ROWS = 10000;
const MAX_RELATION_SCAN_ROWS = 5000;
const MAX_PREVIEW_ROWS = 100;
const MAX_EXECUTE_ROWS = 100;
const CONFIRM_TEXT = 'SİL';
const ACTIVE_FRIEND_REQUEST_STATUSES = new Set(['pending', 'accepted']);
const ACTIVE_GAME_INVITE_STATUSES = new Set(['pending', 'accepted']);
const ACTIVE_LOBBY_STATUSES = new Set(['waiting', 'starting', 'in_game']);
const UNSAFE_PUBLIC_USERNAME_PATTERN = /^(apple|google|firebase|auth0|base44|provider|uid|owner)(?:[\w:-].*)?$/i;
const INTERNAL_ID_PUBLIC_USERNAME_PATTERN = /^(guest|player|owner|user_key|player_key|g|u)_[A-Za-z0-9_-]{4,}$/i;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch (_error) {
    return {};
  }
}

function rowId(row: any) {
  return String(row?.id || row?._id || '');
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeAdminAuthEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isActiveAdminRole(role: unknown) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}

function isActiveAdminStatus(status: unknown) {
  return String(status || '').trim().toLowerCase() === 'active';
}

const ADMIN_AUTH_FIELD_CANDIDATES = {
  email: ['email', 'Email', 'user_email', 'admin_email'],
  role: ['role', 'Role', 'user_role'],
  status: ['status', 'Status'],
};

function readAdminAuthField(row: any, candidates: string[]) {
  for (const field of candidates) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) {
      return { value: row[field], field };
    }
  }
  return { value: undefined, field: '' };
}

async function getAdminAuthorization(base44: any, user: any) {
  const email = normalizeAdminAuthEmail(user?.email);
  if (!email) return { isAdmin: false, row: null, role: '', status: '' };
  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) return { isAdmin: false, row: null, role: '', status: '' };

  let rows: any[] = [];
  for (const field of ADMIN_AUTH_FIELD_CANDIDATES.email) {
    const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10).catch(() => []);
    if (Array.isArray(result) && result.length > 0) {
      rows = result;
      break;
    }
  }

  const exactRows = (rows || [])
    .map((candidate: any) => {
      const emailField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.email);
      const roleField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.role);
      const statusField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.status);
      return {
        candidate,
        email: normalizeAdminAuthEmail(emailField.value),
        role: String(roleField.value || '').trim().toLowerCase(),
        status: String(statusField.value || '').trim().toLowerCase(),
      };
    })
    .filter((candidate) => candidate.email === email);

  const active = exactRows.find((candidate) => isActiveAdminStatus(candidate.status) && isActiveAdminRole(candidate.role)) || null;
  return { isAdmin: Boolean(active?.candidate), row: active?.candidate || null, role: active?.role || '', status: active?.status || '' };
}

async function requireAdmin(base44: any) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) return { response: json({ ok: false, error: 'Authentication required' }, 401) };
    const authorization = await getAdminAuthorization(base44, user);
    if (!authorization.isAdmin) return { response: json({ ok: false, error: 'Admin access required' }, 403) };
    return { user, admin: authorization.row, adminRole: authorization.role };
  } catch (_error) {
    return { response: json({ ok: false, error: 'Authentication required' }, 401) };
  }
}

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeInteger(value: unknown) {
  const number = safeNumber(value);
  return number === null ? null : Math.max(0, Math.floor(number));
}

function normalizeUsername(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isSafePublicUsername(value: unknown) {
  const username = normalizeUsername(value);
  return Boolean(
    username &&
    /^[A-Za-z0-9_]{3,24}$/.test(username) &&
    !username.includes('@') &&
    !UNSAFE_PUBLIC_USERNAME_PATTERN.test(username) &&
    !INTERNAL_ID_PUBLIC_USERNAME_PATTERN.test(username),
  );
}

function normalizeUsernameKey(value: unknown) {
  const username = normalizeUsername(value);
  return isSafePublicUsername(username) ? username.toLowerCase() : '';
}

function parseTime(value: unknown) {
  if (!value) return 0;
  const text = String(value || '').trim();
  if (!text) return 0;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text) ? `${text}Z` : text;
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : 0;
}

function latestActivity(row: any) {
  const candidates = [row?.last_app_open_at, row?.last_seen_at];
  let best = { value: '', ms: 0 };
  for (const value of candidates) {
    const ms = parseTime(value);
    if (ms > best.ms) best = { value: String(value || ''), ms };
  }
  return best;
}

function fnvOwnerKey(prefix: 'g' | 'u', value: unknown) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function getGuestOwnerKey(guestId: unknown) {
  return fnvOwnerKey('g', guestId);
}

async function safeList(entity: any, sort: string, limit: number) {
  if (!entity?.list) return [];
  const rows = await entity.list(sort, limit).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function safeFilter(base44: any, entityName: string, filter: Record<string, unknown>, sort = '-created_date', limit = 100) {
  try {
    const entity = base44?.asServiceRole?.entities?.[entityName];
    if (!entity?.filter) return [];
    const rows = await entity.filter(filter, sort, limit).catch(() => []);
    return Array.isArray(rows) ? rows : [];
  } catch (_error) {
    return [];
  }
}

function addRowsByKey(map: Map<string, any[]>, key: string, rows: any[]) {
  if (!key) return;
  const existing = map.get(key) || [];
  existing.push(...rows);
  map.set(key, existing);
}

function uniqueRows(rows: any[]) {
  const seen = new Set<string>();
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const id = rowId(row);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function buildReasonCounts(reasonLists: string[][]) {
  const counts: Record<string, number> = {};
  for (const reasons of reasonLists) {
    const unique = new Set(reasons);
    for (const reason of unique) {
      counts[reason] = (counts[reason] || 0) + 1;
    }
  }
  return counts;
}

function rowMatchesUsername(row: any, usernameKey: string, fields: string[]) {
  if (!usernameKey) return false;
  return fields.some((field) => normalizeUsernameKey(row?.[field]) === usernameKey);
}

function isFreshPresence(row: any, nowMs: number) {
  if (!row || String(row?.status || '').toLowerCase() !== 'online') return false;
  const expiresAt = parseTime(row?.presence_expires_at || row?.expires_at);
  if (expiresAt) return expiresAt > nowMs;
  const seenAt = parseTime(row?.last_heartbeat_at || row?.last_seen_at);
  return seenAt ? seenAt + 75 * 1000 > nowMs : false;
}

async function buildCleanupContext(base44: any, body: any) {
  const scanLimit = Math.max(1, Math.min(Number(body?.scanLimit) || MAX_GUEST_SCAN_ROWS, MAX_GUEST_SCAN_ROWS));
  const entities = base44.asServiceRole.entities;

  const [
    guests,
    users,
    leaderboardRows,
    pendingFriendRequests,
    acceptedFriendRequests,
    legacyFriendships,
    pendingGameInvites,
    acceptedGameInvites,
    waitingLobbies,
    startingLobbies,
    inGameLobbies,
    onlinePresenceRows,
  ] = await Promise.all([
    safeList(entities.GuestProfile, '-created_at', scanLimit),
    safeList(entities.User, '-created_date', MAX_USER_SCAN_ROWS),
    safeList(entities.SoloLeaderboardEntry, '-total_kronox_score', MAX_LEADERBOARD_SCAN_ROWS),
    safeFilter(base44, 'FriendRequest', { status: 'pending' }, '-updated_date', MAX_RELATION_SCAN_ROWS),
    safeFilter(base44, 'FriendRequest', { status: 'accepted' }, '-updated_date', MAX_RELATION_SCAN_ROWS),
    safeList(entities.Friendship, '-updated_date', MAX_RELATION_SCAN_ROWS),
    safeFilter(base44, 'GameInvite', { status: 'pending' }, '-updated_date', MAX_RELATION_SCAN_ROWS),
    safeFilter(base44, 'GameInvite', { status: 'accepted' }, '-updated_date', MAX_RELATION_SCAN_ROWS),
    safeFilter(base44, 'Lobby', { status: 'waiting' }, '-updated_date', MAX_RELATION_SCAN_ROWS),
    safeFilter(base44, 'Lobby', { status: 'starting' }, '-updated_date', MAX_RELATION_SCAN_ROWS),
    safeFilter(base44, 'Lobby', { status: 'in_game' }, '-updated_date', MAX_RELATION_SCAN_ROWS),
    safeFilter(base44, 'PlayerPresence', { status: 'online' }, '-last_seen_at', MAX_RELATION_SCAN_ROWS),
  ]);

  const userUsernameKeys = new Set<string>();
  const linkedGuestIds = new Set<string>();
  for (const user of users) {
    const key = normalizeUsernameKey(user?.username || user?.public_username || user?.display_name);
    if (key) userUsernameKeys.add(key);
    if (Array.isArray(user?.linked_guest_ids)) {
      user.linked_guest_ids.forEach((value: unknown) => {
        const guestId = String(value || '').trim();
        if (guestId) linkedGuestIds.add(guestId);
      });
    }
  }

  const leaderboardByOwner = new Map<string, any[]>();
  const leaderboardByUsername = new Map<string, any[]>();
  for (const row of leaderboardRows) {
    addRowsByKey(leaderboardByOwner, String(row?.owner_key || '').trim(), [row]);
    addRowsByKey(leaderboardByUsername, normalizeUsernameKey(row?.username || row?.display_name), [row]);
  }

  const activeFriendRequests = [...pendingFriendRequests, ...acceptedFriendRequests]
    .filter((row: any) => ACTIVE_FRIEND_REQUEST_STATUSES.has(String(row?.status || '').toLowerCase()));
  const activeGameInvites = [...pendingGameInvites, ...acceptedGameInvites]
    .filter((row: any) => ACTIVE_GAME_INVITE_STATUSES.has(String(row?.status || '').toLowerCase()));
  const activeLobbies = [...waitingLobbies, ...startingLobbies, ...inGameLobbies]
    .filter((row: any) => ACTIVE_LOBBY_STATUSES.has(String(row?.status || '').toLowerCase()));

  return {
    nowMs: Date.now(),
    scanLimit,
    guests,
    users,
    leaderboardRows,
    userUsernameKeys,
    linkedGuestIds,
    leaderboardByOwner,
    leaderboardByUsername,
    activeFriendRequests,
    legacyFriendships,
    activeGameInvites,
    activeLobbies,
    onlinePresenceRows,
    sourceRows: {
      guestProfileRowsRead: guests.length,
      userRowsRead: users.length,
      soloLeaderboardRowsRead: leaderboardRows.length,
      friendRequestRowsRead: activeFriendRequests.length,
      friendshipRowsRead: legacyFriendships.length,
      gameInviteRowsRead: activeGameInvites.length,
      lobbyRowsRead: activeLobbies.length,
      onlinePresenceRowsRead: onlinePresenceRows.length,
    },
  };
}

function evaluateGuest(row: any, context: any) {
  const id = rowId(row);
  const guestId = String(row?.guest_id || '').trim();
  const username = normalizeUsername(row?.username || row?.display_name);
  const usernameKey = normalizeUsernameKey(username);
  const ownerKey = getGuestOwnerKey(guestId);
  const reasons: string[] = [];
  const activity = latestActivity(row);
  const cutoffMs = context.nowMs - INACTIVE_DAYS * 24 * 60 * 60 * 1000;

  if (!id || !guestId) reasons.push('ambiguous_guest_identity');
  if (!usernameKey) reasons.push('invalid_or_unsafe_username');
  if (!activity.ms) reasons.push('missing_or_uncertain_last_open');
  else if (activity.ms >= cutoffMs) reasons.push('active_within_10_days');

  const status = String(row?.status || '').trim().toLowerCase();
  if (status !== 'guest') reasons.push('not_guest_only');
  if (row?.linked_user_email || row?.linked_auth_user_id || row?.link_idempotency_key) reasons.push('linked_or_logged_in');
  if (context.linkedGuestIds.has(guestId)) reasons.push('linked_or_logged_in');
  if (context.userUsernameKeys.has(usernameKey)) reasons.push('linked_or_logged_in');

  const profileScore = safeInteger(row?.kronox_puan_total);
  const sameOwnerLeaderboardRows = ownerKey ? uniqueRows(context.leaderboardByOwner.get(ownerKey) || []) : [];
  const sameUsernameLeaderboardRows = usernameKey ? uniqueRows(context.leaderboardByUsername.get(usernameKey) || []) : [];
  const otherOwnerLeaderboardRows = sameUsernameLeaderboardRows.filter((item) => String(item?.owner_key || '').trim() !== ownerKey);
  const sameOwnerScores = sameOwnerLeaderboardRows.map((item) => safeInteger(item?.total_kronox_score));
  const sameOwnerScoreKnown = sameOwnerScores.some((value) => value !== null);
  const hasPositiveProjection = sameOwnerScores.some((value) => Number(value) > 0);
  const hasPositiveProfileScore = Number(profileScore) > 0;
  const hasPositiveOtherProjection = otherOwnerLeaderboardRows.some((item) => Number(safeInteger(item?.total_kronox_score)) > 0);
  if (hasPositiveProjection || hasPositiveProfileScore || hasPositiveOtherProjection) reasons.push('score_not_zero');
  if (otherOwnerLeaderboardRows.length) reasons.push('ambiguous_username_projection');
  if (profileScore === null && !sameOwnerScoreKnown) reasons.push('score_source_missing_or_ambiguous');

  const diamonds = safeInteger(row?.diamonds);
  if (Number(diamonds) > 0) reasons.push('economy_state_not_empty');

  const acceptedFriendRows = context.activeFriendRequests.filter((item: any) => (
    String(item?.status || '').toLowerCase() === 'accepted' &&
    rowMatchesUsername(item, usernameKey, ['from_username', 'from_name', 'to_username', 'to_name'])
  ));
  const pendingFriendRows = context.activeFriendRequests.filter((item: any) => (
    String(item?.status || '').toLowerCase() === 'pending' &&
    rowMatchesUsername(item, usernameKey, ['from_username', 'from_name', 'to_username', 'to_name'])
  ));
  const legacyFriendRows = context.legacyFriendships.filter((item: any) => (
    rowMatchesUsername(item, usernameKey, ['friend_name'])
  ));
  if (acceptedFriendRows.length || legacyFriendRows.length) reasons.push('has_friends');
  if (pendingFriendRows.length) reasons.push('has_active_social_relation');

  const activeInviteRows = context.activeGameInvites.filter((item: any) => (
    rowMatchesUsername(item, usernameKey, ['from_name', 'to_name'])
  ));
  if (activeInviteRows.length) reasons.push('has_active_social_relation');

  const activeLobbyRows = context.activeLobbies.filter((lobby: any) => {
    if (rowMatchesUsername(lobby, usernameKey, ['host_name', 'winner'])) return true;
    return Array.isArray(lobby?.players) && lobby.players.some((player: any) => rowMatchesUsername(player, usernameKey, ['name']));
  });
  if (activeLobbyRows.length) reasons.push('has_active_social_relation');

  const freshPresenceRows = context.onlinePresenceRows.filter((item: any) => (
    String(item?.owner_key_hash || '').trim() === ownerKey && isFreshPresence(item, context.nowMs)
  ));
  if (freshPresenceRows.length) reasons.push('active_presence');

  const knownScore = sameOwnerScores.find((value) => value !== null) ?? profileScore ?? 0;
  return {
    eligible: reasons.length === 0,
    reasons,
    row,
    id,
    guestId,
    ownerKey,
    username,
    usernameKey,
    lastAppOpenAt: activity.value,
    score: Math.max(0, Number(knownScore) || 0),
    friendCount: acceptedFriendRows.length + legacyFriendRows.length,
    socialRelationCount: pendingFriendRows.length + activeInviteRows.length + activeLobbyRows.length,
    sameOwnerLeaderboardRows,
  };
}

function buildPreview(context: any) {
  const evaluated = context.guests.map((row: any) => evaluateGuest(row, context));
  const candidates = evaluated.filter((item: any) => item.eligible);
  const blocked = evaluated.filter((item: any) => !item.eligible);
  const reasonCounts = buildReasonCounts(blocked.map((item: any) => item.reasons));
  return {
    generatedAt: new Date(context.nowMs).toISOString(),
    inactiveThresholdDays: INACTIVE_DAYS,
    totalCandidateCount: candidates.length,
    returnedCandidateCount: Math.min(candidates.length, MAX_PREVIEW_ROWS),
    candidates: candidates.slice(0, MAX_PREVIEW_ROWS).map((item: any) => ({
      username: item.username,
      last_app_open_at: item.lastAppOpenAt,
      score: item.score,
      login_status: 'guest_only',
      friend_count: 0,
      relation_status: 'none',
    })),
    skippedReasonCounts: reasonCounts,
    sourceRows: context.sourceRows,
    confirmation: {
      requiredText: CONFIRM_TEXT,
      candidateCount: candidates.length,
    },
    contract: {
      dryRunNoMutation: true,
      adminOnly: true,
      serverSideEligibility: true,
      confirmationRequired: true,
      releasesUsernameForReuse: true,
      excludesMissingLastOpen: true,
      excludesLinkedUsers: true,
      excludesPositiveScore: true,
      excludesFriendsOrActiveSocialRelations: true,
      excludesPositiveDiamondBalance: true,
      exposesEmail: false,
      exposesProviderId: false,
      exposesOwnerKey: false,
      exposesRawGuestId: false,
      exposesInternalPlayerKey: false,
    },
    _internalCandidates: candidates,
  };
}

async function writeAdminMaintenanceLog(base44: any, payload: Record<string, unknown>) {
  try {
    const entity = base44.asServiceRole.entities.AdminMaintenanceLog;
    if (!entity?.create) return { available: false, created: false };
    const created = await entity.create(payload);
    return { available: true, created: true, id: rowId(created) || null };
  } catch (_error) {
    return { available: true, created: false };
  }
}

async function deleteRows(entity: any, rows: any[]) {
  if (!entity?.delete) return 0;
  let deleted = 0;
  for (const row of uniqueRows(rows)) {
    const id = rowId(row);
    if (!id) continue;
    await entity.delete(id);
    deleted += 1;
  }
  return deleted;
}

async function cleanupCandidate(base44: any, candidate: any) {
  const entities = base44.asServiceRole.entities;
  const leaderboardRows = candidate.sameOwnerLeaderboardRows;
  const presenceRows = await safeFilter(
    base44,
    'PlayerPresence',
    { owner_key_hash: candidate.ownerKey },
    '-last_seen_at',
    MAX_RELATION_SCAN_ROWS,
  );

  const leaderboardRowsDeleted = await deleteRows(entities.SoloLeaderboardEntry, leaderboardRows);
  const presenceRowsDeleted = await deleteRows(entities.PlayerPresence, presenceRows);
  await entities.GuestProfile.delete(candidate.id);

  return {
    username: candidate.username,
    leaderboardRowsDeleted,
    presenceRowsDeleted,
    guestProfileDeleted: true,
  };
}

Deno.serve(async (req: Request) => {
  let base44: any = null;
  let actor: any = null;
  const startedAt = new Date().toISOString();

  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

    base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    if (admin.response) return admin.response;
    actor = admin.user;

    const body = await readBody(req);
    const action = String(body?.action || (body?.dryRun === false ? 'execute' : 'preview')).trim().toLowerCase();
    if (action !== 'preview' && action !== 'execute') {
      return json({ ok: false, code: 'invalid_action', error: 'Geçersiz işlem.' }, 400);
    }

    const context = await buildCleanupContext(base44, body);
    const preview = buildPreview(context);
    const safePreview = { ...preview };
    delete (safePreview as any)._internalCandidates;

    if (action === 'preview') {
      await writeAdminMaintenanceLog(base44, {
        action: 'inactive_guest_username_cleanup_preview',
        job_name: JOB_NAME,
        admin_email: normalizeEmail(actor?.email),
        target_email: '__guest_username_cleanup__',
        result: 'preview_ok',
        retention_status: 'active',
        created_at: startedAt,
        metadata: {
          totalCandidateCount: preview.totalCandidateCount,
          skippedReasonCounts: preview.skippedReasonCounts,
          sourceRows: preview.sourceRows,
          privateIdsReturnedToClient: false,
        },
      });
      return json({ ok: true, dryRun: true, preview: safePreview });
    }

    const confirmText = String(body?.confirmText || body?.confirmationText || '').trim();
    const previewCandidateCount = Number(body?.previewCandidateCount ?? body?.candidateCount);
    if (confirmText !== CONFIRM_TEXT) {
      return json({ ok: false, code: 'confirmation_required', error: 'Silme için SİL onayı gerekli.' }, 400);
    }
    if (!Number.isFinite(previewCandidateCount) || Math.floor(previewCandidateCount) !== preview.totalCandidateCount) {
      return json({
        ok: false,
        code: 'preview_count_changed',
        error: 'Aday sayısı değişti. Lütfen yeniden önizleme al.',
        currentCandidateCount: preview.totalCandidateCount,
      }, 409);
    }

    const executeLimit = Math.max(1, Math.min(Number(body?.executeLimit) || MAX_EXECUTE_ROWS, MAX_EXECUTE_ROWS));
    const selected = preview._internalCandidates.slice(0, executeLimit);
    const results = [];
    for (const candidate of selected) {
      results.push(await cleanupCandidate(base44, candidate));
    }

    const nowIso = new Date().toISOString();
    const summary = {
      ok: true,
      dryRun: false,
      executedAt: nowIso,
      deletedReleasedCount: results.length,
      skippedCount: Math.max(0, context.guests.length - results.length),
      remainingCandidateCount: Math.max(0, preview.totalCandidateCount - results.length),
      skippedReasonCounts: preview.skippedReasonCounts,
      results: results.map((item) => ({
        username: item.username,
        released: true,
        guestProfileDeleted: item.guestProfileDeleted,
        leaderboardRowsDeleted: item.leaderboardRowsDeleted,
        presenceRowsDeleted: item.presenceRowsDeleted,
      })),
      contract: {
        adminOnly: true,
        serverSideEligibilityRechecked: true,
        noAutomaticCleanup: true,
        usernamesReleasedForReuse: true,
        loggedInUsersDeleted: false,
        positiveScoreUsersDeleted: false,
        usersWithFriendsDeleted: false,
        missingLastOpenDeleted: false,
        privateIdsReturnedToClient: false,
      },
    };

    const log = await writeAdminMaintenanceLog(base44, {
      action: 'inactive_guest_username_cleanup_execute',
      job_name: JOB_NAME,
      admin_email: normalizeEmail(actor?.email),
      target_email: '__guest_username_cleanup__',
      result: 'success',
      retention_status: 'active',
      created_at: nowIso,
      metadata: {
        deletedReleasedCount: summary.deletedReleasedCount,
        remainingCandidateCount: summary.remainingCandidateCount,
        skippedReasonCounts: summary.skippedReasonCounts,
        privateIdsReturnedToClient: false,
      },
    });

    return json({ ...summary, auditLog: { available: log.available, created: log.created } });
  } catch (error) {
    if (base44 && actor?.email) {
      await writeAdminMaintenanceLog(base44, {
        action: 'inactive_guest_username_cleanup_execute',
        job_name: JOB_NAME,
        admin_email: normalizeEmail(actor.email),
        target_email: '__guest_username_cleanup__',
        result: 'failed',
        retention_status: 'active',
        created_at: new Date().toISOString(),
        metadata: { code: 'inactive_guest_username_cleanup_failed' },
      }).catch(() => null);
    }
    console.error('[cleanupInactiveGuestUsernames] failed', error);
    return json({
      ok: false,
      code: 'inactive_guest_username_cleanup_failed',
      error: 'Pasif guest kullanıcı adı temizliği tamamlanamadı.',
    }, 500);
  }
});
