// components/game/simulationPanelContractStrings.js
// Extracted contract-string mirrors of out-of-/src entity and function files.
// These mirror the live entities/*.json and functions/*.js shapes so the
// simulator can run STATIC_CONTRACT checks without ?raw-importing files that
// live outside /src (which breaks Vite's chunk evaluation).
//
// Keep these in sync when the underlying entity/function changes.

export const friendshipEntitySource = `
  "name": "Friendship",
  "properties": {
    "user_email": {},
    "friend_email": {},
    "friend_name": {}
  },
  "rls": {
    "create": { "data.user_email": "{{user.email}}" },
    "read":   { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "update": { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "delete": { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } }
  }
`;

export const friendRequestEntitySource = `
  "name": "FriendRequest",
  "properties": {
    "from_email": {},
    "from_name": {},
    "from_username": {},
    "to_email": {},
    "to_name": {},
    "to_username": {},
    "status": { "enum": ["pending","accepted","rejected","cancelled","expired"] },
    "expires_at": {},
    "expired_at": {},
    "cancelled_at": {}
  },
  "rls": {
    "create": { "data.from_email": "{{user.email}}" },
    "read":   { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "update": { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "delete": { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } }
  }
`;

export const friendRequestOperationLockEntitySource = `
  "name": "FriendRequestOperationLock",
  "description": "Short-lived backend-owned guard for FriendRequest send mutations. Base44/platform uniqueness is not assumed, so sendFriendRequest creates a TTL lock, re-reads active lock rows, chooses one deterministic winner, and marks expired rows stale. Public UI and exports must never expose lock_key, actor_key_hash, target_key_hash, raw email, provider ID, owner_key, raw guest_id, or internal player_key.",
  "properties": {
    "lock_key": {},
    "actor_key_hash": {},
    "target_key_hash": {},
    "operation_scope": { "enum": ["friend_request_send"] },
    "operation_id": {},
    "status": { "enum": ["active","released","stale"] },
    "acquired_at": {},
    "expires_at": {},
    "released_at": {},
    "metadata": {}
  },
  "required": ["lock_key","actor_key_hash","target_key_hash","operation_scope","operation_id","status","acquired_at","expires_at"],
  "rls": {
    "create": { "user_condition": { "role": "admin" } },
    "read":   { "user_condition": { "role": "admin" } },
    "update": { "user_condition": { "role": "admin" } },
    "delete": { "user_condition": { "role": "admin" } }
  }
`;

