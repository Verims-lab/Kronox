import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const GAME_INVITE_TTL_MS = 10 * 60 * 1000;
const LOBBY_STALE_AFTER_MS = 10 * 60 * 1000;
const PRESENCE_ONLINE_TTL_MS = 75 * 1000;
const TARGET_REF_PATTERN = /^u_[a-z0-9]{3,32}$/;
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

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

function makeUsernameFallback(seed: unknown) {
  const text = String(seed || '').trim();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `KronoxUser${1000 + ((hash >>> 0) % 90000)}`;
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

function normalizeKronoxUserId(value: unknown) {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
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

function getLobbyTouchedAt(lobby: any) {
  return readTime(
    lobby?.last_activity_at ||
    lobby?.updated_at ||
    lobby?.updated_date ||
    lobby?.created_at ||
    lobby?.created_date,
  );
}

function getLobbyExpiry(lobby: any) {
  const explicit = readTime(lobby?.expires_at || lobby?.expiresAt);
  const touched = getLobbyTouchedAt(lobby);
  const derived = Number.isFinite(touched) ? touched + LOBBY_STALE_AFTER_MS : NaN;
  if (Number.isFinite(explicit) && Number.isFinite(derived)) return Math.max(explicit, derived);
  return Number.isFinite(explicit) ? explicit : derived;
}

function normalizeTargetRefs(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((item) => String(item?.target_ref || item?.targetRef || item || '').trim())
      .filter((ref) => TARGET_REF_PATTERN.test(ref)),
  )).slice(0, 3);
}

function normalizePlayerCount(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(2, Math.min(4, Math.trunc(numeric)));
}

async function getAcceptedFriendTargetMap(base44: any, myEmail: string) {
  const [incomingAccepted, outgoingAccepted] = await Promise.all([
    base44.asServiceRole.entities.FriendRequest.filter({ to_email: myEmail, status: 'accepted' }, '-updated_date', 200),
    base44.asServiceRole.entities.FriendRequest.filter({ from_email: myEmail, status: 'accepted' }, '-updated_date', 200),
  ]);
  const byTargetRef = new Map<string, any>();
  const addFriend = (email: string, username: unknown, kronoxUserId: unknown) => {
    const normalized = normalizeEmail(email);
    const targetRef = makeOwnerKeyHash(normalized);
    if (!normalized || !targetRef || normalized === myEmail || byTargetRef.has(targetRef)) return;
    byTargetRef.set(targetRef, {
      targetRef,
      email: normalized,
      kronoxUserId: normalizeKronoxUserId(kronoxUserId),
      username: safePublicUsername(username, normalized),
      relation: 'friend',
    });
  };
  (incomingAccepted || []).forEach((row: any) => addFriend(row.from_email, row.from_username || row.from_name, row.from_kronox_user_id));
  (outgoingAccepted || []).forEach((row: any) => addFriend(row.to_email, row.to_username || row.to_name, row.to_kronox_user_id));
  return byTargetRef;
}

async function findCurrentUserRow(base44: any, user: any, email: string) {
  const rows = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || user || null;
}

