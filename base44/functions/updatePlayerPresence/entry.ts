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
      userEmail: '',
      playerType: 'guest',
      username: safePublicUsername(guest?.username || guest?.display_name, guestId),
    },
  };
}

async function resolvePresenceActor(base44: any, body: any) {
  const user = await base44.auth.me().catch(() => null);
  if (user?.email) {
    const myEmail = normalizeEmail(user.email);
    const ownerKeyHash = makeOwnerKeyHash(myEmail);
    if (!ownerKeyHash) {
      return { ok: false, response: json({ ok: false, error: 'Invalid actor' }, 400), actor: null };
    }
    return {
      ok: true,
      response: null,
      actor: {
        ownerKeyHash,
        userEmail: myEmail,
        playerType: 'linked',
        username: safePublicUsername(
          user.username || user.public_username || user.display_name || user.full_name,
          myEmail,
        ),
      },
    };
  }

  return verifyGuestProfile(base44, body);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const sessionId = normalizeSessionId(body?.session_id);
    if (!sessionId) return json({ ok: false, error: 'session_id is required' }, 400);

    const resolved = await resolvePresenceActor(base44, body);
    if (!resolved.ok) return resolved.response;
    const actor = resolved.actor;
    if (!actor?.ownerKeyHash) return json({ ok: false, error: 'Invalid actor' }, 400);

    const status = body?.status === 'offline' ? 'offline' : 'online';
    const now = new Date();
    const expiresAt = new Date(
      status === 'online' ? now.getTime() + PRESENCE_ONLINE_TTL_MS : now.getTime(),
    );

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

    const existing = await base44.asServiceRole.entities.PlayerPresence.filter({
      owner_key_hash: actor.ownerKeyHash,
      session_id: sessionId,
    }, '-updated_date', 1);

    const row = existing?.[0]
      ? await base44.asServiceRole.entities.PlayerPresence.update(existing[0].id, payload)
      : await base44.asServiceRole.entities.PlayerPresence.create(payload);

    return json({
      ok: true,
      presence: {
        presence_key: actor.ownerKeyHash,
        username: actor.username,
        status: row?.status || status,
        last_seen_at: row?.last_heartbeat_at || row?.last_seen_at || payload.last_heartbeat_at,
        expires_at: row?.presence_expires_at || row?.expires_at || payload.presence_expires_at,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown presence update error';
    return json({ ok: false, error: message }, 500);
  }
});
