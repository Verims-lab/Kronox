import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CATEGORY_METADATA_POLICY = Object.freeze({
  sourceOfTruth: 'Category',
  legacyHardcodedCategoryFallbackAllowed: false,
  loadFailureBehavior: 'retryable_error_or_empty_state',
});
const SOLO_QUESTION_POLICY = Object.freeze({
  categorySourceOfTruth: CATEGORY_METADATA_POLICY.sourceOfTruth,
  preferenceScope: 'solo_only',
  preferenceWeighting: 'soft_70_selected_30_global',
  minimumValidPreferenceCount: 3,
  emptyPreferencesUseAllActiveCategories: true,
  unavailablePreferencesUseAllActiveCategories: true,
  hardFilterToSelectedCategories: false,
  selectedLaneDifficulties: [1, 2],
  globalLaneDifficulties: [1],
  rawQuestionListFallbackAllowed: false,
  legacyHardcodedCategoryFallbackAllowed: false,
});
const ONLINE_GAME_POLICY = Object.freeze({
  categorySourceOfTruth: CATEGORY_METADATA_POLICY.sourceOfTruth,
  selectedCategoriesOnly: true,
  allowedDifficulties: [1, 2],
  difficultyRule: 'difficulty_1_or_2_only',
  soloPreferenceWeightingApplied: false,
});
const MAX_AUTH_GAMEPLAY_RESPONSE_LIMIT = 96;
const DEFAULT_AUTH_GAMEPLAY_RESPONSE_LIMIT = 80;
const MAX_GUEST_GAMEPLAY_LIMIT = 48;
const DEFAULT_GUEST_GAMEPLAY_LIMIT = 32;
const QUESTION_FETCH_PER_CATEGORY_LIMIT = 5000;
const GUEST_QUESTION_FETCH_PER_CATEGORY_LIMIT = 40;
const GAMEPLAY_PROJECTION_VERSION = 'per_category_projection_v2';
const GUEST_GAMEPLAY_MODE = 'guest_gameplay_runtime';
const SERVER_ATTEMPT_SELECTION_MODE = 'server_attempt_candidate_buffer_v1';
const GET_QUESTIONS_RUNTIME_MARKER = 'getQuestions-live-per-category-v7-Codex343';
const GET_QUESTIONS_RUNTIME_CONTRACT_VERSION = GET_QUESTIONS_RUNTIME_MARKER;
const PROJECTION_SAMPLING_STRATEGY = 'pool_proportional_category_subcategory_per_category_fetch_v2';
const DIAGNOSTIC_TOP_LIMIT = 12;
const CATEGORY_ACTIVE_STATUS_VALUES = new Set(['', 'a', 'active', 'aktif']);
const QUESTION_ACTIVE_STATUS_VALUES = new Set(['', 'a', 'active', 'aktif']);
const SELECTED_CATEGORY_LANE_DIFFICULTIES = new Set(SOLO_QUESTION_POLICY.selectedLaneDifficulties);
const GLOBAL_FALLBACK_LANE_DIFFICULTIES = new Set(SOLO_QUESTION_POLICY.globalLaneDifficulties);
const GUEST_PRIMARY_DIFFICULTIES = new Set([1]);
const GUEST_FALLBACK_DIFFICULTIES = new Set([1, 2]);
const SELECTED_CATEGORY_LANE_DIFFICULTY_RULE = 'selected_category_difficulty_1_2';
const GLOBAL_FALLBACK_LANE_DIFFICULTY_RULE = 'global_fallback_difficulty_1_only';
const GUEST_DIFFICULTY_RULE = 'guest_primary_difficulty_1_only';

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function normalizeAdminAuthEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isActiveAdminRole(role: unknown) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}

function isActiveAdminStatus(status: unknown) {
  return String(status || '').trim().toLowerCase() === 'active';
}

const ADMIN_AUTH_FIELD_CANDIDATES = {
  email: ['email', 'Email', 'user_email', 'admin_email'],
  role: ['role', 'Role', 'user_role'],
  status: ['status', 'Status'],
};

function readAdminAuthField(row: any, candidates: string[]) {
  for (const field of candidates) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) {
      return { value: row[field], field };
    }
  }
  return { value: undefined, field: '' };
}

async function isAuthorizedAdmin(base44: any, user: any) {
  const email = normalizeAdminAuthEmail(user?.email);
  if (!email) return false;
  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) return false;

  let rows: any[] = [];
  for (const field of ADMIN_AUTH_FIELD_CANDIDATES.email) {
    const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10).catch(() => []);
    if (Array.isArray(result) && result.length > 0) {
      rows = result;
      break;
    }
  }

  return (rows || []).some((candidate: any) => {
    const emailField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.email);
    const roleField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.role);
    const statusField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.status);
    return normalizeAdminAuthEmail(emailField.value) === email
      && isActiveAdminRole(roleField.value)
      && isActiveAdminStatus(statusField.value);
  });
}

async function getOptionalUser(base44: any) {
  try {
    const user = await base44.auth.me();
    return user?.email ? user : null;
  } catch {
    return null;
  }
}

function normalizeOwnerEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function fnvOwnerKey(prefix: 'u' | 'g', value: unknown) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
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

function normalizeExposureMode(body: any) {
  const requestKind = String(body?.requestKind || body?.request_kind || '').trim();
  if (requestKind === 'guided_first_solo_level' || body?.onboardingTutorial === true) return 'tutorial';
  const mode = String(body?.playerExposureMode || body?.exposureMode || '').trim().toLowerCase();
  return mode === 'tutorial' ? 'tutorial' : 'solo';
}

async function resolveExposurePlayer(base44: any, body: any, user: any = null) {
  const email = normalizeOwnerEmail(user?.email || user?.user_email);
  if (email) {
    return {
      playerKey: String(user?.owner_key || fnvOwnerKey('u', email)).trim(),
      playerType: 'registered',
    };
  }

  const guestId = String(body?.guest_id || '').trim();
  const guestToken = String(body?.guest_token || '').trim();
  if (!guestId || !guestToken) return null;
  const entity = getServiceEntity(base44, 'GuestProfile');
  if (!entity?.filter) return null;
  const rows = await entity.filter({ guest_id: guestId }, '-updated_at', 5).catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  const expectedHash = String(row?.guest_token_hash || '');
  if (!row || !expectedHash) return null;
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (providedHash !== expectedHash) return null;
  return {
    playerKey: String(row?.owner_key || fnvOwnerKey('g', guestId)).trim(),
    playerType: 'guest',
  };
}

function normalizeExposureRow(row: any) {
  const questionId = getQuestionIdentity({ id: row?.question_id });
  if (!questionId) return null;
  return {
    questionId,
    shownCount: Math.max(0, Math.trunc(Number(row?.shown_count) || 0)),
    lastShownAt: String(row?.last_shown_at || ''),
  };
}

async function loadPlayerQuestionExposureStats(base44: any, playerKey: string, mode: string) {
  const entity = getServiceEntity(base44, 'PlayerQuestionExposure');
  if (!entity?.filter || !playerKey) return new Map<string, any>();
  const rows = await entity
    .filter({ player_key: playerKey, mode, status: 'active' }, '-last_shown_at', 2500)
    .catch(() => []);
  const stats = new Map<string, any>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const normalized = normalizeExposureRow(row);
    if (normalized) stats.set(normalized.questionId, normalized);
  }
  return stats;
}

