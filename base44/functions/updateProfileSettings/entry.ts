import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const HASH_ALGORITHM = 'sha256:kronox_guest_v1';
const USERNAME_PREFIX = 'KronoxUser';
const GUEST_ID_PREFIX = 'guest_';
const KRONOX_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const MAX_KRONOX_USER_ID_ATTEMPTS = 10;
const GENDER_VALUES = new Set(['', 'female', 'male', 'non_binary', 'prefer_not_to_say', 'custom']);
const AGE_GROUP_VALUES = new Set(['', '13_17', '18_24', '25_34', '35_44', '45_plus']);
const AVATAR_TYPE_VALUES = new Set(['', 'icon', 'photo']);
const AVATAR_ICON_IDS = new Set([
  'shield', 'hourglass', 'lightning', 'crown', 'compass', 'star', 'book', 'flame',
  'moon', 'planet', 'helmet', 'crystal', 'trophy', 'portal', 'rocket', 'sword',
  'clock', 'timer', 'calendar', 'wand', 'scroll', 'orbit', 'telescope', 'brain',
  'landmark', 'sun',
]);
const AVATAR_COLOR_IDS = new Set(['gold', 'cyan', 'violet', 'emerald', 'rose', 'blue']);
const UNSAFE_PUBLIC_USERNAME_PATTERN = /^(apple|google|firebase|auth0|base44|provider|uid|owner)(?:[\w:-].*)?$/i;
const INTERNAL_ID_PUBLIC_USERNAME_PATTERN = /^(guest|player|owner|user_key|player_key|g|u)_[A-Za-z0-9_-]{4,}$/i;

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
  const explicitName = String(value || '').trim();
  if (
    explicitName &&
    explicitName.length >= 3 &&
    explicitName.length <= 24 &&
    /^[A-Za-z0-9_]+$/.test(explicitName) &&
    !explicitName.includes('@') &&
    !UNSAFE_PUBLIC_USERNAME_PATTERN.test(explicitName) &&
    !INTERNAL_ID_PUBLIC_USERNAME_PATTERN.test(explicitName)
  ) {
    return explicitName;
  }
  return '';
}

function normalizeUsernameKey(value: unknown) {
  return normalizeUsernameInput(value).toLowerCase();
}