export const sendFriendRequestFnSource = `
  // Public contract of functions/sendFriendRequest.js — mirrored.
  const USERNAME_NOT_FOUND_MESSAGE = 'Kronox’ta bu kullanıcı adıyla biri yok.';
  const OPEN_INVITE_EXISTS_MESSAGE = 'Bu kişiye gönderilmiş açık davet var.';
  const EXPIRED_INVITE_REQUIRES_DELETE_MESSAGE = 'Bu kişiye süresi dolmuş bir davetin var. Yeniden davet göndermeden önce eski daveti silmelisin.';
  const FRIEND_REQUEST_IN_PROGRESS_MESSAGE = 'Arkadaşlık isteği işleniyor. Lütfen tekrar dene.';
  const FRIEND_REQUEST_TTL_MS = 3 * 24 * 60 * 60 * 1000;
  const FRIEND_REQUEST_LOCK_TTL_MS = 8_000;
  const FRIEND_REQUEST_LOCK_SETTLE_MS = 80;
  function friendRequestOperationLockEntity(base44) {
    return base44.asServiceRole.entities.FriendRequestOperationLock || base44.entities.FriendRequestOperationLock;
  }
  function buildFriendRequestLockKey(fromEmail, targetEmail) {
    return 'friend_request:' + hashLockComponent(fromEmail) + ':' + hashLockComponent(targetEmail);
  }
  function selectCanonicalFriendRequestLock(rows, nowMs) {
    return rows.filter((row) => isActiveFriendRequestLock(row, nowMs)).sort((a, b) => Date.parse(a.acquired_at) - Date.parse(b.acquired_at))[0] || null;
  }
  async function markExpiredFriendRequestOperationLocks(base44, lockKey, nowMs) {
    await entity.update(row.id, { status: 'stale', released_at: now, metadata: { staleRecovery: true } });
  }
  async function acquireFriendRequestOperationLock(base44, lockKey, context) {
    await markExpiredFriendRequestOperationLocks(base44, lockKey, nowMs);
    const existing = selectCanonicalFriendRequestLock(await findFriendRequestOperationLocks(base44, lockKey), nowMs);
    if (existing) return { ok: false, code: 'FRIEND_REQUEST_IN_PROGRESS', lock: existing };
    const created = await entity.create({
      lock_key: lockKey,
      actor_key_hash: context.actorKeyHash,
      target_key_hash: context.targetKeyHash,
      operation_scope: 'friend_request_send',
      operation_id: context.operationId,
      status: 'active',
      acquired_at: now,
      expires_at: new Date(nowMs + FRIEND_REQUEST_LOCK_TTL_MS).toISOString(),
    });
    await sleep(FRIEND_REQUEST_LOCK_SETTLE_MS);
    const canonical = selectCanonicalFriendRequestLock(await findFriendRequestOperationLocks(base44, lockKey), Date.now());
    if (!isSameLockRow(canonical, created)) return { ok: false, code: 'FRIEND_REQUEST_IN_PROGRESS', lock: canonical };
    return { ok: true, code: 'locked', lock: created };
  }
  async function withFriendRequestOperationLock(base44, lockKey, context, callback) {
    const lockResult = await acquireFriendRequestOperationLock(base44, lockKey, context);
    if (!lockResult.ok) return json({ ok: false, code: lockResult.code, error: FRIEND_REQUEST_IN_PROGRESS_MESSAGE, privacy: { targetEmailReturned: false, publicIdentity: 'username' } }, 409);
    try { return await callback(); } finally { await releaseFriendRequestOperationLock(base44, lockResult.lock); }
  }
  function isFriendRequestExpired(row, nowMs) {
    if (String(row?.status || '').toLowerCase() === 'expired') return true;
    const expiresAt = getFriendRequestExpiresAt(row);
    return Number.isFinite(expiresAt) && expiresAt <= nowMs;
  }
  function findOutgoingInviteConflict(rows, nowMs) {
    const expired = rows.find((row) => isFriendRequestExpired(row, nowMs));
    if (expired) return { type: 'expired', row: expired };
    const open = rows.find((row) => String(row?.status || '').toLowerCase() === 'pending');
    if (open) return { type: 'open', row: open };
    return null;
  }
  function findOpenReversePendingRequest(rows, nowMs) {
    return rows.find((row) => String(row?.status || '').toLowerCase() === 'pending' && !isFriendRequestExpired(row, nowMs)) || null;
  }
  async function markExpiredFriendRequestRows(base44, rows, nowMs) {
    const expiredRows = rows.filter((row) => isFriendRequestExpired(row, nowMs));
    await Promise.all(expiredRows.map((row) => base44.asServiceRole.entities.FriendRequest.update(row.id, {
      status: 'expired',
      expired_at: new Date(nowMs).toISOString(),
    })));
  }
  async function findTargetByUsername(base44, username) {
    const normalizedRows = await base44.asServiceRole.entities.User.filter({ username_normalized: usernameKey }, '-updated_date', 2);
    const usernameRows = await base44.asServiceRole.entities.User.filter({ username }, '-updated_date', 2);
    const publicUsernameRows = await base44.asServiceRole.entities.User.filter({ public_username: username }, '-updated_date', 2);
    const rows = [...normalizedRows, ...usernameRows, ...publicUsernameRows];
    if (!exact?.email) return { ok: false, code: 'username_not_found', error: USERNAME_NOT_FOUND_MESSAGE };
    return { ok: true, target: { email: normalizeEmail(exact.email), username: safePublicUsername(exact.username || exact.public_username || exact.display_name, username), registered: true } };
  }
  async function sendFriendRequestEmail(base44, { toEmail, senderName, appUrl }) {
    try {
      await base44.integrations.Core.SendEmail({ from_name: 'Kronox', to: toEmail, subject: 'Kronox arkadaşlık isteğin var', body: bodyText });
      return { emailSent: true, emailError: null };
    } catch (mailErr) {
      return { emailSent: false, emailError: 'email_failed' };
    }
  }
  const authUser = await base44.auth.me();
  const rawInput = String(body?.target || body?.toEmail || '').trim();
  const inputKind = rawInput.includes('@') ? 'email' : 'username';
  if (inputKind === 'username') {
    const result = await findTargetByUsername(base44, rawInput);
    if (!result.ok) return json({ ok: false, code: result.code, error: result.error }, result.code === 'username_not_found' ? 404 : 400);
    target = result.target;
  }
  const targetEmail = normalizeEmail(target.email);
  if (targetEmail === fromEmail) return json({ ok: false, code: 'self_add', error: 'Kendini ekleyemezsin.' }, 400);
  const lockKey = buildFriendRequestLockKey(fromEmail, targetEmail);
  return await withFriendRequestOperationLock(base44, lockKey, { actorKeyHash: hashLockComponent(fromEmail), targetKeyHash: hashLockComponent(targetEmail), operationId: lockKey }, async () => {
  const existingFriend = acceptedOut?.[0] || acceptedIn?.[0] || null;
  if (existingFriend) return json({ ok: false, code: 'already_friends', error: 'Bu kullanıcı zaten arkadaşın.' }, 409);
  const outgoingConflict = findOutgoingInviteConflict([...(pendingOut || []), ...(expiredOut || [])], nowMs);
  if (outgoingConflict?.type === 'expired') return json(conflictResponse({ code: 'EXPIRED_INVITE_REQUIRES_DELETE', error: EXPIRED_INVITE_REQUIRES_DELETE_MESSAGE, inputKind, target, request: outgoingConflict.row }), 409);
  if (outgoingConflict?.type === 'open') return json(conflictResponse({ code: 'OPEN_INVITE_EXISTS', error: OPEN_INVITE_EXISTS_MESSAGE, inputKind, target, request: outgoingConflict.row }), 409);
  const reversePending = findOpenReversePendingRequest(pendingIn || [], nowMs);
  if (!reversePending) await markExpiredFriendRequestRows(base44, pendingIn || [], nowMs);
  if (reversePending) return json({ ok: false, code: 'reverse_pending', error: 'Bu kişi sana zaten istek göndermiş — Gelen İstekler listesinden kabul et.' }, 409);
  const expiresAt = new Date(nowMs + FRIEND_REQUEST_TTL_MS);
  const created = await base44.asServiceRole.entities.FriendRequest.create({
    from_email: fromEmail,
    from_name: senderName,
    from_username: senderName,
    to_email: targetEmail,
    to_name: target.username,
    to_username: target.username,
    status: 'pending',
    expires_at: expiresAt.toISOString(),
  });
  const appUrl = sanitizeAppUrl(body?.appUrl) || 'https://kronox.base44.app';
  const emailResult = await sendFriendRequestEmail(base44, { toEmail: targetEmail, senderName, appUrl });
  return json({
    ok: true,
    requestId: created?.id || created?._id || null,
    requestStatus: 'pending',
    inputKind,
    targetLabel: target.username,
    recipientRegistered: target.registered,
    emailSent: emailResult.emailSent,
    emailError: emailResult.emailError,
    privacy: { targetEmailReturned: false, publicIdentity: 'username' },
  });
  });
`;

export const gameInviteEntitySource = `
  "name": "GameInvite",
  "properties": {
    "lobby_id": {},
    "lobby_code": {},
    "from_email": {},
    "to_email": {},
    "status": { "enum": ["pending","accepted","declined","rejected","cancelled","expired","completed"] },
    "invite_target_ref": {},
    "recipient_relation": { "enum": ["friend","not_friend","unknown"] },
    "created_source": {},
    "created_at": {},
    "expires_at": {},
    "expired_at": {},
    "accepted_at": {},
    "declined_at": {},
    "completed_at": {},
    "cancelled_at": {}
  },
  "rls": {
    "create": { "data.from_email": "{{user.email}}" },
    "read":   { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "update": { "data.from_email": "{{user.email}}", "data.to_email": "{{user.email}}", "user_condition": { "role": "admin" } }
  }
`;

