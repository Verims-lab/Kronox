import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const HASH_ALGORITHM = 'sha256:kronox_guest_v1';
const GUEST_ID_PREFIX = 'guest_';
const USERNAME_PREFIX = 'KronoxUser';
const JOKER_TYPES = ['mistake_shield', 'card_swap', 'time_freeze'] as const;
const ACCOUNT_LINK_SOURCE = 'account_link_merge';
const ACCOUNT_LINK_RELATED_TYPE = 'account_link';
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

function normalizeText(value: unknown, maxLength = 220) {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : '';
}

function normalizeCredentialText(value: unknown, maxLength = 220) {
  const text = normalizeText(value, maxLength);
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
}

function normalizeGuestId(value: unknown) {
  const text = normalizeCredentialText(value, 80);
  return text.startsWith(GUEST_ID_PREFIX) ? text : '';
}

function normalizeGuestToken(value: unknown) {
  return normalizeCredentialText(value, 220);
}

function normalizeNonNegativeInteger(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function normalizeJokerType(value: unknown) {
  const type = String(value || '').trim();
  return JOKER_TYPES.includes(type as typeof JOKER_TYPES[number]) ? type : '';
}

function normalizeUsernameKey(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeAge(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const age = Math.trunc(Number(value));
  return Number.isFinite(age) && age >= 7 && age <= 120 ? age : null;
}

function normalizeGender(value: unknown) {
  const text = String(value || '').trim();
  return GENDER_VALUES.has(text) ? text : '';
}

function timestampValue(value: unknown) {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? time : 0;
}

function preferGuestProfileValue(userValue: unknown, guestValue: unknown, userUpdatedAt: unknown, guestUpdatedAt: unknown) {
  const hasGuest = guestValue !== null && typeof guestValue !== 'undefined' && String(guestValue).trim() !== '';
  const hasUser = userValue !== null && typeof userValue !== 'undefined' && String(userValue).trim() !== '';
  if (!hasGuest) return userValue ?? null;
  if (!hasUser) return guestValue;
  return timestampValue(guestUpdatedAt) >= timestampValue(userUpdatedAt) ? guestValue : userValue;
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

function cleanPublicName(value: unknown, fallbackSeed = '') {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 28);
  if (
    text &&
    !text.includes('@') &&
    !/^(apple|google|firebase|auth0|base44|provider|uid)[\w:-]*$/i.test(text)
  ) {
    return text;
  }
  return makeFallbackUsername(fallbackSeed);
}

function initialFromName(value: string) {
  return cleanPublicName(value).charAt(0).toLocaleUpperCase('tr-TR') || 'K';
}

async function findRows(entity: any, filter: Record<string, unknown>, sort = '-created_at', limit = 10) {
  if (!entity?.filter) return [];
  const rows = await entity.filter(filter, sort, limit).catch(() => []);
  return Array.isArray(rows) ? rows : [];
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
  if (!expectedHash || expectedHash !== providedHash) {
    return { ok: false, code: 'invalid_guest_token', row: null };
  }
  return { ok: true, code: '', row };
}

async function findCurrentUserRow(base44: any, authUser: any, email: string) {
  const userEntity = entityStore(base44, 'User');
  const directId = rowId(authUser);
  if (directId && userEntity?.update) return authUser;
  const rows = await findRows(userEntity, { email }, '-updated_date', 5);
  return rows[0] || authUser;
}

async function usernameTakenByAnotherUser(base44: any, username: string, email: string) {
  if (!username) return false;
  const usernameKey = normalizeUsernameKey(username);
  const rows = [
    ...(await findRows(entityStore(base44, 'User'), { username_normalized: usernameKey }, '-updated_date', 5)),
    ...(await findRows(entityStore(base44, 'User'), { username }, '-updated_date', 5)),
  ];
  return rows.some((row) => normalizeEmail(row?.email || row?.user_email) !== email);
}

async function resolveUniqueUsername(base44: any, preferred: string, email: string, guestId: string) {
  let candidate = cleanPublicName(preferred, guestId);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (!(await usernameTakenByAnotherUser(base44, candidate, email))) return candidate;
    candidate = makeFallbackUsername(`${guestId}:${attempt}`);
  }
  return candidate;
}

async function updateCurrentUser(base44: any, user: any, patch: Record<string, unknown>) {
  const entity = entityStore(base44, 'User');
  const id = rowId(user);
  if (entity?.update && id) return entity.update(id, patch);
  if (base44?.auth?.updateMe) return base44.auth.updateMe(patch);
  throw new Error('account_link_user_update_unavailable');
}

async function findAccountLinkTransaction(base44: any, idempotencyKey: string) {
  const rows = await findRows(entityStore(base44, 'AccountLinkTransaction'), { idempotency_key: idempotencyKey }, '-created_at', 1);
  return rows[0] || null;
}

async function createOrUpdateAccountLinkTransaction(base44: any, existing: any, payload: Record<string, unknown>) {
  const entity = entityStore(base44, 'AccountLinkTransaction');
  if (!entity?.create || !entity?.update) return existing || null;
  const id = rowId(existing);
  if (id) return entity.update(id, payload);
  return entity.create(payload);
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
      ...(entry.completedAt ? { completedAt: normalizeText(entry.completedAt, 80) } : {}),
      ...(entry.lastAttemptAt ? { lastAttemptAt: normalizeText(entry.lastAttemptAt, 80) } : {}),
    };
    if (Object.keys(levels).length >= 1000) break;
  }
  const progress = {
    currentLevel: Math.max(1, Math.floor(Number(source?.currentLevel) || 1)),
    levels,
  };
  return { ...progress, summary: summarizeSoloProgress(progress) };
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

