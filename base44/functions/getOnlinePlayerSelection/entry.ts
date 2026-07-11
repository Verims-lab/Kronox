import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const PRESENCE_ONLINE_TTL_MS = 75 * 1000;
const MAX_SELECTION_ROWS = 200;
const PRESENCE_SCAN_LIMIT = 600;
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const AVATAR_TYPE_VALUES = new Set(['icon', 'photo']);
const AVATAR_ICON_IDS = new Set([
  'shield', 'helmet', 'sword', 'crown', 'trophy', 'hourglass', 'clock', 'timer',
  'calendar', 'portal', 'wand', 'scroll', 'crystal', 'planet', 'rocket', 'orbit',
  'telescope', 'book', 'compass', 'brain', 'landmark', 'lightning', 'flame',
  'moon', 'sun', 'star',
]);
const AVATAR_COLOR_IDS = new Set(['gold', 'cyan', 'violet', 'emerald', 'rose', 'blue']);
const SOCIAL_REF_PATTERN = /^social_[A-Za-z0-9_-]{20,80}$/;

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const json = (body: unknown, status = 200) => Response.json(body, { status });

function makeOwnerKeyHash(email: unknown) {
  const normalized = normalizeEmail(email);
  if (!normalized) return '';
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function makeGuestOwnerKeyHash(guestId: unknown) {
  const normalized = String(guestId || '').trim().toLowerCase();
  if (!normalized) return '';
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `g_${(hash >>> 0).toString(36)}`;
}

function makeUsernameFallback(seed: unknown) {
  const text = String(seed || '').trim();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `KronoxUser${1000 + ((hash >>> 0) % 90000)}`;
}

function normalizeKronoxUserId(value: unknown) {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
}

function safeCredentialText(value: unknown, maxLength = 180) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) return '';
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
}

function normalizeGuestId(value: unknown) {
  const text = safeCredentialText(value, 80);
  return text.startsWith('guest_') ? text : '';
}

function normalizeGuestToken(value: unknown) {
  return safeCredentialText(value, 220);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomSocialRef() {
  return `social_${bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)))}`;
}

async function ensureSocialRef(entity: any, row: any) {
  const current = String(row?.social_ref || '').trim();
  if (SOCIAL_REF_PATTERN.test(current)) return current;
  const id = String(row?.id || row?._id || '').trim();
  if (!id || !entity?.update) throw new Error('Actor profile cannot be updated');
  const socialRef = randomSocialRef();
  await entity.update(id, { social_ref: socialRef });
  return socialRef;
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest));
}

async function hashGuestToken(guestId: string, guestToken: string) {
  return sha256Base64Url(`kronox_guest_v1:${guestId}:${guestToken}`);
}

function guestProfileEntity(base44: any) {
  return base44?.asServiceRole?.entities?.GuestProfile || base44?.entities?.GuestProfile || null;
}

function safePublicUsername(value: unknown, fallbackSeed: unknown) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  const safe = Boolean(
    normalized
      && /^[A-Za-z0-9_]{3,24}$/.test(normalized)
      && !normalized.includes('@')
      && !/^(apple|google|firebase|auth0|base44|provider|uid|owner)(?:[\w:-].*)?$/i.test(normalized)
      && !/^(guest|player|owner|user_key|player_key|g|u)_[A-Za-z0-9_-]{4,}$/i.test(normalized)
  );
  return safe ? normalized : makeUsernameFallback(fallbackSeed);
}

function normalizeAvatarColorId(value: unknown) {
  const text = String(value || '').trim();
  return AVATAR_COLOR_IDS.has(text) ? text : 'gold';
}

function isSafeAvatarPhotoUrl(value: unknown) {
  const text = String(value || '').trim();
  if (!text || text.length > 2048) return false;
  try {
    return new URL(text).protocol === 'https:';
  } catch {
    return false;
  }
}

function readSafeAvatarPhotoUrl(row: any = {}) {
  const candidates = [
    row?.avatar_url,
    row?.avatarUrl,
    row?.avatar_image_url,
    row?.avatarImageUrl,
    row?.profile_avatar_url,
    row?.profileAvatarUrl,
  ];
  for (const value of candidates) {
    if (isSafeAvatarPhotoUrl(value)) return String(value).trim();
  }
  return '';
}

