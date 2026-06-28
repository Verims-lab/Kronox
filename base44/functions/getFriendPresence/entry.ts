import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const PRESENCE_ONLINE_TTL_MS = 75 * 1000;

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

function normalizeRequestedEmails(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(normalizeEmail).filter(Boolean))).slice(0, 200);
}

async function getUserPublicUsername(base44: any, email: string, fallbackName: string) {
  try {
    const rows = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1);
    const user = rows?.[0] || null;
    return safePublicUsername(
      user?.username || user?.public_username || fallbackName,
      email,
    );
  } catch {
    return safePublicUsername(fallbackName, email);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return json({ ok: false, error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const requestedEmails = normalizeRequestedEmails(body?.friend_emails);
    const requestedSet = new Set(requestedEmails);
    const myEmail = normalizeEmail(user.email);

    const [incomingAccepted, outgoingAccepted] = await Promise.all([
      base44.asServiceRole.entities.FriendRequest.filter({ to_email: myEmail, status: 'accepted' }, '-updated_date', 200),
      base44.asServiceRole.entities.FriendRequest.filter({ from_email: myEmail, status: 'accepted' }, '-updated_date', 200),
    ]);

    const friends = [
      ...(incomingAccepted || []).map((row: any) => ({
        email: normalizeEmail(row.from_email),
        name: row.from_name,
      })),
      ...(outgoingAccepted || []).map((row: any) => ({
        email: normalizeEmail(row.to_email),
        name: row.to_name,
      })),
    ].filter((friend) => friend.email && friend.email !== myEmail);

    const seen = new Set<string>();
    const allowedFriends = friends.filter((friend) => {
      if (seen.has(friend.email)) return false;
      seen.add(friend.email);
      return !requestedSet.size || requestedSet.has(friend.email);
    });

    const nowMs = Date.now();
    const presence = [];
    for (const friend of allowedFriends) {
      const presenceKey = makeOwnerKeyHash(friend.email);
      const rows = await base44.asServiceRole.entities.PlayerPresence.filter({
        owner_key_hash: presenceKey,
      }, '-last_seen_at', 20);
      const freshOnline = (rows || []).find((row: any) => isOnlinePresence(row, nowMs));
      const latest = freshOnline || rows?.[0] || null;
      const username = latest?.username
        ? safePublicUsername(latest.username, friend.email)
        : await getUserPublicUsername(base44, friend.email, friend.name);
      presence.push({
        presence_key: presenceKey,
        username,
        online: Boolean(freshOnline),
        status: freshOnline ? 'online' : 'offline',
        last_seen_at: latest?.last_heartbeat_at || latest?.last_seen_at || null,
        expires_at: latest?.presence_expires_at || latest?.expires_at || null,
      });
    }

    return json({ ok: true, presence });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown friend presence error';
    return json({ ok: false, error: message }, 500);
  }
});