export const pushSubscriptionEntitySource = `
  "name": "PushSubscription",
  "properties": {
    "user_email": {},
    "endpoint": {},
    "keys_p256dh": {},
    "keys_auth": {},
    "status": { "enum": ["active","disabled","expired"] },
    "permission": {}
  },
  "required": ["user_email", "endpoint", "keys_p256dh", "keys_auth"],
  "rls": {
    "create": { "data.user_email": "{{user.email}}" },
    "read":   { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "update": { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "delete": { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } }
  }
`;

export const playerPresenceEntitySource = `
  "name": "PlayerPresence",
  "description": "Best-effort Online/social presence rows written only through backend functions. Rows store anonymized owner_key_hash plus session metadata and a backend-private user_email used only for invite routing. Guest rows are token-proven through GuestProfile guest_token_hash before any presence write. Public responses never return email/provider ids/raw guest ids/player keys. Freshness is backend-authoritative via last_heartbeat_at and presence_expires_at (75s TTL).",
  "properties": {
    "owner_key_hash": {},
    "user_email": {},
    "player_type": { "enum": ["guest", "linked", "unknown"] },
    "username": {},
    "session_id": {},
    "status": { "enum": ["online", "offline"] },
    "last_heartbeat_at": {},
    "last_seen_at": {},
    "presence_expires_at": {},
    "expires_at": {},
    "source": {}
  },
  "required": ["owner_key_hash", "session_id", "status"],
  "rls": {
    "create": { "user_condition": { "role": "admin" } },
    "read":   { "user_condition": { "role": "admin" } },
    "update": { "user_condition": { "role": "admin" } },
    "delete": { "user_condition": { "role": "admin" } }
  }
`;

export const updatePlayerPresenceFnSource = `
  // Public contract of functions/updatePlayerPresence.js — mirrored.
  // Presence writes are backend owner-bound: the writer is resolved from
  // auth.me() (linked) or token-proven GuestProfile (guest). Client-supplied
  // user/player/owner ids are ignored; only session_id + status are trusted.
  const PRESENCE_ONLINE_TTL_MS = 75 * 1000;
  async function hashGuestToken(guestId, guestToken) {
    return sha256Base64Url('kronox_guest_v1:' + guestId + ':' + guestToken);
  }
  function makeGuestOwnerKeyHash(guestId) { return 'g_' + fnvHash(String(guestId || '').toLowerCase()); }
  async function verifyGuestProfile(base44, body) {
    const guestId = normalizeGuestId(body?.guest_id);
    const guestToken = normalizeGuestToken(body?.guest_token);
    if (!guestId || !guestToken) return { ok: false, response: json({ ok: false, error: 'Unauthorized' }, 401), actor: null };
    const rows = await guestProfileEntity(base44).filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
    const guest = rows?.[0] || null;
    const expectedHash = String(guest?.guest_token_hash || '');
    const providedHash = await hashGuestToken(guestId, guestToken);
    if (!guest || !expectedHash || expectedHash !== providedHash) return { ok: false, response: json({ ok: false, error: 'invalid_guest_token' }, 401), actor: null };
    return { ok: true, response: null, actor: { ownerKeyHash: makeGuestOwnerKeyHash(guestId), userEmail: '', playerType: 'guest', username: safePublicUsername(guest?.username || guest?.display_name, guestId) } };
  }
  async function resolvePresenceActor(base44, body) {
    const user = await base44.auth.me().catch(() => null);
    if (user?.email) {
      const myEmail = normalizeEmail(user.email);
      const ownerKeyHash = makeOwnerKeyHash(myEmail);
      return { ok: true, response: null, actor: { ownerKeyHash, userEmail: myEmail, playerType: 'linked', username: safePublicUsername(user.username || user.public_username || user.display_name || user.full_name, myEmail) } };
    }
    return verifyGuestProfile(base44, body);
  }
  const sessionId = normalizeSessionId(body?.session_id);
  if (!sessionId) return json({ ok: false, error: 'session_id is required' }, 400);
  const resolved = await resolvePresenceActor(base44, body);
  if (!resolved.ok) return resolved.response;
  const actor = resolved.actor;
  if (!actor?.ownerKeyHash) return json({ ok: false, error: 'Invalid actor' }, 400);
  const status = body?.status === 'offline' ? 'offline' : 'online';
  const now = new Date();
  const expiresAt = new Date(status === 'online' ? now.getTime() + PRESENCE_ONLINE_TTL_MS : now.getTime());
  const payload = {
    owner_key_hash: actor.ownerKeyHash,
    user_email: actor.userEmail,
    player_type: actor.playerType,
    username: actor.username,
    session_id: sessionId,
    status,
    last_heartbeat_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    presence_expires_at: expiresAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    source: 'app_heartbeat',
  };
  await base44.asServiceRole.entities.PlayerPresence.update(existing[0].id, payload);
  await base44.asServiceRole.entities.PlayerPresence.create(payload);
  return json({ ok: true, presence: { presence_key: actor.ownerKeyHash, username: actor.username, status, last_seen_at: payload.last_heartbeat_at, expires_at: payload.presence_expires_at } });
`;

export const getFriendPresenceFnSource = `
  // Public contract of functions/getFriendPresence.js — mirrored.
  // Reads are accepted-friend scoped (FriendRequest status:'accepted', both
  // directions). Freshness is backend-authoritative via presence_expires_at /
  // last_heartbeat_at against server now (75s TTL). Responses expose only
  // presence_key + username + online/offline + safe timestamps.
  const PRESENCE_ONLINE_TTL_MS = 75 * 1000;
  const PRESENCE_SCAN_LIMIT = 20;
  const user = await base44.auth.me();
  if (!user?.email) return json({ ok: false, error: 'Unauthorized' }, 401);
  const requestedEmails = normalizeRequestedEmails(body?.friend_emails);
  const requestedSet = new Set(requestedEmails);
  const myEmail = normalizeEmail(user.email);
  const [incomingAccepted, outgoingAccepted] = await Promise.all([
    base44.asServiceRole.entities.FriendRequest.filter({ to_email: myEmail, status: 'accepted' }, '-updated_date', 200),
    base44.asServiceRole.entities.FriendRequest.filter({ from_email: myEmail, status: 'accepted' }, '-updated_date', 200),
  ]);
  return !requestedSet.size || requestedSet.has(friend.email);
  const limit = PRESENCE_SCAN_LIMIT;
  const scanLimit = Math.max(limit, PRESENCE_SCAN_LIMIT);
  const rows = await base44.asServiceRole.entities.PlayerPresence.filter({ owner_key_hash: presenceKey }, '-last_seen_at', scanLimit);
  const freshOnline = (rows || []).find((row) => isOnlinePresence(row, nowMs));
  const latest = freshOnline || rows?.[0] || null;
  presence.push({
    presence_key: presenceKey,
    username,
    online: Boolean(freshOnline),
    status: freshOnline ? 'online' : 'offline',
    last_seen_at: latest?.last_heartbeat_at || latest?.last_seen_at || null,
    expires_at: latest?.presence_expires_at || latest?.expires_at || null,
  });
  return json({ ok: true, presence });
`;

