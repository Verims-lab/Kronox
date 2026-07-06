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
  return {
    ok: true,
    response: null,
    actor: {
      ownerKeyHash,
      kronoxUserId: normalizeKronoxUserId(guest?.kronox_user_id),
      myEmail: '',
      playerType: 'guest',
      username: safePublicUsername(guest?.username || guest?.display_name, guestId),
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
    return {
      ok: true,
      response: null,
      actor: {
        ownerKeyHash,
        kronoxUserId: normalizeKronoxUserId(storedUser?.kronox_user_id || user?.kronox_user_id),
        myEmail,
        playerType: 'linked',
        username: safePublicUsername(
          storedUser?.username || storedUser?.public_username || storedUser?.display_name || user.username || user.public_username || user.display_name || user.full_name,
          myEmail,
        ),
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
    const key = String(row?.owner_key_hash || '').trim();
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const limit = normalizeLimit(body?.limit);
    const resolved = await resolveSelectionActor(base44, body);
    if (!resolved.ok) return resolved.response;
    const actor = resolved.actor;
    const myEmail = normalizeEmail(actor?.myEmail);
    const myPresenceKey = String(actor?.ownerKeyHash || '');
    if (!myPresenceKey) return json({ ok: false, error: 'Invalid actor' }, 400);

    const nowMs = Date.now();
    const friends = await getAcceptedFriends(base44, myEmail);
    const friendKeys = new Set(friends.map((friend) => makeOwnerKeyHash(friend.email)).filter(Boolean));

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
      const targetRef = makeOwnerKeyHash(friend.email);
      if (!targetRef || targetRef === myPresenceKey) continue;
      let latest = freshOnline.get(targetRef) || null;
      if (!latest) {
        const friendPresence = await base44.asServiceRole.entities.PlayerPresence.filter(
          { owner_key_hash: targetRef },
          '-last_seen_at',
          10,
        ).catch(() => []);
        latest = (friendPresence || [])[0] || null;
      }
      const friendProfile = await getUserPublicProfile(base44, friend.email);
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
      if (!targetRef || targetRef === myPresenceKey || friendKeys.has(targetRef)) continue;
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
        targetReference: 'opaque_presence_key',
        rawGuestIdReturned: false,
        ownerKeyReturned: false,
      },
    });
  } catch {
    return json({ ok: false, error: 'Oyuncu listesi yüklenemedi.' }, 500);
  }
});