function normalizeDisplayNameInput(value: unknown, fallbackUsername = '') {
  const text = String(value || fallbackUsername || '').trim().replace(/\s+/g, ' ');
  if (!text || text.length < 2 || text.length > 32) return '';
  if (text.includes('@')) return '';
  if (UNSAFE_PUBLIC_USERNAME_PATTERN.test(text) || INTERNAL_ID_PUBLIC_USERNAME_PATTERN.test(text)) return '';
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

function normalizeAgeGroup(value: unknown) {
  const text = String(value || '').trim();
  return AGE_GROUP_VALUES.has(text) ? text : undefined;
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

// Returns { avatar_type, avatar_icon_id, avatar_url, avatar_color_id } patch
// fields when the client sends a valid avatar selection, or undefined on
// invalid input, or null when no avatar field was sent (preserve existing).
function buildAvatarPatch(body: any) {
  const hasAvatar = ['avatar_type', 'avatar_icon_id', 'avatar_url', 'avatar_color_id']
    .some((key) => Object.prototype.hasOwnProperty.call(body || {}, key));
  if (!hasAvatar) return null;

  const type = String(body?.avatar_type || '').trim();
  if (!AVATAR_TYPE_VALUES.has(type) || !type) return undefined;
  const colorId = normalizeAvatarColorId(body?.avatar_color_id);

  if (type === 'icon') {
    const iconId = String(body?.avatar_icon_id || '').trim();
    if (!AVATAR_ICON_IDS.has(iconId)) return undefined;
    return { avatar_type: 'icon', avatar_icon_id: iconId, avatar_url: '', avatar_color_id: colorId };
  }
  if (type === 'photo') {
    if (!isSafeAvatarPhotoUrl(body?.avatar_url)) return undefined;
    return { avatar_type: 'photo', avatar_url: String(body.avatar_url).trim(), avatar_icon_id: '', avatar_color_id: colorId };
  }
  return undefined;
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

function normalizeKronoxUserId(value: unknown) {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
}

function makeKronoxUserId() {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (byte) => KRONOX_ID_ALPHABET[byte % KRONOX_ID_ALPHABET.length]);
  return `KX-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
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

function safePublicUsername(value: unknown, fallbackSeed = '') {
  return normalizeUsernameInput(value) || makeFallbackUsername(fallbackSeed);
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

async function kronoxUserIdExists(base44: any, kronoxUserId: string) {
  if (!kronoxUserId) return false;
  const [guestRows, userRows, tombstoneRows] = await Promise.all([
    findRows(entityStore(base44, 'GuestProfile'), { kronox_user_id: kronoxUserId }, '-updated_date', 2),
    findRows(entityStore(base44, 'User'), { kronox_user_id: kronoxUserId }, '-updated_date', 2),
    findRows(entityStore(base44, 'KronoxUserIdTombstone'), { kronox_user_id: kronoxUserId }, '-reserved_at', 2),
  ]);
  return Boolean(guestRows.length || userRows.length || tombstoneRows.length);
}

async function generateUniqueKronoxUserId(base44: any) {
  for (let attempt = 0; attempt < MAX_KRONOX_USER_ID_ATTEMPTS; attempt += 1) {
    const candidate = makeKronoxUserId();
    if (!(await kronoxUserIdExists(base44, candidate))) return candidate;
  }
  throw new Error('kronox_user_id_generation_failed');
}

async function ensureKronoxUserIdPatch(base44: any, row: any, source: string) {
  if (normalizeKronoxUserId(row?.kronox_user_id)) return {};
  return {
    kronox_user_id: await generateUniqueKronoxUserId(base44),
    kronox_user_id_created_at: nowIso(),
    kronox_user_id_source: source,
  };
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
  const username = safePublicUsername(row?.username, row?.guest_id || rowId(row) || '');
  return {
    guest_id: String(row?.guest_id || ''),
    kronox_user_id: normalizeKronoxUserId(row?.kronox_user_id),
    username,
    display_name: username,
    status: String(row?.status || 'guest'),
    onboarding_status: String(row?.onboarding_status || 'guest_created'),
    tutorial_status: String(row?.tutorial_status || 'not_started'),
    profile_setup_status: String(row?.profile_setup_status || 'pending'),
    category_setup_status: String(row?.category_setup_status || 'pending'),
    age: Number.isFinite(Number(row?.age)) ? Number(row.age) : null,
    age_group: String(row?.age_group || ''),
    gender: String(row?.gender || ''),
    selected_category_ids: Array.isArray(row?.selected_category_ids) ? row.selected_category_ids : [],
    avatar_type: AVATAR_TYPE_VALUES.has(String(row?.avatar_type || '')) ? String(row?.avatar_type || '') : '',
    avatar_icon_id: AVATAR_ICON_IDS.has(String(row?.avatar_icon_id || '')) ? String(row?.avatar_icon_id || '') : '',
    avatar_url: isSafeAvatarPhotoUrl(row?.avatar_url) ? String(row?.avatar_url).trim() : '',
    avatar_color_id: row?.avatar_color_id ? normalizeAvatarColorId(row?.avatar_color_id) : '',
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

function buildProfilePatch(body: any, fallbackSeed: string, existingProfile: any = {}) {
  const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(body || {}, key);
  const rawUsername = String(body?.username || '').trim();
  if (rawUsername && !normalizeUsernameInput(rawUsername)) return { ok: false, code: 'invalid_username' };
  const existingUsername = normalizeUsernameInput(existingProfile?.username);
  const requestedUsername = normalizeUsernameInput(rawUsername) || existingUsername || makeFallbackUsername(fallbackSeed);
  const username = normalizeUsernameInput(requestedUsername);
  if (!username) return { ok: false, code: 'invalid_username' };
  const age = hasOwn('age')
    ? normalizeAge(body?.age)
    : (Number.isFinite(Number(existingProfile?.age)) ? Number(existingProfile.age) : null);
  if (age === undefined) return { ok: false, code: 'invalid_age' };
  const ageGroup = hasOwn('age_group')
    ? normalizeAgeGroup(body?.age_group)
    : (normalizeAgeGroup(existingProfile?.age_group) || '');
  if (ageGroup === undefined) return { ok: false, code: 'invalid_age_group' };
  const gender = hasOwn('gender')
    ? normalizeGender(body?.gender)
    : (normalizeGender(existingProfile?.gender) || '');
  if (gender === undefined) return { ok: false, code: 'invalid_gender' };
  const avatarPatch = buildAvatarPatch(body);
  if (avatarPatch === undefined) return { ok: false, code: 'invalid_avatar' };
  return {
    ok: true,
    patch: {
      username,
      username_normalized: normalizeUsernameKey(username),
      display_name: username,
      age,
      age_group: ageGroup,
      gender,
      // Avatar fields only written when a valid avatar selection was sent;
      // otherwise existing avatar is preserved (no field in patch).
      ...(avatarPatch || {}),
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
    if (Object.prototype.hasOwnProperty.call(body || {}, 'kronox_user_id')) {
      return json({ ok: false, code: 'kronox_user_id_client_input_forbidden', error: 'Kronox ID sistem tarafından atanır.' }, 400);
    }
    const authUser = await base44.auth.me().catch(() => null);
    const email = normalizeEmail(authUser?.email || authUser?.user_email);
    const timestamp = nowIso();

    if (email) {
      const user = await findCurrentUserRow(base44, authUser, email);
      const built = buildProfilePatch(body, email || String(rowId(user) || timestamp), user);
      if (!built.ok) return json({ ok: false, code: built.code, error: 'Profil bilgilerini kontrol et.' }, 400);
      const owner = { mode: 'user' as const, ownerId: String(rowId(user) || ''), email };
      if (await usernameTaken(base44, built.patch.username, owner)) {
        return json({ ok: false, code: 'username_taken', error: 'Bu kullanıcı adı alınmış. Başka bir Kronox adı seç.' }, 409);
      }
      const updatedUser = await updateCurrentUser(base44, user, {
        ...built.patch,
        ...(await ensureKronoxUserIdPatch(base44, user, 'system_profile_settings_backfill')),
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
          usernamePreservesExistingWhenEmpty: true,
          providerIdsDisplayedPublicly: false,
          ageGenderPublicFields: false,
          ageGroupPublicFields: false,
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
    const built = buildProfilePatch(body, guestId || timestamp, guest);
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
      ...(await ensureKronoxUserIdPatch(base44, guest, 'system_profile_settings_backfill')),
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
        usernamePreservesExistingWhenEmpty: true,
        providerIdsDisplayedPublicly: false,
        ageGenderPublicFields: false,
        ageGroupPublicFields: false,
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