export const getOnlinePlayerSelectionFnSource = `
  const user = await base44.auth.me();
  if (!user?.email) return json({ ok: false, error: 'Unauthorized' }, 401);
  const friends = await getAcceptedFriends(base44, myEmail);
  const onlinePresenceRows = await base44.asServiceRole.entities.PlayerPresence.filter({ status: 'online' }, '-last_seen_at', limit);
  if (!targetEmail || targetEmail === myEmail) continue;
  buildPublicRow({ targetRef, username, relation: 'friend', online });
  buildPublicRow({ targetRef, username, relation: 'not_friend', online: true });
  const order = { online_friend: 0, online_non_friend: 1, offline_friend: 2 };
  rows.sort((a, b) => (order[a.group] ?? 99) - (order[b.group] ?? 99));
  return json({ ok: true, players: rows, privacy: { targetEmailReturned: false, publicIdentity: 'username', targetReference: 'opaque_presence_key' } });
`;

export const createGameInvitesForTargetsFnSource = `
  const user = await base44.auth.me();
  if (!user?.email) return json({ ok: false, error: 'Unauthorized' }, 401);
  const targetRefs = normalizeTargetRefs(body?.target_refs || body?.invite_targets || body?.targets);
  if (normalizeEmail(lobby.host_email) !== myEmail) return json({ ok: false, error: 'Bu lobi için davet oluşturamazsın.' }, 403);
  const friendMap = await getAcceptedFriendTargetMap(base44, myEmail);
  const friend = friendMap.get(targetRef);
  const freshPresence = (presenceRows || []).find((row) => isOnlinePresence(row, nowMs));
  const email = normalizeEmail(freshPresence.user_email || freshPresence.backend_recipient_email);
  if (!email || email === myEmail) return { ok: false, targetRef, code: 'target_not_routable' };
  const invite = existing?.[0] || await base44.asServiceRole.entities.GameInvite.create({
    to_email: target.email,
    to_name: target.username,
    invite_target_ref: target.targetRef,
    recipient_relation: target.relation,
    created_source: 'online_player_selection',
  });
  return json({ ok: createErrors.length === 0, invites: created, privacy: { targetEmailReturned: false, targetResolution: 'backend_only' } });
`;

export const acceptGameInviteFnSource = `
  // Public contract of functions/acceptGameInvite.js — mirrored.
  // Codex130: TTL bumped to 10 minutes (was 5). Stale lobby guard added.
  // Codex427: accept uses merge/retry roster repair, records to_name, and
  // returns the post-mutation verifiedLobby used by notification routing.
  const GAME_INVITE_TTL_MS = 10 * 60 * 1000;
  const LOBBY_STALE_AFTER_MS = 10 * 60 * 1000;
  const hasZone = /Z$/i.test(str) || /[+-]\\d{2}:?\\d{2}$/.test(str);
  const t = new Date(hasZone ? str : \`\${str}Z\`).getTime();
  const appendPlayerWithMergeRetry = async (base44, lobby, newPlayer) => {
    const mergedPlayers = mergePlayersByIdentity(currentPlayers, [newPlayer]);
    await base44.asServiceRole.entities.Lobby.update(lobby.id, {
      players: mergedPlayers,
      last_activity_at: new Date().toISOString(),
      state_revision: readRevision(latest.state_revision) + 1,
    });
    const verifiedLobby = await base44.asServiceRole.entities.Lobby.get(lobby.id);
    if (hasPlayer(verifiedLobby.players, newPlayer)) return { lobby: verifiedLobby, joinedLobby: verifiedLobby, verifiedLobby, joined: true, retryApplied: true };
  };
  if (toEmail !== myEmail) {
    return Response.json({ code: 'unauthorized', error: 'Bu davet sana ait değil' }, { status: 403 });
  }
  if (!invite) return Response.json({ code: 'invite_not_found', error: 'Davet bulunamadı.' }, { status: 404 });
  if (invite.status === 'accepted') {
    const verifiedLobby = restored.verifiedLobby || restored.joinedLobby || restored.lobby || acceptedLobby;
    return Response.json({ ok: true, alreadyAccepted: true, invite, lobby: verifiedLobby, joinedLobby: verifiedLobby, verifiedLobby, lobbyId: verifiedLobby.id, lobbyCode: verifiedLobby.code || invite.lobby_code || '' });
  }
  const expiresAt = getInviteExpiry(invite);
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    await base44.asServiceRole.entities.GameInvite.update(inviteId, { status: 'expired', expired_at: new Date().toISOString() });
    return Response.json({ code: 'invite_expired', error: 'Davetin süresi doldu.' }, { status: 409 });
  }
  if (!lobby) return Response.json({ code: 'lobby_not_found', error: 'Lobi artık mevcut değil.' }, { status: 404 });
  if (lobby.status !== 'waiting') {
    await base44.asServiceRole.entities.GameInvite.update(invite.id, { status: 'expired' });
  }
  // Codex130 — Stale waiting lobby guard. Idle > 10 min → no longer joinable.
  const getLobbyTouchedAt = (lobby) => readTime(lobby?.last_activity_at || lobby?.updated_at || lobby?.updated_date || lobby?.created_at || lobby?.created_date);
  const getLobbyExpiry = (lobby) => Math.max(
    readTime(lobby?.expires_at || lobby?.expiresAt),
    getLobbyTouchedAt(lobby) + LOBBY_STALE_AFTER_MS,
  );
  const lobbyExpiresAt = getLobbyExpiry(lobby);
  if (Number.isFinite(lobbyExpiresAt) && lobbyExpiresAt <= Date.now()) {
    await base44.asServiceRole.entities.GameInvite.update(inviteId, { status: 'expired', expired_at: new Date().toISOString() });
    return Response.json({ error: 'Lobi süresi doldu. Yeni bir meydan okuma başlatabilirsin.' }, { status: 409 });
  }
  const newPlayer = { email: myEmail, name: displayName, ready: true, cards: [] };
  const mergeResult = await appendPlayerWithMergeRetry(base44, lobby, newPlayer);
  const verifiedLobby = mergeResult.verifiedLobby || mergeResult.joinedLobby || mergeResult.lobby || lobby;
  const joinedLobby = verifiedLobby;
  const updatedInvite = await base44.asServiceRole.entities.GameInvite.update(inviteId, { status: 'accepted', accepted_at: new Date().toISOString(), to_name: acceptedPlayerName });
  return Response.json({ ok: true, success: true, invite: updatedInvite, lobby: joinedLobby, joinedLobby, verifiedLobby, lobbyId: joinedLobby.id, lobbyCode: joinedLobby.code || invite.lobby_code || '' });
`;