function betterSoloEntry(a: any, b: any) {
  if (!a) return b;
  if (!b) return a;
  const scoreDiff = normalizeNonNegativeInteger(b.bestScore) - normalizeNonNegativeInteger(a.bestScore);
  if (scoreDiff !== 0) return scoreDiff > 0 ? b : a;
  const starsDiff = normalizeNonNegativeInteger(b.bestStars) - normalizeNonNegativeInteger(a.bestStars);
  if (starsDiff !== 0) return starsDiff > 0 ? b : a;
  const aMistakes = Number.isFinite(Number(a.bestMistakes)) ? Number(a.bestMistakes) : Number.POSITIVE_INFINITY;
  const bMistakes = Number.isFinite(Number(b.bestMistakes)) ? Number(b.bestMistakes) : Number.POSITIVE_INFINITY;
  if (aMistakes !== bMistakes) return bMistakes < aMistakes ? b : a;
  const aTime = Number.isFinite(Number(a.bestTimeSeconds)) ? Number(a.bestTimeSeconds) : Number.POSITIVE_INFINITY;
  const bTime = Number.isFinite(Number(b.bestTimeSeconds)) ? Number(b.bestTimeSeconds) : Number.POSITIVE_INFINITY;
  return bTime < aTime ? b : a;
}

function mergeSoloProgress(authProgressRaw: unknown, guestProgressRaw: unknown) {
  const authProgress = normalizeSoloProgress(authProgressRaw);
  const guestProgress = normalizeSoloProgress(guestProgressRaw);
  const levels: Record<string, any> = {};
  const keys = new Set([...Object.keys(authProgress.levels || {}), ...Object.keys(guestProgress.levels || {})]);
  keys.forEach((key) => {
    const selected = betterSoloEntry(authProgress.levels?.[key], guestProgress.levels?.[key]);
    if (selected) levels[key] = selected;
  });
  const merged = {
    currentLevel: Math.max(normalizeNonNegativeInteger(authProgress.currentLevel) || 1, normalizeNonNegativeInteger(guestProgress.currentLevel) || 1),
    levels,
  };
  return { ...merged, summary: summarizeSoloProgress(merged) };
}

