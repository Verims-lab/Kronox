export const SOLO_QUESTION_RUNTIME_DEBUG_VERSION = 'solo-runtime-query-debug-v1-Codex336';
export const SOLO_QUESTION_RUNTIME_DEBUG_TARGET_EMAIL = 'sariverim@gmail.com';
export const SOLO_QUESTION_RUNTIME_DEBUG_CATEGORY_IDS = ['6', '7', '8', '9', '11'];

export function normalizeDebugEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isSoloQuestionRuntimeDebugAllowed({ currentUser, authUser, adminStatus } = {}) {
  const currentEmail = normalizeDebugEmail(currentUser?.email || authUser?.email);
  if (currentEmail !== SOLO_QUESTION_RUNTIME_DEBUG_TARGET_EMAIL) return false;

  const userAdminDebug = authUser?.admin_status_debug || currentUser?.admin_status_debug || {};
  const adminSourceAllows = adminStatus?.parsedIsAdmin === true || userAdminDebug?.parsedIsAdmin === true;
  const adminRole = String(adminStatus?.role || userAdminDebug?.role || '').trim().toLowerCase();
  const adminState = String(adminStatus?.status || userAdminDebug?.status || '').trim().toLowerCase();
  const roleAllows = adminRole === 'owner' || adminRole === 'admin';
  const statusAllows = !adminState || adminState === 'active';

  return Boolean(adminSourceAllows && roleAllows && statusAllows);
}

export function normalizeDiagnosticCategoryId(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const stripped = raw
    .replace(/^cat(?:egory)?:/i, '')
    .replace(/^main(?:_category)?[:_]/i, '')
    .trim();
  const numeric = Number(stripped);
  if (Number.isFinite(numeric) && numeric > 0) return String(Math.trunc(numeric));
  return stripped || null;
}

function normalizeState(value) {
  return String(value ?? '').trim();
}

function normalizeDifficulty(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? '').trim() || null;
  return Math.trunc(numeric);
}

function getQuestionPrimaryCategoryId(question) {
  return normalizeDiagnosticCategoryId(
    question?.main_category_id
      ?? question?.category_id
      ?? question?.categoryId
      ?? question?.mainCategoryId
      ?? question?.category,
  );
}

export function getQuestionDiagnosticCategoryIds(question) {
  const ids = [
    question?.main_category_id,
    question?.category_id,
    question?.categoryId,
    question?.mainCategoryId,
    question?.second_category_id,
    question?.third_category_id,
    question?.sub_category,
    question?.category,
  ]
    .map(normalizeDiagnosticCategoryId)
    .filter(Boolean);
  return Array.from(new Set(ids));
}

export function countQuestionsByCategory(questions = []) {
  const counts = {};
  for (const question of questions || []) {
    const categoryId = getQuestionPrimaryCategoryId(question) || 'unknown';
    counts[categoryId] = (counts[categoryId] || 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })),
  );
}

export function countDifficultyOneQuestionsByCategory(questions = []) {
  return countQuestionsByCategory(
    (questions || []).filter((question) => Number(question?.difficulty) === 1),
  );
}

function normalizeDistributionKeys(distribution = {}) {
  const out = {};
  for (const [rawKey, value] of Object.entries(distribution || {})) {
    const categoryId = normalizeDiagnosticCategoryId(rawKey) || 'unknown';
    out[categoryId] = (out[categoryId] || 0) + Number(value || 0);
  }
  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })),
  );
}

function sanitizePreferenceRows(rows = []) {
  return (rows || []).map((row) => ({
    category_id: row?.category_id ?? row?.categoryId ?? row?.main_category_id ?? null,
    status: row?.status ?? row?.state ?? null,
  }));
}

function mapActiveCategoryRowsById(rows = []) {
  const out = {};
  for (const row of rows || []) {
    const categoryId = normalizeDiagnosticCategoryId(row?.category_id ?? row?.id);
    if (!categoryId) continue;
    out[categoryId] = {
      category_id: categoryId,
      name: row?.name ?? row?.title ?? row?.category_name ?? null,
      status: row?.status ?? row?.state ?? null,
    };
  }
  return out;
}

function sanitizeReturnedQuestions(questions = []) {
  return (questions || []).map((question) => ({
    id: question?.id ?? question?.question_id ?? null,
    question: question?.question ?? null,
    answer: question?.answer ?? null,
    difficulty: normalizeDifficulty(question?.difficulty),
    state: normalizeState(question?.state ?? question?.status),
    main_category_id: question?.main_category_id ?? null,
    second_category_id: question?.second_category_id ?? null,
    third_category_id: question?.third_category_id ?? null,
    sub_category: question?.sub_category ?? null,
    normalizedCategoryIds: getQuestionDiagnosticCategoryIds(question),
  }));
}