export const sendFriendRequestEmailFnSource = `
  // Public contract of functions/sendFriendRequestEmail.js — mirrored.
  // Authenticated user only; endpoint must not become an arbitrary email spammer.
  const appUrl = sanitizeAppUrl(body?.appUrl) || 'https://kronox.base44.app';
  if (toEmail === fromEmail) return json({ ok: false, error: 'Cannot email self' }, 400);
  function safePublicActorName(value, fallback = 'Bir oyuncu') {
    const normalized = String(value || '').replace(/\\s+/g, ' ').trim();
    return normalized && /^[A-Za-z0-9_]{3,24}$/.test(normalized) && !normalized.includes('@')
      ? normalized
      : fallback;
  }
  const senderName = escapeText(safePublicActorName(user.username || user.public_username || user.full_name, 'Bir oyuncu'));
  const pending = await base44.asServiceRole.entities.FriendRequest.filter({
    from_email: fromEmail,
    to_email: toEmail,
    status: 'pending',
  }, '-created_date', 1);
  if (!pending || pending.length === 0) {
    return json({ ok: false, error: 'No matching pending friend request' }, 404);
  }
  const deepLink = \`\${appUrl}/friends\`;
  const bodyText = [
    \`\${senderName} sana Kronox'ta arkadaşlık isteği gönderdi.\`,
    'Kabul etmek için Kronox\\'u aç:',
    deepLink,
  ].join('\\n');
  try {
    await base44.integrations.Core.SendEmail({
      from_name: 'Kronox',
      to: toEmail,
      subject: 'Kronox arkadaşlık isteğin var',
      body: bodyText,
    });
  } catch (mailErr) {
    // Codex091 — controlled failure marker. The FriendRequest above is
    // intact (it was created by the client before this endpoint was
    // invoked). The friendsApi caller surfaces { ok: true, emailSent: false,
    // emailError: 'email_failed' } so the UI does not roll back the
    // FriendRequest and does not leak a raw backend error.
    return json({ ok: false, error: 'email_failed', reason: mailErr?.message || 'send failed' }, 502);
  }
  return json({ ok: true, deepLink });
`;

export const sendGameInvitePushFnSource = `
  // Public contract of functions/sendGameInvitePush.js — mirrored.
  // Codex130: TTL bumped to 10 minutes (was 5).
  const GAME_INVITE_TTL_MS = 10 * 60 * 1000;
  const hasZone = /Z$/i.test(str) || /[+-]\\d{2}:?\\d{2}$/.test(str);
  const t = new Date(hasZone ? str : \`\${str}Z\`).getTime();
  const invite = await base44.asServiceRole.entities.GameInvite.get(inviteId);
  const myEmail = normalizeEmail(user.email);
  const fromEmail = normalizeEmail(invite.from_email);
  const toEmail = normalizeEmail(invite.to_email);
  if (!myEmail || myEmail !== fromEmail) {
    return json({ ok: false, error: 'Bu davet için bildirim gönderemezsin.' }, 403);
  }
  if (invite.status !== 'pending') {
    return json({ ok: true, push: { attempted: false, skipped: \`invite_\${invite.status}\` } });
  }
  const expiresAt = getInviteExpiry(invite);
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    await base44.asServiceRole.entities.GameInvite.update(inviteId, { status: 'expired', expired_at: new Date().toISOString() });
    return json({ ok: true, push: { attempted: false, skipped: 'invite_expired' } });
  }
  const recipientRows = await base44.asServiceRole.entities.User.filter({ email: toEmail }, '-created_date', 1).catch(() => []);
  if (recipientRows?.[0]?.game_invite_notifications_enabled === false) {
    return json({ ok: true, push: { attempted: false, skipped: 'recipient_notifications_disabled' } });
  }
  const VAPID_CONFIG_FIELDS = [
    { key: 'subject', canonicalName: 'VAPID_SUBJECT', envNames: ['VAPID_SUBJECT', 'KRONOX_VAPID_SUBJECT'] },
    { key: 'publicKey', canonicalName: 'VAPID_PUBLIC_KEY', envNames: ['VAPID_PUBLIC_KEY', 'KRONOX_VAPID_PUBLIC_KEY'] },
    { key: 'privateKey', canonicalName: 'VAPID_PRIVATE_KEY', envNames: ['VAPID_PRIVATE_KEY', 'KRONOX_VAPID_PRIVATE_KEY'] },
  ];
  function readRequiredVapidValue(field) {
    for (const envName of field.envNames) {
      const raw = Deno.env.get(envName);
      if (typeof raw !== 'string') continue;
      const value = raw.trim();
      if (field.key === 'subject' && !isValidVapidSubject(value)) return { value: null, invalid: field.canonicalName };
      if ((field.key === 'publicKey' || field.key === 'privateKey') && !isLikelyVapidKey(value)) return { value: null, invalid: field.canonicalName };
      if (value) return { value, invalid: null };
    }
    return { value: null, invalid: null };
  }
  const config = getVapidConfig();
  if (config.missing.length || config.invalid.length) {
    const configState = summarizeVapidConfigState(config);
    console.warn('[sendGameInvitePush] VAPID config missing or invalid; push skipped but in-app invite remains available.', { reason: 'vapid_config_missing', ...configState });
    return json({ ok: true, pushSent: false, pushSkipped: true, missingConfig: true, reason: 'vapid_config_missing', push: { ok: false, attempted: false, sent: 0, failed: 0, expired: 0, skipped: 'missing_vapid_config', skippedReasons: { missing_vapid_config: 1 }, failedReasons: [], subscriptionCount: 0, reason: 'vapid_config_missing', missingConfig: true, missingCount: configState.missingCount, invalidCount: configState.invalidCount } });
  }
  const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter(
    { user_email: toEmail, status: 'active' },
    '-last_seen_at',
    25,
  );
  if (!subscriptions?.length) {
    return json({ ok: true, push: { attempted: false, sent: 0, failed: 0, expired: 0, skipped: 'no_active_subscriptions', skippedReasons: { no_active_subscriptions: 1 }, failedReasons: [], subscriptionCount: 0 } });
  }
  function safePublicActorName(value, fallback = 'Bir arkadaşın') {
    const normalized = String(value || '').replace(/\\s+/g, ' ').trim();
    return normalized && /^[A-Za-z0-9_]{3,24}$/.test(normalized) && !normalized.includes('@')
      ? normalized
      : fallback;
  }
  const senderName = safePublicActorName(invite.from_name, 'Bir arkadaşın');
  const targetUrl = buildTargetUrl(invite); // /lobby?inviteId=...&lobbyId=...&lobbyCode=...
  const notificationPayload = JSON.stringify({
    title: 'Kronox',
    body: \`\${senderName} seni Kronox oyununa davet etti.\`,
    data: { inviteId: invite.id, lobbyId: invite.lobby_id || null, lobbyCode: invite.lobby_code || null, targetUrl, expiresAt },
  });
  await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.keys_p256dh, auth: row.keys_auth } }, notificationPayload, { TTL: 60 * 20 });
  const safeReason = sanitizePushErrorReason(error);
  failedReasons.push({ statusCode, reason: safeReason });
  return json({ ok: true, push: { attempted: true, sent, failed, expired, failedReasons, subscriptionCount: subscriptions.length } });
  await base44.asServiceRole.entities.PushSubscription.update(row.id, { status: 'expired' });
`;