function mergeOnlineProgress(authOnlineRaw: unknown, guestOnlineRaw: unknown) {
  const authOnline = authOnlineRaw && typeof authOnlineRaw === 'object' ? authOnlineRaw as any : {};
  const guestOnline = guestOnlineRaw && typeof guestOnlineRaw === 'object' ? guestOnlineRaw as any : {};
  const lastMatchAt = String(authOnline.lastMatchAt || '').localeCompare(String(guestOnline.lastMatchAt || '')) >= 0
    ? authOnline.lastMatchAt
    : guestOnline.lastMatchAt;
  return {
    ...authOnline,
    score: Math.max(normalizeNonNegativeInteger(authOnline.score), normalizeNonNegativeInteger(guestOnline.score)),
    peakScore: Math.max(normalizeNonNegativeInteger(authOnline.peakScore), normalizeNonNegativeInteger(guestOnline.peakScore)),
    peakCheckpoint: Math.max(normalizeNonNegativeInteger(authOnline.peakCheckpoint), normalizeNonNegativeInteger(guestOnline.peakCheckpoint)),
    wins: Math.max(normalizeNonNegativeInteger(authOnline.wins), normalizeNonNegativeInteger(guestOnline.wins)),
    losses: Math.max(normalizeNonNegativeInteger(authOnline.losses), normalizeNonNegativeInteger(guestOnline.losses)),
    draws: Math.max(normalizeNonNegativeInteger(authOnline.draws), normalizeNonNegativeInteger(guestOnline.draws)),
    ...(lastMatchAt ? { lastMatchAt } : {}),
  };
}

async function syncCategoryPreferences(base44: any, user: any, email: string, selectedCategoryIds: number[]) {
  if (!selectedCategoryIds.length) return { selectedCategoryCount: 0, updatedRows: 0 };
  const entity = entityStore(base44, 'UserCategoryPreference');
  if (!entity?.filter || !entity?.create || !entity?.update) return { selectedCategoryCount: selectedCategoryIds.length, updatedRows: 0 };
  const existing = await findRows(entity, { user_email: email }, '-updated_date', 1000);
  const byCategory = new Map<number, any>();
  existing.forEach((row) => {
    const id = Math.floor(Number(row?.category_id) || 0);
    if (id > 0 && !byCategory.has(id)) byCategory.set(id, row);
  });
  const timestamp = nowIso();
  let updatedRows = 0;
  for (const categoryId of selectedCategoryIds) {
    const row = byCategory.get(categoryId);
    if (row?.id) {
      await entity.update(row.id, { status: 'A', updated_date: timestamp });
    } else {
      await entity.create({
        user_id: String(user?.id || user?.user_id || email),
        user_email: email,
        category_id: categoryId,
        status: 'A',
        created_date: timestamp,
        updated_date: timestamp,
      });
    }
    updatedRows += 1;
  }
  return { selectedCategoryCount: selectedCategoryIds.length, updatedRows };
}

async function findDiamondTransaction(base44: any, email: string, idempotencyKey: string) {
  const rows = await findRows(entityStore(base44, 'DiamondTransaction'), { user_email: email, idempotency_key: idempotencyKey }, '-created_at', 1);
  return rows[0] || null;
}

async function createDiamondTransaction(base44: any, payload: Record<string, unknown>) {
  const existing = await findDiamondTransaction(base44, String(payload.user_email || ''), String(payload.idempotency_key || ''));
  if (existing) return existing;
  return entityStore(base44, 'DiamondTransaction')?.create?.(payload);
}

async function findInventory(base44: any, email: string, jokerType: string) {
  const rows = await findRows(entityStore(base44, 'UserJokerInventory'), { user_email: email, joker_type: jokerType }, '-updated_at', 10);
  return rows.sort((a, b) => normalizeNonNegativeInteger(b?.quantity) - normalizeNonNegativeInteger(a?.quantity))[0] || null;
}