function buildCategoryProof({ targetCategoryIds, activeCategoryIds, activeCategoryRowsById, activePoolCounts, candidateCounts, selectedLaneCounts, globalLaneCounts, globalDifficultyCounts, finalCounts }) {
  const activeSet = new Set((activeCategoryIds || []).map(normalizeDiagnosticCategoryId).filter(Boolean));
  const proof = {};
  for (const categoryId of targetCategoryIds) {
    const hasActiveCategoryRow = Boolean(activeCategoryRowsById?.[categoryId] || activeSet.has(categoryId));
    const activeQuestionCount = Number(activePoolCounts?.[categoryId] || 0);
    const candidateCount = Number(candidateCounts?.[categoryId] || 0);
    const selectedLaneCount = Number(selectedLaneCounts?.[categoryId] || 0);
    const globalLaneCount = Number(globalLaneCounts?.[categoryId] || 0);
    const globalDifficulty1Count = Number(globalDifficultyCounts?.[categoryId] || 0);
    const finalCount = Number(finalCounts?.[categoryId] || 0);
    let removalReason = null;
    if (!hasActiveCategoryRow) removalReason = 'missing_active_category_row_or_passive';
    else if (activeQuestionCount <= 0) removalReason = 'not_present_in_active_question_pool';
    else if (candidateCount <= 0) removalReason = 'excluded_before_deck_builder_candidate_pool';
    else if (finalCount <= 0) removalReason = 'not_selected_by_current_dry_run_deck_balance_or_year_rules';

    proof[categoryId] = {
      hasActiveCategoryRow,
      activeCategoryRow: activeCategoryRowsById?.[categoryId] || null,
      presentInRuntimeActiveWhitelist: activeSet.has(categoryId),
      activeQuestionCount,
      candidatePoolQuestionCount: candidateCount,
      presentInCandidatePool: candidateCount > 0,
      presentInSelectedLane: selectedLaneCount > 0,
      presentInGlobalLane: globalLaneCount > 0,
      presentInGlobalDifficulty1: globalDifficulty1Count > 0,
      presentInFinalReturnedDeck: finalCount > 0,
      removalReason,
    };
  }
  return proof;
}