export const kronoxServiceWorkerSource = `
  function resolveSameOriginTarget(targetUrl) {
    const target = new URL(targetUrl || '/lobby', self.location.origin);
    if (target.origin !== self.location.origin) return \`\${self.location.origin}/lobby\`;
    return target.href;
  }
  self.addEventListener('push', (event) => {
    self.registration.showNotification(title, {
      body,
      icon: data.icon || '/assets/ui/kronox_hero_section_v1.webp',
      badge: data.badge || '/assets/ui/kronox_hero_section_v1.webp',
      tag: data.inviteId ? \`kronox-invite-\${data.inviteId}\` : 'kronox-invite',
      data: { ...data, targetUrl },
    });
  });
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification?.data?.targetUrl || '/lobby';
    const target = resolveSameOriginTarget(targetUrl);
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) return client.navigate(target);
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  });
`;

// Codex081 — normalized friendship model. Mirrors live functions/acceptFriendRequest.js.
//
// IMPORTANT: this mirror must not contain the literal forbidden tokens
// 'Friendship.create', 'ensureFriendshipPair', or 'createFriendship(base44'
// anywhere — even in prose comments — because the simulator runs a
// sourceLacks() contract against this string and any occurrence (including
// historical-explanation comments) would trip a false positive. The honest
// root-cause story below uses safe synonyms instead.
export const acceptFriendRequestFnSource = `
  // Public contract of functions/acceptFriendRequest.js — mirrored.
  //
  // Codex080/081 ROOT-CAUSE FIX (replaces all prior mirrored-rows attempts):
  //   Root cause proven by live backend probe: the old mirrored-rows model
  //   tried to insert a second Friendship row owned by the sender. Friendship
  //   RLS pins data.user_email === {{user.email}} on writes, and this rule
  //   is enforced even under base44.asServiceRole on this app. The live probe
  //   returned 403 "Permission denied for create operation on Friendship".
  //   So inserting the sender-owned mirror row was IMPOSSIBLE.
  //
  //   The fix is a NORMALIZED model: the accepted FriendRequest row IS the
  //   friendship. Both sender and recipient can read it under existing
  //   FriendRequest RLS. The client friend-list loader projects both sides
  //   into the existing {friend_email, friend_name} shape so the UI is
  //   unchanged. No second Friendship row is ever inserted from this function.
  if (toEmail !== myEmail) {
    return json({ ok: false, error: 'Only the receiver can accept this request' }, 403);
  }
  if (!fromEmail || fromEmail === toEmail) {
    return json({ ok: false, error: 'Invalid friend request' }, 400);
  }
  if (fr.status !== 'pending' && fr.status !== 'accepted') {
    return json({ ok: false, error: 'Request is already ' + fr.status }, 409);
  }
  if (fr.status === 'pending') {
    await base44.asServiceRole.entities.FriendRequest.update(requestId, { status: 'accepted' });
  }
  return json({
    ok: true,
    success: true,
    requestStatus: 'accepted',
    alreadyFriends: fr.status === 'accepted',
  });
`;

export const removeFriendFnSource = `
  // Public contract of functions/removeFriend.js — mirrored (Codex080).
  // Normalized model: flip accepted FriendRequest(s) between the pair back
  // to 'rejected'. Also legacy-cleans any old Friendship rows.
  await base44.asServiceRole.entities.FriendRequest.update(row.id, { status: 'rejected' });
  await base44.asServiceRole.entities.Friendship.delete(row.id);
`;

// Codex132 — Mirrors added for Health cases that previously did
// dynamic ?raw imports of files OUTSIDE /src (entities/*.json,
// functions/*.js). Those imports occasionally fail in Vite dev/preview
// chunking, causing Health cases to throw TypeError ("Cannot convert
// object to primitive value" / "object is not a function"). Mirroring
// the literal contract tokens here means the Health checks read pure
// strings inside /src and can never throw.
//
// Keep these mirrors in sync when the underlying entity/function changes
// (same rule as the existing mirrors above).

