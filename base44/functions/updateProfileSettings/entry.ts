import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HASH_ALGORITHM = 'sha256:kronox_guest_v1';
const USERNAME_PREFIX = 'KronoxUser';
const GUEST_ID_PREFIX = 'guest_';
const GENDER_VALUES = new Set(['', 'female', 'male', 'non_binary', 'prefer_not_to_say', 'custom']);

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function nowIso() {
  return new Date().toISOString();
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

function normalizeUsernameInput(value: unknown) {
  const text = String(value || '').trim();
  if (!text || text.length < 3 || text.length > 24) return '';
  if (text.includes('@')) return '';
  if (/^(apple|google|firebase|auth0|base44|provider|uid|owner)[\w:-]*$/i.test(text)) return '';
  return /^[A-Za-z0-9_]+$/.test(text) ? text : '';
}

function normalizeUsernameKey(value: unknown) {
  return normalizeUsernameInput(value).toLowerCase();
}

function normalizeDisplayNameInput(value: unknown, fallbackUsername = '') {
  const text = String(value || fallbackUsername || '').trim().replace(/\s+/g, ' ');
  if (!text || text.length < 2 || text.length > 32) return '';
  if (text.includes('@')) return '';
  if (/^(apple|google|firebase|auth0|base44|provider|uid|owner)[\w:-]*$/i.test(text)) return '';
  return text;
}

function normalizeAge(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const age = Math.trunc(Number(value));
  if (!Number.isFinite(age) || age < 7 || age > 120) return undefined;
  return age;
}

function normalizeGender(value: unknown) {
  const text = String(value || '').trim();
  return GENDER_VALUES.has(text) ? text : undefined;
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

function fnvOwnerKey(prefix: 'u' | 'g', value: string) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function getAuthOwnerKey(email: string) {
  return fnvOwnerKey('u', email);
}

function getGuestOwnerKey(guestId: string) {
  return fnvOwnerKey('g', guestId);
}

function makeFallbackUsername(seed = '') {
  const ownerKey = fnvOwnerKey('g', seed || String(Date.now()));
  let numeric = 0;
  for (let i = 0; i < ownerKey.length; i += 1) numeric += ownerKey.charCodeAt(i) * (i + 1);
  return `${USERNAME_PREFIX}${1000 + (numeric % 90000)}`;
}

function initialFromName(value: string) {
  const text = String(value || USERNAME_PREFIX).trim();
  return text.charAt(0).toLocaleUpperCase('tr-TR') || 'K';
}

async function findRows(entity: any, filter: Record<string, unknown>, sort = '-updated_at', limit = 10) {
  if (!entity?.filter) return [];
  const rows = await entity.filter(filter, sort, limit).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function listRows(entity: any, sort = '-updated_at', limit = 500) {
  if (!entity?.list) return [];
  const rows = await entity.list(sort, limit).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function isSameOwner(row: any, mode: 'guest' | 'user', ownerId: string, email: string) {
  if (mode === 'guest') return String(row?.guest_id || '') === ownerId;
  return normalizeEmail(row?.email || row?.user_email) === email || String(rowId(row) || '') === ownerId;
}

async function usernameTaken(base44: any, username: string, owner: { mode: 'guest' | 'user'; ownerId: string; email: string }) {
  const usernameKey = normalizeUsernameKey(username);
  if (!usernameKey) return true;
  const entities = [
    { entity: entityStore(base44, 'GuestProfile'), name: 'GuestProfile' },
    { entity: entityStore(base44, 'User'), name: 'User' },
  ];
  for (const { entity } of entities) {
    const exactChecks = [
      ...(await findRows(entity, { username_normalized: usernameKey }, '-updated_at', 20)),
      ...(await findRows(entity, { username }, '-updated_at', 20)),
    ];
    if (exactChecks.some((row) => !isSameOwner(row, owner.mode, owner.ownerId, owner.email))) return true;

    const recentRows = await listRows(entity, '-updated_at', 500);
    if (recentRows.some((row) => {
      const rowKey = normalizeUsernameKey(row?.username);
      return rowKey === usernameKey && !isSameOwner(row, owner.mode, owner.ownerId, owner.email);
    })) {
      return true;
    }
  }
  return false;
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

async function findCurrentUserRow(base44: any, authUser: any, email: string) {
  const userEntity = entityStore(base44, 'User');
  const rows = await findRows(userEntity, { email }, '-updated_date', 5);
  return rows[0] || authUser;
}

async function updateCurrentUser(base44: any, user: any, patch: Record<string, unknown>) {
  const entity = entityStore(base44, 'User');
  const id = rowId(user);
  if (entity?.update && id) return entity.update(id, patch);
  if (base44?.auth?.updateMe) return base44.auth.updateMe(patch);
  throw new Error('profile_settings_user_update_unavailable');
}

function publicGuestProfile(row: any) {
  return {
    guest_id: String(row?.guest_id || ''),
    username: String(row?.username || ''),
    display_name: String(row?.display_name || row?.username || ''),
    status: String(row?.status || 'guest'),
    onboarding_status: String(row?.onboarding_status || 'guest_created'),
    tutorial_status: String(row?.tutorial_status || 'not_started'),
    profile_setup_status: String(row?.profile_setup_status || 'pending'),
    category_setup_status: String(row?.category_setup_status || 'pending'),
    age: Number.isFinite(Number(row?.age)) ? Number(row.age) : null,
    gender: String(row?.gender || ''),
    selected_category_ids: Array.isArray(row?.selected_category_ids) ? row.selected_category_ids : [],
    created_at: row?.created_at || row?.created_date || null,
    last_seen_at: row?.last_seen_at || row?.updated_at || null,
    profile_settings_updated_at: row?.profile_settings_updated_at || null,
  };
}


async function refreshLeaderboardIdentity(base44: any, ownerKey: string, displayName: string) {
  const entity = entityStore(base44, 'SoloLeaderboardEntry');
  if (!entity?.filter || !entity?.update || !ownerKey) return false;
  const rows = await findRows(entity, { owner_key: ownerKey }, '-updated_at', 5);
  const existing = rows[0] || null;
  if (!rowId(existing)) return false;
  await entity.update(rowId(existing), {
    display_name: displayName,
    initial: initialFromName(displayName),
    updated_at: nowIso(),
  });
  return true;
}

function buildProfilePatch(body: any, fallbackSeed: string) {
  const rawUsername = String(body?.username || '').trim();
  if (rawUsername && !normalizeUsernameInput(rawUsername)) return { ok: false, code: 'invalid_username' };
  const requestedUsername = normalizeUsernameInput(rawUsername) || makeFallbackUsername(fallbackSeed);
  const username = normalizeUsernameInput(requestedUsername);
  if (!username) return { ok: false, code: 'invalid_username' };
  const displayName = normalizeDisplayNameInput(body?.display_name, username);
  if (!displayName) return { ok: false, code: 'invalid_display_name' };
  const age = normalizeAge(body?.age);
  if (age === undefined) return { ok: false, code: 'invalid_age' };
  const gender = normalizeGender(body?.gender);
  if (gender === undefined) return { ok: false, code: 'invalid_gender' };
  return {
    ok: true,
    patch: {
      username,
      username_normalized: normalizeUsernameKey(username),
      display_name: displayName,
      age,
      gender,
      profile_settings_updated_at: nowIso(),
    },
  };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const authUser = await base44.auth.me().catch(() => null);
    const email = normalizeEmail(authUser?.email || authUser?.user_email);
    const timestamp = nowIso();

    if (email) {
      const user = await findCurrentUserRow(base44, authUser, email);
      const built = buildProfilePatch(body, email || String(rowId(user) || timestamp));
      if (!built.ok) return json({ ok: false, code: built.code, error: 'Profil bilgilerini kontrol et.' }, 400);
      const owner = { mode: 'user' as const, ownerId: String(rowId(user) || ''), email };
      if (await usernameTaken(base44, built.patch.username, owner)) {
        return json({ ok: false, code: 'username_taken', error: 'Bu kullanıcı adı alınmış. Başka bir Kronox adı seç.' }, 409);
      }
      const updatedUser = await updateCurrentUser(base44, user, {
        ...built.patch,
        profile_settings_updated_at: timestamp,
      });
      const leaderboardUpdated = await refreshLeaderboardIdentity(
        base44,
        getAuthOwnerKey(email),
        String(built.patch.display_name),
      ).catch(() => false);
      return json({
        ok: true,
        mode: 'registered',
        user: updatedUser || { ...user, ...built.patch },
        leaderboardUpdated,
        contract: {
          authUserVerifiedServerSide: true,
          usernameUniqueCaseInsensitive: true,
          providerIdsDisplayedPublicly: false,
          ageGenderPublicFields: false,
        },
      });
    }

    const guestId = normalizeGuestId(body?.guest_id);
    const guestToken = normalizeGuestToken(body?.guest_token);
    if (!guestId || !guestToken) {
      return json({ ok: false, code: 'guest_credentials_required', error: 'Misafir profil doğrulaması gerekli.' }, 401);
    }
    const verified = await verifyGuestProfile(base44, guestId, guestToken);
    if (!verified.ok) {
      return json({ ok: false, code: verified.code, error: 'Misafir profil doğrulanamadı.' }, 401);
    }
    const guest = verified.row;
    if (String(guest?.status || 'guest') === 'linked') {
      return json({ ok: false, code: 'guest_already_linked', error: 'Bu misafir profil bağlı hesaba taşınmış.' }, 409);
    }
    const built = buildProfilePatch(body, guestId || timestamp);
    if (!built.ok) return json({ ok: false, code: built.code, error: 'Profil bilgilerini kontrol et.' }, 400);
    const owner = { mode: 'guest' as const, ownerId: guestId, email: '' };
    if (await usernameTaken(base44, built.patch.username, owner)) {
      return json({ ok: false, code: 'username_taken', error: 'Bu kullanıcı adı alınmış. Başka bir Kronox adı seç.' }, 409);
    }
    const entity = entityStore(base44, 'GuestProfile');
    const id = rowId(guest);
    if (!entity?.update || !id) return json({ ok: false, code: 'guest_profile_update_unavailable' }, 500);
    const updatedGuest = await entity.update(id, {
      ...built.patch,
      last_seen_at: timestamp,
    });
    const leaderboardUpdated = await refreshLeaderboardIdentity(
      base44,
      getGuestOwnerKey(guestId),
      String(built.patch.display_name),
    ).catch(() => false);
    return json({
      ok: true,
      mode: 'guest',
      profile: publicGuestProfile(updatedGuest || { ...guest, ...built.patch }),
      leaderboardUpdated,
      contract: {
        guestTokenProofRequired: true,
        rawGuestTokenServerStored: false,
        usernameUniqueCaseInsensitive: true,
        providerIdsDisplayedPublicly: false,
        ageGenderPublicFields: false,
        hashAlgorithm: HASH_ALGORITHM,
      },
    });
  } catch (error) {
    console.warn('[updateProfileSettings] failed without exposing credentials', {
      reason: String((error as Error)?.message || 'profile_settings_update_failed').slice(0, 120),
    });
    return json({ ok: false, code: 'profile_settings_update_failed', error: 'Profil ayarları kaydedilemedi.' }, 500);
  }
});