async function findJokerTransaction(base44: any, email: string, jokerType: string, idempotencyKey: string) {
  const rows = await findRows(entityStore(base44, 'JokerTransaction'), { user_email: email, joker_type: jokerType, idempotency_key: idempotencyKey }, '-created_at', 1);
  return rows[0] || null;
}

async function createJokerTransaction(base44: any, payload: Record<string, unknown>) {
  const existing = await findJokerTransaction(
    base44,
    String(payload.user_email || ''),
    String(payload.joker_type || ''),
    String(payload.idempotency_key || ''),
  );
  if (existing) return existing;
  return entityStore(base44, 'JokerTransaction')?.create?.(payload);
}

async function upsertInventory(base44: any, existing: any, payload: Record<string, unknown>) {
  const entity = entityStore(base44, 'UserJokerInventory');
  const id = rowId(existing);
  if (id) return entity.update(id, payload);
  return entity.create(payload);
}

async function mergeJokerBalances(base44: any, email: string, guestId: string, guestBalancesRaw: unknown, additiveAllowed: boolean) {
  const source = guestBalancesRaw && typeof guestBalancesRaw === 'object' ? guestBalancesRaw as any : {};
  const result: Record<string, number> = {};
  let mergedCount = 0;
  for (const jokerType of JOKER_TYPES) {
    const guestQuantity = additiveAllowed ? normalizeNonNegativeInteger(source[jokerType]) : 0;
    const inventory = await findInventory(base44, email, jokerType);
    const currentQuantity = normalizeNonNegativeInteger(inventory?.quantity);
    const idempotencyKey = `${ACCOUNT_LINK_SOURCE}:${guestId}:${email}:joker:${jokerType}`;
    const existingTx = await findJokerTransaction(base44, email, jokerType, idempotencyKey);
    const balanceAfter = existingTx
      ? Math.max(currentQuantity, normalizeNonNegativeInteger(existingTx.balance_after))
      : currentQuantity + guestQuantity;

    if (guestQuantity > 0 && !existingTx) {
      await createJokerTransaction(base44, {
        user_email: email,
        joker_type: jokerType,
        quantity_delta: guestQuantity,
        reason: ACCOUNT_LINK_SOURCE,
        source: ACCOUNT_LINK_SOURCE,
        related_entity_type: ACCOUNT_LINK_RELATED_TYPE,
        related_entity_id: guestId,
        idempotency_key: idempotencyKey,
        balance_before: currentQuantity,
        balance_after: balanceAfter,
        created_at: nowIso(),
        created_by: 'system:account_link',
        metadata: {
          accountLinkMerge: true,
          guestId,
          rawGuestTokenServerStored: false,
        },
      });
      mergedCount += 1;
    }

    if (guestQuantity > 0 || existingTx) {
      await upsertInventory(base44, inventory, {
        user_email: email,
        joker_type: jokerType,
        quantity: balanceAfter,
        created_at: inventory?.created_at || nowIso(),
        updated_at: nowIso(),
        last_transaction_id: rowId(existingTx),
        metadata: {
          ...(inventory?.metadata && typeof inventory.metadata === 'object' ? inventory.metadata : {}),
          accountLinkMergedGuestId: guestId,
        },
      });
    }
    result[jokerType] = balanceAfter;
  }
  return { balances: result, mergedCount };
}

