#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@base44/sdk';
import { createServer } from 'vite';

const JOB_NAME = 'diagnoseSoloQuestionStartQuery';
const OWNER_EMAIL = 'sariverim@gmail.com';
const MAX_PREFERENCE_USERS = 10;
const MAX_PREFERENCE_ROWS = 10000;
const MAX_CATEGORY_ROWS = 1000;
const QUERY_PER_CATEGORY_LIMIT = 1000;
const TARGET_CATEGORY_IDS = Object.freeze([6, 7, 8, 9, 11]);
const QUESTION_CACHE_KEY = 'kronox_questions_v4';
const QUESTION_CACHE_VERSION = 'question-runtime-v4-active-category-full-pool';
const CATEGORY_ACTIVE_STATUS_VALUES = new Set(['', 'a', 'active', 'aktif']);
const PREFERENCE_ACTIVE_STATUS_VALUES = new Set(['a', 'active', 'aktif']);
const ENV_FILE_CANDIDATES = Object.freeze([
  '.env.local',
  '.env',
  '.env.development.local',
  '.env.development',
  '.env.production.local',
  '.env.production',
]);
const ONLINE_ID_TO_MAIN_CATEGORY_ID = Object.freeze({
  chronicle: 1,
  flashback: 2,
  kult: 3,
  viral: 4,
  arena: 5,
  level_up: 6,
});

function readJsonc(path) {
  const raw = readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '');
  return JSON.parse(raw);
}

function parseEnvLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) return null;
  const key = match[1];
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

function loadEnvFiles() {
  const loaded = [];
  for (const file of ENV_FILE_CANDIDATES) {
    if (!existsSync(file)) continue;
    const raw = readFileSync(file, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      if (process.env[parsed.key] === undefined) process.env[parsed.key] = parsed.value;
    }
    loaded.push(file);
  }
  return loaded;
}

function normalizeBase44ServerUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  return withProtocol
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');
}

function isAppNotFoundError(error) {
  const status = Number(error?.response?.status || error?.status || error?.statusCode || 0);
  const message = String(error?.response?.data?.message || error?.response?.data?.error || error?.message || error || '').toLowerCase();
  return status === 404 && message.includes('app not found');
}

function serializeError(error, config = {}) {
  const message = String(error?.response?.data?.message || error?.response?.data?.error || error?.message || error || 'unknown_error');
  if (isAppNotFoundError(error)) {
    return {
      ok: false,
      jobName: JOB_NAME,
      code: 'token_app_mismatch_or_wrong_app_id',
      error: 'App not found',
      readOnly: true,
      dryRun: true,
      attemptedAppId: config.appId || null,
      attemptedBase44ServerUrl: config.serverUrl || null,
      message: 'Base44 returned App not found. Check that BASE44_APP_ID points to the Kronox app and BASE44_APP_BASE_URL/VITE_BASE44_APP_BASE_URL points to the same deployed Kronox Base44 backend; also verify the service token belongs to that app/environment.',
      requiredEnv: [
        'BASE44_SERVICE_TOKEN or BASE44_SERVICE_ROLE_TOKEN',
        'BASE44_APP_BASE_URL or VITE_BASE44_APP_BASE_URL',
      ],
      optionalEnv: [
        'BASE44_APP_ID or VITE_BASE44_APP_ID',
      ],
    };
  }
  return {
    ok: false,
    jobName: JOB_NAME,
    code: 'diagnostic_failed',
    error: message,
    readOnly: true,
    dryRun: true,
    attemptedAppId: config.appId || null,
    attemptedBase44ServerUrl: config.serverUrl || null,
  };
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function maskEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized === OWNER_EMAIL) return normalized;
  const [name, domain] = normalized.split('@');
  if (!domain) return normalized;
  return `${name.slice(0, 1) || '*'}***@${domain}`;
}