function pickPublicAvatarFields(row: any = {}) {
  const type = String(row?.avatar_type || '').trim();
  const iconId = String(row?.avatar_icon_id || '').trim();
  const colorId = normalizeAvatarColorId(row?.avatar_color_id);
  const avatarUrl = readSafeAvatarPhotoUrl(row);

  if ((type === 'photo' || !type) && avatarUrl) {
    return { avatar_type: 'photo', avatar_icon_id: '', avatar_color_id: colorId, avatar_url: avatarUrl };
  }
  if (type === 'icon' && AVATAR_ICON_IDS.has(iconId)) {
    return { avatar_type: 'icon', avatar_icon_id: iconId, avatar_color_id: colorId, avatar_url: '' };
  }
  if (!type && AVATAR_ICON_IDS.has(iconId)) {
    return { avatar_type: 'icon', avatar_icon_id: iconId, avatar_color_id: colorId, avatar_url: '' };
  }
  if (type && !AVATAR_TYPE_VALUES.has(type)) {
    return { avatar_type: '', avatar_icon_id: '', avatar_color_id: colorId, avatar_url: '' };
  }
  return { avatar_type: '', avatar_icon_id: '', avatar_color_id: colorId, avatar_url: '' };
}

function readTime(value: unknown) {
  const time = new Date(String(value || '')).getTime();
  return Number.isFinite(time) ? time : NaN;
}

function isOnlinePresence(row: any, nowMs: number) {
  if (!row || row.status !== 'online') return false;
  const expiresAt = readTime(row.presence_expires_at || row.expires_at);
  if (Number.isFinite(expiresAt)) return expiresAt > nowMs;
  const lastSeenAt = readTime(row.last_heartbeat_at || row.last_seen_at);
  return Number.isFinite(lastSeenAt) && lastSeenAt + PRESENCE_ONLINE_TTL_MS > nowMs;
}

function normalizeLimit(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MAX_SELECTION_ROWS;
  return Math.max(1, Math.min(MAX_SELECTION_ROWS, Math.trunc(numeric)));
}

function buildPublicRow({
  targetRef,
  username,
  relation,
  online,
  lastSeenAt,
  expiresAt,
  avatarSource,
  inviteEnabled = true,
  selectionDisabledReason = '',
}: {
  targetRef: string;
  username: string;
  relation: 'friend' | 'not_friend';
  online: boolean;
  lastSeenAt?: string | null;
  expiresAt?: string | null;
  avatarSource?: any;
  inviteEnabled?: boolean;
  selectionDisabledReason?: string;
}) {
  const group = relation === 'friend'
    ? (online ? 'online_friend' : 'offline_friend')
    : 'online_non_friend';
  return {
    target_ref: targetRef,
    username,
    relation,
    online,
    status: online ? 'online' : 'offline',
    group,
    invite_enabled: inviteEnabled,
    selection_disabled_reason: selectionDisabledReason,
    last_seen_at: lastSeenAt || null,
    expires_at: expiresAt || null,
    ...pickPublicAvatarFields(avatarSource),
  };
}

