/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const JOB_NAME = 'diagnoseSoloQuestionStartQuery';
const MAX_PREFERENCE_USERS = 10;
const MAX_PREFERENCE_ROWS = 10000;
const MAX_CATEGORY_ROWS = 1000;
const QUERY_PER_CATEGORY_LIMIT = 1000;
const QUESTION_CACHE_KEY = 'kronox_questions_v7';
const QUESTION_CACHE_VERSION = 'question-runtime-v7-getQuestions-live-marker';
const CATEGORY_ACTIVE_STATUS_VALUES = new Set(['', 'a', 'active', 'aktif']);
const PREFERENCE_ACTIVE_STATUS_VALUES = new Set(['a', 'active', 'aktif']);

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeAdminAuthEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function adminAuthJson(payload: unknown, status = 200) {
  return Response.json(payload, { status });
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


async function getAdminAuthorization(base44: any, user: any) {
  const email = normalizeAdminAuthEmail(user?.email);
  if (!email) return { isAdmin: false, row: null, role: '', status: '' };
  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) return { isAdmin: false, row: null, role: '', status: '' };

  let rows: any[] = [];
  for (const field of ADMIN_AUTH_FIELD_CANDIDATES.email) {
    const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10).catch(() => []);
    if (Array.isArray(result) && result.length > 0) {
      rows = result;
      break;
    }
  }

  const exactRows = (rows || []).map((candidate: any) => {
    const emailField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.email);
    const roleField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.role);
    const statusField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.status);
    return {
      candidate,
      email: normalizeAdminAuthEmail(emailField.value),
      role: String(roleField.value || '').trim().toLowerCase(),
      status: String(statusField.value || '').trim().toLowerCase(),
    };
  }).filter((candidate) => candidate.email === email);

  const active = exactRows.find((candidate) => isActiveAdminStatus(candidate.status) && isActiveAdminRole(candidate.role)) || null;
  return { isAdmin: Boolean(active?.candidate), row: active?.candidate || null, role: active?.role || '', status: active?.status || '' };
}

async function requireAdmin(base44: any) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) return { response: adminAuthJson({ ok: false, error: 'Authentication required' }, 401) };
    const authorization = await getAdminAuthorization(base44, user);
    if (!authorization.isAdmin) return { response: adminAuthJson({ ok: false, error: 'Admin access required' }, 403) };
    return { user, admin: authorization.row, adminRole: authorization.role };
  } catch (_error) {
    return { response: adminAuthJson({ ok: false, error: 'Authentication required' }, 401) };
  }
}

function maskEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return '';
  const [name, domain] = normalized.split('@');
  if (!domain) return normalized;
  const visible = name.slice(0, 1);
  return `${visible || '*'}***@${domain}`;
}

function normalizeRequestedDiagnosticEmail(body: any) {
  return normalizeEmail(body?.requestedUserEmail ?? body?.targetUserEmail ?? body?.diagnosticUserEmail);
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

function isActiveCategory(row: any) {
  const status = String(row?.status ?? '').trim().toLowerCase();
  return CATEGORY_ACTIVE_STATUS_VALUES.has(status);
}

function isActivePreference(row: any) {
  const status = String(row?.status ?? '').trim().toLowerCase();
  return PREFERENCE_ACTIVE_STATUS_VALUES.has(status);
}

function isActiveQuestion(row: any) {
  const state = String(row?.state ?? 'A').trim().toUpperCase();
  return state === 'A';
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
    category: 'genel',
    type: 'metin',
    media_url: '',
  };
}