function normalizeCategoryId(value) {
  if (typeof value === 'string') {
    const stripped = value.trim().replace(/^(?:cat|category):/i, '');
    const numeric = Number(stripped);
    if (!Number.isFinite(numeric)) return null;
    const id = Math.trunc(numeric);
    return id > 0 ? id : null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const id = Math.trunc(numeric);
  return id > 0 ? id : null;
}

function normalizeQuestionMainCategoryId(question = {}) {
  const raw = question.main_category_id
    ?? question.mainCategoryId
    ?? question.category_id
    ?? question.categoryid
    ?? question.categoryId;
  const direct = normalizeCategoryId(raw);
  if (direct !== null) return direct;

  const categoryText = String(question.category || '').trim().toLowerCase();
  return ONLINE_ID_TO_MAIN_CATEGORY_ID[categoryText] ?? null;
}

function parseExplicitYear(value) {
  if (typeof value === 'number') return Number.isFinite(value) && Number.isInteger(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || !/^-?\d{1,4}$/.test(text)) return null;
  const year = Number(text);
  return Number.isFinite(year) ? year : null;
}

function getTimelineYearFromAnswer(answer) {
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

function isActiveCategory(row) {
  const status = String(row?.status ?? '').trim().toLowerCase();
  return CATEGORY_ACTIVE_STATUS_VALUES.has(status);
}

function isActivePreference(row) {
  const status = String(row?.status ?? '').trim().toLowerCase();
  return PREFERENCE_ACTIVE_STATUS_VALUES.has(status);
}

function isActiveQuestion(row) {
  const state = String(row?.state ?? 'A').trim().toUpperCase();
  return state === 'A';
}

function getQuestionIdentity(question) {
  return String(question?.id ?? question?.__id ?? question?.question_id ?? question?.question ?? '').trim();
}

function dedupeQuestions(rows = []) {
  const seen = new Set();
  const out = [];
  for (const row of rows || []) {
    const key = getQuestionIdentity(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function normalizeQuestionForRuntime(question = {}, activeMainCategoryIds = new Set()) {
  const mainCategoryId = normalizeQuestionMainCategoryId(question);
  if (!mainCategoryId || !activeMainCategoryIds.has(mainCategoryId)) return null;
  if (!isActiveQuestion(question)) return null;

  const explicitYear = parseExplicitYear(question.year);
  const year = explicitYear !== null ? explicitYear : getTimelineYearFromAnswer(question.answer);
  if (!Number.isFinite(year)) return null;

  const text = String(question.question || '').trim();
  if (!text) return null;

  return {
    id: question.id,
    question: text,
    answer: String(question.answer || '').trim(),
    year,
    main_category_id: mainCategoryId,
    category_id: mainCategoryId,
    categoryId: mainCategoryId,
    sub_category: String(question.sub_category || question.subcategory || '').trim(),
    tag: String(question.tag || '').trim(),
    difficulty: Number.isFinite(Number(question.difficulty)) ? Number(question.difficulty) : 1,
    state: 'A',
    category: 'genel',
    type: 'metin',
    media_url: '',
  };
}

function countByCategory(rows = []) {
  const counts = {};
  for (const row of rows || []) {
    const id = normalizeQuestionMainCategoryId(row) ?? normalizeCategoryId(row?.main_category_id ?? row?.category_id);
    const key = id ? String(id) : 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function countDifficultyOneByCategory(rows = []) {
  const counts = {};
  for (const row of rows || []) {
    const difficulty = Number(row?.difficulty ?? row?.Difficulty);
    if (difficulty !== 1) continue;
    const id = normalizeQuestionMainCategoryId(row) ?? normalizeCategoryId(row?.main_category_id ?? row?.category_id);
    const key = id ? String(id) : 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function difficultiesByCategory(rows = []) {
  return (rows || []).reduce((acc, row) => {
    const key = String(normalizeQuestionMainCategoryId(row) || 'unknown');
    const difficulty = String(row?.difficulty ?? row?.Difficulty ?? 'unknown');
    if (!acc[key]) acc[key] = {};
    acc[key][difficulty] = (acc[key][difficulty] || 0) + 1;
    return acc;
  }, {});
}

function sortedUniqueCategoryIds(values = []) {
  return Array.from(new Set(values.map(normalizeCategoryId).filter((id) => id !== null)))
    .sort((a, b) => a - b);
}

function groupPreferencesByUser(rows = []) {
  const grouped = new Map();
  for (const row of rows || []) {
    const email = normalizeEmail(row?.user_email ?? row?.email ?? row?.created_by);
    if (!email) continue;
    const group = grouped.get(email) || [];
    group.push(row);
    grouped.set(email, group);
  }
  return grouped;
}

function buildPreferenceContext(email, rows, activeCategoryIds) {
  const activeSet = new Set(activeCategoryIds.map(String));
  const rawActivePreferenceIds = (rows || [])
    .filter(isActivePreference)
    .map((row) => row?.category_id ?? row?.categoryId ?? row?.main_category_id);
  const selectedPreferenceCategoryIdsNormalized = sortedUniqueCategoryIds(rawActivePreferenceIds);
  const activeValidSelectedCategoryIds = selectedPreferenceCategoryIdsNormalized
    .filter((id) => activeSet.has(String(id)));
  return {
    userEmail: email === OWNER_EMAIL ? email : undefined,
    userEmailMasked: maskEmail(email),
    isOwnerRequestedAccount: normalizeEmail(email) === OWNER_EMAIL,
    selectedPreferenceRawRowsCount: rows.length,
    selectedPreferenceCategoryIdsRaw: rawActivePreferenceIds,
    selectedPreferenceCategoryIdsNormalized,
    activeValidSelectedCategoryIds,
    insufficientPreferences: activeValidSelectedCategoryIds.length < 3,
  };
}

function selectPreferenceUsers(groupedPreferences, activeCategoryIds) {
  return Array.from(groupedPreferences.entries())
    .map(([email, rows]) => buildPreferenceContext(email, rows, activeCategoryIds))
    .filter((item) => !item.isOwnerRequestedAccount)
    .filter((item) => item.activeValidSelectedCategoryIds.length >= 3)
    .sort((a, b) => {
      if (b.activeValidSelectedCategoryIds.length !== a.activeValidSelectedCategoryIds.length) {
        return b.activeValidSelectedCategoryIds.length - a.activeValidSelectedCategoryIds.length;
      }
      return a.userEmailMasked.localeCompare(b.userEmailMasked);
    })
    .slice(0, MAX_PREFERENCE_USERS);
}

function hasCategory(distribution = {}, id) {
  return Number(distribution[String(id)] || 0) > 0;
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
  presentInDryRunDeck,
}) {
  if (!hasActiveCategoryRow) return 'passive_category_or_missing_category_row';
  if (activeQuestionCount <= 0) return 'no_active_questions';
  if (soloEligibleQuestionCount <= 0) return 'filtered_before_solo_eligibility';
  if (difficulty1QuestionCount <= 0 && !presentInGlobalDifficulty1) return 'no_difficulty_1_questions';
  if (selectedEnabled && !selectedIds.includes(id) && !presentInSelectedLane) return 'not_selected';
  if (!presentInGlobalLane) return 'excluded_from_global_lane_unknown';
  if (!presentInGlobalDifficulty1) return 'global_lane_has_category_but_no_difficulty_1_candidate';
  if (!presentInDryRunDeck) return 'available_before_deck_build_but_not_selected_by_dry_run_hard_rules_or_soft_balance';
  return 'not_removed_selected_in_frontend_buildSoloAttemptDeck_dry_run';
}

function makeSeededRandom(seedText = 'solo-query-diagnostic') {
  let state = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    state ^= seedText.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state = (Math.imul(state >>> 0, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

async function loadRuntimeDeckModules() {
  const server = await createServer({
    configFile: 'vite.config.js',
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true },
  });
  try {
    const engine = await server.ssrLoadModule('/src/lib/soloQuestionEngine.js');
    const levels = await server.ssrLoadModule('/src/lib/soloLevels.js');
    return { engine, levels };
  } finally {
    await server.close();
  }
}

async function loadActiveQuestionCandidates(base44, categoryIds) {
  const batches = [];
  const fetchedByCategory = {};
  const queryDescriptors = [];

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
    const rows = await base44.asServiceRole.entities.Question.filter(
      descriptor.filters,
      descriptor.sort,
      descriptor.limit,
    ).catch((error) => ({ __error: error?.message || String(error) }));
    if (rows?.__error) throw new Error(`Question.filter category ${categoryId} failed: ${rows.__error}`);
    fetchedByCategory[String(categoryId)] = Array.isArray(rows) ? rows.length : 0;
    if (Array.isArray(rows) && rows.length > 0) batches.push(...rows);
  }

  return { rows: dedupeQuestions(batches), fetchedByCategory, queryDescriptors };
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
  dryRunDeck,
  dryRunResult,
  soloDeckDiagnostics,
}) {
  const rawFetchedCountsByCategory = countByCategory(rawRows);
  const activeFilteredCountsByCategory = countByCategory(activeRows);
  const soloEligibleCountsByCategory = countByCategory(soloEligibleRows);
  const difficulty1CountsByCategory = countDifficultyOneByCategory(soloEligibleRows);
  const selectedLaneCandidateCountsByCategory = countByCategory(selectedLaneRows);
  const globalLaneCandidateCountsByCategory = countByCategory(globalLaneRows);
  const globalDifficulty1CandidateCountsByCategory = countByCategory(globalDifficulty1Rows);
  const finalDryRunDeckCountsByCategory = countByCategory(dryRunDeck);
  const selectedEnabled = preferenceContext.activeValidSelectedCategoryIds.length >= 3;
  const selectedIds = preferenceContext.activeValidSelectedCategoryIds;

  const categoryProof = Object.fromEntries(TARGET_CATEGORY_IDS.map((id) => {
    const hasActiveCategoryRow = activeCategoryIds.includes(id);
    const activeQuestionCount = Number(activeFilteredCountsByCategory[String(id)] || 0);
    const soloEligibleQuestionCount = Number(soloEligibleCountsByCategory[String(id)] || 0);
    const difficulty1QuestionCount = Number(difficulty1CountsByCategory[String(id)] || 0);
    const presentInSelectedLane = hasCategory(selectedLaneCandidateCountsByCategory, id);
    const presentInGlobalLane = hasCategory(globalLaneCandidateCountsByCategory, id);
    const presentInGlobalDifficulty1 = hasCategory(globalDifficulty1CandidateCountsByCategory, id);
    const presentInDryRunDeck = hasCategory(finalDryRunDeckCountsByCategory, id);
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
      presentInDryRunDeck,
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
        presentInDryRunDeck,
      }),
    }];
  }));

  return {
    ...preferenceContext,
    activeCategoryIds,
    passiveCategoryIds,
    actualSoloLevelStartPath: [
      'Home/SoloMap navigate("/game", state)',
      'Game.jsx routeState.soloLevel',
      'useOfflineQuestions reads local questionCache first',
      'useOfflineQuestions invokes getQuestions for fresh public_minimal_playable_projection',
      'questionRuntimeAdapter normalizes cached/fetched rows',
      'Game.jsx builds candidatePool = allQuestions type=metin within year window',
      'Game.jsx passes activeCategoryIds + selectedCategoryIds into buildSoloAttemptDeck',
    ],
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
    finalDryRunDeckGeneratedBy: 'scripts/diagnoseSoloQuestionStartQuery.mjs via Vite SSR import of src/lib/soloQuestionEngine.js',
    finalDryRunDeckOk: Boolean(dryRunResult?.ok),
    finalDryRunDeckFailureReason: dryRunResult?.ok ? null : (dryRunResult?.reason || 'unknown'),
    finalDryRunDeckCount: dryRunDeck.length,
    finalDryRunDeckCountsByCategory,
    finalDryRunDeckQuestionIds: dryRunDeck.map((question) => question.id).filter(Boolean),
    finalDryRunDeckYears: dryRunDeck.map((question) => question.year).filter((year) => year !== undefined && year !== null),
    finalDryRunDeckDifficultiesByCategory: difficultiesByCategory(dryRunDeck),
    finalDryRunDeckDiagnostics: soloDeckDiagnostics,
    categoryProof,
  };
}

function getEnv(name) {
  return String(process.env[name] || '').trim();
}

function buildConfig() {
  const loadedEnvFiles = loadEnvFiles();
  const appConfig = readJsonc('base44/.app.jsonc');
  const appId = getEnv('BASE44_APP_ID') || getEnv('VITE_BASE44_APP_ID') || appConfig.id || '';
  const serverUrl = normalizeBase44ServerUrl(
    getEnv('BASE44_APP_BASE_URL')
      || getEnv('VITE_BASE44_APP_BASE_URL')
      || getEnv('BASE44_BASE_URL')
      || getEnv('BASE44_API_URL')
      || getEnv('BASE44_SERVER_URL'),
  );
  const serviceToken = getEnv('BASE44_SERVICE_TOKEN') || getEnv('BASE44_SERVICE_ROLE_TOKEN');
  const accessToken = getEnv('BASE44_ACCESS_TOKEN') || getEnv('BASE44_ADMIN_ACCESS_TOKEN');
  const diagnosticMode = (getEnv('BASE44_DIAGNOSTIC_MODE') || 'service-role').toLowerCase();
  return {
    appId,
    serverUrl,
    serviceToken,
    accessToken,
    diagnosticMode,
    loadedEnvFiles,
  };
}

function buildMissingConfigOutput(config) {
  const requiredEnv = [];
  if (!config.appId) requiredEnv.push('BASE44_APP_ID or VITE_BASE44_APP_ID');
  if (!config.serverUrl) requiredEnv.push('BASE44_APP_BASE_URL or VITE_BASE44_APP_BASE_URL');
  if (config.diagnosticMode === 'backend-function') {
    if (!config.accessToken) requiredEnv.push('BASE44_ACCESS_TOKEN or BASE44_ADMIN_ACCESS_TOKEN');
  } else if (!config.serviceToken) {
    requiredEnv.push('BASE44_SERVICE_TOKEN or BASE44_SERVICE_ROLE_TOKEN');
  }
  return {
    ok: false,
    jobName: JOB_NAME,
    code: requiredEnv.length ? 'missing_base44_app_config' : 'missing_live_base44_service_token',
    readOnly: true,
    dryRun: true,
    mutatesGameplay: false,
    mutatesAnalytics: false,
    mutatesProgress: false,
    mutatesEconomy: false,
    appIdPresent: Boolean(config.appId),
    base44AppBaseUrlPresent: Boolean(config.serverUrl),
    serviceTokenPresent: Boolean(config.serviceToken),
    adminAccessTokenPresent: Boolean(config.accessToken),
    attemptedAppId: config.appId || null,
    attemptedBase44ServerUrl: config.serverUrl || null,
    diagnosticMode: config.diagnosticMode,
    loadedEnvFiles: config.loadedEnvFiles,
    requiredEnv,
    optionalEnv: [
      'BASE44_APP_ID or VITE_BASE44_APP_ID (defaults to base44/.app.jsonc id)',
      'BASE44_DIAGNOSTIC_MODE=service-role or backend-function',
    ],
    command: 'BASE44_APP_BASE_URL=<deployed-kronox-base44-url> BASE44_SERVICE_TOKEN=<service-token> node scripts/diagnoseSoloQuestionStartQuery.mjs > /tmp/solo-query-diagnostic.json',
    backendFunctionCommand: 'BASE44_DIAGNOSTIC_MODE=backend-function BASE44_APP_BASE_URL=<deployed-kronox-base44-url> BASE44_ACCESS_TOKEN=<admin-user-access-token> node scripts/diagnoseSoloQuestionStartQuery.mjs > /tmp/solo-query-diagnostic.json',
    message: 'Node diagnostics cannot use the frontend same-origin /api proxy. Set BASE44_APP_BASE_URL or VITE_BASE44_APP_BASE_URL to the same deployed Kronox Base44 app URL used by the frontend.',
  };
}

async function invokeBackendFunctionDiagnostic(config, { levelNumber, yearStart, yearEnd }) {
  const url = `${config.serverUrl}/api/functions/${JOB_NAME}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.accessToken}`,
    },
    body: JSON.stringify({ levelNumber, yearStart, yearEnd }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    const error = new Error(body?.error || body?.message || `Backend function returned ${response.status}`);
    error.status = response.status;
    error.response = { status: response.status, data: body };
    throw error;
  }
  return {
    ...body,
    diagnosticTransport: 'backend-function',
    attemptedAppId: config.appId,
    attemptedBase44ServerUrl: config.serverUrl,
  };
}

async function run() {
  const config = buildConfig();
  const levelNumber = Math.max(1, Math.trunc(Number(getEnv('SOLO_DIAGNOSTIC_LEVEL') || 1)));
  const yearStart = Number.isFinite(Number(getEnv('SOLO_DIAGNOSTIC_YEAR_START')))
    ? Number(getEnv('SOLO_DIAGNOSTIC_YEAR_START'))
    : 0;
  const yearEnd = Number.isFinite(Number(getEnv('SOLO_DIAGNOSTIC_YEAR_END')))
    ? Number(getEnv('SOLO_DIAGNOSTIC_YEAR_END'))
    : new Date().getFullYear();

  if (!config.appId || !config.serverUrl || (config.diagnosticMode === 'backend-function' ? !config.accessToken : !config.serviceToken)) {
    const output = buildMissingConfigOutput(config);
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = 2;
    return;
  }

  if (config.diagnosticMode === 'backend-function') {
    const output = await invokeBackendFunctionDiagnostic(config, { levelNumber, yearStart, yearEnd });
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const base44 = createClient({
    appId: config.appId,
    serverUrl: config.serverUrl,
    token: config.accessToken || undefined,
    serviceToken: config.serviceToken,
  });
  const { engine, levels } = await loadRuntimeDeckModules();

  const categoryRows = await base44.asServiceRole.entities.Category.list('category_id', MAX_CATEGORY_ROWS);
  const activeCategories = (Array.isArray(categoryRows) ? categoryRows : [])
    .filter(isActiveCategory)
    .map((row) => ({ ...row, category_id: normalizeCategoryId(row?.category_id ?? row?.categoryid) }))
    .filter((row) => row.category_id !== null)
    .sort((a, b) => a.category_id - b.category_id);
  const passiveCategoryIds = (Array.isArray(categoryRows) ? categoryRows : [])
    .filter((row) => !isActiveCategory(row))
    .map((row) => normalizeCategoryId(row?.category_id ?? row?.categoryid))
    .filter((id) => id !== null)
    .sort((a, b) => a - b);
  const activeCategoryIds = activeCategories.map((row) => Number(row.category_id));
  const activeCategoryIdSet = new Set(activeCategoryIds);

  const { rows: rawFetchedRows, fetchedByCategory, queryDescriptors } = await loadActiveQuestionCandidates(base44, activeCategoryIds);
  const activeFilteredRows = rawFetchedRows.filter((row) => {
    const categoryId = normalizeQuestionMainCategoryId(row);
    return categoryId && activeCategoryIdSet.has(categoryId) && isActiveQuestion(row);
  });
  const soloEligibleRows = activeFilteredRows
    .map((row) => normalizeQuestionForRuntime(row, activeCategoryIdSet))
    .filter(Boolean);
  const candidatePool = soloEligibleRows
    .filter((question) => question.type === 'metin')
    .filter((question) => Number(question.year) >= yearStart && Number(question.year) <= yearEnd);
  const globalLaneRows = soloEligibleRows;
  const globalDifficulty1Rows = soloEligibleRows.filter((row) => Number(row?.difficulty ?? row?.Difficulty) === 1);

  const preferenceRows = await base44.asServiceRole.entities.UserCategoryPreference.list('-updated_date', MAX_PREFERENCE_ROWS);
  const groupedPreferences = groupPreferencesByUser(Array.isArray(preferenceRows) ? preferenceRows : []);
  const ownerPreferenceContext = buildPreferenceContext(
    OWNER_EMAIL,
    groupedPreferences.get(OWNER_EMAIL) || [],
    activeCategoryIds,
  );
  const preferenceUsers = selectPreferenceUsers(groupedPreferences, activeCategoryIds);
  const inspectedUsers = [ownerPreferenceContext, ...preferenceUsers];

  const users = inspectedUsers.map((preferenceContext) => {
    const selectedSet = new Set(preferenceContext.activeValidSelectedCategoryIds.map(String));
    const preferenceEnabled = preferenceContext.activeValidSelectedCategoryIds.length >= 3;
    const selectedLaneRows = preferenceEnabled
      ? soloEligibleRows.filter((row) => selectedSet.has(String(row.main_category_id)))
      : [];
    const random = makeSeededRandom(`${preferenceContext.userEmailMasked}:${levelNumber}`);
    const dryRunResult = engine.buildSoloAttemptDeck({
      pool: candidatePool,
      allowedMainCategoryIds: activeCategoryIds,
      userSelectedCategoryIds: preferenceContext.activeValidSelectedCategoryIds,
      userCategoryPreferenceAvailable: preferenceEnabled,
      userCategoryPreferenceFallbackReason: preferenceEnabled ? null : 'diagnostic_insufficient_or_missing_preferences',
      levelNumber,
      deckSize: levels.getSoloAttemptDeckSizeForLevel(levelNumber),
      seedCount: 2,
      requireActiveCategoryWhitelist: true,
      random,
    });
    const dryRunDeck = dryRunResult?.ok ? dryRunResult.deck : [];
    const soloDeckDiagnostics = dryRunResult?.ok
      ? engine.getSoloDeckDiagnostics(dryRunResult, { levelNumber })
      : null;

    return buildUserDiagnostic({
      preferenceContext,
      activeCategoryIds,
      passiveCategoryIds,
      rawRows: rawFetchedRows,
      activeRows: activeFilteredRows,
      soloEligibleRows,
      selectedLaneRows,
      globalLaneRows,
      globalDifficulty1Rows,
      dryRunDeck,
      dryRunResult,
      soloDeckDiagnostics,
    });
  });

  const output = {
    ok: true,
    jobName: JOB_NAME,
    buildMarker: 'Codex334',
    readOnly: true,
    dryRun: true,
    mutatesGameplay: false,
    mutatesAnalytics: false,
    mutatesProgress: false,
    mutatesEconomy: false,
    requestedOwnerEmail: OWNER_EMAIL,
    attemptedAppId: config.appId,
    attemptedBase44ServerUrl: config.serverUrl,
    diagnosticTransport: 'service-role-sdk',
    ownerIncluded: true,
    preferenceUserLimit: MAX_PREFERENCE_USERS,
    preferenceUsersIncluded: preferenceUsers.length,
    fewerThanTenPreferenceUsers: preferenceUsers.length < MAX_PREFERENCE_USERS,
    targetCategoryIds: TARGET_CATEGORY_IDS,
    diagnosticInput: { levelNumber, yearStart, yearEnd },
    actualSoloLevelStartPath: [
      'Home/SoloMap navigate("/game", state)',
      'Game.jsx routeState.soloLevel',
      'useOfflineQuestions reads local questionCache first',
      'useOfflineQuestions invokes getQuestions for fresh public_minimal_playable_projection',
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
      note: 'This direct runner reads fresh DB rows and reports runtime cache keys; browser cache hit/age must be inspected in the device/browser that starts Solo.',
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
      queryOrderUsed: '-created_date per active category before pool/deck balancing',
      queryDescriptors,
    },
    activeCategoryIds,
    passiveCategoryIds,
    rawFetchedCount: rawFetchedRows.length,
    rawFetchedCountsByCategory: countByCategory(rawFetchedRows),
    activeFilteredCount: activeFilteredRows.length,
    activeFilteredCountsByCategory: countByCategory(activeFilteredRows),
    soloEligibleCount: soloEligibleRows.length,
    soloEligibleCountsByCategory: countByCategory(soloEligibleRows),
    difficulty1Count: globalDifficulty1Rows.length,
    difficulty1CountsByCategory: countDifficultyOneByCategory(soloEligibleRows),
    fetchedByCategory,
    users,
  };

  console.log(JSON.stringify(output, null, 2));
}

run().catch((error) => {
  console.log(JSON.stringify(serializeError(error, buildConfig()), null, 2));
  process.exitCode = 1;
});