async function getUserPublicProfile(base44: any, email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const rows = await base44.asServiceRole.entities.User.filter({ email: normalized }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || null;
}

async function findCurrentUserRow(base44: any, user: any, email: string) {
  const rows = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || user || null;
}

async function verifyGuestProfile(base44: any, body: any) {
  const guestId = normalizeGuestId(body?.guest_id);
  const guestToken = normalizeGuestToken(body?.guest_token);
  if (!guestId || !guestToken) {
    return { ok: false, response: json({ ok: false, error: 'Unauthorized' }, 401), actor: null };
  }

  const entity = guestProfileEntity(base44);
  if (!entity?.filter) {
    return { ok: false, response: json({ ok: false, error: 'GuestProfile unavailable' }, 503), actor: null };
  }

  const rows = await entity.filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
  const guest = Array.isArray(rows) && rows[0] ? rows[0] : null;
  const expectedHash = String(guest?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!guest || !expectedHash || expectedHash !== providedHash) {
    return { ok: false, response: json({ ok: false, error: 'invalid_guest_token' }, 401), actor: null };
  }

  const ownerKeyHash = makeGuestOwnerKeyHash(guestId);
  const socialRef = await ensureSocialRef(entity, guest);
  return {
    ok: true,
    response: null,
    actor: {
      ownerKeyHash,
      socialRef,
      kronoxUserId: normalizeKronoxUserId(guest?.kronox_user_id),
      myEmail: '',
      playerType: 'guest',
      username: safePublicUsername(guest?.username || guest?.display_name, guestId),
      profile: guest,
    },
  };
}

async function resolveSelectionActor(base44: any, body: any) {
  const user = await base44.auth.me().catch(() => null);
  if (user?.email) {
    const myEmail = normalizeEmail(user.email);
    const storedUser = await findCurrentUserRow(base44, user, myEmail);
    const ownerKeyHash = makeOwnerKeyHash(myEmail);
    if (!ownerKeyHash) {
      return { ok: false, response: json({ ok: false, error: 'Invalid actor' }, 400), actor: null };
    }
    const socialRef = await ensureSocialRef(base44.asServiceRole.entities.User, storedUser);
    return {
      ok: true,
      response: null,
      actor: {
        ownerKeyHash,
        socialRef,
        kronoxUserId: normalizeKronoxUserId(storedUser?.kronox_user_id || user?.kronox_user_id),
        myEmail,
        playerType: 'linked',
        username: safePublicUsername(
          storedUser?.username || storedUser?.public_username || storedUser?.display_name || user.username || user.public_username || user.display_name || user.full_name,
          myEmail,
        ),
        profile: storedUser,
      },
    };
  }

  return verifyGuestProfile(base44, body);
}

async function getAcceptedFriends(base44: any, myEmail: string) {
  if (!myEmail) return [];
  const [incomingAccepted, outgoingAccepted] = await Promise.all([
    base44.asServiceRole.entities.FriendRequest.filter({ to_email: myEmail, status: 'accepted' }, '-updated_date', 200),
    base44.asServiceRole.entities.FriendRequest.filter({ from_email: myEmail, status: 'accepted' }, '-updated_date', 200),
  ]);

  const raw = [
    ...(incomingAccepted || []).map((row: any) => ({
      email: normalizeEmail(row.from_email),
      username: row.from_username || row.from_name,
    })),
    ...(outgoingAccepted || []).map((row: any) => ({
      email: normalizeEmail(row.to_email),
      username: row.to_username || row.to_name,
    })),
  ].filter((friend) => friend.email && friend.email !== myEmail);

  const seen = new Set<string>();
  return raw.filter((friend) => {
    if (seen.has(friend.email)) return false;
    seen.add(friend.email);
    return true;
  });
}

function latestPresenceByOwner(rows: any[], nowMs: number) {
  const byOwner = new Map<string, any>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(row?.selection_ref || '').trim();
    if (!key) continue;
    const existing = byOwner.get(key);
    if (!existing || readTime(row?.last_heartbeat_at || row?.last_seen_at) > readTime(existing?.last_heartbeat_at || existing?.last_seen_at)) {
      byOwner.set(key, row);
    }
  }
  const freshOnline = new Map<string, any>();
  for (const [key, row] of byOwner.entries()) {
    if (isOnlinePresence(row, nowMs)) freshOnline.set(key, row);
  }
  return { latest: byOwner, freshOnline };
}

function randomPublicRef(prefix: string) {
  return `${prefix}_${bytesToBase64Url(crypto.getRandomValues(new Uint8Array(24)))}`;
}

async function ensurePublicRef(entity: any, row: any, prefix: string) {
  const current = String(row?.public_ref || '').trim();
  if (current) return current;
  const id = String(row?.id || row?._id || '').trim();
  if (!id || !entity?.update) return '';
  const publicRef = randomPublicRef(prefix);
  await entity.update(id, { public_ref: publicRef });
  return publicRef;
}