function countByCategory(rows: any[] = []) {
  const counts: Record<string, number> = {};
  for (const row of rows || []) {
    const id = normalizeQuestionMainCategoryId(row) ?? normalizeCategoryId(row?.main_category_id ?? row?.category_id);
    const key = id ? String(id) : 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function countDifficultyOneByCategory(rows: any[] = []) {
  const counts: Record<string, number> = {};
  for (const row of rows || []) {
    const difficulty = Number(row?.difficulty ?? row?.Difficulty);
    if (difficulty !== 1) continue;
    const id = normalizeQuestionMainCategoryId(row) ?? normalizeCategoryId(row?.main_category_id ?? row?.category_id);
    const key = id ? String(id) : 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function sortedUniqueCategoryIds(values: unknown[] = []) {
  return Array.from(new Set(values
    .map(normalizeCategoryId)
    .filter((id): id is number => id !== null)))
    .sort((a, b) => a - b);
}

function normalizeDiagnosticCategoryIds(value: unknown, fallbackIds: number[] = []) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const explicit = sortedUniqueCategoryIds(rawValues);
  return explicit.length ? explicit : fallbackIds.slice();
}

async function loadActiveQuestionCandidates(base44: any, categoryIds: number[]) {
  const batches: any[] = [];
  const fetchedByCategory: Record<string, number> = {};
  const queryDescriptors: any[] = [];

  for (const categoryId of categoryIds) {
    const descriptor = {
      entity: 'Question',
      method: 'filter',
      filters: { main_category_id: categoryId, state: 'A' },
      sort: '-created_date',
      limit: QUERY_PER_CATEGORY_LIMIT,
      pagination: 'per-category',
      capBeforeBalancing: false,
    };
    queryDescriptors.push(descriptor);
    const rows = await base44.asServiceRole.entities.Question
      .filter(descriptor.filters, descriptor.sort, descriptor.limit)
      .catch(() => []);
    fetchedByCategory[String(categoryId)] = Array.isArray(rows) ? rows.length : 0;
    if (Array.isArray(rows) && rows.length > 0) batches.push(...rows);
  }

  return {
    rows: dedupeQuestions(batches),
    fetchedByCategory,
    queryDescriptors,
  };
}

function groupPreferencesByUser(rows: any[] = []) {
  const grouped = new Map<string, any[]>();
  for (const row of rows || []) {
    const email = normalizeEmail(row?.user_email ?? row?.email ?? row?.created_by);
    if (!email) continue;
    const group = grouped.get(email) || [];
    group.push(row);
    grouped.set(email, group);
  }
  return grouped;
}

function buildPreferenceContext(email: string, rows: any[], activeCategoryIds: number[], requestedEmail = '') {
  const activeSet = new Set(activeCategoryIds.map(String));
  const normalizedEmail = normalizeEmail(email);
  const normalizedRequestedEmail = normalizeEmail(requestedEmail);
  const rawActivePreferenceIds = (rows || [])
    .filter(isActivePreference)
    .map((row) => row?.category_id ?? row?.categoryId ?? row?.main_category_id);
  const selectedPreferenceCategoryIdsNormalized = sortedUniqueCategoryIds(rawActivePreferenceIds);
  const activeValidSelectedCategoryIds = selectedPreferenceCategoryIdsNormalized
    .filter((id) => activeSet.has(String(id)));
  return {
    userEmailMasked: maskEmail(normalizedEmail),
    isRequestedAccount: Boolean(normalizedRequestedEmail && normalizedEmail === normalizedRequestedEmail),
    selectedPreferenceRawRows: rows.length,
    selectedPreferenceCategoryIdsRaw: rawActivePreferenceIds,
    selectedPreferenceCategoryIdsNormalized,
    activeValidSelectedCategoryIds,
    insufficientPreferences: activeValidSelectedCategoryIds.length < 3,
  };
}

function selectPreferenceUsers(groupedPreferences: Map<string, any[]>, activeCategoryIds: number[], requestedEmail = '') {
  const users = Array.from(groupedPreferences.entries())
    .map(([email, rows]) => buildPreferenceContext(email, rows, activeCategoryIds, requestedEmail))
    .filter((item) => !item.isRequestedAccount)
    .filter((item) => item.activeValidSelectedCategoryIds.length >= 3)
    .sort((a, b) => {
      if (b.activeValidSelectedCategoryIds.length !== a.activeValidSelectedCategoryIds.length) {
        return b.activeValidSelectedCategoryIds.length - a.activeValidSelectedCategoryIds.length;
      }
      return a.userEmailMasked.localeCompare(b.userEmailMasked);
    })
    .slice(0, MAX_PREFERENCE_USERS);
  return users;
}

function hasCategory(distribution: Record<string, number>, id: number) {
  return Number(distribution?.[String(id)] || 0) > 0;
}

function getRemovalReason({
  id,
  hasActiveCategoryRow,
  activeQuestionCount,
  soloEligibleQuestionCount,
  difficulty1QuestionCount,
  selectedEnabled,
  selectedIds,
  presentInSelectedLane,
  presentInGlobalLane,
  presentInGlobalDifficulty1,
}: {
  id: number;
  hasActiveCategoryRow: boolean;
  activeQuestionCount: number;
  soloEligibleQuestionCount: number;
  difficulty1QuestionCount: number;
  selectedEnabled: boolean;
  selectedIds: number[];
  presentInSelectedLane: boolean;
  presentInGlobalLane: boolean;
  presentInGlobalDifficulty1: boolean;
}) {
  if (!hasActiveCategoryRow) return 'passive_category_or_missing_category_row';
  if (activeQuestionCount <= 0) return 'no_active_questions';
  if (soloEligibleQuestionCount <= 0) return 'filtered_before_solo_eligibility';
  if (difficulty1QuestionCount <= 0 && !presentInGlobalDifficulty1) return 'no_difficulty_1_questions';
  if (selectedEnabled && !selectedIds.includes(id) && !presentInSelectedLane) return 'not_selected';
  if (!presentInGlobalLane) return 'excluded_from_global_lane_unknown';
  if (!presentInGlobalDifficulty1) return 'global_lane_has_category_but_no_difficulty_1_candidate';
  return 'not_removed_before_deck_build';
}

function buildUserDiagnostic({
  preferenceContext,
  activeCategoryIds,
  passiveCategoryIds,
  rawRows,
  activeRows,
  soloEligibleRows,
  selectedLaneRows,
  globalLaneRows,
  globalDifficulty1Rows,
  diagnosticCategoryIds,
}: any) {
  const rawFetchedCountsByCategory = countByCategory(rawRows);
  const activeFilteredCountsByCategory = countByCategory(activeRows);
  const soloEligibleCountsByCategory = countByCategory(soloEligibleRows);
  const difficulty1CountsByCategory = countDifficultyOneByCategory(soloEligibleRows);
  const selectedLaneCandidateCountsByCategory = countByCategory(selectedLaneRows);
  const globalLaneCandidateCountsByCategory = countByCategory(globalLaneRows);
  const globalDifficulty1CandidateCountsByCategory = countByCategory(globalDifficulty1Rows);
  const selectedEnabled = preferenceContext.activeValidSelectedCategoryIds.length >= 3;

  const categoryProof = Object.fromEntries(diagnosticCategoryIds.map((id: number) => {
    const hasActiveCategoryRow = activeCategoryIds.includes(id);
    const selectedIds = preferenceContext.activeValidSelectedCategoryIds;
    const activeQuestionCount = Number(activeFilteredCountsByCategory[String(id)] || 0);
    const soloEligibleQuestionCount = Number(soloEligibleCountsByCategory[String(id)] || 0);
    const difficulty1QuestionCount = Number(difficulty1CountsByCategory[String(id)] || 0);
    const presentInSelectedLane = hasCategory(selectedLaneCandidateCountsByCategory, id);
    const presentInGlobalLane = hasCategory(globalLaneCandidateCountsByCategory, id);
    const presentInGlobalDifficulty1 = hasCategory(globalDifficulty1CandidateCountsByCategory, id);
    return [String(id), {
      hasActiveCategoryRow,
      activeQuestionCount,
      soloEligibleQuestionCount,
      difficulty1QuestionCount,
      presentInRawFetch: hasCategory(rawFetchedCountsByCategory, id),
      presentInActiveFiltered: hasCategory(activeFilteredCountsByCategory, id),
      presentInSoloEligible: hasCategory(soloEligibleCountsByCategory, id),
      presentInSelectedLane,
      presentInGlobalLane,
      presentInGlobalDifficulty1,
      presentInDryRunDeck: null,
      removalReason: getRemovalReason({
        id,
        hasActiveCategoryRow,
        activeQuestionCount,
        soloEligibleQuestionCount,
        difficulty1QuestionCount,
        selectedEnabled,
        selectedIds,
        presentInSelectedLane,
        presentInGlobalLane,
        presentInGlobalDifficulty1,
      }),
    }];
  }));

  return {
    ...preferenceContext,
    activeCategoryIds,
    passiveCategoryIds,
    questionFetchSource: 'getQuestions -> Question entity per-category dry-run',
    functionPathNames: [
      'Game.jsx',
      'useOfflineQuestions',
      'base44.functions.invoke("getQuestions")',
      'questionCache localStorage stale-while-revalidate',
      'buildSoloAttemptDeck',
    ],
    rawFetchedCount: rawRows.length,
    rawFetchedCountsByCategory,
    activeFilteredCount: activeRows.length,
    activeFilteredCountsByCategory,
    soloEligibleCount: soloEligibleRows.length,
    soloEligibleCountsByCategory,
    difficulty1Count: globalDifficulty1Rows.length,
    difficulty1CountsByCategory,
    selectedLaneCandidateCount: selectedLaneRows.length,
    selectedLaneCandidateCountsByCategory,
    globalLaneCandidateCount: globalLaneRows.length,
    globalLaneCandidateCountsByCategory,
    globalDifficulty1CandidateCount: globalDifficulty1Rows.length,
    globalDifficulty1CandidateCountsByCategory,
    finalDryRunDeckGeneratedBy: 'Admin UI imports buildSoloAttemptDeck from src/lib/soloQuestionEngine.js',
    finalDryRunDeckCount: null,
    finalDryRunDeckCountsByCategory: {},
    finalDryRunDeckQuestionIds: [],
    finalDryRunDeckYears: [],
    finalDryRunDeckDifficultiesByCategory: {},
    categoryProof,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    if (admin.response) return admin.response;

    const body = await req.json().catch(() => ({}));
    const levelNumber = Math.max(1, Math.trunc(Number(body?.levelNumber) || 1));
    const yearStart = Number.isFinite(Number(body?.yearStart)) ? Number(body.yearStart) : 0;
    const yearEnd = Number.isFinite(Number(body?.yearEnd)) ? Number(body.yearEnd) : new Date().getFullYear();
    const requestedEmail = normalizeRequestedDiagnosticEmail(body);

    const categoryRows = await base44.asServiceRole.entities.Category
      .list('category_id', MAX_CATEGORY_ROWS)
      .catch(() => []);
    const activeCategories = (Array.isArray(categoryRows) ? categoryRows : [])
      .filter(isActiveCategory)
      .map((row: any) => ({ ...row, category_id: normalizeCategoryId(row?.category_id ?? row?.categoryid) }))
      .filter((row: any) => row.category_id !== null)
      .sort((a: any, b: any) => a.category_id - b.category_id);
    const passiveCategories = (Array.isArray(categoryRows) ? categoryRows : [])
      .filter((row: any) => !isActiveCategory(row))
      .map((row: any) => normalizeCategoryId(row?.category_id ?? row?.categoryid))
      .filter((id): id is number => id !== null)
      .sort((a: number, b: number) => a - b);
    const activeCategoryIds = activeCategories.map((row: any) => Number(row.category_id));
    const activeCategoryIdSet = new Set(activeCategoryIds);
    const diagnosticCategoryIds = normalizeDiagnosticCategoryIds(
      body?.diagnosticCategoryIds ?? body?.categoryIds,
      activeCategoryIds,
    );

    const { rows: rawFetchedRows, fetchedByCategory, queryDescriptors } = await loadActiveQuestionCandidates(base44, activeCategoryIds);
    const activeFilteredRows = rawFetchedRows.filter((row) => {
      const categoryId = normalizeQuestionMainCategoryId(row);
      return categoryId && activeCategoryIdSet.has(categoryId) && isActiveQuestion(row);
    });
    const soloEligibleRows = activeFilteredRows
      .map((row: Record<string, unknown>) => normalizeQuestionForRuntime(row, activeCategoryIdSet))
      .filter(Boolean);
    const globalLaneRows = soloEligibleRows;
    const globalDifficulty1Rows = soloEligibleRows.filter((row: any) => Number(row?.difficulty ?? row?.Difficulty) === 1);

    const preferenceRows = await base44.asServiceRole.entities.UserCategoryPreference
      .list('-updated_date', MAX_PREFERENCE_ROWS)
      .catch(() => []);
    const groupedPreferences = groupPreferencesByUser(Array.isArray(preferenceRows) ? preferenceRows : []);
    const requestedPreferenceContext = requestedEmail
      ? buildPreferenceContext(
        requestedEmail,
        groupedPreferences.get(requestedEmail) || [],
        activeCategoryIds,
        requestedEmail,
      )
      : null;
    const preferenceUsers = selectPreferenceUsers(groupedPreferences, activeCategoryIds, requestedEmail);
    const inspectedUsers = [requestedPreferenceContext, ...preferenceUsers].filter(Boolean);

    const users = inspectedUsers.map((preferenceContext) => {
      const selectedSet = new Set(preferenceContext.activeValidSelectedCategoryIds.map(String));
      const selectedLaneRows = preferenceContext.activeValidSelectedCategoryIds.length >= 3
        ? soloEligibleRows.filter((row: any) => selectedSet.has(String(row?.main_category_id)))
        : [];
      return buildUserDiagnostic({
        preferenceContext,
        activeCategoryIds,
        passiveCategoryIds: passiveCategories,
        rawRows: rawFetchedRows,
        activeRows: activeFilteredRows,
        soloEligibleRows,
        selectedLaneRows,
        globalLaneRows,
        globalDifficulty1Rows,
        diagnosticCategoryIds,
      });
    });

    return json({
      ok: true,
      jobName: JOB_NAME,
      buildMarker: 'Codex410',
      readOnly: true,
      dryRun: true,
      mutatesGameplay: false,
      mutatesAnalytics: false,
      mutatesProgress: false,
      mutatesEconomy: false,
      requestedByMasked: maskEmail(normalizeEmail(admin.user?.email)),
      requestedUserEmailConfigured: Boolean(requestedEmail),
      requestedUserEmailMasked: requestedEmail ? maskEmail(requestedEmail) : null,
      requestedUserIncluded: Boolean(requestedPreferenceContext),
      preferenceUserLimit: MAX_PREFERENCE_USERS,
      preferenceUsersIncluded: preferenceUsers.length,
      fewerThanTenPreferenceUsers: preferenceUsers.length < MAX_PREFERENCE_USERS,
      targetCategoryIds: diagnosticCategoryIds,
      diagnosticCategoryIds,
      diagnosticCategoryIdSource: 'request_or_current_active_categories',
      historicalRegressionCategoryIdsAreRuntimePolicy: false,
      diagnosticInput: { levelNumber, yearStart, yearEnd },
      actualSoloLevelStartPath: [
        'Home/SoloMap navigate("/game", state)',
        'Game.jsx routeState.soloLevel',
        'useOfflineQuestions reads local questionCache first',
        'useOfflineQuestions invokes getQuestions for fresh authenticated_minimal_playable_projection',
        'questionRuntimeAdapter normalizes cached/fetched rows',
        'Game.jsx builds candidatePool = allQuestions type=metin within year window',
        'Game.jsx passes activeCategoryIds + selectedCategoryIds into buildSoloAttemptDeck',
      ],
      cacheDescriptor: {
        frontendCacheLayer: 'localStorage questionCache',
        cacheKey: QUESTION_CACHE_KEY,
        cacheVersion: QUESTION_CACHE_VERSION,
        cacheHit: null,
        cacheAgeMinutes: null,
        staleCacheRejected: null,
        note: 'Backend diagnostic reads fresh DB rows. Admin UI adds the current browser cache snapshot separately.',
      },
      queryDescriptor: {
        questionFetchSource: 'getQuestions-compatible fresh DB dry-run',
        entity: 'Question',
        method: 'filter',
        filters: { main_category_id: activeCategoryIds, state: 'A' },
        sort: '-created_date',
        limit: QUERY_PER_CATEGORY_LIMIT,
        pagination: 'per-category',
        capBeforeBalancing: false,
        queryLimitUsed: QUERY_PER_CATEGORY_LIMIT,
        queryOrderUsed: '-created_date per active category before frontend deck balancing',
        queryDescriptors,
      },
      activeCategoryIds,
      passiveCategoryIds: passiveCategories,
      rawFetchedCount: rawFetchedRows.length,
      rawFetchedCountsByCategory: countByCategory(rawFetchedRows),
      activeFilteredCount: activeFilteredRows.length,
      activeFilteredCountsByCategory: countByCategory(activeFilteredRows),
      soloEligibleCount: soloEligibleRows.length,
      soloEligibleCountsByCategory: countByCategory(soloEligibleRows),
      difficulty1Count: globalDifficulty1Rows.length,
      difficulty1CountsByCategory: countDifficultyOneByCategory(soloEligibleRows),
      runtimeQuestions: soloEligibleRows,
      users,
    });
  } catch (error) {
    console.error(`[${JOB_NAME}] failed:`, (error as Error)?.message || error);
    return json({ ok: false, error: 'Solo query diagnostiği çalıştırılamadı.' }, 500);
  }
});
