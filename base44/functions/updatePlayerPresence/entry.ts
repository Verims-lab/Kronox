import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const PRESENCE_ONLINE_TTL_MS = 2 * 60 * 1000;

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

function normalizeSessionId(value: unknown) {
  const sessionId = String(value || '').trim();
  return /^presence_[A-Za-z0-9_-]{12,80}$/.test(sessionId) ? sessionId : '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return json({ ok: false, error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const sessionId = normalizeSessionId(body?.session_id);
    if (!sessionId) return json({ ok: false, error: 'session_id is required' }, 400);

    const myEmail = normalizeEmail(user.email);
    const ownerKeyHash = makeOwnerKeyHash(myEmail);
    if (!ownerKeyHash) return json({ ok: false, error: 'Invalid actor' }, 400);

    const status = body?.status === 'offline' ? 'offline' : 'online';
    const now = new Date();
    const expiresAt = new Date(
      status === 'online' ? now.getTime() + PRESENCE_ONLINE_TTL_MS : now.getTime(),
    );
    const username = safePublicUsername(
      user.username || user.public_username || user.display_name || user.full_name,
      myEmail,
    );

    const payload = {
      owner_key_hash: ownerKeyHash,
      user_email: myEmail,
      player_type: 'linked',
      username,
      session_id: sessionId,
      status,
      last_seen_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      source: 'app_heartbeat',
    };

    const existing = await base44.asServiceRole.entities.PlayerPresence.filter({
      owner_key_hash: ownerKeyHash,
      session_id: sessionId,
    }, '-updated_date', 1);

    const row = existing?.[0]
      ? await base44.asServiceRole.entities.PlayerPresence.update(existing[0].id, payload)
      : await base44.asServiceRole.entities.PlayerPresence.create(payload);

    return json({
      ok: true,
      presence: {
        presence_key: ownerKeyHash,
        username,
        status: row?.status || status,
        last_seen_at: row?.last_seen_at || payload.last_seen_at,
        expires_at: row?.expires_at || payload.expires_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown presence update error';
    return json({ ok: false, error: message }, 500);
  }
});