async function resolveTarget(base44: any, targetRef: string, {
  myEmail,
  myPresenceKey,
  friendMap,
  nowMs,
}: {
  myEmail: string;
  myPresenceKey: string;
  friendMap: Map<string, any>;
  nowMs: number;
}) {
  if (!targetRef || targetRef === myPresenceKey) {
    return { ok: false, targetRef, code: 'self_target' };
  }

  const friend = friendMap.get(targetRef);
  if (friend?.email) return { ok: true, ...friend };

  const presenceRows = await base44.asServiceRole.entities.PlayerPresence.filter(
    { owner_key_hash: targetRef },
    '-last_seen_at',
    10,
  ).catch(() => []);
  const freshPresence = (presenceRows || []).find((row: any) => isOnlinePresence(row, nowMs));
  if (!freshPresence) return { ok: false, targetRef, code: 'target_not_online_or_friend' };

  const email = normalizeEmail(freshPresence.user_email || freshPresence.backend_recipient_email);
  if (!email || email === myEmail) return { ok: false, targetRef, code: 'target_not_routable' };

  return {
    ok: true,
    targetRef,
    email,
    kronoxUserId: normalizeKronoxUserId(freshPresence.kronox_user_id),
    username: safePublicUsername(freshPresence.username, targetRef),
    relation: 'not_friend',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return json({ ok: false, error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const lobbyId = String(body?.lobby_id || body?.lobbyId || '').trim();
    const targetRefs = normalizeTargetRefs(body?.target_refs || body?.invite_targets || body?.targets);
    if (!lobbyId) return json({ ok: false, error: 'lobby_id is required' }, 400);
    if (!targetRefs.length) return json({ ok: false, error: 'At least one invite target is required' }, 400);

    const myEmail = normalizeEmail(user.email);
    const currentUser = await findCurrentUserRow(base44, user, myEmail);
    const fromKronoxUserId = normalizeKronoxUserId(currentUser?.kronox_user_id || user?.kronox_user_id);
    const myPresenceKey = makeOwnerKeyHash(myEmail);
    const lobby = await base44.asServiceRole.entities.Lobby.get(lobbyId);
    if (!lobby) return json({ ok: false, error: 'Lobi bulunamadı.' }, 404);
    if (normalizeEmail(lobby.host_email) !== myEmail) {
      return json({ ok: false, error: 'Bu lobi için davet oluşturamazsın.' }, 403);
    }
    if (lobby.status !== 'waiting') {
      return json({ ok: false, error: 'Bu lobi artık davet kabul etmiyor.' }, 409);
    }
    const lobbyExpiresAt = getLobbyExpiry(lobby);
    if (Number.isFinite(lobbyExpiresAt) && lobbyExpiresAt <= Date.now()) {
      return json({ ok: false, error: 'Lobi süresi doldu.' }, 409);
    }

    const friendMap = await getAcceptedFriendTargetMap(base44, myEmail);
    const nowMs = Date.now();
    const resolved = await Promise.all(targetRefs.map((targetRef) => resolveTarget(base44, targetRef, {
      myEmail,
      myPresenceKey,
      friendMap,
      nowMs,
    })));

    const failed = resolved
      .filter((item: any) => !item.ok)
      .map((item: any) => ({ target_ref: item.targetRef, code: item.code || 'unresolved_target' }));

    const deduped = new Map<string, any>();
    resolved.filter((item: any) => item.ok && item.email).forEach((item: any) => {
      if (!deduped.has(item.email)) deduped.set(item.email, item);
    });

    const created: any[] = [];
    const createErrors: any[] = [];
    const playerCount = normalizePlayerCount(body?.player_count || body?.playerCount, deduped.size + 1);
    const fromName = safePublicUsername(
      user.username || user.public_username || user.display_name || user.full_name,
      myEmail,
    );

    for (const target of deduped.values()) {
      try {
        const existing = await base44.asServiceRole.entities.GameInvite.filter({
          lobby_id: lobby.id,
          from_email: myEmail,
          to_email: target.email,
          status: 'pending',
        }, '-created_date', 1).catch(() => []);
        const targetKronoxUserId = normalizeKronoxUserId(target.kronoxUserId);
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + GAME_INVITE_TTL_MS);
        const invite = existing?.[0] || await base44.asServiceRole.entities.GameInvite.create({
          lobby_id: lobby.id,
          lobby_code: lobby.code || '',
          from_email: myEmail,
          ...(fromKronoxUserId ? { from_kronox_user_id: fromKronoxUserId } : {}),
          from_name: fromName,
          to_email: target.email,
          ...(targetKronoxUserId ? { to_kronox_user_id: targetKronoxUserId } : {}),
          to_name: target.username,
          status: 'pending',
          created_at: createdAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          game_mode: 'online_challenge',
          player_count: playerCount,
          invite_target_ref: target.targetRef,
          recipient_relation: target.relation,
          created_source: 'online_player_selection',
        });
        created.push({
          id: invite?.id || null,
          target_ref: target.targetRef,
          relation: target.relation,
          duplicatePending: Boolean(existing?.[0]),
        });
      } catch (error) {
        createErrors.push({
          target_ref: target.targetRef,
          code: 'create_failed',
          error: 'create_failed',
        });
      }
    }

    return json({
      ok: createErrors.length === 0,
      attempted: targetRefs.length,
      created: created.length,
      invites: created.filter((item) => item.id),
      failed: [...failed, ...createErrors],
      privacy: {
        targetEmailReturned: false,
        publicIdentity: 'username',
        targetResolution: 'backend_only',
      },
    });
  } catch {
    return json({ ok: false, error: 'Davet hedefleri çözümlenemedi.' }, 500);
  }
});