async function upsertLeaderboard(base44: any, email: string, guestId: string, displayName: string, soloProgress: any, onlineProgress: any, totalKronoxScore: number) {
  const entity = entityStore(base44, 'SoloLeaderboardEntry');
  if (!entity?.filter || !entity?.create || !entity?.update) return { updated: false, guestPassivated: false };
  const authOwnerKey = getAuthOwnerKey(email);
  const guestOwnerKey = getGuestOwnerKey(guestId);
  const summary = summarizeSoloProgress(soloProgress);
  const onlineScore = normalizeNonNegativeInteger(onlineProgress?.score);
  const payload = {
    owner_key: authOwnerKey,
    display_name: displayName,
    initial: initialFromName(displayName),
    total_kronox_score: Math.max(totalKronoxScore, normalizeNonNegativeInteger(summary.totalSoloScore) + onlineScore),
    total_solo_score: normalizeNonNegativeInteger(summary.totalSoloScore),
    online_score: onlineScore,
    current_level: Math.max(1, Number(summary.currentLevel) || 1),
    unlocked_level: Math.max(1, Number(summary.unlockedLevel) || Number(summary.currentLevel) || 1),
    total_stars: normalizeNonNegativeInteger(summary.totalStars),
    completed_level_count: normalizeNonNegativeInteger(summary.completedLevelCount),
    updated_at: nowIso(),
  };
  const authRows = await findRows(entity, { owner_key: authOwnerKey }, '-updated_at', 5);
  const authRow = authRows[0] || null;
  if (rowId(authRow)) await entity.update(rowId(authRow), payload);
  else await entity.create(payload);

  const guestRows = await findRows(entity, { owner_key: guestOwnerKey }, '-updated_at', 5);
  const guestRow = guestRows[0] || null;
  if (rowId(guestRow)) {
    await entity.update(rowId(guestRow), {
      display_name: displayName,
      total_kronox_score: 0,
      total_solo_score: 0,
      online_score: 0,
      updated_at: nowIso(),
      description: `Merged into linked account ${authOwnerKey}`,
    }).catch(() => null);
  }
  return { updated: true, guestPassivated: Boolean(rowId(guestRow)), guestOwnerKey, authOwnerKey };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    let authUser: any = null;
    try {
      authUser = await base44.auth.me();
    } catch {
      return json({ ok: false, code: 'unauthenticated', error: 'Hesap bağlamak için giriş yapmalısın.' }, 401);
    }
    const email = normalizeEmail(authUser?.email || authUser?.user_email);
    if (!email) return json({ ok: false, code: 'unauthenticated', error: 'Hesap bağlamak için giriş yapmalısın.' }, 401);

    const body = await req.json().catch(() => ({}));
    const guestId = normalizeGuestId(body?.guest_id);
    const guestToken = normalizeGuestToken(body?.guest_token);
    if (!guestId || !guestToken) return json({ ok: false, code: 'guest_credentials_required', error: 'Misafir oturumu doğrulanamadı.' }, 400);

    const idempotencyKey = normalizeCredentialText(body?.idempotency_key, 180) || `${ACCOUNT_LINK_SOURCE}:${guestId}:${email}`;
    const existingLink = await findAccountLinkTransaction(base44, idempotencyKey);
    if (String(existingLink?.status || '') === 'completed' || String(existingLink?.status || '') === 'already_linked') {
      return json({
        ok: true,
        alreadyApplied: true,
        idempotencyKey,
        mergeSummary: existingLink?.merge_summary || {},
        contract: {
          guestAccountLinking: true,
          mergeIdempotent: true,
          guestStatusLinkedOnce: true,
        },
      });
    }

    const verified = await verifyGuestProfile(base44, guestId, guestToken);
    if (!verified.ok) return json({ ok: false, code: verified.code, error: 'Misafir oturumu doğrulanamadı.' }, 401);
    const guest = verified.row;
    const linkedEmail = normalizeEmail(guest?.linked_user_email);
    if (String(guest?.status || '') === 'linked' && linkedEmail && linkedEmail !== email) {
      await createOrUpdateAccountLinkTransaction(base44, existingLink, {
        idempotency_key: idempotencyKey,
        guest_id: guestId,
        guest_owner_key: getGuestOwnerKey(guestId),
        linked_user_email: email,
        linked_auth_user_id: String(authUser?.id || authUser?.user_id || ''),
        status: 'rejected',
        error_code: 'guest_already_linked',
        created_at: existingLink?.created_at || nowIso(),
        completed_at: nowIso(),
      }).catch(() => null);
      return json({ ok: false, code: 'guest_already_linked', error: 'Bu misafir profil başka bir hesaba bağlanmış.' }, 409);
    }

    const user = await findCurrentUserRow(base44, authUser, email);
    const linkedGuestIds = Array.isArray(user?.linked_guest_ids) ? user.linked_guest_ids.map(String) : [];
    const guestAlreadyLinkedToThisUser = String(guest?.status || '') === 'linked' && linkedEmail === email;
    const additiveAllowed = !guestAlreadyLinkedToThisUser && !linkedGuestIds.includes(guestId);
    const displayName = cleanPublicName(guest?.display_name || guest?.username || user?.display_name || user?.username || user?.full_name, guestId);
    const username = await resolveUniqueUsername(base44, guest?.username || user?.username || displayName, email, guestId);
    const userProfileUpdatedAt = user?.profile_settings_updated_at || user?.updated_at || user?.updated_date || user?.created_date;
    const guestProfileUpdatedAt = guest?.profile_settings_updated_at || guest?.profile_setup_completed_at || guest?.updated_at || guest?.created_at || guest?.created_date;
    const mergedAge = normalizeAge(preferGuestProfileValue(user?.age, guest?.age, userProfileUpdatedAt, guestProfileUpdatedAt));
    const mergedGender = normalizeGender(preferGuestProfileValue(user?.gender, guest?.gender, userProfileUpdatedAt, guestProfileUpdatedAt));
    const mergedSoloProgress = mergeSoloProgress(user?.solo_progress, guest?.solo_progress);
    const mergedOnlineProgress = mergeOnlineProgress(user?.online_progress, guest?.online_progress);
    const soloScore = normalizeNonNegativeInteger(mergedSoloProgress.summary?.totalSoloScore);
    const onlineScore = normalizeNonNegativeInteger(mergedOnlineProgress.score);
    const bestTotalScore = Math.max(
      soloScore + onlineScore,
      normalizeNonNegativeInteger(user?.kronox_puan_total),
      normalizeNonNegativeInteger(guest?.kronox_puan_total),
    );
    const selectedCategoryIds = Array.isArray(guest?.selected_category_ids)
      ? guest.selected_category_ids.map((value: unknown) => Math.floor(Number(value) || 0)).filter((value: number) => value > 0)
      : [];
    const guestDiamonds = additiveAllowed ? normalizeNonNegativeInteger(guest?.diamonds) : 0;
    let diamondBalance = normalizeNonNegativeInteger(user?.diamonds);
    if (guestDiamonds > 0) {
      const diamondKey = `${ACCOUNT_LINK_SOURCE}:${guestId}:${email}:diamonds`;
      const existingDiamond = await findDiamondTransaction(base44, email, diamondKey);
      if (existingDiamond) {
        diamondBalance = Math.max(diamondBalance, normalizeNonNegativeInteger(existingDiamond.balance_after));
      } else {
        const before = diamondBalance;
        diamondBalance = before + guestDiamonds;
        await createDiamondTransaction(base44, {
          user_email: email,
          amount: guestDiamonds,
          balance_before: before,
          balance_after: diamondBalance,
          source: ACCOUNT_LINK_SOURCE,
          direction: 'earn',
          idempotency_key: diamondKey,
          related_entity_type: ACCOUNT_LINK_RELATED_TYPE,
          related_entity_id: guestId,
          created_at: nowIso(),
          metadata: {
            accountLinkMerge: true,
            guestId,
            rawGuestTokenServerStored: false,
          },
        });
      }
    }

    const jokerMerge = await mergeJokerBalances(base44, email, guestId, guest?.joker_balances, additiveAllowed);
    const categoryMerge = await syncCategoryPreferences(base44, user, email, selectedCategoryIds);
    const nextLinkedGuestIds = Array.from(new Set([...linkedGuestIds, guestId]));
    const userPatch = {
      solo_progress: mergedSoloProgress,
      online_progress: mergedOnlineProgress,
      kronox_puan_total: bestTotalScore,
      diamonds: diamondBalance,
      username,
      username_normalized: normalizeUsernameKey(username),
      display_name: displayName,
      age: mergedAge,
      gender: mergedGender,
      profile_settings_updated_at: nowIso(),
      linked_guest_ids: nextLinkedGuestIds,
      category_preferences_onboarding_completed: selectedCategoryIds.length > 0 ? true : user?.category_preferences_onboarding_completed,
      category_preferences_onboarding_completed_at: selectedCategoryIds.length > 0
        ? (user?.category_preferences_onboarding_completed_at || nowIso())
        : user?.category_preferences_onboarding_completed_at,
    };
    const updatedUser = await updateCurrentUser(base44, user, userPatch);
    const leaderboard = await upsertLeaderboard(base44, email, guestId, displayName, mergedSoloProgress, mergedOnlineProgress, bestTotalScore);

    const mergeSummary = {
      scoreTotal: bestTotalScore,
      soloScore,
      onlineScore,
      diamondsCombined: guestDiamonds,
      jokerMergeCount: jokerMerge.mergedCount,
      categoryPreferenceCount: categoryMerge.selectedCategoryCount,
      leaderboardGuestRowPassivated: leaderboard.guestPassivated,
      usernameDisplayApplied: true,
      additiveMergeApplied: additiveAllowed,
    };

    const guestEntity = entityStore(base44, 'GuestProfile');
    if (guestEntity?.update && rowId(guest)) {
      await guestEntity.update(rowId(guest), {
        status: 'linked',
        linked_user_email: email,
        linked_auth_user_id: String(authUser?.id || authUser?.user_id || ''),
        linked_at: nowIso(),
        link_idempotency_key: idempotencyKey,
        merge_summary: mergeSummary,
        last_seen_at: nowIso(),
        metadata: {
          ...(guest?.metadata && typeof guest.metadata === 'object' ? guest.metadata : {}),
          accountLinked: true,
          rawGuestTokenServerStored: false,
          hashAlgorithm: HASH_ALGORITHM,
        },
      });
    }

    await createOrUpdateAccountLinkTransaction(base44, existingLink, {
      idempotency_key: idempotencyKey,
      guest_id: guestId,
      guest_owner_key: getGuestOwnerKey(guestId),
      linked_user_email: email,
      linked_auth_user_id: String(authUser?.id || authUser?.user_id || ''),
      status: guestAlreadyLinkedToThisUser ? 'already_linked' : 'completed',
      merge_summary: mergeSummary,
      created_at: existingLink?.created_at || nowIso(),
      completed_at: nowIso(),
      metadata: {
        guestAccountLinking: true,
        mergeIdempotent: true,
        guestStatusLinkedOnce: true,
        rawGuestTokenServerStored: false,
      },
    });

    return json({
      ok: true,
      alreadyApplied: !additiveAllowed,
      idempotencyKey,
      user: updatedUser || { ...user, ...userPatch },
      mergeSummary,
      contract: {
        guestAccountLinking: true,
        mergeIdempotent: true,
        guestStatusLinkedOnce: true,
        usernameFirstLeaderboardIdentity: true,
        providerIdsDisplayedInLeaderboard: false,
      },
    });
  } catch (error) {
    console.warn('[linkGuestAccount] failed without exposing tokens', {
      reason: String((error as Error)?.message || 'account_link_failed').slice(0, 120),
    });
    return json({ ok: false, code: 'account_link_failed', error: 'Hesap bağlama tamamlanamadı. Lütfen tekrar dene.' }, 500);
  }
});