function getServiceEntity(base44: any, entityName: string) {
  return base44?.asServiceRole?.entities?.[entityName] || null;
}

function parseExplicitYear(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) && Number.isInteger(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || !/^-?\d{1,4}$/.test(text)) return null;
  const year = Number(text);
  return Number.isFinite(year) ? year : null;
}

function getTimelineYearFromAnswer(answer: unknown) {
  const explicitYear = parseExplicitYear(answer);
  if (explicitYear !== null) return explicitYear;
  const text = String(answer ?? '').trim();
  if (!text) return null;
  if (/(?:\bcirca\b|\bca\.|\bc\.|\baround\b|\babout\b|\byaklaşık\b|\byaklasik\b|\btahmini\b|[~?])/i.test(text)) return null;
  const match = text.match(/\b\d{3,4}\b/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

function normalizeCategoryId(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const id = Math.trunc(numeric);
  return id > 0 ? id : null;
}

function normalizeQuestionMainCategoryId(question: Record<string, unknown>) {
  const raw = question?.main_category_id
    ?? question?.mainCategoryId
    ?? question?.category_id
    ?? question?.categoryid
    ?? question?.categoryId;
  return normalizeCategoryId(raw);
}

function isKnownCategoryId(value: number | null): value is number {
  return value !== null;
}

function getCategoryId(row: any) {
  return normalizeCategoryId(row?.category_id ?? row?.categoryid);
}

function isActiveCategory(row: any) {
  if (!row) return false;
  const status = String(row.status ?? '').trim().toLowerCase();
  return CATEGORY_ACTIVE_STATUS_VALUES.has(status);
}

function isActiveQuestion(row: any) {
  const state = String(row?.state ?? row?.status ?? 'A').trim().toLowerCase();
  return QUESTION_ACTIVE_STATUS_VALUES.has(state);
}

function normalizeRequestedMainCategoryIds(body: any) {
  const direct = Array.isArray(body?.main_category_ids)
    ? body.main_category_ids
    : (Array.isArray(body?.category_ids) ? body.category_ids : []);
  const fromDirect = direct.map(normalizeCategoryId).filter(isKnownCategoryId);

  const selected = Array.isArray(body?.selected_category_ids) ? body.selected_category_ids : [];
  const fromSelected = selected.map(normalizeCategoryId).filter(isKnownCategoryId);

  const merged = Array.from(new Set([...fromDirect, ...fromSelected]));
  return merged.length ? new Set(merged) : null;
}

function normalizeSoftPreferenceCategoryIds(body: any, activeMainCategoryIds: Set<number>) {
  const selected = Array.isArray(body?.selected_category_ids)
    ? body.selected_category_ids
    : (Array.isArray(body?.preferenceCategoryIds) ? body.preferenceCategoryIds : []);
  const ids = selected
    .map(normalizeCategoryId)
    .filter(isKnownCategoryId)
    .filter((id: number) => activeMainCategoryIds.has(id));
  const unique = Array.from(new Set(ids));
  return unique.length >= 3 ? unique : [];
}

function isGameplayRuntimeProjectionRequest(body: any) {
  return body?.mode === 'gameplay_runtime'
    || body?.projectionVersion === GAMEPLAY_PROJECTION_VERSION
    || body?.requireCategoryCoverage === true;
}

function isGuestGameplayProjectionRequest(body: any) {
  return body?.mode === GUEST_GAMEPLAY_MODE;
}

function isForbiddenGuestQuestionRequest(body: any) {
  return body?.scope === 'admin'
    || body?.fullBank === true
    || body?.includeInactive === true
    || body?.includeDiagnostics === true
    || body?.debug === true;
}

function normalizeGuestGameplayLimit(value: unknown) {
  const requested = Number(value);
  const normalized = Number.isFinite(requested) && requested > 0
    ? Math.floor(requested)
    : DEFAULT_GUEST_GAMEPLAY_LIMIT;
  return Math.min(MAX_GUEST_GAMEPLAY_LIMIT, Math.max(1, normalized));
}

function isSoloSpecialLevel(levelNumber: unknown) {
  const level = Math.trunc(Number(levelNumber) || 0);
  return level >= 10 && (level - 10) % 5 === 0;
}

function getSoloAttemptDeckSizeForLevel(levelNumber: unknown) {
  return (isSoloSpecialLevel(levelNumber) ? 10 : 7) + 9;
}

function normalizeSoloAttemptContext(body: any) {
  const levelNumber = Math.max(1, Math.trunc(Number(body?.levelNumber ?? body?.soloLevelNumber) || 1));
  const deckSize = Math.max(
    1,
    Math.min(
      32,
      Math.trunc(Number(body?.deckSize) || getSoloAttemptDeckSizeForLevel(levelNumber)),
    ),
  );
  const seedCount = Math.max(0, Math.min(8, Math.trunc(Number(body?.seedCount) || 2)));
  const currentYear = new Date().getUTCFullYear();
  const rawYearStart = Number(body?.yearStart);
  const rawYearEnd = Number(body?.yearEnd);
  const yearStart = Number.isFinite(rawYearStart) ? Math.trunc(rawYearStart) : -9999;
  const yearEnd = Number.isFinite(rawYearEnd) ? Math.trunc(rawYearEnd) : currentYear;
  return {
    levelNumber,
    deckSize,
    seedCount,
    yearStart: Math.min(yearStart, yearEnd),
    yearEnd: Math.max(yearStart, yearEnd),
  };
}

function normalizeAuthenticatedGameplayResponseLimit(value: unknown, deckSize: number) {
  const requested = Number(value);
  const defaultLimit = Math.max(DEFAULT_AUTH_GAMEPLAY_RESPONSE_LIMIT, deckSize * 4);
  const normalized = Number.isFinite(requested) && requested > 0
    ? Math.floor(requested)
    : defaultLimit;
  return Math.min(
    MAX_AUTH_GAMEPLAY_RESPONSE_LIMIT,
    Math.max(deckSize, normalized),
  );
}

function normalizeQuestionForRuntime(question: Record<string, unknown>, activeMainCategoryIds: Set<number>) {
  const mainCategoryId = normalizeQuestionMainCategoryId(question);
  if (!mainCategoryId || !activeMainCategoryIds.has(mainCategoryId)) return null;
  if (!isActiveQuestion(question)) return null;

  const explicitYear = parseExplicitYear(question?.year);
  const year = explicitYear !== null
    ? explicitYear
    : getTimelineYearFromAnswer(question?.answer);
  if (!Number.isFinite(year)) return null;

  const text = String(question?.question || '').trim();
  if (!text) return null;

  return {
    id: question?.id,
    question: text,
    answer: String(question?.answer || '').trim(),
    year,
    main_category_id: mainCategoryId,
    category_id: mainCategoryId,
    categoryId: mainCategoryId,
    sub_category: String(question?.sub_category || question?.subcategory || '').trim(),
    tag: String(question?.tag || '').trim(),
    difficulty: Number.isFinite(Number(question?.difficulty)) ? Number(question.difficulty) : 1,
    state: 'A',
    // Runtime compatibility fields. These are intentionally derived and
    // minimal; the raw question-bank metadata is not exposed to gameplay.
    category: 'genel',
    type: 'metin',
    media_url: '',
  };
}

function getQuestionIdentity(question: any) {
  return String(question?.id ?? question?.__id ?? question?.question ?? '').trim();
}

function dedupeQuestions(rows: any[] = []) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const row of rows || []) {
    const key = getQuestionIdentity(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function buildQuestionCategoryFetchDescriptors(categoryId: number) {
  const idText = String(categoryId);
  return [
    { label: 'main_category_id_number_state_A', filters: { main_category_id: categoryId, state: 'A' } },
    { label: 'main_category_id_string_state_A', filters: { main_category_id: idText, state: 'A' } },
    { label: 'category_id_number_state_A', filters: { category_id: categoryId, state: 'A' } },
    { label: 'category_id_string_state_A', filters: { category_id: idText, state: 'A' } },
  ];
}

function buildQuestionCategoryFallbackFetchDescriptors(categoryId: number) {
  const idText = String(categoryId);
  return [
    { label: 'main_category_id_number_no_state_fallback', filters: { main_category_id: categoryId } },
    { label: 'main_category_id_string_no_state_fallback', filters: { main_category_id: idText } },
    { label: 'category_id_number_no_state_fallback', filters: { category_id: categoryId } },
    { label: 'category_id_string_no_state_fallback', filters: { category_id: idText } },
  ];
}

async function fetchQuestionRowsForCategory(base44: any, categoryId: number, perCategoryLimit: number) {
  const rows: any[] = [];
  const descriptorCounts: Record<string, number> = {};
  let usedFallback = false;
  const questionEntity = getServiceEntity(base44, 'Question');
  if (!questionEntity?.filter) {
    descriptorCounts.service_entity_unavailable = 0;
    return {
      rows: [],
      descriptorCounts,
      usedFallback: true,
    };
  }

  for (const descriptor of buildQuestionCategoryFetchDescriptors(categoryId)) {
    const batch = await questionEntity
      .filter(descriptor.filters, '-created_date', perCategoryLimit)
      .catch(() => []);
    descriptorCounts[descriptor.label] = Array.isArray(batch) ? batch.length : 0;
    if (Array.isArray(batch) && batch.length > 0) rows.push(...batch);
  }

  if (rows.length === 0) {
    usedFallback = true;
    for (const descriptor of buildQuestionCategoryFallbackFetchDescriptors(categoryId)) {
      const batch = await questionEntity
        .filter(descriptor.filters, '-created_date', perCategoryLimit)
        .catch(() => []);
      descriptorCounts[descriptor.label] = Array.isArray(batch) ? batch.length : 0;
      if (Array.isArray(batch) && batch.length > 0) rows.push(...batch);
    }
  }

  return {
    rows: dedupeQuestions(rows),
    descriptorCounts,
    usedFallback,
  };
}

async function loadActiveQuestionCandidates(base44: any, categoryIds: number[], perCategoryLimit = QUESTION_FETCH_PER_CATEGORY_LIMIT) {
  const batches: any[] = [];
  const fetchedByCategory: Record<string, number> = {};
  const fetchDescriptorsByCategory: Record<string, Record<string, number>> = {};
  const fallbackFetchCategories: number[] = [];
  for (const categoryId of categoryIds) {
    const result = await fetchQuestionRowsForCategory(base44, categoryId, perCategoryLimit);
    const activeRows = result.rows.filter(isActiveQuestion);
    fetchedByCategory[String(categoryId)] = Array.isArray(activeRows) ? activeRows.length : 0;
    fetchDescriptorsByCategory[String(categoryId)] = result.descriptorCounts;
    if (result.usedFallback) fallbackFetchCategories.push(categoryId);
    if (Array.isArray(activeRows) && activeRows.length > 0) batches.push(...activeRows);
  }
  return {
    rows: dedupeQuestions(batches),
    fetchedByCategory,
    fetchDescriptorsByCategory,
    fallbackFetchCategories,
  };
}

async function resolveActiveCategoryContext(base44: any) {
  let categoryReadFailed = false;
  let categoryReadError: string | null = null;
  const categoryEntity = getServiceEntity(base44, 'Category');
  let categoryRows: any[] = [];
  if (!categoryEntity?.list) {
    categoryReadFailed = true;
    categoryReadError = 'category_entity_unavailable';
  } else {
    categoryRows = await categoryEntity.list('category_id', 1000).catch((error: Error) => {
      categoryReadFailed = true;
      categoryReadError = error?.message || String(error);
      return [];
    });
  }
  const activeCategoryRows = Array.isArray(categoryRows)
    ? categoryRows.filter(isActiveCategory).filter((row: any) => isKnownCategoryId(getCategoryId(row)))
    : [];
  const fallbackUsed = categoryReadFailed;
  const fallbackReason = categoryReadFailed
    ? `category_read_failed_no_legacy_category_fallback:${categoryReadError || 'unknown'}`
    : null;
  const activeCategorySource = categoryReadFailed
    ? 'Category.list(category_id,1000):unavailable'
    : 'Category.list(category_id,1000)';
  const activeIds = activeCategoryRows.map(getCategoryId).filter(isKnownCategoryId);

  return {
    activeCategoryRows,
    fallbackUsed,
    fallbackReason,
    activeCategorySource,
    activeIds,
    categoryMetadataPolicy: CATEGORY_METADATA_POLICY,
  };
}

function getUtcDayBucket(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function safeSeedText(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 64);
}

function getProjectionSeed(body: any, allowRequestSeed: boolean) {
  const requestedSeed = allowRequestSeed ? safeSeedText(body?.projectionSeed ?? body?.seed) : '';
  // Admin diagnostics may provide a deterministic seed to reproduce a
  // projection; normal gameplay cannot control fairness and rotates by UTC day.
  return requestedSeed ? `admin-provided:${requestedSeed}` : `utc-day:${getUtcDayBucket()}`;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableQuestionScore(question: any, seed: string, salt: string) {
  return hashText(`${seed}|${salt}|${getQuestionIdentity(question)}`);
}

function stableShuffleQuestions<T extends Record<string, unknown>>(items: T[], seed: string, salt: string) {
  return (items || []).slice().sort((a: any, b: any) => {
    const diff = stableQuestionScore(a, seed, salt) - stableQuestionScore(b, seed, salt);
    if (diff !== 0) return diff;
    return getQuestionIdentity(a).localeCompare(getQuestionIdentity(b));
  });
}

function timestampMs(value: unknown) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function globalShownCount(question: any) {
  const value = Number(question?.solo_shown_count ?? question?.shown_count ?? question?.exposure_count ?? question?.shownCount);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function globalLastShownAt(question: any) {
  return timestampMs(question?.last_solo_shown_at ?? question?.last_shown_at ?? question?.lastShownAt);
}

function playerExposureRankScore(question: any, exposureStats: Map<string, any>, seed: string, salt: string) {
  const id = getQuestionIdentity(question);
  const stat = id ? exposureStats.get(id) : null;
  const shownCount = Math.max(0, Math.trunc(Number(stat?.shownCount) || 0));
  const lastShownAt = timestampMs(stat?.lastShownAt);
  const globalCount = globalShownCount(question);
  const globalLast = globalLastShownAt(question);
  const now = Date.now();

  let score = 0;
  // Per-player signal dominates: unseen first, then lower count.
  score += shownCount > 0 ? 1000000 + shownCount * 50000 : 0;
  if (lastShownAt > 0) {
    const ageDays = Math.max(0, (now - lastShownAt) / (24 * 60 * 60 * 1000));
    score += Math.max(0, 25000 - Math.min(25000, ageDays * 850));
  }
  // Global signals are deliberately secondary tie-breakers.
  score += Math.min(25000, globalCount * 1200);
  if (globalLast > 0) {
    const globalAgeDays = Math.max(0, (now - globalLast) / (24 * 60 * 60 * 1000));
    score += Math.max(0, 3000 - Math.min(3000, globalAgeDays * 120));
  }
  score += stableQuestionScore(question, seed, `player-exposure:${salt}`) / 1e9;
  return score;
}

function rankQuestionsByPlayerExposure<T extends Record<string, unknown>>(
  items: T[],
  seed: string,
  salt: string,
  playerExposureStats: Map<string, any> = new Map(),
) {
  if (!playerExposureStats?.size) return stableShuffleQuestions(items, seed, salt);
  return (items || []).slice().sort((a: any, b: any) => {
    const scoreDiff = playerExposureRankScore(a, playerExposureStats, seed, salt)
      - playerExposureRankScore(b, playerExposureStats, seed, salt);
    if (scoreDiff !== 0) return scoreDiff;
    return getQuestionIdentity(a).localeCompare(getQuestionIdentity(b));
  });
}

function groupQuestions<T>(items: T[], keyFn: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items || []) {
    const key = keyFn(item) || 'unknown';
    const bucket = groups.get(key) || [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return groups;
}

function getCategoryKey(question: any) {
  return String(question?.main_category_id ?? 'unknown');
}

function getQuestionDifficulty(question: any) {
  const difficulty = Math.trunc(Number(question?.difficulty) || 1);
  return Number.isFinite(difficulty) && difficulty > 0 ? difficulty : 1;
}

function getDifficultyKey(question: any) {
  return String(getQuestionDifficulty(question));
}

function hasAllowedDifficulty(question: any, difficulties: Set<number>) {
  return difficulties.has(getQuestionDifficulty(question));
}

function getSubcategoryKey(question: any) {
  const text = String(question?.sub_category || '').trim().toLowerCase();
  return text || 'unknown_subcategory';
}

function getEraBand(question: any) {
  const year = Number(question?.year);
  if (!Number.isFinite(year)) return 'unknown_year';
  const start = Math.floor(year / 50) * 50;
  return `${start}-${start + 49}`;
}

function allocateProportionalSlots<T>(groups: Map<string, T[]>, limit: number) {
  const entries = Array.from(groups.entries())
    .map(([key, items]) => ({
      key,
      items,
      size: items.length,
      exact: 0,
      remainder: 0,
      slots: 0,
    }))
    .filter((entry) => entry.size > 0);

  const total = entries.reduce((sum, entry) => sum + entry.size, 0);
  const target = Math.max(0, Math.min(Math.trunc(limit), total));
  if (target === 0 || total === 0) return [];

  if (total <= target) {
    return entries.map((entry) => ({ ...entry, exact: entry.size, slots: entry.size, remainder: 0 }));
  }

  for (const entry of entries) {
    entry.exact = (entry.size / total) * target;
    entry.slots = Math.min(entry.size, Math.floor(entry.exact));
    if (target >= entries.length && entry.slots === 0) entry.slots = 1;
    entry.remainder = entry.exact - Math.floor(entry.exact);
  }

  let assigned = entries.reduce((sum, entry) => sum + entry.slots, 0);
  while (assigned > target) {
    const removable = entries
      .filter((entry) => entry.slots > 0)
      .sort((a, b) => (a.exact - b.exact) || a.size - b.size || a.key.localeCompare(b.key))[0];
    if (!removable) break;
    removable.slots -= 1;
    assigned -= 1;
  }

  let guard = 0;
  while (assigned < target && guard < entries.length * Math.max(1, target)) {
    guard += 1;
    const addable = entries
      .filter((entry) => entry.slots < entry.size)
      .sort((a, b) => (b.remainder - a.remainder) || b.size - a.size || a.key.localeCompare(b.key))[0];
    if (!addable) break;
    addable.slots += 1;
    addable.remainder = Math.max(0, addable.remainder - 1);
    assigned += 1;
  }

  return entries.filter((entry) => entry.slots > 0);
}

function sampleWithinCategory(
  candidates: any[],
  quota: number,
  seed: string,
  categoryKey: string,
  playerExposureStats: Map<string, any> = new Map(),
) {
  const target = Math.max(0, Math.min(quota, candidates.length));
  if (target === 0) return [];
  if (target >= candidates.length) {
    return rankQuestionsByPlayerExposure(candidates, seed, `category:${categoryKey}:all`, playerExposureStats);
  }

  const subcategoryGroups = groupQuestions(candidates, getSubcategoryKey);
  const subcategorySlots = allocateProportionalSlots(subcategoryGroups, target);
  const selected: any[] = [];
  const selectedIds = new Set<string>();

  for (const entry of subcategorySlots) {
    const picks = rankQuestionsByPlayerExposure(entry.items, seed, `subcategory:${categoryKey}:${entry.key}`, playerExposureStats)
      .slice(0, entry.slots);
    for (const pick of picks) {
      const id = getQuestionIdentity(pick);
      if (!id || selectedIds.has(id)) continue;
      selectedIds.add(id);
      selected.push(pick);
    }
  }

  if (selected.length < target) {
    const fill = rankQuestionsByPlayerExposure(
      candidates.filter((question) => !selectedIds.has(getQuestionIdentity(question))),
      seed,
      `category:${categoryKey}:fill`,
      playerExposureStats,
    );
    for (const pick of fill) {
      if (selected.length >= target) break;
      selected.push(pick);
    }
  }

  return selected.slice(0, target);
}

function buildPoolProportionalProjection(
  candidates: any[],
  limit: number,
  seed: string,
  playerExposureStats: Map<string, any> = new Map(),
) {
  const target = Math.max(0, Math.min(Math.trunc(limit), candidates.length));
  if (target === 0) {
    return {
      projected: [],
      categorySlots: {},
    };
  }

  if (target >= candidates.length) {
    return {
      projected: rankQuestionsByPlayerExposure(candidates, seed, 'full-pool-final', playerExposureStats),
      categorySlots: Object.fromEntries(
        Array.from(groupQuestions(candidates, getCategoryKey).entries()).map(([key, items]) => [key, items.length]),
      ),
    };
  }

  const categoryGroups = groupQuestions(candidates, getCategoryKey);
  const categorySlots = allocateProportionalSlots(categoryGroups, target);
  const selected: any[] = [];
  const selectedIds = new Set<string>();
  const categorySlotSummary: Record<string, number> = {};

  for (const entry of categorySlots) {
    categorySlotSummary[entry.key] = entry.slots;
    const picks = sampleWithinCategory(entry.items, entry.slots, seed, entry.key, playerExposureStats);
    for (const pick of picks) {
      const id = getQuestionIdentity(pick);
      if (!id || selectedIds.has(id)) continue;
      selectedIds.add(id);
      selected.push(pick);
    }
  }

  if (selected.length < target) {
    const fill = rankQuestionsByPlayerExposure(
      candidates.filter((question) => !selectedIds.has(getQuestionIdentity(question))),
      seed,
      'projection-fill',
      playerExposureStats,
    );
    for (const pick of fill) {
      if (selected.length >= target) break;
      selected.push(pick);
    }
  }

  return {
    projected: rankQuestionsByPlayerExposure(selected, seed, 'final-projection', playerExposureStats).slice(0, target),
    categorySlots: categorySlotSummary,
  };
}

function filterSoloAttemptCandidatePool(candidates: any[], context: { yearStart: number; yearEnd: number }) {
  return (candidates || []).filter((question) => {
    const year = Number(question?.year);
    if (!Number.isFinite(year)) return false;
    return year >= context.yearStart && year <= context.yearEnd;
  });
}

function keepYearDiverseBuffer(
  candidates: any[],
  limit: number,
  seed: string,
  playerExposureStats: Map<string, any> = new Map(),
) {
  const target = Math.max(0, Math.min(Math.trunc(limit), candidates.length));
  const shuffled = rankQuestionsByPlayerExposure(candidates, seed, 'year-diverse-buffer', playerExposureStats);
  const seenYears = new Set<number>();
  const selected: any[] = [];
  const selectedIds = new Set<string>();

  for (const question of shuffled) {
    if (selected.length >= target) break;
    const year = Number(question?.year);
    const id = getQuestionIdentity(question);
    if (!id || !Number.isFinite(year) || seenYears.has(year)) continue;
    seenYears.add(year);
    selectedIds.add(id);
    selected.push(question);
  }

  if (selected.length < target) {
    for (const question of shuffled) {
      if (selected.length >= target) break;
      const id = getQuestionIdentity(question);
      if (!id || selectedIds.has(id)) continue;
      selectedIds.add(id);
      selected.push(question);
    }
  }

  return selected.slice(0, target);
}

function buildServerAttemptCandidateBuffer(
  candidates: any[],
  limit: number,
  seed: string,
  selectedCategoryIds: number[] = [],
  playerExposureStats: Map<string, any> = new Map(),
) {
  const target = Math.max(0, Math.min(Math.trunc(limit), candidates.length));
  if (target === 0) {
    return {
      projected: [],
      categorySlots: {},
      preferenceApplied: false,
      selectedCategoryTarget: 0,
      globalCategoryTarget: 0,
      selectedLaneDifficultyRule: SELECTED_CATEGORY_LANE_DIFFICULTY_RULE,
      globalFallbackDifficultyRule: GLOBAL_FALLBACK_LANE_DIFFICULTY_RULE,
    };
  }

  const selectedSet = new Set(selectedCategoryIds);
  const preferenceApplied = selectedSet.size >= 3;
  if (!preferenceApplied) {
    const projection = buildPoolProportionalProjection(candidates, target, seed, playerExposureStats);
    return {
      projected: keepYearDiverseBuffer(projection.projected, target, seed, playerExposureStats),
      categorySlots: projection.categorySlots,
      preferenceApplied: false,
      selectedCategoryTarget: 0,
      globalCategoryTarget: target,
      selectedLaneDifficultyRule: SELECTED_CATEGORY_LANE_DIFFICULTY_RULE,
      globalFallbackDifficultyRule: GLOBAL_FALLBACK_LANE_DIFFICULTY_RULE,
    };
  }

  const selectedCandidates = candidates
    .filter((question) => selectedSet.has(Number(question?.main_category_id)))
    .filter((question) => hasAllowedDifficulty(question, SELECTED_CATEGORY_LANE_DIFFICULTIES));
  const selectedTarget = Math.min(selectedCandidates.length, Math.round(target * 0.7));
  const selectedProjection = buildPoolProportionalProjection(
    selectedCandidates,
    selectedTarget,
    `${seed}:selected70`,
    playerExposureStats,
  ).projected;
  const selectedIds = new Set(selectedProjection.map(getQuestionIdentity).filter(Boolean));
  const globalFallbackCandidates = candidates
    .filter((question) => hasAllowedDifficulty(question, GLOBAL_FALLBACK_LANE_DIFFICULTIES))
    .filter((question) => !selectedIds.has(getQuestionIdentity(question)));
  const globalTarget = Math.max(0, target - selectedProjection.length);
  const globalProjection = buildPoolProportionalProjection(
    globalFallbackCandidates,
    globalTarget,
    `${seed}:global30`,
    playerExposureStats,
  ).projected;
  const merged = keepYearDiverseBuffer(
    [...selectedProjection, ...globalProjection],
    target,
    `${seed}:merged-preference-buffer`,
    playerExposureStats,
  );

  if (merged.length < target) {
    const mergedIds = new Set(merged.map(getQuestionIdentity).filter(Boolean));
    const laneSafeFill = rankQuestionsByPlayerExposure(
      candidates
        .filter((question) => !mergedIds.has(getQuestionIdentity(question)))
        .filter((question) => (
          selectedSet.has(Number(question?.main_category_id))
            ? hasAllowedDifficulty(question, SELECTED_CATEGORY_LANE_DIFFICULTIES)
            : hasAllowedDifficulty(question, GLOBAL_FALLBACK_LANE_DIFFICULTIES)
        )),
      seed,
      'preference-buffer-lane-safe-fill',
      playerExposureStats,
    );
    merged.push(...laneSafeFill.slice(0, target - merged.length));
  }

  if (merged.length < target) {
    const mergedIds = new Set(merged.map(getQuestionIdentity).filter(Boolean));
    const broaderGlobalFill = rankQuestionsByPlayerExposure(
      candidates
        .filter((question) => !mergedIds.has(getQuestionIdentity(question)))
        .filter((question) => (
          !selectedSet.has(Number(question?.main_category_id))
          || hasAllowedDifficulty(question, SELECTED_CATEGORY_LANE_DIFFICULTIES)
        )),
      seed,
      'preference-buffer-broader-global-fill',
      playerExposureStats,
    );
    merged.push(...broaderGlobalFill.slice(0, target - merged.length));
  }

  return {
    projected: rankQuestionsByPlayerExposure(merged, seed, 'final-server-attempt-buffer', playerExposureStats).slice(0, target),
    categorySlots: buildFullDistribution(merged, getCategoryKey),
    preferenceApplied: true,
    selectedCategoryTarget: selectedTarget,
    globalCategoryTarget: globalTarget,
    selectedLaneDifficultyRule: SELECTED_CATEGORY_LANE_DIFFICULTY_RULE,
    globalFallbackDifficultyRule: GLOBAL_FALLBACK_LANE_DIFFICULTY_RULE,
    selectedLaneCandidateCount: selectedCandidates.length,
    globalFallbackLaneCandidateCount: globalFallbackCandidates.length,
    broaderGlobalFallbackUsed: merged.length > selectedProjection.length + globalProjection.length,
    globalFallbackFillCount: Math.max(0, merged.length - selectedProjection.length - globalProjection.length),
  };
}

function buildDistribution(items: any[], keyFn: (item: any) => string, limit = DIAGNOSTIC_TOP_LIMIT) {
  const counts = new Map<string, number>();
  for (const item of items || []) {
    const key = keyFn(item) || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries(
    Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit),
  );
}

function buildFullDistribution(items: any[], keyFn: (item: any) => string) {
  return buildDistribution(items, keyFn, Number.MAX_SAFE_INTEGER);
}

function buildProjectionDiagnostics({
  fetchedRows,
  normalizedRows,
  projectedRows,
  fetchedByCategory,
  fetchDescriptorsByCategory,
  fallbackFetchCategories,
  categorySlots,
  limit,
  seed,
  activeCategoryIds,
  activeCategoryRows,
  activeCategorySource,
  requestedCategoryIds,
  allowedCategoryIds,
  requestedLimit,
  fallbackUsed,
  fallbackReason,
  selectionMode = PROJECTION_SAMPLING_STRATEGY,
  sourcePoolCapRemoved = false,
  responseCapApplied = false,
  responseQuestionCount = null,
  eligibleQuestionCountByCategory = null,
  selectedDeckCountsByCategory = null,
  eligibleQuestionCountByDifficulty = null,
  selectedDeckCountsByDifficulty = null,
  playerExposureAwareSelection = false,
  playerExposureMode = 'solo',
  playerExposureStatsCount = 0,
}: {
  fetchedRows: any[];
  normalizedRows: any[];
  projectedRows: any[];
  fetchedByCategory: Record<string, number>;
  fetchDescriptorsByCategory: Record<string, Record<string, number>>;
  fallbackFetchCategories: number[];
  categorySlots: Record<string, number>;
  limit: number;
  seed: string;
  activeCategoryIds: number[];
  activeCategoryRows: any[];
  activeCategorySource: string;
  requestedCategoryIds: number[] | null;
  allowedCategoryIds: number[];
  requestedLimit: number | null;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  selectionMode?: string;
  sourcePoolCapRemoved?: boolean;
  responseCapApplied?: boolean;
  responseQuestionCount?: number | null;
  eligibleQuestionCountByCategory?: Record<string, number> | null;
  selectedDeckCountsByCategory?: Record<string, number> | null;
  eligibleQuestionCountByDifficulty?: Record<string, number> | null;
  selectedDeckCountsByDifficulty?: Record<string, number> | null;
  playerExposureAwareSelection?: boolean;
  playerExposureMode?: string;
  playerExposureStatsCount?: number;
}) {
  const playableByCategory = buildFullDistribution(normalizedRows, getCategoryKey);
  const playableByDifficulty = buildFullDistribution(normalizedRows, getDifficultyKey);
  const returnedByDifficulty = buildFullDistribution(projectedRows, getDifficultyKey);
  const activeCategoryRowsById = Object.fromEntries((activeCategoryRows || [])
    .map((row: any) => {
      const id = getCategoryId(row);
      if (!id) return null;
      return [String(id), {
        category_id: id,
        name: row?.name ?? row?.title ?? row?.category_name ?? null,
        status: row?.status ?? null,
      }];
    })
    .filter(Boolean) as Array<[string, Record<string, unknown>]>);

  return {
    projectionVersion: GAMEPLAY_PROJECTION_VERSION,
    runtimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
    getQuestionsRuntimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
    functionContractVersion: GET_QUESTIONS_RUNTIME_CONTRACT_VERSION,
    strategy: PROJECTION_SAMPLING_STRATEGY,
    selectionMode,
    playerExposureAwareSelection,
    playerExposureMode,
    playerExposureStatsCount,
    playerExposurePriority: [
      'unseen_by_this_player',
      'lower_player_shown_count',
      'older_player_last_shown_at',
      'global_metrics_secondary',
      'stable_randomization',
    ],
    sourcePoolCapRemoved,
    responseCapApplied,
    responseQuestionCount,
    requestedLimit,
    effectiveLimit: limit,
    projectionSeed: seed,
    projectionLimit: limit,
    questionFetchPath: 'getQuestions:per_active_category_question_filter_numeric_string_main_category_category_id',
    activeCategorySource,
    categorySourceOfTruth: CATEGORY_METADATA_POLICY.sourceOfTruth,
    categoryMetadataPolicy: CATEGORY_METADATA_POLICY,
    soloQuestionPolicy: SOLO_QUESTION_POLICY,
    onlineGamePolicy: ONLINE_GAME_POLICY,
    legacyHardcodedCategoryFallbackAllowed: false,
    staleCategoryFallbackUsed: false,
    rawQuestionListFallbackAllowed: false,
    activeCategoryRowsById,
    activeCategoryIds,
    requestedCategoryIds,
    allowedCategoryIds,
    activeCategoryIdsFromGetQuestions: activeCategoryIds,
    wasCappedBeforeBalancing: false,
    projectionCappedBeforeCategoryCoverage: false,
    queryLimitUsed: QUESTION_FETCH_PER_CATEGORY_LIMIT,
    queryOrderUsed: '-created_date per active category/query variant before pool-proportional projection',
    fallbackUsed,
    fallbackReason,
    fetchedActiveTotal: fetchedRows.length,
    eligibleAfterNormalization: normalizedRows.length,
    returnedTotal: projectedRows.length,
    droppedDuringNormalization: Math.max(0, fetchedRows.length - normalizedRows.length),
    activeCategoryWhitelistSize: activeCategoryIds.length,
    fetchedByCategory,
    perCategoryQuestionFetchCounts: fetchedByCategory,
    perCategoryFetchCounts: fetchedByCategory,
    perCategoryPlayableCounts: playableByCategory,
    eligibleQuestionCountByCategory: eligibleQuestionCountByCategory || playableByCategory,
    eligibleQuestionCountByDifficulty: eligibleQuestionCountByDifficulty || playableByDifficulty,
    eligibleCountsByCategory: eligibleQuestionCountByCategory || playableByCategory,
    eligibleCountsByDifficulty: eligibleQuestionCountByDifficulty || playableByDifficulty,
    selectedDeckCountsByCategory: selectedDeckCountsByCategory || buildFullDistribution(projectedRows, getCategoryKey),
    selectedDeckCountsByDifficulty: selectedDeckCountsByDifficulty || returnedByDifficulty,
    categoriesWithZeroPlayableQuestions: activeCategoryIds
      .filter((categoryId) => !Number(playableByCategory[String(categoryId)] || 0))
      .map(String),
    fetchDescriptorsByCategory,
    fallbackFetchCategories,
    categorySlots,
    eligibleByCategory: playableByCategory,
    returnedByCategory: buildFullDistribution(projectedRows, getCategoryKey),
    returnedByDifficulty,
    returnedTopSubCategories: buildDistribution(
      projectedRows,
      (question) => `${getCategoryKey(question)} / ${getSubcategoryKey(question)}`,
    ),
    returnedByEraBand: buildDistribution(projectedRows, getEraBand),
    finalProjectionShuffled: true,
    poolProportional: true,
    equalCategoryCounts: false,
  };
}

Deno.serve(async (req) => 
{
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    const requestPayload = await req.clone().json().catch(() => ({}));

    if (requestPayload?.ping === true) {
      return json({
        ok: true,
        pong: true,
        getQuestionsRuntimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
        runtimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
        functionContractVersion: GET_QUESTIONS_RUNTIME_CONTRACT_VERSION,
      });
    }

    let base44: any;
    try {
      base44 = createClientFromRequest(req);
    } catch {
      return json({
        ok: false,
        error: 'base44_client_create_failed',
        getQuestionsRuntimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
        runtimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
      }, 500);
    }

    const body = requestPayload;
    const wantsGuestGameplayProjection = isGuestGameplayProjectionRequest(body);
    const wantsAdminBank = body?.scope === 'admin' || body?.fullBank === true || body?.includeInactive === true;
    const wantsGameplayProjection = isGameplayRuntimeProjectionRequest(body);
    const wantsDiagnostics = body?.includeDiagnostics === true || body?.debug === true;
    const wantsAdminDiagnostics = wantsDiagnostics;
    const needsAdmin = wantsAdminBank || wantsAdminDiagnostics;

    if (wantsGuestGameplayProjection) {
      if (isForbiddenGuestQuestionRequest(body)) {
        return json({
          ok: false,
          error: 'Guest oyun modu sadece sinirli oynanabilir soru destesi alabilir.',
          getQuestionsRuntimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
          runtimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
          functionContractVersion: GET_QUESTIONS_RUNTIME_CONTRACT_VERSION,
          source: 'guest_minimal_playable_projection',
        }, 400);
      }

      const guestAttemptContext = normalizeSoloAttemptContext(body);
      const limit = normalizeGuestGameplayLimit(body?.limit);
      const {
        activeCategorySource,
        activeIds,
      } = await resolveActiveCategoryContext(base44);
      const activeMainCategoryIds = new Set(activeIds);
      const allowedCategoryIds = Array.from(activeMainCategoryIds);

      if (allowedCategoryIds.length === 0) {
        return json({
          ok: true,
          questions: [],
          activeCategoryIds: Array.from(activeMainCategoryIds),
          activeCategorySource,
          categorySourceOfTruth: CATEGORY_METADATA_POLICY.sourceOfTruth,
          legacyHardcodedCategoryFallbackAllowed: false,
          staleCategoryFallbackUsed: false,
          rawQuestionListFallbackAllowed: false,
          projectionVersion: GAMEPLAY_PROJECTION_VERSION,
          getQuestionsRuntimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
          runtimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
          functionContractVersion: GET_QUESTIONS_RUNTIME_CONTRACT_VERSION,
          source: 'guest_minimal_playable_projection',
          reason: 'no_active_guest_categories',
          limit,
          requestedLimit: Number.isFinite(Number(body?.limit)) ? Number(body.limit) : null,
          effectiveLimit: limit,
          guest: true,
          guestLimitCap: MAX_GUEST_GAMEPLAY_LIMIT,
          projectionCappedBeforeCategoryCoverage: false,
        });
      }

      const projectionSeed = getProjectionSeed(body, false);
      const exposureMode = normalizeExposureMode(body);
      const exposurePlayer = await resolveExposurePlayer(base44, body, null).catch(() => null);
      const playerExposureStats = exposurePlayer?.playerKey
        ? await loadPlayerQuestionExposureStats(base44, exposurePlayer.playerKey, exposureMode)
        : new Map<string, any>();
      const { rows: questions } = await loadActiveQuestionCandidates(
        base44,
        allowedCategoryIds,
        GUEST_QUESTION_FETCH_PER_CATEGORY_LIMIT,
      );
      const normalizedQuestions = (questions || [])
        .map((question: Record<string, unknown>) => normalizeQuestionForRuntime(question, activeMainCategoryIds))
        .filter(Boolean);
      const guestAttemptQuestions = filterSoloAttemptCandidatePool(normalizedQuestions, guestAttemptContext);
      const primaryEasyQuestions = guestAttemptQuestions
        .filter((question: any) => hasAllowedDifficulty(question, GUEST_PRIMARY_DIFFICULTIES));
      const fallbackBeginnerQuestions = guestAttemptQuestions
        .filter((question: any) => hasAllowedDifficulty(question, GUEST_FALLBACK_DIFFICULTIES));
      const guestDeckNeed = Math.min(limit, guestAttemptContext.deckSize);
      const guestCandidateQuestions = primaryEasyQuestions.length >= guestDeckNeed
        ? primaryEasyQuestions
        : (fallbackBeginnerQuestions.length >= guestDeckNeed
          ? fallbackBeginnerQuestions
          : guestAttemptQuestions);
      const guestDifficultyRuleApplied = primaryEasyQuestions.length >= guestDeckNeed
        ? GUEST_DIFFICULTY_RULE
        : (fallbackBeginnerQuestions.length >= guestDeckNeed
          ? 'guest_fallback_difficulty_1_2'
          : 'guest_fallback_all_active_playable');
      const projection = buildPoolProportionalProjection(guestCandidateQuestions, limit, projectionSeed, playerExposureStats);
      const projected = projection.projected;

      return json({
        ok: true,
        questions: projected,
        activeCategoryIds: Array.from(activeMainCategoryIds),
        activeCategorySource,
        categorySourceOfTruth: CATEGORY_METADATA_POLICY.sourceOfTruth,
        legacyHardcodedCategoryFallbackAllowed: false,
        staleCategoryFallbackUsed: false,
        rawQuestionListFallbackAllowed: false,
        projectionVersion: GAMEPLAY_PROJECTION_VERSION,
        getQuestionsRuntimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
        runtimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
        functionContractVersion: GET_QUESTIONS_RUNTIME_CONTRACT_VERSION,
        source: 'guest_minimal_playable_projection',
        limit,
        requestedLimit: Number.isFinite(Number(body?.limit)) ? Number(body.limit) : null,
        effectiveLimit: limit,
        count: projected.length,
        samplingStrategy: PROJECTION_SAMPLING_STRATEGY,
        guest: true,
        guestLimitCap: MAX_GUEST_GAMEPLAY_LIMIT,
        guestDifficultyRule: guestDifficultyRuleApplied,
        playerExposureAwareSelection: playerExposureStats.size > 0,
        playerExposureMode: exposureMode,
        playerExposureStatsCount: playerExposureStats.size,
        responseCapApplied: true,
        responseQuestionCount: projected.length,
        projectionCappedBeforeCategoryCoverage: false,
      });
    }

    const user = await getOptionalUser(base44);
    if (!user?.email) {
      return json({
        ok: false,
        error: 'Giris yapmaniz gerekiyor.',
        getQuestionsRuntimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
        runtimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
        functionContractVersion: GET_QUESTIONS_RUNTIME_CONTRACT_VERSION,
        source: 'authenticated_minimal_playable_projection',
      }, 401);
    }
    const isAdmin = needsAdmin ? await isAuthorizedAdmin(base44, user) : false;
    if (needsAdmin && !isAdmin) {
      return json({ ok: false, error: 'Admin yetkisi gerekli.' }, 403);
    }

    const soloAttemptContext = normalizeSoloAttemptContext(body);
    const requestedIds = wantsGameplayProjection ? null : normalizeRequestedMainCategoryIds(body);
    const limit = wantsGameplayProjection
      ? normalizeAuthenticatedGameplayResponseLimit(body?.limit, soloAttemptContext.deckSize)
      : normalizeAuthenticatedGameplayResponseLimit(body?.limit, soloAttemptContext.deckSize);

    const {
      activeCategoryRows,
      fallbackUsed,
      fallbackReason,
      activeCategorySource,
      activeIds,
    } = await resolveActiveCategoryContext(base44);
    const activeMainCategoryIds = new Set(activeIds);
    const allowedMainCategoryIds = requestedIds
      ? new Set(Array.from(requestedIds).filter((id) => activeMainCategoryIds.has(id)))
      : activeMainCategoryIds;
    const softPreferenceCategoryIds = wantsGameplayProjection
      ? normalizeSoftPreferenceCategoryIds(body, activeMainCategoryIds)
      : [];

    if (allowedMainCategoryIds.size === 0) {
      const emptyDiagnostics = buildProjectionDiagnostics({
        fetchedRows: [],
        normalizedRows: [],
        projectedRows: [],
        fetchedByCategory: {},
        fetchDescriptorsByCategory: {},
        fallbackFetchCategories: [],
        categorySlots: {},
        limit,
        seed: getProjectionSeed(body, isAdmin),
        activeCategoryIds: Array.from(activeMainCategoryIds),
        activeCategoryRows,
        activeCategorySource,
        requestedCategoryIds: requestedIds ? Array.from(requestedIds) : null,
        allowedCategoryIds: [],
        requestedLimit: Number.isFinite(Number(body?.limit)) ? Number(body.limit) : null,
        fallbackUsed,
        fallbackReason,
        selectionMode: SERVER_ATTEMPT_SELECTION_MODE,
        sourcePoolCapRemoved: true,
        responseCapApplied: true,
        responseQuestionCount: 0,
      });
      const emptyResponse: Record<string, unknown> = {
        ok: true,
        questions: [],
        activeCategoryIds: Array.from(activeMainCategoryIds),
        activeCategorySource,
        categorySourceOfTruth: CATEGORY_METADATA_POLICY.sourceOfTruth,
        legacyHardcodedCategoryFallbackAllowed: false,
        staleCategoryFallbackUsed: false,
        rawQuestionListFallbackAllowed: false,
        projectionVersion: GAMEPLAY_PROJECTION_VERSION,
        getQuestionsRuntimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
        runtimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
        functionContractVersion: GET_QUESTIONS_RUNTIME_CONTRACT_VERSION,
        source: 'authenticated_minimal_playable_projection',
        reason: 'no_active_requested_categories',
        limit,
        requestedLimit: Number.isFinite(Number(body?.limit)) ? Number(body.limit) : null,
        effectiveLimit: limit,
        projectionCappedBeforeCategoryCoverage: false,
      };
      if (wantsDiagnostics) emptyResponse.projectionDiagnostics = emptyDiagnostics;
      return json(emptyResponse);
    }

    const projectionSeed = getProjectionSeed(body, isAdmin);
    const exposureMode = normalizeExposureMode(body);
    const exposurePlayer = await resolveExposurePlayer(base44, body, user).catch(() => null);
    const playerExposureStats = exposurePlayer?.playerKey
      ? await loadPlayerQuestionExposureStats(base44, exposurePlayer.playerKey, exposureMode)
      : new Map<string, any>();
    const allowedCategoryIds = Array.from(allowedMainCategoryIds);
    const { rows: questions, fetchedByCategory, fetchDescriptorsByCategory, fallbackFetchCategories } = await loadActiveQuestionCandidates(base44, allowedCategoryIds);
    const normalizedQuestions = (questions || [])
      .map((question: Record<string, unknown>) => normalizeQuestionForRuntime(question, allowedMainCategoryIds))
      .filter(Boolean);
    const eligibleAttemptQuestions = wantsGameplayProjection
      ? filterSoloAttemptCandidatePool(normalizedQuestions, soloAttemptContext)
      : normalizedQuestions;
    const projection = wantsGameplayProjection
      ? buildServerAttemptCandidateBuffer(
        eligibleAttemptQuestions,
        limit,
        projectionSeed,
        softPreferenceCategoryIds,
        playerExposureStats,
      )
      : buildPoolProportionalProjection(eligibleAttemptQuestions, limit, projectionSeed, playerExposureStats);
    const projected = projection.projected;

    const responsePayload: Record<string, unknown> = {
      ok: true,
      questions: projected,
      activeCategoryIds: Array.from(activeMainCategoryIds),
      activeCategorySource,
      categorySourceOfTruth: CATEGORY_METADATA_POLICY.sourceOfTruth,
      legacyHardcodedCategoryFallbackAllowed: false,
      staleCategoryFallbackUsed: false,
      rawQuestionListFallbackAllowed: false,
      projectionVersion: GAMEPLAY_PROJECTION_VERSION,
      getQuestionsRuntimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
      runtimeMarker: GET_QUESTIONS_RUNTIME_MARKER,
      functionContractVersion: GET_QUESTIONS_RUNTIME_CONTRACT_VERSION,
      source: 'authenticated_minimal_playable_projection',
      selectionMode: wantsGameplayProjection ? SERVER_ATTEMPT_SELECTION_MODE : PROJECTION_SAMPLING_STRATEGY,
      sourcePoolCapRemoved: wantsGameplayProjection,
      responseCapApplied: true,
      responseQuestionCount: projected.length,
      playerExposureAwareSelection: playerExposureStats.size > 0,
      playerExposureMode: exposureMode,
      playerExposureStatsCount: playerExposureStats.size,
      serverAttemptContext: wantsGameplayProjection ? {
        levelNumber: soloAttemptContext.levelNumber,
        deckSize: soloAttemptContext.deckSize,
        seedCount: soloAttemptContext.seedCount,
        yearStart: soloAttemptContext.yearStart,
        yearEnd: soloAttemptContext.yearEnd,
        softPreferenceCategoryIds,
        categoryPreferenceApplied: projection.preferenceApplied === true,
        selectedLaneDifficultyRule: projection.selectedLaneDifficultyRule || SELECTED_CATEGORY_LANE_DIFFICULTY_RULE,
        globalFallbackDifficultyRule: projection.globalFallbackDifficultyRule || GLOBAL_FALLBACK_LANE_DIFFICULTY_RULE,
        selectedLaneCandidateCount: projection.selectedLaneCandidateCount ?? null,
        globalFallbackLaneCandidateCount: projection.globalFallbackLaneCandidateCount ?? null,
        broaderGlobalFallbackUsed: projection.broaderGlobalFallbackUsed === true,
        globalFallbackFillCount: projection.globalFallbackFillCount ?? 0,
      } : null,
      limit,
      requestedLimit: Number.isFinite(Number(body?.limit)) ? Number(body.limit) : null,
      effectiveLimit: limit,
      count: projected.length,
      samplingStrategy: PROJECTION_SAMPLING_STRATEGY,
      projectionCappedBeforeCategoryCoverage: false,
    };
    if (wantsDiagnostics) {
      responsePayload.projectionDiagnostics = buildProjectionDiagnostics({
        fetchedRows: questions,
        normalizedRows: eligibleAttemptQuestions,
        projectedRows: projected,
        fetchedByCategory,
        fetchDescriptorsByCategory,
        fallbackFetchCategories,
        categorySlots: projection.categorySlots,
        limit,
        seed: projectionSeed,
        activeCategoryIds: Array.from(activeMainCategoryIds),
        activeCategoryRows,
        activeCategorySource,
        requestedCategoryIds: requestedIds ? Array.from(requestedIds) : null,
        allowedCategoryIds,
        requestedLimit: Number.isFinite(Number(body?.limit)) ? Number(body.limit) : null,
        fallbackUsed,
        fallbackReason,
        selectionMode: wantsGameplayProjection ? SERVER_ATTEMPT_SELECTION_MODE : PROJECTION_SAMPLING_STRATEGY,
        sourcePoolCapRemoved: wantsGameplayProjection,
        responseCapApplied: true,
        responseQuestionCount: projected.length,
        eligibleQuestionCountByCategory: buildFullDistribution(eligibleAttemptQuestions, getCategoryKey),
        selectedDeckCountsByCategory: buildFullDistribution(projected, getCategoryKey),
        eligibleQuestionCountByDifficulty: buildFullDistribution(eligibleAttemptQuestions, getDifficultyKey),
        selectedDeckCountsByDifficulty: buildFullDistribution(projected, getDifficultyKey),
        playerExposureAwareSelection: playerExposureStats.size > 0,
        playerExposureMode: exposureMode,
        playerExposureStatsCount: playerExposureStats.size,
      });
    }
    return json(responsePayload);
  } catch {
    return json({ ok: false, error: 'Sorular yuklenemedi.' }, 500);
  }
});
