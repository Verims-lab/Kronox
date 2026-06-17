import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HASH_ALGORITHM = 'sha256:kronox_guest_v1';
const USERNAME_PREFIX = 'KronoxUser';
const GUEST_ID_PREFIX = 'guest_';
const MAX_USERNAME_ATTEMPTS = 18;
const MAX_GUEST_ID_ATTEMPTS = 8;
const TOKEN_BYTE_LENGTH = 32;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function nowIso() {
  return new Date().toISOString();
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function makeGuestId() {
  return `${GUEST_ID_PREFIX}${bytesToBase64Url(randomBytes(16)).slice(0, 22)}`;
}

function makeGuestToken() {
  return bytesToBase64Url(randomBytes(TOKEN_BYTE_LENGTH));
}

function randomUsernameCandidate() {
  const bytes = randomBytes(4);
  const value = (
    (bytes[0] << 24)
    | (bytes[1] << 16)
    | (bytes[2] << 8)
    | bytes[3]
  ) >>> 0;
  const suffix = 1000 + (value % 90000);
  return `${USERNAME_PREFIX}${suffix}`;
}

function safeCredentialText(value: unknown, maxLength = 180) {
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

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function guestProfileEntity(base44: any) {
  return base44?.asServiceRole?.entities?.GuestProfile || base44?.entities?.GuestProfile || null;
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest));
}

async function hashGuestToken(guestId: string, guestToken: string) {
  return sha256Base64Url(`kronox_guest_v1:${guestId}:${guestToken}`);
}

async function findGuestProfile(base44: any, guestId: string) {
  const entity = guestProfileEntity(base44);
  if (!entity?.filter || !guestId) return null;
  const rows = await entity.filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function usernameExists(base44: any, username: string) {
  const entity = guestProfileEntity(base44);
  if (!entity?.filter || !username) return false;
  const rows = await entity.filter({ username }, '-created_at', 1).catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function generateUniqueUsername(base44: any) {
  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt += 1) {
    const username = randomUsernameCandidate();
    if (!(await usernameExists(base44, username))) return username;
  }
  const fallback = `${USERNAME_PREFIX}${bytesToBase64Url(randomBytes(4)).slice(0, 5).toUpperCase()}`;
  if (!(await usernameExists(base44, fallback))) return fallback;
  throw new Error('guest_username_generation_failed');
}

function publicGuestProfile(row: any) {
  return {
    guest_id: String(row?.guest_id || ''),
    username: String(row?.username || ''),
    display_name: String(row?.display_name || row?.username || ''),
    status: String(row?.status || 'guest'),
    onboarding_status: String(row?.onboarding_status || 'not_started'),
    tutorial_status: String(row?.tutorial_status || 'not_started'),
    profile_setup_status: String(row?.profile_setup_status || 'pending'),
    category_setup_status: String(row?.category_setup_status || 'pending'),
    created_at: row?.created_at || row?.created_date || null,
    last_seen_at: row?.last_seen_at || row?.updated_at || null,
  };
}

async function updateLastSeen(base44: any, row: any) {
  const entity = guestProfileEntity(base44);
  const id = rowId(row);
  if (!entity?.update || !id) return row;
  return entity.update(id, { last_seen_at: nowIso() });
}

async function verifyExistingGuest(base44: any, guestId: string, guestToken: string) {
  const row = await findGuestProfile(base44, guestId);
  if (!row) return json({ ok: false, error: 'guest_profile_not_found' }, 404);
  const expectedHash = String(row?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!expectedHash || expectedHash !== providedHash) {
    return json({ ok: false, error: 'invalid_guest_token' }, 401);
  }
  const updated = await updateLastSeen(base44, row).catch(() => row);
  return json({
    ok: true,
    created: false,
    profile: publicGuestProfile(updated || row),
    contract: {
      appOwnedGuestProfile: true,
      firebaseUsed: false,
      base44AnonymousAuthUsed: false,
      rawGuestTokenServerStored: false,
      rawGuestTokenClientOnly: true,
      tokenHashStored: true,
      usernameFormat: `${USERNAME_PREFIX}####`,
    },
  });
}

async function createGuestProfile(base44: any) {
  const entity = guestProfileEntity(base44);
  if (!entity?.create || !entity?.filter) {
    return json({ ok: false, error: 'guest_profile_entity_unavailable' }, 500);
  }

  const timestamp = nowIso();
  const username = await generateUniqueUsername(base44);
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_GUEST_ID_ATTEMPTS; attempt += 1) {
    const guestId = makeGuestId();
    const guestToken = makeGuestToken();
    const existing = await findGuestProfile(base44, guestId);
    if (existing) continue;
    const tokenHash = await hashGuestToken(guestId, guestToken);
    try {
      const created = await entity.create({
        guest_id: guestId,
        guest_token_hash: tokenHash,
        guest_token_hash_algorithm: HASH_ALGORITHM,
        username,
        display_name: username,
        status: 'guest',
        onboarding_status: 'not_started',
        tutorial_status: 'not_started',
        profile_setup_status: 'pending',
        category_setup_status: 'pending',
        linked_user_email: '',
        linked_auth_user_id: '',
        created_at: timestamp,
        last_seen_at: timestamp,
        metadata: {
          appOwnedGuestProfile: true,
          portableIdentity: true,
          firebaseUsed: false,
          base44AnonymousAuthUsed: false,
          rawGuestTokenServerStored: false,
        },
      });
      return json({
        ok: true,
        created: true,
        profile: publicGuestProfile(created),
        guest_token: guestToken,
        contract: {
          appOwnedGuestProfile: true,
          firebaseUsed: false,
          base44AnonymousAuthUsed: false,
          rawGuestTokenServerStored: false,
          rawGuestTokenClientOnly: true,
          tokenHashStored: true,
          usernameFormat: `${USERNAME_PREFIX}####`,
        },
      }, 201);
    } catch (error) {
      lastError = error;
    }
  }

  console.warn('[createGuestProfile] create failed without exposing guest token', {
    reason: String((lastError as Error)?.message || 'guest_profile_create_failed').slice(0, 120),
  });
  return json({ ok: false, error: 'guest_profile_create_failed' }, 500);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json().catch(() => ({}));
    const guestId = normalizeGuestId(body?.guest_id);
    const guestToken = normalizeGuestToken(body?.guest_token);

    if (guestId || guestToken) {
      if (!guestId || !guestToken) return json({ ok: false, error: 'guest_credentials_required' }, 400);
      return verifyExistingGuest(base44, guestId, guestToken);
    }

    return createGuestProfile(base44);
  } catch (error) {
    console.warn('[createGuestProfile] failed', {
      reason: String((error as Error)?.message || 'guest_profile_error').slice(0, 120),
    });
    return json({ ok: false, error: 'guest_profile_error' }, 500);
  }
});
