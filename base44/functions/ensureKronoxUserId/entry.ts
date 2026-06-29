import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const HASH_ALGORITHM = 'sha256:kronox_guest_v1';
const GUEST_ID_PREFIX = 'guest_';
const KRONOX_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const MAX_ID_ATTEMPTS = 10;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function entityStore(base44: any, entityName: string) {
  return base44?.asServiceRole?.entities?.[entityName] || base44?.entities?.[entityName] || null;
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeCredentialText(value: unknown, maxLength = 220) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) return '';
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
}

function normalizeGuestId(value: unknown) {
  const text = normalizeCredentialText(value, 80);
  return text.startsWith(GUEST_ID_PREFIX) ? text : '';
}

function normalizeGuestToken(value: unknown) {
  return normalizeCredentialText(value, 220);
}

function normalizeKronoxUserId(value: unknown) {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function makeKronoxUserId() {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (byte) => KRONOX_ID_ALPHABET[byte % KRONOX_ID_ALPHABET.length]);
  return `KX-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
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
  return sha256Base64Url(`${HASH_ALGORITHM}:${guestId}:${guestToken}`);
}

async function findRows(entity: any, filter: Record<string, unknown>, sort = '-updated_at', limit = 10) {
  if (!entity?.filter) return [];
  const rows = await entity.filter(filter, sort, limit).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function kronoxUserIdExists(base44: any, kronoxUserId: string) {
  if (!kronoxUserId) return false;
  const [users, guests, tombstones] = await Promise.all([
    findRows(entityStore(base44, 'User'), { kronox_user_id: kronoxUserId }, '-updated_date', 2),
    findRows(entityStore(base44, 'GuestProfile'), { kronox_user_id: kronoxUserId }, '-updated_date', 2),
    findRows(entityStore(base44, 'KronoxUserIdTombstone'), { kronox_user_id: kronoxUserId }, '-reserved_at', 2),
  ]);
  return Boolean(users.length || guests.length || tombstones.length);
}

async function generateUniqueKronoxUserId(base44: any) {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const candidate = makeKronoxUserId();
    if (!(await kronoxUserIdExists(base44, candidate))) return candidate;
  }
  throw new Error('kronox_user_id_generation_failed');
}

async function findCurrentUserRow(base44: any, authUser: any, email: string) {
  const userEntity = entityStore(base44, 'User');
  const directId = rowId(authUser);
  if (directId && userEntity?.get) {
    const direct = await userEntity.get(directId).catch(() => null);
    if (direct) return direct;
  }
  const rows = await findRows(userEntity, { email }, '-updated_date', 5);
  return rows[0] || authUser || null;
}

async function findGuestProfile(base44: any, guestId: string) {
  const rows = await findRows(entityStore(base44, 'GuestProfile'), { guest_id: guestId }, '-created_at', 5);
  return rows[0] || null;
}

async function verifyGuestProfile(base44: any, guestId: string, guestToken: string) {
  const row = await findGuestProfile(base44, guestId);
  if (!row) return { ok: false, code: 'guest_profile_not_found', row: null };
  const expectedHash = String(row?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!expectedHash || expectedHash !== providedHash) return { ok: false, code: 'invalid_guest_token', row: null };
  return { ok: true, code: '', row };
}

async function ensureRowKronoxUserId(base44: any, entityName: 'User' | 'GuestProfile', row: any) {
  const existing = normalizeKronoxUserId(row?.kronox_user_id);
  if (existing) return { row, kronoxUserId: existing, created: false };

  const entity = entityStore(base44, entityName);
  const id = rowId(row);
  if (!entity?.update || !id) throw new Error('kronox_user_id_update_unavailable');
  const kronoxUserId = await generateUniqueKronoxUserId(base44);
  const updated = await entity.update(id, {
    kronox_user_id: kronoxUserId,
    kronox_user_id_created_at: row?.kronox_user_id_created_at || new Date().toISOString(),
    kronox_user_id_source: row?.kronox_user_id_source || 'system_backfill',
  });
  return { row: updated || { ...row, kronox_user_id: kronoxUserId }, kronoxUserId, created: true };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    if (Object.prototype.hasOwnProperty.call(body || {}, 'kronox_user_id')) {
      return json({
        ok: false,
        code: 'kronox_user_id_client_input_forbidden',
        error: 'Kronox ID sistem tarafından atanır.',
      }, 400);
    }

    const authUser = await base44.auth.me().catch(() => null);
    const email = normalizeEmail(authUser?.email || authUser?.user_email);
    if (email) {
      const user = await findCurrentUserRow(base44, authUser, email);
      if (!user) return json({ ok: false, code: 'user_not_found', error: 'Kullanıcı bulunamadı.' }, 404);
      const ensured = await ensureRowKronoxUserId(base44, 'User', user);
      return json({
        ok: true,
        mode: 'registered',
        user: ensured.row,
        kronox_user_id: ensured.kronoxUserId,
        created: ensured.created,
        contract: {
          backendAssigned: true,
          immutableClientInputForbidden: true,
          notAuthorizationProof: true,
          emailProviderIdsPubliclyDisplayed: false,
        },
      });
    }

    const guestId = normalizeGuestId(body?.guest_id);
    const guestToken = normalizeGuestToken(body?.guest_token);
    if (!guestId || !guestToken) {
      return json({ ok: false, code: 'guest_credentials_required', error: 'Misafir profil doğrulaması gerekli.' }, 401);
    }
    const verified = await verifyGuestProfile(base44, guestId, guestToken);
    if (!verified.ok) return json({ ok: false, code: verified.code, error: 'Misafir profil doğrulanamadı.' }, 401);
    const ensured = await ensureRowKronoxUserId(base44, 'GuestProfile', verified.row);
    return json({
      ok: true,
      mode: 'guest',
      profile: ensured.row,
      kronox_user_id: ensured.kronoxUserId,
      created: ensured.created,
      contract: {
        backendAssigned: true,
        guestTokenProofRequired: true,
        rawGuestTokenServerStored: false,
        immutableClientInputForbidden: true,
        notAuthorizationProof: true,
      },
    });
  } catch (error) {
    console.warn('[ensureKronoxUserId] failed without exposing private identity', {
      reason: String((error as Error)?.message || 'kronox_user_id_ensure_failed').slice(0, 120),
    });
    return json({ ok: false, code: 'kronox_user_id_ensure_failed', error: 'Kronox ID hazırlanamadı.' }, 500);
  }
});
