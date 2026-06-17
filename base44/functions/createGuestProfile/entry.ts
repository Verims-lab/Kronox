import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HASH_ALGORITHM = 'sha256:kronox_guest_v1';
const USERNAME_PREFIX = 'KronoxUser';
const GUEST_ID_PREFIX = 'guest_';
const MAX_USERNAME_ATTEMPTS = 18;
const MAX_GUEST_ID_ATTEMPTS = 8;
const TOKEN_BYTE_LENGTH = 32;
const JOKER_TYPES = ['mistake_shield', 'card_swap', 'time_freeze'] as const;
const ONBOARDING_STATES = new Set([
  'guest_created',
  'tutorial_in_progress',
  'tutorial_completed',
  'profile_setup_pending',
  'category_setup_pending',
  'onboarding_complete',
  // Phase 1 compatibility values.
  'not_started',
  'in_progress',
  'completed',
]);
const TUTORIAL_STATES = new Set(['not_started', 'in_progress', 'completed', 'skipped']);
const SETUP_STATES = new Set(['pending', 'completed']);
const GENDER_VALUES = new Set(['', 'female', 'male', 'non_binary', 'prefer_not_to_say', 'custom']);

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

function fnvOwnerKey(prefix: 'g', value: string) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function cleanPublicName(value: unknown, fallbackSeed = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 28);
  if (
    text &&
    !text.includes('@') &&
    !/^(apple|google|firebase|auth0|base44|provider|uid)[\w:-]*$/i.test(text)
  ) {
    return text;
  }
  return `${USERNAME_PREFIX}${1000 + ((fallbackSeed.length * 7919) % 90000)}`;
}

function initialFromName(value: string) {
  return cleanPublicName(value).charAt(0).toLocaleUpperCase('tr-TR') || 'K';
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

function soloLeaderboardEntryEntity(base44: any) {
  return base44?.asServiceRole?.entities?.SoloLeaderboardEntry || base44?.entities?.SoloLeaderboardEntry || null;
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

async function usernameExists(base44: any, username: string, excludeGuestId = '') {
  const entity = guestProfileEntity(base44);
  if (!entity?.filter || !username) return false;
  const rows = await entity.filter({ username }, '-created_at', 1).catch(() => []);
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return rows.some((row: any) => String(row?.guest_id || '') !== excludeGuestId);
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
  const selectedCategoryIds = Array.isArray(row?.selected_category_ids)
    ? row.selected_category_ids
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isFinite(value) && value > 0)
    : [];
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
    selected_category_ids: selectedCategoryIds,
    created_at: row?.created_at || row?.created_date || null,
    last_seen_at: row?.last_seen_at || row?.updated_at || null,
    tutorial_completed_at: row?.tutorial_completed_at || null,
    profile_setup_completed_at: row?.profile_setup_completed_at || null,
    category_setup_completed_at: row?.category_setup_completed_at || null,
    onboarding_completed_at: row?.onboarding_completed_at || null,
  };
}

async function updateLastSeen(base44: any, row: any) {
  const entity = guestProfileEntity(base44);
  const id = rowId(row);
  if (!entity?.update || !id) return row;
  return entity.update(id, { last_seen_at: nowIso() });
}

async function getVerifiedGuestRow(base44: any, guestId: string, guestToken: string) {
  const row = await findGuestProfile(base44, guestId);
  if (!row) {
    return {
      ok: false,
      response: json({ ok: false, error: 'guest_profile_not_found' }, 404),
      row: null,
    };
  }
  const expectedHash = String(row?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!expectedHash || expectedHash !== providedHash) {
    return {
      ok: false,
      response: json({ ok: false, error: 'invalid_guest_token' }, 401),
      row: null,
    };
  }
  return { ok: true, response: null, row };
}

async function verifyExistingGuest(base44: any, guestId: string, guestToken: string) {
  const verified = await getVerifiedGuestRow(base44, guestId, guestToken);
  if (!verified.ok) return verified.response;
  const row = verified.row;
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

function normalizeUsernameInput(value: unknown) {
  const text = String(value || '').trim();
  if (!text || text.length < 3 || text.length > 24) return '';
  return /^[A-Za-z0-9_]+$/.test(text) ? text : '';
}

function normalizeDisplayNameInput(value: unknown) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text || text.length < 2 || text.length > 32) return '';
  // Public display names must not look like direct provider/email identity.
  if (text.includes('@') || /^apple|google|firebase|auth0|base44/i.test(text)) return '';
  return text;
}

function normalizeCategoryIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    const numeric = Number(item);
    if (!Number.isFinite(numeric)) continue;
    const id = Math.trunc(numeric);
    if (id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= 100) break;
  }
  return ids;
}

function normalizeNonNegativeInteger(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function normalizeJokerBalances(value: unknown) {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const balances: Record<string, number> = {};
  for (const jokerType of JOKER_TYPES) {
    balances[jokerType] = normalizeNonNegativeInteger(source[jokerType]);
  }
  return balances;
}

function normalizeSoloProgress(value: unknown) {
  const source = value && typeof value === 'object' ? value as any : {};
  const rawLevels = source?.levels && typeof source.levels === 'object' ? source.levels : {};
  const levels: Record<string, any> = {};
  for (const [rawLevel, rawEntry] of Object.entries(rawLevels)) {
    const levelNumber = Math.max(1, Math.floor(Number(rawLevel) || 0));
    if (!levelNumber) continue;
    const entry = rawEntry && typeof rawEntry === 'object' ? rawEntry as any : {};
    levels[String(levelNumber)] = {
      bestStars: Math.max(0, Math.min(3, normalizeNonNegativeInteger(entry.bestStars))),
      bestScore: normalizeNonNegativeInteger(entry.bestScore),
      bestScoreStars: normalizeNonNegativeInteger(entry.bestScoreStars),
      bestScoreBaseScore: normalizeNonNegativeInteger(entry.bestScoreBaseScore),
      bestScoreTimeBonus: normalizeNonNegativeInteger(entry.bestScoreTimeBonus),
      bestMistakes: normalizeNonNegativeInteger(entry.bestMistakes),
      bestTimeSeconds: normalizeNonNegativeInteger(entry.bestTimeSeconds),
      attempts: normalizeNonNegativeInteger(entry.attempts),
      ...(entry.completedAt ? { completedAt: String(entry.completedAt).slice(0, 80) } : {}),
      ...(entry.lastAttemptAt ? { lastAttemptAt: String(entry.lastAttemptAt).slice(0, 80) } : {}),
    };
    if (Object.keys(levels).length >= 1000) break;
  }
  const currentLevel = Math.max(1, Math.floor(Number(source?.currentLevel) || 1));
  const progress = { currentLevel, levels };
  return {
    ...progress,
    summary: summarizeSoloProgress(progress),
  };
}

function summarizeSoloProgress(progress: any) {
  const levels = progress?.levels && typeof progress.levels === 'object' ? progress.levels : {};
  let totalSoloScore = 0;
  let completedLevelCount = 0;
  let totalStars = 0;
  let totalAttempts = 0;
  let highestCompleted = 0;
  for (const [rawLevel, entry] of Object.entries(levels)) {
    const levelNumber = Math.max(1, Math.floor(Number(rawLevel) || 0));
    const stars = Math.max(0, Math.min(3, Number((entry as any)?.bestStars) || 0));
    totalSoloScore += normalizeNonNegativeInteger((entry as any)?.bestScore);
    totalAttempts += normalizeNonNegativeInteger((entry as any)?.attempts);
    totalStars += stars;
    if (stars > 0) {
      completedLevelCount += 1;
      highestCompleted = Math.max(highestCompleted, levelNumber);
    }
  }
  const currentLevel = Math.max(1, Math.floor(Number(progress?.currentLevel) || 1));
  return {
    totalSoloScore,
    currentLevel,
    unlockedLevel: Math.max(currentLevel, highestCompleted + 1),
    totalStars,
    completedLevelCount,
    totalAttempts,
  };
}

async function syncGuestProgress(base44: any, guestId: string, guestToken: string, patchInput: any) {
  const verified = await getVerifiedGuestRow(base44, guestId, guestToken);
  if (!verified.ok) return verified.response;
  const row = verified.row;
  if (String(row?.status || '') === 'linked') {
    return json({
      ok: true,
      synced: false,
      alreadyLinked: true,
      profile: publicGuestProfile(row),
      contract: {
        linkedGuestProfileNoLongerAcceptsProgressSync: true,
        rawGuestTokenServerStored: false,
      },
    });
  }
  const entity = guestProfileEntity(base44);
  const id = rowId(row);
  if (!entity?.update || !id) return json({ ok: false, error: 'guest_profile_update_unavailable' }, 500);

  const patch = patchInput && typeof patchInput === 'object' ? patchInput : {};
  const soloProgress = Object.prototype.hasOwnProperty.call(patch, 'solo_progress')
    ? normalizeSoloProgress(patch.solo_progress)
    : null;
  const onlineProgress = patch.online_progress && typeof patch.online_progress === 'object'
    ? patch.online_progress
    : null;
  const update: Record<string, unknown> = {
    last_seen_at: nowIso(),
    metadata: {
      ...(row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
      guestProgressSyncedAt: nowIso(),
      rawGuestTokenServerStored: false,
    },
  };

  if (soloProgress) {
    update.solo_progress = soloProgress;
    update.kronox_puan_total = Math.max(
      normalizeNonNegativeInteger(row?.kronox_puan_total),
      normalizeNonNegativeInteger(soloProgress.summary?.totalSoloScore),
      normalizeNonNegativeInteger(patch.kronox_puan_total),
    );
  }
  if (onlineProgress) update.online_progress = onlineProgress;
  if (Object.prototype.hasOwnProperty.call(patch, 'diamonds')) {
    update.diamonds = normalizeNonNegativeInteger(patch.diamonds);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'joker_balances')) {
    update.joker_balances = normalizeJokerBalances(patch.joker_balances);
  }

  const updated = await entity.update(id, update);
  if (soloProgress) {
    await publishGuestLeaderboardEntry(base44, updated || { ...row, ...update }, soloProgress).catch(() => null);
  }
  return json({
    ok: true,
    synced: true,
    profile: publicGuestProfile(updated || { ...row, ...update }),
    contract: {
      guestTokenProofRequiredForProgressSync: true,
      rawGuestTokenServerStored: false,
      accountLinkMergeInputReady: true,
    },
  });
}

async function publishGuestLeaderboardEntry(base44: any, row: any, soloProgress: any) {
  const entity = soloLeaderboardEntryEntity(base44);
  if (!entity?.filter || !entity?.update || !entity?.create) return null;
  const guestId = normalizeGuestId(row?.guest_id);
  const ownerKey = fnvOwnerKey('g', guestId);
  if (!ownerKey) return null;
  const summary = summarizeSoloProgress(soloProgress);
  const displayName = cleanPublicName(row?.display_name || row?.username, guestId);
  const payload = {
    owner_key: ownerKey,
    display_name: displayName,
    initial: initialFromName(displayName),
    total_kronox_score: normalizeNonNegativeInteger(row?.kronox_puan_total) || normalizeNonNegativeInteger(summary.totalSoloScore),
    total_solo_score: normalizeNonNegativeInteger(summary.totalSoloScore),
    online_score: 0,
    current_level: Math.max(1, Number(summary.currentLevel) || 1),
    unlocked_level: Math.max(1, Number(summary.unlockedLevel) || Number(summary.currentLevel) || 1),
    total_stars: normalizeNonNegativeInteger(summary.totalStars),
    completed_level_count: normalizeNonNegativeInteger(summary.completedLevelCount),
    updated_at: nowIso(),
    description: 'GuestProfile leaderboard projection; owner_key is internal and display_name is username-first.',
  };
  const existing = await entity.filter({ owner_key: ownerKey }, '-updated_at', 5).catch(() => []);
  const rowIdValue = Array.isArray(existing) && existing[0] ? rowId(existing[0]) : null;
  if (rowIdValue) return entity.update(rowIdValue, payload);
  return entity.create(payload);
}

function normalizeAge(value: unknown) {
  if (value === '' || value === null || value === undefined) return undefined;
  const age = Math.trunc(Number(value));
  if (!Number.isFinite(age) || age < 7 || age > 120) return undefined;
  return age;
}

function normalizeGender(value: unknown) {
  const text = String(value || '').trim();
  return GENDER_VALUES.has(text) ? text : undefined;
}

async function updateGuestOnboarding(base44: any, guestId: string, guestToken: string, patchInput: any) {
  const verified = await getVerifiedGuestRow(base44, guestId, guestToken);
  if (!verified.ok) return verified.response;
  const row = verified.row;
  const entity = guestProfileEntity(base44);
  const id = rowId(row);
  if (!entity?.update || !id) return json({ ok: false, error: 'guest_profile_update_unavailable' }, 500);

  const patch = patchInput && typeof patchInput === 'object' ? patchInput : {};
  const update: Record<string, unknown> = { last_seen_at: nowIso() };
  const timestamp = nowIso();

  const onboardingStatus = String(patch.onboarding_status || '').trim();
  if (onboardingStatus) {
    if (!ONBOARDING_STATES.has(onboardingStatus)) return json({ ok: false, error: 'invalid_onboarding_status' }, 400);
    update.onboarding_status = onboardingStatus;
    if (onboardingStatus === 'tutorial_completed') {
      update.tutorial_status = 'completed';
      update.tutorial_completed_at = timestamp;
      update.profile_setup_status = String(row?.profile_setup_status || 'pending') === 'completed' ? 'completed' : 'pending';
    }
    if (onboardingStatus === 'profile_setup_pending') {
      update.profile_setup_status = 'pending';
    }
    if (onboardingStatus === 'category_setup_pending') {
      update.profile_setup_status = 'completed';
      update.profile_setup_completed_at = row?.profile_setup_completed_at || timestamp;
      update.category_setup_status = 'pending';
    }
    if (onboardingStatus === 'onboarding_complete' || onboardingStatus === 'completed') {
      update.onboarding_status = 'onboarding_complete';
      update.tutorial_status = 'completed';
      update.profile_setup_status = 'completed';
      update.category_setup_status = 'completed';
      update.onboarding_completed_at = timestamp;
      update.category_setup_completed_at = row?.category_setup_completed_at || timestamp;
      update.profile_setup_completed_at = row?.profile_setup_completed_at || timestamp;
      update.tutorial_completed_at = row?.tutorial_completed_at || timestamp;
    }
  }

  const tutorialStatus = String(patch.tutorial_status || '').trim();
  if (tutorialStatus) {
    if (!TUTORIAL_STATES.has(tutorialStatus)) return json({ ok: false, error: 'invalid_tutorial_status' }, 400);
    update.tutorial_status = tutorialStatus;
    if (tutorialStatus === 'completed') update.tutorial_completed_at = timestamp;
  }

  const profileSetupStatus = String(patch.profile_setup_status || '').trim();
  if (profileSetupStatus) {
    if (!SETUP_STATES.has(profileSetupStatus)) return json({ ok: false, error: 'invalid_profile_setup_status' }, 400);
    update.profile_setup_status = profileSetupStatus;
    if (profileSetupStatus === 'completed') update.profile_setup_completed_at = timestamp;
  }

  const categorySetupStatus = String(patch.category_setup_status || '').trim();
  if (categorySetupStatus) {
    if (!SETUP_STATES.has(categorySetupStatus)) return json({ ok: false, error: 'invalid_category_setup_status' }, 400);
    update.category_setup_status = categorySetupStatus;
    if (categorySetupStatus === 'completed') update.category_setup_completed_at = timestamp;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'username')) {
    const username = normalizeUsernameInput(patch.username);
    if (!username) return json({ ok: false, error: 'invalid_username' }, 400);
    if (await usernameExists(base44, username, guestId)) {
      return json({ ok: false, error: 'username_taken' }, 409);
    }
    update.username = username;
    if (!Object.prototype.hasOwnProperty.call(patch, 'display_name')) update.display_name = username;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'display_name')) {
    const displayName = normalizeDisplayNameInput(patch.display_name);
    if (!displayName) return json({ ok: false, error: 'invalid_display_name' }, 400);
    update.display_name = displayName;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'age')) {
    const age = normalizeAge(patch.age);
    if (age !== undefined) update.age = age;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'gender')) {
    const gender = normalizeGender(patch.gender);
    if (gender === undefined) return json({ ok: false, error: 'invalid_gender' }, 400);
    update.gender = gender;
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'selected_category_ids')) {
    update.selected_category_ids = normalizeCategoryIds(patch.selected_category_ids);
  }

  const updated = await entity.update(id, update);
  return json({
    ok: true,
    updated: true,
    profile: publicGuestProfile(updated || { ...row, ...update }),
    contract: {
      guidedFirstSoloLevel: true,
      guestTokenProofRequiredForUpdates: true,
      rawGuestTokenServerStored: false,
      profileSetupAfterTutorial: true,
      categorySetupAfterProfile: true,
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
        onboarding_status: 'guest_created',
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
    const action = String(body?.action || '').trim();

    if (guestId || guestToken) {
      if (!guestId || !guestToken) return json({ ok: false, error: 'guest_credentials_required' }, 400);
      if (action === 'update_onboarding') {
        return updateGuestOnboarding(base44, guestId, guestToken, body?.patch || {});
      }
      if (action === 'sync_progress') {
        return syncGuestProgress(base44, guestId, guestToken, body?.patch || {});
      }
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