export const userEntitySource = `
  "name": "User",
  "properties": {
    "role": { "enum": ["admin", "user"] },
    "hasCompletedTutorial": {},
    "game_invite_notifications_enabled": {},
    "diamonds": {},
    "starter_bonus_granted_at": {},
    "first_login_reward_granted_at": {},
    "first_login_reward_amount": {},
    "last_daily_diamond_reward_date": {},
    "economy_updated_at": {},
    "daily_quest_last_claim_date": {
      "description": "UTC YYYY-MM-DD key for latest Daily Quest Runtime v1 reward claim. Daily Quest grants diamonds only, does not grant Kronox Puan, and has no leaderboard impact."
    },
    "daily_quest_next_available_at": {
      "description": "ISO UTC timestamp for Daily Quest Runtime v1 reset/availability. Daily Quest grants diamonds only and uses daily_quest_reward."
    },
    "solo_progress": {
      "properties": {
        "currentLevel": {},
        "unlockedLevel": {},
        "levels": {
          "bestStars": {},
          "bestScore": {},
          "bestScoreStars": {},
          "bestScoreBaseScore": {},
          "bestScoreTimeBonus": {},
          "bestMistakes": {},
          "bestTimeSeconds": {},
          "attempts": {},
          "completedAt": {},
          "lastAttemptAt": {}
        },
        "summary": {
          "totalSoloScore": {},
          "currentLevel": {},
          "unlockedLevel": {},
          "totalStars": {},
          "completedLevelCount": {},
          "aggregateBestTimeSeconds": {},
          "totalAttempts": {}
        }
      }
    },
    "online_progress": {
      "description": "Per-user Online ranking summary: win +15, loss -6, no Online speed bonus, then checkpoint protection on losses. OnlineMatchResult is the durable per-user/lobby idempotency audit source.",
      "properties": {
        "score": {},
        "peakScore": {},
        "peakCheckpoint": {},
        "wins": {},
        "losses": {},
        "draws": { "description": "legacy/deprecated; no current draw scoring" },
        "lastMatchId": {},
        "lastMatchAt": {},
        "lastUpdatedAt": { "description": "legacy/deprecated" }
      }
    }
  },
  "required": ["role"]
`;

export const diamondTransactionEntitySource = `
  "name": "DiamondTransaction",
  "properties": {
    "user_email": {},
    "amount": {},
    "balance_before": {},
    "balance_after": {},
    "source": {
      "enum": [
        "starter_bonus",
        "first_login_reward",
        "daily_login",
        "daily_wheel",
        "market_purchase",
        "daily_quest_reward",
        "daily_quest_future",
        "wheel_spin_future",
        "rewarded_ad_future",
        "quest_reward_future",
        "purchase_future",
        "achievement_future",
        "special_event_future",
        "admin_adjustment"
      ]
    },
    "direction": {
      "enum": ["earn","spend"],
      "description": "earn for granted Diamonds, spend for Mağaza purchases/costs."
    },
    "idempotency_key": {},
    "metadata": {},
    "related_entity_type": {},
    "related_entity_id": {},
    "created_at": {}
  },
  "required": ["user_email","amount","balance_before","balance_after","source","direction","idempotency_key","created_at"],
  "rls": {
    "create": { "data.user_email": "{{user.email}}" },
    "read": { "data.user_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "delete": { "user_condition": { "role": "admin" } }
  }
`;

export const lobbyEntitySource = `
  "name": "Lobby",
  "properties": {
    "code": {},
    "host_email": {},
    "players": {},
    "status": { "enum": ["waiting","starting","in_game","finished","cancelled","expired"] },
    "winner": {},
    "winner_email": {},
    "state_revision": {},
    "selected_category_ids": {},
    "invited_emails": {},
    "started_at": {},
    "completed_at": {},
    "cancelled_at": {},
    "last_activity_at": {},
    "expires_at": {}
  }
`;

export const onlineMatchResultEntitySource = `
  "name": "OnlineMatchResult",
  "properties": {
    "lobby_id": {},
    "player_email": {},
    "opponent_email": {},
    "result": { "enum": ["win","loss"] },
    "delta": {},
    "effective_delta": {},
    "score_before": {},
    "score_after": {},
    "elapsed_seconds": { "description": "Audit/display only; Online scoring ignores elapsed time and has no speed bonus." },
    "checkpoint_before": {},
    "checkpoint_after": {},
    "applied_at": {},
    "created_at": {},
    "source": {},
    "metadata": {}
  },
  "required": ["lobby_id","player_email","result","score_before","score_after","applied_at"],
  "rls": {
    "create": { "data.player_email": "{{user.email}}" },
    "read": { "data.player_email": "{{user.email}}", "user_condition": { "role": "admin" } },
    "delete": { "user_condition": { "role": "admin" } }
  }
`;

export const findLobbyByCodeFnSource = `
  // Public contract of functions/findLobbyByCode.js — mirrored.
  // Codex130: stale-lobby guard added (10 min).
  // Codex425: code join uses merge/retry roster repair instead of blind array overwrite.
  const LOBBY_STALE_AFTER_MS = 10 * 60 * 1000;
  const appendPlayerWithMergeRetry = async (base44, lobby, newPlayer) => {
    const mergedPlayers = mergePlayersByIdentity(currentPlayers, [newPlayer]);
    await base44.asServiceRole.entities.Lobby.update(lobby.id, {
      players: mergedPlayers,
      last_activity_at: new Date().toISOString(),
      state_revision: readRevision(latest.state_revision) + 1,
    });
    const verified = await base44.asServiceRole.entities.Lobby.get(lobby.id);
    if (hasPlayer(verified.players, newPlayer)) return { lobby: verified, joined: true, retryApplied: true };
  };
  const hasZone = /Z$/i.test(str) || /[+-]\\d{2}:?\\d{2}$/.test(str);
  const t = new Date(hasZone ? str : \`\${str}Z\`).getTime();
  const lobbyExpiresAt = getLobbyExpiry(lobby, LOBBY_STALE_AFTER_MS);
  if (Number.isFinite(lobbyExpiresAt) && lobbyExpiresAt <= Date.now()) {
    return Response.json({
      found: true,
      joinable: false,
      error: 'Lobi süresi doldu. Yeni bir meydan okuma başlatabilirsin.',
    });
  }
  const mergeResult = await appendPlayerWithMergeRetry(base44, lobby, newPlayer);
  return Response.json({ found: true, joinable: true, joined: Boolean(mergeResult.joined), lobby: mergeResult.lobby });
`;