export function buildSoloQuestionRuntimeDebugPayload({
  currentUserEmail,
  isDebugAllowed,
  questionLoadDebugSnapshot,
  soloStartInput,
  soloCategoryPreferenceState,
  activeCategoryIds,
  allQuestions,
  candidatePool,
  engineResult,
  deck,
  isFromCache,
} = {}) {
  const preferenceFairness = engineResult?.meta?.categoryPreferenceFairness || {};
  const diagnostics = questionLoadDebugSnapshot?.projectionDiagnostics || null;
  const activePoolCounts = normalizeDistributionKeys(
    diagnostics?.eligibleByCategory
      || diagnostics?.fetchedByCategory
      || countQuestionsByCategory(allQuestions || []),
  );
  const candidatePoolCounts = countQuestionsByCategory(candidatePool || []);
  const finalCounts = countQuestionsByCategory(deck || []);
  const selectedLaneCounts = normalizeDistributionKeys(preferenceFairness.selectedLaneCandidateCategoryDistribution);
  const globalLaneCounts = normalizeDistributionKeys(preferenceFairness.globalLaneCandidateCategoryDistribution);
  const globalDifficultyCounts = normalizeDistributionKeys(
    preferenceFairness.globalDifficulty1CandidateCategoryDistribution
      || preferenceFairness.fullEligibleDifficulty1CandidateCategoryDistribution,
  );

  const selectedRawRows = sanitizePreferenceRows(soloCategoryPreferenceState?.rawPreferenceRows || []);
  const normalizedSelectedIds = (soloCategoryPreferenceState?.selectedCategoryIds || [])
    .map(normalizeDiagnosticCategoryId)
    .filter(Boolean);
  const activeDifficulty1Counts = countDifficultyOneQuestionsByCategory(allQuestions || []);
  const projectionActiveCategoryIds = (diagnostics?.activeCategoryIdsFromGetQuestions || questionLoadDebugSnapshot?.activeCategoryIds || [])
    .map(normalizeDiagnosticCategoryId)
    .filter(Boolean);
  const runtimeActiveCategoryIds = (activeCategoryIds || []).map(normalizeDiagnosticCategoryId).filter(Boolean);
  const activeCategoryRowsById = diagnostics?.activeCategoryRowsById
    || mapActiveCategoryRowsById(soloCategoryPreferenceState?.activeCategoryRows || []);
  const preferenceIdsRaw = (soloCategoryPreferenceState?.preferenceCategoryIdsRaw || selectedRawRows.map((row) => row.category_id))
    .map(normalizeDiagnosticCategoryId)
    .filter(Boolean);
  const preferenceValidAfterIntersection = (soloCategoryPreferenceState?.preferenceCategoryIdsValidAfterCategoryIntersection || normalizedSelectedIds)
    .map(normalizeDiagnosticCategoryId)
    .filter(Boolean);

  return {
    debugVersion: SOLO_QUESTION_RUNTIME_DEBUG_VERSION,
    currentUserEmail: normalizeDebugEmail(currentUserEmail),
    isDebugAllowed: Boolean(isDebugAllowed),
    cacheKey: questionLoadDebugSnapshot?.cacheKey || null,
    cacheVersion: questionLoadDebugSnapshot?.cacheVersion || null,
    soloStartInput: {
      mode: 'solo',
      ...soloStartInput,
    },
    normalizedPreferences: {
      raw: selectedRawRows,
      normalizedCategoryIds: normalizedSelectedIds,
      activeValidSelectedCategoryIds: normalizedSelectedIds,
      available: soloCategoryPreferenceState?.available === true,
      fallbackReason: soloCategoryPreferenceState?.fallbackReason || null,
    },
    queryPlan: {
      questionFetchSource: questionLoadDebugSnapshot?.source || (isFromCache ? 'local cache' : 'getQuestions'),
      functionSequence: [
        'Game.jsx',
        'useOfflineQuestions',
        'base44.functions.invoke(getQuestions)',
        'normalizeQuestionsForRuntime',
        'Game.jsx candidatePool(type=metin, year range)',
        'buildSoloAttemptDeck',
      ],
      entity: diagnostics?.questionFetchPath || 'getQuestions public_minimal_playable_projection',
      filtersApplied: [
        'getQuestions active Category whitelist',
        'getQuestions active playable Question projection',
        'runtime type === metin',
        `runtime year between ${soloStartInput?.yearStart ?? 'unknown'} and ${soloStartInput?.yearEnd ?? 'unknown'}`,
        'buildSoloAttemptDeck active category whitelist',
      ],
      sortOrLimit: {
        projectionVersion: diagnostics?.projectionVersion || questionLoadDebugSnapshot?.projectionVersion || null,
        requestedLimit: diagnostics?.requestedLimit ?? questionLoadDebugSnapshot?.requestedLimit ?? null,
        effectiveLimit: diagnostics?.effectiveLimit ?? questionLoadDebugSnapshot?.effectiveLimit ?? null,
        queryOrderUsed: diagnostics?.queryOrderUsed || questionLoadDebugSnapshot?.queryOrder || 'getQuestions deployed function order',
        queryLimitUsed: diagnostics?.queryLimitUsed ?? questionLoadDebugSnapshot?.queryLimit ?? null,
        projectionLimit: diagnostics?.projectionLimit ?? questionLoadDebugSnapshot?.limit ?? null,
        wasCappedBeforeBalancing: diagnostics?.wasCappedBeforeBalancing ?? false,
        projectionCappedBeforeCategoryCoverage: diagnostics?.projectionCappedBeforeCategoryCoverage
          ?? questionLoadDebugSnapshot?.projectionCappedBeforeCategoryCoverage
          ?? false,
      },
      difficultyLane: 'global 30% lane prefers difficulty=1 through buildSoloAttemptDeck metadata when preferences are active',
      activeQuestionPredicate: 'backend projection + runtime adapter expose active playable rows',
      categoryPredicate: 'normalized main_category_id/category_id compared against activeCategoryIds',
      cache: {
        cacheHit: Boolean(questionLoadDebugSnapshot?.cacheHit ?? isFromCache),
        cacheKey: questionLoadDebugSnapshot?.cacheKey || null,
        cacheVersion: questionLoadDebugSnapshot?.cacheVersion || null,
        ageMinutes: questionLoadDebugSnapshot?.cacheAgeMinutes ?? null,
        staleCacheRejected: questionLoadDebugSnapshot?.staleCacheRejected ?? false,
      },
    },
    activeCategorySource: diagnostics?.activeCategorySource || questionLoadDebugSnapshot?.activeCategorySource || 'runtime_activeCategoryIds',
    backendProjectionVersion: diagnostics?.projectionVersion || questionLoadDebugSnapshot?.projectionVersion || null,
    backendRequestedLimit: diagnostics?.requestedLimit ?? questionLoadDebugSnapshot?.requestedLimit ?? null,
    backendEffectiveLimit: diagnostics?.effectiveLimit ?? questionLoadDebugSnapshot?.effectiveLimit ?? null,
    backendFallbackUsed: diagnostics?.fallbackUsed ?? null,
    backendFallbackReason: diagnostics?.fallbackReason ?? null,
    activeCategoryRowsById,
    activeCategoryIdsFromGetQuestions: projectionActiveCategoryIds,
    activeCategoryIdsFromSoloRuntime: runtimeActiveCategoryIds,
    activeCategoryIds: runtimeActiveCategoryIds,
    preferenceCategoryIdsRaw: preferenceIdsRaw,
    preferenceCategoryIdsValidAfterCategoryIntersection: preferenceValidAfterIntersection,
    preferenceCategoryIdsRejectedWithReason: soloCategoryPreferenceState?.preferenceCategoryIdsRejectedWithReason || [],
    perCategoryQuestionFetchCounts: diagnostics?.perCategoryQuestionFetchCounts || questionLoadDebugSnapshot?.rawFetchedCountsByCategory || activePoolCounts,
    perCategoryPlayableCounts: diagnostics?.perCategoryPlayableCounts || questionLoadDebugSnapshot?.activeFilteredCountsByCategory || activePoolCounts,
    categoriesWithZeroPlayableQuestions: diagnostics?.categoriesWithZeroPlayableQuestions || [],
    projectionCappedBeforeCategoryCoverage: diagnostics?.projectionCappedBeforeCategoryCoverage
      ?? questionLoadDebugSnapshot?.projectionCappedBeforeCategoryCoverage
      ?? false,
    activePoolCountsByCategory: activePoolCounts,
    activeDifficulty1QuestionTotal: Object.values(activeDifficulty1Counts).reduce((sum, value) => sum + Number(value || 0), 0),
    activeDifficulty1QuestionCountsByCategory: activeDifficulty1Counts,
    candidatePoolCountsByCategory: candidatePoolCounts,
    selectedLaneCandidateCountsByCategory: selectedLaneCounts,
    globalLaneCandidateCountsByCategory: globalLaneCounts,
    globalDifficulty1CandidateCountsByCategory: globalDifficultyCounts,
    finalReturnedCountsByCategory: finalCounts,
    returnedQuestions: sanitizeReturnedQuestions(deck || []),
    returnedQuestionIds: (deck || []).map((question) => question?.id ?? question?.question_id).filter(Boolean),
    returnedQuestionYears: (deck || []).map((question) => Number(question?.year)).filter(Number.isFinite),
    returnedQuestionDifficultiesByCategory: (deck || []).reduce((acc, question) => {
      const categoryId = getQuestionPrimaryCategoryId(question) || 'unknown';
      const difficulty = String(normalizeDifficulty(question?.difficulty) ?? 'unknown');
      acc[categoryId] = acc[categoryId] || {};
      acc[categoryId][difficulty] = (acc[categoryId][difficulty] || 0) + 1;
      return acc;
    }, {}),
    category611Proof: buildCategoryProof({
      targetCategoryIds: SOLO_QUESTION_RUNTIME_DEBUG_CATEGORY_IDS,
      activeCategoryIds,
      activeCategoryRowsById,
      activePoolCounts,
      candidateCounts: candidatePoolCounts,
      selectedLaneCounts,
      globalLaneCounts,
      globalDifficultyCounts,
      finalCounts,
    }),
    engineMeta: {
      attemptId: engineResult?.attemptId || null,
      candidateCount: engineResult?.meta?.candidateCount ?? null,
      deckSize: engineResult?.meta?.deckSize ?? null,
      levelNumber: engineResult?.meta?.levelNumber ?? null,
      fallbackTier: engineResult?.meta?.fallbackTier ?? null,
      categoryPreferenceFairness: preferenceFairness,
    },
    fetchDiagnostics: questionLoadDebugSnapshot || null,
    exclusionSummary: {
      excludedByState: diagnostics?.droppedDuringNormalization ?? 0,
      excludedByDifficulty: 0,
      excludedByCategory: Math.max(0, (allQuestions || []).length - (candidatePool || []).length),
      excludedByAlreadySeenOrCache: 0,
      other: Math.max(0, (candidatePool || []).length - (deck || []).length),
    },
    notes: [
      'This payload is assembled from the real Solo runtime fetch/deck path, not a separate diagnostic query.',
      diagnostics ? 'getQuestions projectionDiagnostics were included.' : 'No getQuestions projectionDiagnostics were present; counts are derived from the runtime returned projection.',
      'No service token, env secret, auth header, or other user data is included.',
    ],
  };
}