function effectiveLifecycleStatus(row: any, nowMs: number) {
  const status = String(row?.status || '').toLowerCase();
  const expiresAt = readTime(row?.expires_at);
  return status === 'pending' && Number.isFinite(expiresAt) && expiresAt <= nowMs ? 'expired' : status;
}

async function buildSocialSnapshot(base44: any, actor: any, nowMs: number) {
  const myEmail = normalizeEmail(actor?.myEmail);
  const actorKeyHash = String(actor?.ownerKeyHash || '').trim();
  if (!myEmail && !actorKeyHash) {
    return {
      friends: [],
      incomingFriendRequests: [],
      outgoingFriendRequests: [],
      incomingGameInvites: [],
      outgoingGameInvites: [],
    };
  }

  const [incomingFriendRows, outgoingFriendRows, incomingInviteRows, outgoingInviteRows, presenceRows] = await Promise.all([
    myEmail
      ? base44.asServiceRole.entities.FriendRequest.filter({ to_email: myEmail }, '-updated_date', 200).catch(() => [])
      : Promise.resolve([]),
    myEmail
      ? base44.asServiceRole.entities.FriendRequest.filter({ from_email: myEmail }, '-updated_date', 200).catch(() => [])
      : Promise.resolve([]),
    myEmail
      ? base44.asServiceRole.entities.GameInvite.filter({ to_email: myEmail }, '-updated_date', 100).catch(() => [])
      : Promise.resolve([]),
    myEmail
      ? base44.asServiceRole.entities.GameInvite.filter({ from_email: myEmail }, '-updated_date', 100).catch(() => [])
      : base44.asServiceRole.entities.GameInvite.filter({ from_actor_key_hash: actorKeyHash }, '-updated_date', 100).catch(() => []),
    base44.asServiceRole.entities.PlayerPresence.filter({ status: 'online' }, '-last_seen_at', PRESENCE_SCAN_LIMIT).catch(() => []),
  ]);

  const profileCache = new Map<string, any>();
  const getProfile = async (email: unknown) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    if (!profileCache.has(normalized)) {
      profileCache.set(normalized, await getUserPublicProfile(base44, normalized));
    }
    return profileCache.get(normalized) || null;
  };
  const { freshOnline } = latestPresenceByOwner(presenceRows || [], nowMs);

  const publicFriendRequest = async (row: any, direction: 'incoming' | 'outgoing') => {
    const publicRef = await ensurePublicRef(base44.asServiceRole.entities.FriendRequest, row, 'friendreq');
    const otherEmail = direction === 'incoming' ? row?.from_email : row?.to_email;
    const profile = await getProfile(otherEmail);
    const username = safePublicUsername(
      direction === 'incoming'
        ? (profile?.username || profile?.public_username || row?.from_username || row?.from_name)
        : (profile?.username || profile?.public_username || row?.to_username || row?.to_name),
      publicRef,
    );
    return {
      id: publicRef,
      request_ref: publicRef,
      direction,
      status: effectiveLifecycleStatus(row, nowMs),
      username,
      ...(direction === 'incoming'
        ? { from_name: username, from_username: username, sender_name: username }
        : { to_name: username, to_username: username, recipient_name: username }),
      expires_at: row?.expires_at || null,
      created_at: row?.created_at || row?.created_date || null,
      updated_at: row?.updated_at || row?.updated_date || null,
      ...pickPublicAvatarFields(profile),
    };
  };

  const acceptedPairs = [
    ...(incomingFriendRows || []).filter((row: any) => row?.status === 'accepted').map((row: any) => ({ row, email: row?.from_email, username: row?.from_username || row?.from_name })),
    ...(outgoingFriendRows || []).filter((row: any) => row?.status === 'accepted').map((row: any) => ({ row, email: row?.to_email, username: row?.to_username || row?.to_name })),
  ];
  const friendByRef = new Map<string, any>();
  for (const pair of acceptedPairs) {
    const profile = await getProfile(pair.email);
    if (!profile) continue;
    const targetRef = await ensureSocialRef(base44.asServiceRole.entities.User, profile);
    if (!targetRef || friendByRef.has(targetRef)) continue;
    const presence = freshOnline.get(targetRef) || null;
    const online = isOnlinePresence(presence, nowMs);
    const username = safePublicUsername(profile?.username || profile?.public_username || pair.username, targetRef);
    friendByRef.set(targetRef, {
      id: targetRef,
      target_ref: targetRef,
      presence_ref: targetRef,
      presence_key: targetRef,
      friend_username: username,
      friend_name: username,
      username,
      relation: 'friend',
      online,
      status: online ? 'online' : 'offline',
      last_seen_at: presence?.last_heartbeat_at || presence?.last_seen_at || null,
      ...pickPublicAvatarFields(profile || presence),
    });
  }

  const lobbyCache = new Map<string, any>();
  const getLobby = async (internalId: unknown) => {
    const id = String(internalId || '').trim();
    if (!id) return null;
    if (!lobbyCache.has(id)) {
      const lobby = await base44.asServiceRole.entities.Lobby.get(id).catch(() => null);
      if (lobby && !lobby.public_ref) {
        const publicRef = randomPublicRef('lobby');
        await base44.asServiceRole.entities.Lobby.update(id, { public_ref: publicRef });
        lobby.public_ref = publicRef;
      }
      lobbyCache.set(id, lobby);
    }
    return lobbyCache.get(id) || null;
  };
  const publicInvite = async (row: any, direction: 'incoming' | 'outgoing') => {
    const inviteRef = await ensurePublicRef(base44.asServiceRole.entities.GameInvite, row, 'invite');
    const lobby = await getLobby(row?.lobby_id);
    const fromName = safePublicUsername(row?.from_name, inviteRef);
    const toName = safePublicUsername(row?.to_name, inviteRef);
    const status = effectiveLifecycleStatus(row, nowMs);
    if (status === 'expired' && row?.status === 'pending') {
      await base44.asServiceRole.entities.GameInvite.update(row.id, {
        status: 'expired',
        expired_at: new Date(nowMs).toISOString(),
      }).catch(() => null);
    }
    return {
      id: inviteRef,
      invite_ref: inviteRef,
      direction,
      status,
      from_name: fromName,
      sender_name: fromName,
      to_name: toName,
      recipient_name: toName,
      lobby_id: lobby?.public_ref || null,
      lobby_ref: lobby?.public_ref || null,
      lobby_code: lobby?.code || row?.lobby_code || '',
      recipient_is_self: direction === 'incoming',
      sender_is_self: direction === 'outgoing',
      expires_at: row?.expires_at || null,
      created_at: row?.created_at || row?.created_date || null,
      accepted_at: row?.accepted_at || null,
      declined_at: row?.declined_at || null,
    };
  };

  return {
    friends: Array.from(friendByRef.values()),
    incomingFriendRequests: await Promise.all((incomingFriendRows || []).filter((row: any) => effectiveLifecycleStatus(row, nowMs) === 'pending').map((row: any) => publicFriendRequest(row, 'incoming'))),
    outgoingFriendRequests: await Promise.all((outgoingFriendRows || []).filter((row: any) => ['pending', 'expired'].includes(effectiveLifecycleStatus(row, nowMs))).map((row: any) => publicFriendRequest(row, 'outgoing'))),
    incomingGameInvites: await Promise.all((incomingInviteRows || []).map((row: any) => publicInvite(row, 'incoming'))),
    outgoingGameInvites: await Promise.all((outgoingInviteRows || []).map((row: any) => publicInvite(row, 'outgoing'))),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const limit = normalizeLimit(body?.limit);
    const resolved = await resolveSelectionActor(base44, body);
    if (!resolved.ok) return resolved.response;
    const actor = resolved.actor;
    const action = String(body?.action || 'selection').trim().toLowerCase();
    if (action === 'social_snapshot') {
      const social = await buildSocialSnapshot(base44, actor, Date.now());
      return json({
        ok: true,
        ...social,
        privacy: {
          publicIdentity: 'username',
          publicReferences: 'random_opaque_refs',
          forbiddenIdentityFieldsReturned: false,
        },
      });
    }
    const myEmail = normalizeEmail(actor?.myEmail);
    const mySelectionRef = String(actor?.socialRef || '');
    if (!SOCIAL_REF_PATTERN.test(mySelectionRef)) return json({ ok: false, error: 'Invalid actor' }, 400);

    const nowMs = Date.now();
    const friends = await getAcceptedFriends(base44, myEmail);
    const friendRefs = new Set<string>();

    const onlinePresenceRows = await base44.asServiceRole.entities.PlayerPresence.filter(
      { status: 'online' },
      '-last_seen_at',
      Math.max(limit, PRESENCE_SCAN_LIMIT),
    ).catch(() => []);
    const { freshOnline } = latestPresenceByOwner(onlinePresenceRows || [], nowMs);

    const rows: any[] = [];
    const seenTargetRefs = new Set<string>();
    const addRow = (row: any) => {
      if (!row?.target_ref || seenTargetRefs.has(row.target_ref)) return;
      seenTargetRefs.add(row.target_ref);
      rows.push(row);
    };

    for (const friend of friends) {
      const friendProfile = await getUserPublicProfile(base44, friend.email);
      if (!friendProfile) continue;
      const targetRef = await ensureSocialRef(base44.asServiceRole.entities.User, friendProfile);
      if (!targetRef || targetRef === mySelectionRef) continue;
      friendRefs.add(targetRef);
      let latest = freshOnline.get(targetRef) || null;
      if (!latest) {
        const friendPresence = await base44.asServiceRole.entities.PlayerPresence.filter(
          { selection_ref: targetRef },
          '-last_seen_at',
          10,
        ).catch(() => []);
        latest = (friendPresence || [])[0] || null;
      }
      const online = isOnlinePresence(latest, nowMs);
      addRow(buildPublicRow({
        targetRef,
        username: safePublicUsername(latest?.username || friendProfile?.username || friendProfile?.public_username || friend.username, friend.email),
        relation: 'friend',
        online,
        lastSeenAt: latest?.last_heartbeat_at || latest?.last_seen_at || null,
        expiresAt: latest?.presence_expires_at || latest?.expires_at || null,
        avatarSource: friendProfile || latest,
      }));
    }

    for (const [targetRef, presence] of freshOnline.entries()) {
      if (!targetRef || targetRef === mySelectionRef || friendRefs.has(targetRef)) continue;
      const targetEmail = normalizeEmail(presence?.user_email || presence?.backend_recipient_email);
      if (targetEmail && targetEmail === myEmail) continue;
      const targetProfile = targetEmail ? await getUserPublicProfile(base44, targetEmail) : null;
      const inviteEnabled = Boolean(targetEmail);
      addRow(buildPublicRow({
        targetRef,
        username: safePublicUsername(presence?.username || targetProfile?.username || targetProfile?.public_username, targetRef),
        relation: 'not_friend',
        online: true,
        lastSeenAt: presence?.last_heartbeat_at || presence?.last_seen_at || null,
        expiresAt: presence?.presence_expires_at || presence?.expires_at || null,
        avatarSource: targetProfile || presence,
        inviteEnabled,
        selectionDisabledReason: inviteEnabled ? '' : 'code_join_only',
      }));
    }

    const order: Record<string, number> = {
      online_friend: 0,
      online_non_friend: 1,
      offline_friend: 2,
    };
    rows.sort((a, b) => {
      const groupDelta = (order[a.group] ?? 99) - (order[b.group] ?? 99);
      if (groupDelta !== 0) return groupDelta;
      return String(a.username || '').localeCompare(String(b.username || ''), 'tr');
    });

    return json({
      ok: true,
      players: rows.slice(0, limit),
      privacy: {
        targetEmailReturned: false,
        publicIdentity: 'username',
        targetReference: 'random_social_ref',
        rawGuestIdReturned: false,
        ownerKeyReturned: false,
      },
    });
  } catch {
    return json({ ok: false, error: 'Oyuncu listesi yüklenemedi.' }, 500);
  }
});