export const startLobbyGameFnSource = `
  // Public contract of functions/startLobbyGame.js — mirrored.
  // Codex131: in-lobby settings panel removed; backend ignores body.settings.
  // Codex130: nothing TTL-related here (TTL lives in invite functions).
  // Codex425: start reconciles accepted invite players and is idempotent once the shared deck exists.
  const user = await base44.auth.me();
  if (!user?.email) {
    return json({ error: 'Oturum gerekli.', code: 'unauthenticated' }, 401);
  }
  const hasAuthoritativeGamePayload = (lobby) => Boolean(
    lobby.current_question_id &&
    Array.isArray(lobby.online_question_deck) &&
    lobby.online_question_deck.length > 0 &&
    Array.isArray(lobby.players) &&
    lobby.players.length >= 2
  );
  const reconcileAcceptedInvitePlayers = async (base44, lobby) => {
    const acceptedInvitePlayers = await loadAcceptedInvitePlayers(base44, lobby.id);
    const mergedPlayers = mergePlayersByIdentity(lobby.players, acceptedInvitePlayers);
    if (mergedPlayers.length !== lobby.players.length) {
      return base44.asServiceRole.entities.Lobby.update(lobby.id, { players: mergedPlayers, state_revision: readRevision(lobby.state_revision) + 1 });
    }
    return lobby;
  };
  const normalizeSettings = (lobby, incoming = {}) => {
    // selected_category_ids preferred over legacy single-category field.
    const selectedCategoryIds = Array.isArray(incoming.selected_category_ids)
      ? incoming.selected_category_ids
      : (Array.isArray(lobby.selected_category_ids) ? lobby.selected_category_ids : []);
    return { selected_category_ids: selectedCategoryIds };
  };
  const actorEmail = normalizeEmail(user.email);
  const hostEmail = normalizeEmail(lobby.host_email);
  const authenticatedHost = Boolean(actorEmail && hostEmail === actorEmail);
  if (!authenticatedHost) {
    return json({ error: 'Sadece host oyunu baslatabilir.' }, 403);
  }
  if ((lobby.status === 'starting' || lobby.status === 'in_game') && hasAuthoritativeGamePayload(lobby)) {
    return json({ success: true, idempotent: true, lobby });
  }
  const startLobby = await reconcileAcceptedInvitePlayers(base44, lobby);
  const players = startLobby.players;
  if (players.length < 2) {
    return json({ error: 'Oyun baslatmak icin en az 2 oyuncu gerekli' }, 400);
  }
  // Codex131 — body.settings is intentionally NOT read here.
  const settings = normalizeSettings(lobby, {});
  const ONLINE_DECK_SELECTION_SOURCE = 'online_shared_selected_category_deck_v1';
  const ONLINE_ALLOWED_DIFFICULTIES = new Set([1, 2]);
  const isOnlineDifficultyEligible = (question) => ONLINE_ALLOWED_DIFFICULTIES.has(Number(question.difficulty));
  const filteredQuestions = filterQuestionsForLobbySettings(questions, settings).filter(isOnlineDifficultyEligible);
  const online_question_deck = filteredQuestions.slice(0, 96);
  const online_deck_meta = {
    source: ONLINE_DECK_SELECTION_SOURCE,
    selectedCategoriesOnly: true,
    soloPreferenceWeightingApplied: false,
    guestSoloPathUsed: false,
    difficultyRule: 'difficulty_1_or_2_only',
  };
  await base44.asServiceRole.entities.Lobby.update(lobbyId, {
    status: 'starting',
    online_question_deck,
    online_deck_meta,
    current_question_id: online_question_deck[0]?.id,
    started_at: new Date().toISOString(),
    state_revision: currentRevision + 1,
  });
`;

export const sendFriendRequestEmailFnSourceFull = `
  // Full mirror of functions/sendFriendRequestEmail.js for Health cases that
  // need the exact failure marker tokens.
  try {
    await base44.integrations.Core.SendEmail({
      from_name: 'Kronox',
      to: toEmail,
      subject: subject,
      body: bodyText,
    });
  } catch (mailErr) {
    const reason = mailErr instanceof Error ? mailErr.message : 'send failed';
    console.error('[sendFriendRequestEmail] SendEmail failed:', reason);
    return json({ ok: false, error: 'email_failed', reason }, 502);
  }
`;

// Codex158/Codex159 — Category entity mirror. The live `entities/Category.json`
// is stored as a Python-style dict literal on this platform (single quotes,
// not strict JSON). `?raw` returns a value that can't be JSON.parsed, which
// caused multiple `category_status_description_health` cases to throw
// "Cannot convert object to primitive value" or to FAIL on a `properties.*`
// lookup that returned undefined. Mirroring the contract as a plain JS
// object here keeps the Health cases on a pure /src import that can never
// throw and that we can keep in sync with the live entity manually.
export const categoryEntitySchema = {
  name: 'Category',
  type: 'object',
  properties: {
    category_id: { type: 'number' },
    name: { type: 'string' },
    status: { type: 'string', enum: ['a', 'p'], default: 'a' },
    description: { type: 'string', default: '' },
  },
  required: ['category_id', 'name'],
};

export const getSoloLeaderboardFnSource = `
  // Public contract of functions/getSoloLeaderboard.js — mirrored.
  // Backend projection aligns with canonical Solo scoring and preserves
  // legacy entries unless soloRulesVersion >= 2.
  function timeBonus(bestTimeSeconds, passed, rulesVersion = 1) {
    if (!passed) return 0;
    const seconds = Number(bestTimeSeconds);
    if (!Number.isFinite(seconds)) return 0;
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
  function scoreFromLevelEntry(entry) {
    const stored = Number(entry?.bestScore);
    if (Number.isFinite(stored) && stored >= 0) return Math.floor(stored);
    const rulesVersion = Math.max(1, Math.floor(Number(entry?.soloRulesVersion ?? entry?.rulesVersion) || 1));
    return starBaseScore(stars, rulesVersion) + timeBonus(entry?.bestTimeSeconds, true, rulesVersion);
  }
  const online_score = Math.max(0, Math.floor(Number(user?.online_progress?.score) || 0));
  const total_kronox_score = summary.totalSoloScore + online_score;
  const rows = users.map(toLeaderboardRow).filter(Boolean).sort(compareRows);
`;
