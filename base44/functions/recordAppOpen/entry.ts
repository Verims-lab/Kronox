import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const GUEST_ID_PREFIX = 'guest_';
const HASH_ALGORITHM = 'sha256:kronox_guest_v1';
const PLATFORM_VALUES = new Set(['ios', 'android', 'other', 'unknown']);

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

function safeCredentialText(value: unknown, maxLength = 220) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) return '';
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
}

function normalizeGuestId(value: unknown) {
  const text = safeCredentialText(value, 80);
  return text.startsWith(GUEST_ID_PREFIX) ? text : '';
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

function normalizePlatform(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  return PLATFORM_VALUES.has(normalized) ? normalized : 'unknown';
}

function platformFromUserAgent(value: unknown) {
  const ua = String(value || '').toLowerCase();
  if (!ua) return 'unknown';
  if (/\b(android)\b/.test(ua)) return 'android';
  if (/\b(iphone|ipad|ipod)\b/.test(ua)) return 'ios';
  return 'other';
}

function resolveCoarsePlatform(req: Request, body: any) {
  const bodyPlatform = normalizePlatform(body?.platform_class || body?.platform);
  if (bodyPlatform !== 'unknown') return bodyPlatform;
  return platformFromUserAgent(req.headers.get('user-agent') || '');
}

async function findGuestProfile(base44: any, guestId: string) {
  const entity = base44?.asServiceRole?.entities?.GuestProfile || base44?.entities?.GuestProfile;
  if (!entity?.filter || !guestId) return null;
  const rows = await entity.filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function updateGuestOpen(base44: any, body: any, patch: Record<string, unknown>) {
  const guestId = normalizeGuestId(body?.guest_id);
  const guestToken = normalizeGuestToken(body?.guest_token);
  if (!guestId || !guestToken) {
    return json({ ok: false, code: 'guest_credentials_required', error: 'Guest credentials required' }, 401);
  }

  const row = await findGuestProfile(base44, guestId);
  const expectedHash = String(row?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!row || !expectedHash || expectedHash !== providedHash) {
    return json({ ok: false, code: 'invalid_guest_token', error: 'Guest session could not be verified' }, 401);
  }
  if (String(row?.guest_token_hash_algorithm || HASH_ALGORITHM) !== HASH_ALGORITHM) {
    return json({ ok: false, code: 'invalid_guest_token_algorithm', error: 'Guest session could not be verified' }, 401);
  }

  const entity = base44?.asServiceRole?.entities?.GuestProfile || base44?.entities?.GuestProfile;
  const id = rowId(row);
  if (!entity?.update || !id) return json({ ok: false, code: 'guest_update_unavailable', error: 'Guest activity could not be recorded' }, 500);

  await entity.update(id, {
    ...patch,
    metadata: {
      ...(row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      appOpenTracking: 'server_time_coarse_platform_v1',
      rawGuestTokenServerStored: false,
      preciseDeviceFingerprintStored: false,
    },
  });

  return json({
    ok: true,
    actor_type: 'guest',
    tracked: true,
    serverTimeUsed: true,
    clientTimestampIgnored: true,
    preciseDeviceFingerprintStored: false,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const base44 = createClientFromRequest(req);
  const body = await readBody(req);
  const now = new Date().toISOString();
  const platform = resolveCoarsePlatform(req, body);
  const patch = {
    last_app_open_at: now,
    last_seen_at: now,
    app_platform: platform,
    app_platform_updated_at: now,
  };

  try {
    const user = await base44.auth.me().catch(() => null);
    const email = normalizeEmail(user?.email || user?.user_email);
    if (email) {
      if (!base44?.auth?.updateMe) return json({ ok: false, code: 'user_update_unavailable', error: 'User activity could not be recorded' }, 500);
      await base44.auth.updateMe(patch);
      return json({
        ok: true,
        actor_type: 'linked',
        tracked: true,
        serverTimeUsed: true,
        clientTimestampIgnored: true,
        platform_class: platform,
        preciseDeviceFingerprintStored: false,
      });
    }

    return updateGuestOpen(base44, body, patch);
  } catch (_error) {
    return json({ ok: false, code: 'record_app_open_failed', error: 'App open could not be recorded' }, 500);
  }
});
