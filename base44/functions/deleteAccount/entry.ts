import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MAX_ROWS = 500;
const PENDING_STATUSES = new Set(['pending', 'waiting', 'starting']);

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function safeId(value: unknown) {
  return String(value || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 48) || 'unknown';
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

function uniqueRows(rows: any[]) {
  const seen = new Set<string>();
  return (rows || []).filter((row) => {
    const id = String(row?.id || row?._id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function anonymizedIdentity(user: any) {
  const ownerKey = ownerKeyFromEmail(user?.email) || `u_${safeId(user?.id)}`;
  return {
    ownerKey,
    email: `deleted-${ownerKey}@deleted.kronox.local`,
    name: 'Silinmiş Kullanıcı',
  };
}

function replaceEmailInKey(value: unknown, userEmail: string, anonymousEmail: string) {
  const source = String(value || '').trim();
  if (!source) return source;
  return source.split(userEmail).join(anonymousEmail);
}

function accountDeletedDescription(previous: unknown) {
  const suffix = 'account_deleted';
  const text = String(previous || '').trim();
  if (!text) return suffix;
  if (text.includes(suffix)) return text.slice(0, 1000);
  return `${text} | ${suffix}`.slice(0, 1000);
}


async function safeFilter(base44: any, entityName: string, filter: Record<string, unknown>, sort = '-created_date', limit = MAX_ROWS) {
  try {
    const entity = base44.asServiceRole.entities[entityName];
    if (!entity?.filter) return [];
    return await entity.filter(filter, sort, limit).catch(() => []);
  } catch {
    return [];
  }
}

async function deleteRows(base44: any, entityName: string, rows: any[]) {
  const entity = base44.asServiceRole.entities[entityName];
  if (!entity?.delete) return 0;
  let deleted = 0;
  for (const row of uniqueRows(rows)) {
    if (!row?.id) continue;
    await entity.delete(row.id);
    deleted += 1;
  }
  return deleted;
}

async function updateRows(base44: any, entityName: string, rows: any[], buildPatch: (row: any) => Record<string, unknown>) {
  const entity = base44.asServiceRole.entities[entityName];
  if (!entity?.update) return 0;
  let updated = 0;
  for (const row of uniqueRows(rows)) {
    if (!row?.id) continue;
    const patch = buildPatch(row);
    await entity.update(row.id, patch);
    updated += 1;
  }
  return updated;
}

async function removePushSubscriptions(base44: any, userEmail: string) {
  const rows = await safeFilter(base44, 'PushSubscription', { user_email: userEmail }, '-last_seen_at');
  return deleteRows(base44, 'PushSubscription', rows);
}

async function removeSocialRows(base44: any, userEmail: string) {
  const [sentRequests, receivedRequests, ownFriendships, friendFriendships] = await Promise.all([
    safeFilter(base44, 'FriendRequest', { from_email: userEmail }),
    safeFilter(base44, 'FriendRequest', { to_email: userEmail }),
    safeFilter(base44, 'Friendship', { user_email: userEmail }),
    safeFilter(base44, 'Friendship', { friend_email: userEmail }),
  ]);

  const friendRequests = await deleteRows(base44, 'FriendRequest', [...sentRequests, ...receivedRequests]);
  const friendships = await deleteRows(base44, 'Friendship', [...ownFriendships, ...friendFriendships]);
  return { friendRequests, friendships };
}

async function cancelOrAnonymizeInvites(base44: any, userEmail: string, anon: ReturnType<typeof anonymizedIdentity>) {
  const now = new Date().toISOString();
  const [sent, received] = await Promise.all([
    safeFilter(base44, 'GameInvite', { from_email: userEmail }),
    safeFilter(base44, 'GameInvite', { to_email: userEmail }),
  ]);

  return updateRows(base44, 'GameInvite', [...sent, ...received], (invite) => {
    const fromMatches = normalizeEmail(invite?.from_email) === userEmail;
    const toMatches = normalizeEmail(invite?.to_email) === userEmail;
    const status = String(invite?.status || 'pending');
    return {
      ...(fromMatches ? { from_email: anon.email, from_name: anon.name } : {}),
      ...(toMatches ? { to_email: anon.email, to_name: anon.name } : {}),
      ...(status === 'pending' ? { status: 'cancelled', cancelled_at: now } : {}),
      description: accountDeletedDescription(invite?.description),
    };
  });
}

function scrubLobbyPlayer(player: any, userEmail: string, anon: ReturnType<typeof anonymizedIdentity>) {
  if (normalizeEmail(player?.email) !== userEmail) return player;
  return {
    ...player,
    email: anon.email,
    name: anon.name,
    cards: [],
    ready: false,
  };
}

async function anonymizeLobbyRows(base44: any, userEmail: string, userId: string, anon: ReturnType<typeof anonymizedIdentity>) {
  const [hosted, won, participant, invited, created] = await Promise.all([
    safeFilter(base44, 'Lobby', { host_email: userEmail }),
    safeFilter(base44, 'Lobby', { winner_email: userEmail }),
    safeFilter(base44, 'Lobby', { 'players.email': userEmail }),
    safeFilter(base44, 'Lobby', { invited_emails: userEmail }),
    safeFilter(base44, 'Lobby', { created_by_id: userId }),
  ]);
  const now = new Date().toISOString();

  return updateRows(base44, 'Lobby', [...hosted, ...won, ...participant, ...invited, ...created], (lobby) => {
    const hostMatches = normalizeEmail(lobby?.host_email) === userEmail;
    const winnerMatches = normalizeEmail(lobby?.winner_email) === userEmail;
    const players = Array.isArray(lobby?.players)
      ? lobby.players.map((player: any) => scrubLobbyPlayer(player, userEmail, anon))
      : [];
    const invitedEmails = Array.isArray(lobby?.invited_emails)
      ? lobby.invited_emails.filter((email: unknown) => normalizeEmail(email) !== userEmail)
      : [];
    const status = String(lobby?.status || '');
    const shouldCancel = hostMatches && PENDING_STATUSES.has(status);

    return {
      ...(hostMatches ? { host_email: anon.email, host_name: anon.name } : {}),
      ...(winnerMatches ? { winner_email: anon.email, winner: anon.name } : {}),
      players,
      invited_emails: invitedEmails,
      ...(shouldCancel ? { status: 'cancelled', cancelled_at: now } : {}),
      last_activity_at: now,
      description: accountDeletedDescription(lobby?.description),
    };
  });
}

async function removeOrAnonymizePublicRows(base44: any, user: any, userEmail: string, anon: ReturnType<typeof anonymizedIdentity>) {
  const userId = String(user?.id || '');
  const ownerKey = ownerKeyFromEmail(userEmail);

  const [leaderboardByCreator, leaderboardByOwner, gameRecordsByEmail, gameRecordsByCreator, lobbyMessagesByCreator] = await Promise.all([
    safeFilter(base44, 'SoloLeaderboardEntry', { created_by_id: userId }),
    ownerKey ? safeFilter(base44, 'SoloLeaderboardEntry', { owner_key: ownerKey }) : Promise.resolve([]),
    safeFilter(base44, 'GameRecord', { user_email: userEmail }),
    safeFilter(base44, 'GameRecord', { created_by_id: userId }),
    safeFilter(base44, 'LobbyMessage', { created_by_id: userId }),
  ]);

  const leaderboard = await deleteRows(base44, 'SoloLeaderboardEntry', [...leaderboardByCreator, ...leaderboardByOwner]);
  const gameRecords = await deleteRows(base44, 'GameRecord', [...gameRecordsByEmail, ...gameRecordsByCreator]);
  const lobbyMessages = await deleteRows(base44, 'LobbyMessage', lobbyMessagesByCreator);

  const [diamondRows, dailyWheelRows, resultRows, opponentRows, questionAttemptRows] = await Promise.all([
    safeFilter(base44, 'DiamondTransaction', { user_email: userEmail }),
    safeFilter(base44, 'DailyWheelSpin', { user_email: userEmail }),
    safeFilter(base44, 'OnlineMatchResult', { player_email: userEmail }),
    safeFilter(base44, 'OnlineMatchResult', { opponent_email: userEmail }),
    safeFilter(base44, 'QuestionAttemptEvent', { user_email: userEmail }, '-created_at'),
  ]);

  const diamondTransactions = await updateRows(base44, 'DiamondTransaction', diamondRows, (row) => ({
    user_email: anon.email,
    idempotency_key: replaceEmailInKey(row?.idempotency_key, userEmail, anon.email),
    metadata: {
      ...(row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      account_deleted: true,
    },
  }));

  const dailyWheelSpins = await updateRows(base44, 'DailyWheelSpin', dailyWheelRows, (row) => ({
    user_email: anon.email,
    owner_key: anon.ownerKey,
    idempotency_key: replaceEmailInKey(row?.idempotency_key, userEmail, anon.email),
    metadata: {
      ...(row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      account_deleted: true,
    },
    description: accountDeletedDescription(row?.description),
  }));

  const onlineMatchResults = await updateRows(base44, 'OnlineMatchResult', [...resultRows, ...opponentRows], (row) => {
    const playerMatches = normalizeEmail(row?.player_email) === userEmail;
    const opponentMatches = normalizeEmail(row?.opponent_email) === userEmail;
    return {
      ...(playerMatches ? { player_email: anon.email } : {}),
      ...(opponentMatches ? { opponent_email: anon.email } : {}),
      idempotency_key: replaceEmailInKey(row?.idempotency_key, userEmail, anon.email),
      metadata: {
        ...(row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
        account_deleted: true,
      },
      description: accountDeletedDescription(row?.description),
    };
  });

  const questionAttemptEvents = await updateRows(base44, 'QuestionAttemptEvent', questionAttemptRows, (row) => ({
    user_email: anon.email,
    user_key: anon.ownerKey,
    event_id: replaceEmailInKey(row?.event_id, userEmail, anon.email),
    attempt_id: replaceEmailInKey(row?.attempt_id, userEmail, anon.email),
    metadata: {
      ...(row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      account_deleted: true,
    },
    description: accountDeletedDescription(row?.description),
  }));

  return {
    leaderboard,
    gameRecords,
    lobbyMessages,
    diamondTransactions,
    dailyWheelSpins,
    onlineMatchResults,
    questionAttemptEvents,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return json({ ok: false, code: 'unauthenticated', error: 'Giriş yapmanız gerekiyor.' }, 401);
    }

    const userEmail = normalizeEmail(user.email);
    const userId = String(user.id || '');
    if (!userEmail || !userId) {
      return json({ ok: false, code: 'invalid_account', error: 'Hesap doğrulanamadı.' }, 400);
    }

    const anon = anonymizedIdentity(user);
    await Promise.all([
      removePushSubscriptions(base44, userEmail),
      removeSocialRows(base44, userEmail),
      cancelOrAnonymizeInvites(base44, userEmail, anon),
      anonymizeLobbyRows(base44, userEmail, userId, anon),
      removeOrAnonymizePublicRows(base44, user, userEmail, anon),
    ]);

    await base44.asServiceRole.entities.User.delete(userId);

    return json({
      ok: true,
      success: true,
      deleted: true,
    });
  } catch (error) {
    console.error('[deleteAccount] failed', error);
    return json({
      ok: false,
      code: 'account_deletion_failed',
      error: 'Hesap silinemedi. Lütfen tekrar deneyin veya destek ile iletişime geçin.',
    }, 500);
  }
});
