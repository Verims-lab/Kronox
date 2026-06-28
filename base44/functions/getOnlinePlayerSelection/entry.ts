import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const PRESENCE_ONLINE_TTL_MS = 75 * 1000;
const MAX_SELECTION_ROWS = 200;
const PRESENCE_SCAN_LIMIT = 600;

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
}: {
  targetRef: string;
  username: string;
  relation: 'friend' | 'not_friend';
  online: boolean;
  lastSeenAt?: string | null;
  expiresAt?: string | null;
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
    last_seen_at: lastSeenAt || null,
    expires_at: expiresAt || null,
  };
}

async function getAcceptedFriends(base44: any, myEmail: string) {
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
    const user = await base44.auth.me();
    if (!user?.email) return json({ ok: false, error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const limit = normalizeLimit(body?.limit);
    const myEmail = normalizeEmail(user.email);
    const myPresenceKey = makeOwnerKeyHash(myEmail);
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
      const online = isOnlinePresence(latest, nowMs);
      addRow(buildPublicRow({
        targetRef,
        username: safePublicUsername(latest?.username || friend.username, friend.email),
        relation: 'friend',
        online,
        lastSeenAt: latest?.last_heartbeat_at || latest?.last_seen_at || null,
        expiresAt: latest?.presence_expires_at || latest?.expires_at || null,
      }));
    }

    for (const [targetRef, presence] of freshOnline.entries()) {
      if (!targetRef || targetRef === myPresenceKey || friendKeys.has(targetRef)) continue;
      const targetEmail = normalizeEmail(presence?.user_email || presence?.backend_recipient_email);
      if (!targetEmail || targetEmail === myEmail) continue;
      addRow(buildPublicRow({
        targetRef,
        username: safePublicUsername(presence?.username, targetRef),
        relation: 'not_friend',
        online: true,
        lastSeenAt: presence?.last_heartbeat_at || presence?.last_seen_at || null,
        expiresAt: presence?.presence_expires_at || presence?.expires_at || null,
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
      },
    });
  } catch {
    return json({ ok: false, error: 'Oyuncu listesi yüklenemedi.' }, 500);
  }
});
