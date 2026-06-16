/**
 * useOfflineQuestions — Offline-first soru yükleme hook'u.
 *
 * Strateji (Android "offline-first" önerisi):
 * 1. localStorage cache'i anında yükle → UI hemen kullanılabilir
 * 2. Arka planda API'den taze veri çek (stale-while-revalidate)
 * 3. API başarılı → cache güncelle
 * 4. API başarısız + cache var → cache'le devam et (offline oynanabilir)
 * 5. API başarısız + cache yok → yalnızca gerçek offline ise offline ekranı göster
 *
 * Empty cache is not offline. Cold app/PWA starts and question-set refreshes
 * must attempt the auth/guest-safe bounded getQuestions path before any
 * no-cache fallback.
 */
import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  QUESTION_CACHE_KEY,
  QUESTION_CACHE_VERSION,
  getCacheInfo,
  saveQuestionsToCache,
  loadQuestionsFromCache,
} from '@/lib/questionCache';
import { normalizeQuestionsForRuntime } from '@/lib/questionRuntimeAdapter';
import {
  countDifficultyOneQuestionsByCategory,
  countQuestionsByCategory,
} from '@/lib/soloQuestionRuntimeDebug';
import { pushAppDiag } from '@/lib/appDiagBus';

const QUESTION_FETCH_RETRY_MS = 850;
const EMPTY_QUESTION_RESPONSE_RETRY_MS = 900;
const NO_CACHE_NETWORK_ATTEMPTS = 3;
const AUTH_GAMEPLAY_QUESTION_RESPONSE_LIMIT = 96;
const GUEST_GAMEPLAY_QUESTION_RESPONSE_LIMIT = 48;
const GAMEPLAY_QUESTION_REQUEST_VERSION = 'per_category_projection_v2';
const GUEST_GAMEPLAY_QUESTION_MODE = 'guest_gameplay_runtime';
const SERVER_ATTEMPT_SELECTION_MODE = 'server_attempt_candidate_buffer_v1';

export const QUESTION_LOAD_ERROR_KIND = {
  NO_ACTIVE_QUESTIONS: 'no_active_questions',
  OFFLINE_NO_CACHE: 'offline_no_cache',
  QUESTION_FETCH_FAILED: 'question_fetch_failed',
};

export const QUESTION_LOAD_CONTRACTS = {
  EMPTY_CACHE_IS_NOT_OFFLINE: 'empty_cache_is_not_offline_online_fetch_first',
  RETRY_REFETCHES_ONLINE: 'retry_clears_transient_error_and_refetches_online',
  OFFLINE_NO_CACHE_REQUIRES_KNOWN_OFFLINE: 'offline_no_cache_requires_known_offline_and_no_cache',
  GAMEPLAY_QUESTION_FETCH_REQUIRES_AUTH: 'gameplay_question_fetch_requires_authenticated_getQuestions',
  GUEST_GAMEPLAY_QUESTION_FETCH_IS_CAPPED: 'guest_gameplay_question_fetch_uses_capped_minimal_getQuestions_mode',
  AUTH_GAMEPLAY_RESPONSE_IS_ATTEMPT_BUFFER: 'authenticated_gameplay_getQuestions_returns_server_attempt_candidate_buffer',
  GAMEPLAY_QUESTION_FETCH_REQUESTS_CATEGORY_COVERAGE: 'gameplay_question_fetch_requests_per_category_projection_v2',
  AUTH_PREFERENCE_SELECTED_LANE_DIFFICULTY: 'selected_category_lane_uses_difficulty_1_and_2',
  AUTH_PREFERENCE_GLOBAL_LANE_DIFFICULTY: 'global_fallback_lane_uses_difficulty_1_only',
  GUEST_PRIMARY_DIFFICULTY: 'guest_primary_deck_uses_difficulty_1_only',
};

function normalizeQuestionRequestContext(context = {}) {
  const deckSize = Math.max(1, Math.min(32, Math.trunc(Number(context.deckSize) || 16)));
  const responseLimit = Math.min(
    AUTH_GAMEPLAY_QUESTION_RESPONSE_LIMIT,
    Math.max(deckSize, Math.trunc(Number(context.limit) || Math.max(80, deckSize * 4))),
  );
  const guestLimit = Math.min(
    GUEST_GAMEPLAY_QUESTION_RESPONSE_LIMIT,
    Math.max(deckSize, Math.trunc(Number(context.guestLimit) || Math.max(32, deckSize * 2))),
  );
  const selectedCategoryIds = Array.isArray(context.selectedCategoryIds)
    ? context.selectedCategoryIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
    : [];

  return {
    authScope: context.authScope === 'guest' ? 'guest' : 'authenticated',
    requestKind: context.requestKind || 'solo_attempt',
    levelNumber: Math.max(1, Math.trunc(Number(context.levelNumber) || 1)),
    deckSize,
    seedCount: Math.max(0, Math.min(8, Math.trunc(Number(context.seedCount) || 2))),
    yearStart: Number.isFinite(Number(context.yearStart)) ? Math.trunc(Number(context.yearStart)) : -9999,
    yearEnd: Number.isFinite(Number(context.yearEnd)) ? Math.trunc(Number(context.yearEnd)) : new Date().getFullYear(),
    selectedCategoryIds,
    categoryPreferenceAvailable: context.categoryPreferenceAvailable === true && selectedCategoryIds.length >= 3,
    categoryPreferenceFallbackReason: context.categoryPreferenceFallbackReason || null,
    limit: responseLimit,
    guestLimit,
  };
}

function buildQuestionRequestCacheKey(context = {}) {
  const normalized = normalizeQuestionRequestContext(context);
  return [
    normalized.authScope,
    normalized.requestKind,
    normalized.levelNumber,
    normalized.deckSize,
    normalized.seedCount,
    normalized.yearStart,
    normalized.yearEnd,
    normalized.categoryPreferenceAvailable ? normalized.selectedCategoryIds.join(',') : 'all-active',
  ].join('|');
}

function buildGameplayQuestionRequestPayload({ includeDiagnostics = false, requestContext = {} } = {}) {
  const context = normalizeQuestionRequestContext(requestContext);
  return {
    mode: 'gameplay_runtime',
    projectionVersion: GAMEPLAY_QUESTION_REQUEST_VERSION,
    requireCategoryCoverage: true,
    selectionMode: SERVER_ATTEMPT_SELECTION_MODE,
    responseMode: 'solo_attempt_candidate_buffer',
    levelNumber: context.levelNumber,
    deckSize: context.deckSize,
    seedCount: context.seedCount,
    yearStart: context.yearStart,
    yearEnd: context.yearEnd,
    selected_category_ids: context.categoryPreferenceAvailable ? context.selectedCategoryIds : [],
    categoryPreferenceAvailable: context.categoryPreferenceAvailable,
    categoryPreferenceFallbackReason: context.categoryPreferenceFallbackReason,
    limit: context.limit,
    ...(includeDiagnostics ? { includeDiagnostics: true } : {}),
  };
}

function buildGuestGameplayQuestionRequestPayload({ requestContext = {} } = {}) {
  const context = normalizeQuestionRequestContext({ ...requestContext, authScope: 'guest' });
  return {
    mode: GUEST_GAMEPLAY_QUESTION_MODE,
    projectionVersion: GAMEPLAY_QUESTION_REQUEST_VERSION,
    requireCategoryCoverage: true,
    selectionMode: SERVER_ATTEMPT_SELECTION_MODE,
    responseMode: 'guest_solo_attempt_candidate_buffer',
    levelNumber: context.levelNumber,
    deckSize: context.deckSize,
    seedCount: context.seedCount,
    yearStart: context.yearStart,
    yearEnd: context.yearEnd,
    limit: context.guestLimit,
  };
}

async function resolveQuestionAccessMode(preferredMode = 'authenticated') {
  if (preferredMode === 'guest') return 'guest';
  if (preferredMode === 'authenticated') return 'authenticated';
  try {
    const user = await base44.auth.me();
    return user?.email ? 'authenticated' : 'guest';
  } catch {
    return 'guest';
  }
}

function getBackendFunctionWiringStatus({ requestPayload, responseData } = {}) {
  const requestedGuest = requestPayload?.mode === GUEST_GAMEPLAY_QUESTION_MODE;
  const requestedDiagnostics = requestPayload?.includeDiagnostics === true || requestPayload?.debug === true;
  const requestedV2 = requestPayload?.mode === 'gameplay_runtime'
    || requestedGuest
    || requestPayload?.projectionVersion === GAMEPLAY_QUESTION_REQUEST_VERSION
    || requestPayload?.requireCategoryCoverage === true;
  const runtimeMarker = responseData?.getQuestionsRuntimeMarker
    || responseData?.runtimeMarker
    || responseData?.projectionDiagnostics?.getQuestionsRuntimeMarker
    || responseData?.projectionDiagnostics?.runtimeMarker
    || null;
  const hasDiagnostics = Boolean(responseData?.projectionDiagnostics);

  if (!requestedV2) return 'not_gameplay_v2_request';
  if (requestedGuest && runtimeMarker) return 'guest_backend_marker_present';
  if (requestedGuest && !runtimeMarker) return 'missing_guest_backend_marker';
  if (runtimeMarker && hasDiagnostics) return 'backend_marker_and_projection_diagnostics_present';
  if (runtimeMarker && !requestedDiagnostics) return 'backend_marker_present_bounded_attempt_buffer';
  if (!runtimeMarker && !hasDiagnostics) return 'missing_backend_marker_and_projection_diagnostics';
  if (!runtimeMarker) return 'missing_backend_marker';
  return 'missing_projection_diagnostics';
}

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function isKnownOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function deriveActiveCategoryIds(questions = []) {
  return Array.from(new Set(
    (questions || [])
      .map((question) => Number(question?.main_category_id))
      .filter((id) => Number.isFinite(id) && id > 0),
  ));
}

function readUsableCachedQuestions(requestKey = '') {
  const cached = loadQuestionsFromCache();
  const questions = normalizeQuestionsForRuntime(cached?.questions || []);
  if (!cached || questions.length === 0) return null;
  if (requestKey && cached.requestKey && cached.requestKey !== requestKey) return null;
  const activeCategoryIds = Array.isArray(cached.activeCategoryIds) && cached.activeCategoryIds.length
    ? cached.activeCategoryIds
    : deriveActiveCategoryIds(questions);
  return { ...cached, questions, activeCategoryIds };
}

function buildQuestionFetchDebugSnapshot({
  source,
  cacheHit = false,
  cacheInfo = null,
  responseData = null,
  requestPayload = null,
  questions = [],
  activeCategoryIds = [],
  fallbackReason = null,
  diagnosticsFallbackError = null,
} = {}) {
  const normalizedQuestions = normalizeQuestionsForRuntime(questions || []);
  const backendFunctionWiringStatus = getBackendFunctionWiringStatus({ requestPayload, responseData });
  return {
    source,
    cacheHit: Boolean(cacheHit),
    cacheKey: cacheInfo?.key || QUESTION_CACHE_KEY,
    cacheVersion: cacheInfo?.version || QUESTION_CACHE_VERSION,
    cacheAgeMinutes: cacheInfo?.ageMinutes ?? null,
    staleCacheRejected: Boolean(cacheInfo?.isStale === true && !cacheHit),
    limit: responseData?.limit ?? null,
    count: responseData?.count ?? normalizedQuestions.length,
    activeCategoryIds,
    activeCategorySource: responseData?.activeCategorySource || responseData?.projectionDiagnostics?.activeCategorySource || null,
    queryEntity: 'base44.functions.invoke',
    queryFunction: 'getQuestions',
    queryPayload: requestPayload || buildGameplayQuestionRequestPayload({ includeDiagnostics: Boolean(responseData?.projectionDiagnostics) }),
    questionAccessMode: requestPayload?.mode === GUEST_GAMEPLAY_QUESTION_MODE ? 'guest' : 'authenticated',
    backendFunctionWiringStatus,
    backendFunctionWiringBlocker: backendFunctionWiringStatus.startsWith('missing_'),
    getQuestionsRuntimeMarker: responseData?.getQuestionsRuntimeMarker
      || responseData?.runtimeMarker
      || responseData?.projectionDiagnostics?.getQuestionsRuntimeMarker
      || responseData?.projectionDiagnostics?.runtimeMarker
      || null,
    projectionVersion: responseData?.projectionVersion || responseData?.projectionDiagnostics?.projectionVersion || null,
    selectionMode: responseData?.selectionMode || responseData?.projectionDiagnostics?.selectionMode || null,
    sourcePoolCapRemoved: responseData?.sourcePoolCapRemoved ?? responseData?.projectionDiagnostics?.sourcePoolCapRemoved ?? null,
    responseCapApplied: responseData?.responseCapApplied ?? responseData?.projectionDiagnostics?.responseCapApplied ?? null,
    responseQuestionCount: responseData?.responseQuestionCount ?? responseData?.projectionDiagnostics?.responseQuestionCount ?? null,
    serverAttemptContext: responseData?.serverAttemptContext || null,
    requestedLimit: responseData?.requestedLimit ?? responseData?.projectionDiagnostics?.requestedLimit ?? null,
    effectiveLimit: responseData?.effectiveLimit ?? responseData?.projectionDiagnostics?.effectiveLimit ?? responseData?.limit ?? null,
    queryOrder: responseData?.projectionDiagnostics?.queryOrderUsed || null,
    queryLimit: responseData?.projectionDiagnostics?.queryLimitUsed ?? responseData?.limit ?? null,
    rawFetchedCount: responseData?.projectionDiagnostics?.fetchedActiveTotal ?? responseData?.count ?? normalizedQuestions.length,
    rawFetchedCountsByCategory: responseData?.projectionDiagnostics?.fetchedByCategory || countQuestionsByCategory(normalizedQuestions),
    activeFilteredCount: responseData?.projectionDiagnostics?.eligibleAfterNormalization ?? normalizedQuestions.length,
    activeFilteredCountsByCategory: responseData?.projectionDiagnostics?.eligibleByCategory || countQuestionsByCategory(normalizedQuestions),
    soloEligibleCount: responseData?.projectionDiagnostics?.eligibleAfterNormalization ?? normalizedQuestions.length,
    soloEligibleCountsByCategory: responseData?.projectionDiagnostics?.eligibleByCategory || countQuestionsByCategory(normalizedQuestions),
    difficulty1Count: normalizedQuestions.filter((question) => Number(question?.difficulty) === 1).length,
    difficulty1CountsByCategory: countDifficultyOneQuestionsByCategory(normalizedQuestions),
    returnedCountsByCategory: responseData?.projectionDiagnostics?.returnedByCategory || countQuestionsByCategory(normalizedQuestions),
    eligibleCountsByDifficulty: responseData?.projectionDiagnostics?.eligibleCountsByDifficulty
      || responseData?.projectionDiagnostics?.eligibleQuestionCountByDifficulty
      || null,
    selectedDeckCountsByDifficulty: responseData?.projectionDiagnostics?.selectedDeckCountsByDifficulty
      || responseData?.projectionDiagnostics?.returnedByDifficulty
      || null,
    projectionCappedBeforeCategoryCoverage: responseData?.projectionCappedBeforeCategoryCoverage ?? responseData?.projectionDiagnostics?.projectionCappedBeforeCategoryCoverage ?? null,
    projectionDiagnostics: responseData?.projectionDiagnostics || null,
    guestLimitCap: responseData?.guestLimitCap ?? null,
    guestDifficultyRule: responseData?.guestDifficultyRule ?? null,
    fallbackReason,
    diagnosticsFallbackError,
    generatedAt: new Date().toISOString(),
  };
}

export function useOfflineQuestions({ debugEnabled = false, enabled = true, requestContext = {} } = {}) {
  const normalizedRequestContext = useMemo(
    () => normalizeQuestionRequestContext(requestContext),
    [requestContext],
  );
  const requestKey = buildQuestionRequestCacheKey(normalizedRequestContext);
  const initialCached = enabled ? readUsableCachedQuestions(requestKey) : null;
  const [questions, setQuestions] = useState(() => {
    // Sync init: cache varsa anında ver — loading göstermeden
    return normalizeQuestionsForRuntime(initialCached?.questions || []);
  });
  const [isLoading, setIsLoading] = useState(() => {
    return !initialCached; // cache varsa loading false başlar
  });
  const [isError, setIsError] = useState(false);
  const [errorKind, setErrorKind] = useState(null);
  const [isFromCache, setIsFromCache] = useState(() => {
    return !!initialCached;
  });
  const [activeCategoryIds, setActiveCategoryIds] = useState(() => {
    const fromCache = initialCached?.activeCategoryIds || [];
    return fromCache.length ? fromCache : deriveActiveCategoryIds(initialCached?.questions || []);
  });
  const [debugSnapshot, setDebugSnapshot] = useState(() => {
    if (!initialCached) return null;
    return buildQuestionFetchDebugSnapshot({
      source: 'local cache',
      cacheHit: true,
      cacheInfo: getCacheInfo(),
      questions: initialCached.questions,
      activeCategoryIds: initialCached.activeCategoryIds,
    });
  });
  const fetchedRequestKeyRef = useRef(null);
  const diagnosticsFetchRef = useRef(false);
  const requestIdRef = useRef(0);

  const applyCachedQuestions = useCallback((cached, { fallbackReason = null } = {}) => {
    if (!cached) return false;
    setDebugSnapshot(buildQuestionFetchDebugSnapshot({
      source: 'local cache',
      cacheHit: true,
      cacheInfo: getCacheInfo(),
      questions: cached.questions,
      activeCategoryIds: cached.activeCategoryIds,
      fallbackReason,
    }));
    setQuestions(cached.questions);
    setActiveCategoryIds(cached.activeCategoryIds);
    setIsFromCache(true);
    setIsError(false);
    setErrorKind(null);
    setIsLoading(false);
    return true;
  }, []);

  const fetchFromNetwork = useCallback(async ({ attempts = 1, forceLoading = false, includeDiagnostics = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (forceLoading) setIsLoading(true);
    setIsError(false);
    setErrorKind(null);
    pushAppDiag({
      questionFetchStatus: 'started',
      questionFetchRequestId: requestId,
      questionFetchIncludeDiagnostics: Boolean(includeDiagnostics),
      questionFetchAttempts: attempts,
      questionFetchStartedAt: new Date().toISOString(),
    });

    let fetched = [];
    let fetchedActiveCategoryIds = [];
    let lastError = null;
    let networkReturned = false;
    let responseData = null;
    let diagnosticsFallbackError = null;
    const questionAccessMode = await resolveQuestionAccessMode(normalizedRequestContext.authScope);
    const includeBackendDiagnostics = questionAccessMode === 'authenticated' && includeDiagnostics;
    let requestPayload = questionAccessMode === 'guest'
      ? buildGuestGameplayQuestionRequestPayload({ requestContext: normalizedRequestContext })
      : buildGameplayQuestionRequestPayload({ includeDiagnostics: includeBackendDiagnostics, requestContext: normalizedRequestContext });

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        // Signed-in gameplay receives the authenticated bounded attempt buffer.
        // Guests use only the explicit, capped minimal guest mode. Direct
        // Question.list fallback remains removed so callers never receive the
        // raw question bank.
        let res;
        requestPayload = questionAccessMode === 'guest'
          ? buildGuestGameplayQuestionRequestPayload({ requestContext: normalizedRequestContext })
          : buildGameplayQuestionRequestPayload({ includeDiagnostics: includeBackendDiagnostics, requestContext: normalizedRequestContext });
        try {
          res = await base44.functions.invoke('getQuestions', requestPayload);
        } catch (diagnosticError) {
          if (!includeBackendDiagnostics) throw diagnosticError;
          diagnosticsFallbackError = diagnosticError?.message || String(diagnosticError);
          requestPayload = buildGameplayQuestionRequestPayload({ requestContext: normalizedRequestContext });
          res = await base44.functions.invoke('getQuestions', requestPayload);
        }
        networkReturned = true;
        responseData = res.data || null;
        if (Array.isArray(res.data?.questions) && res.data.questions.length > 0) {
          fetched = res.data.questions;
          fetchedActiveCategoryIds = Array.isArray(res.data.activeCategoryIds) ? res.data.activeCategoryIds : [];
        }
        pushAppDiag({
          questionFetchStatus: 'succeeded',
          questionFetchRequestId: requestId,
          questionFetchAccessMode: questionAccessMode,
          questionFetchCount: fetched.length,
          questionFetchBackendMarkerPresent: Boolean(
            responseData?.getQuestionsRuntimeMarker
              || responseData?.runtimeMarker
              || responseData?.projectionDiagnostics?.runtimeMarker,
          ),
          questionFetchCompletedAt: new Date().toISOString(),
        });
        if (fetched.length === 0 && attempt < attempts) {
          pushAppDiag({
            questionFetchStatus: 'empty_response_retrying',
            questionFetchRequestId: requestId,
            questionFetchAttempt: attempt,
            questionFetchAccessMode: questionAccessMode,
            questionFetchRetryDelayMs: EMPTY_QUESTION_RESPONSE_RETRY_MS,
            questionFetchEmptyResponseAt: new Date().toISOString(),
          });
          await wait(EMPTY_QUESTION_RESPONSE_RETRY_MS);
          continue;
        }
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        pushAppDiag({
          questionFetchStatus: 'failed_attempt',
          questionFetchRequestId: requestId,
          questionFetchAttempt: attempt,
          questionFetchAccessMode: questionAccessMode,
          questionFetchErrorCode: err?.code || null,
          questionFetchErrorMessage: String(err?.message || 'question_fetch_failed').slice(0, 160),
          questionFetchFailedAt: new Date().toISOString(),
        });
        if (attempt < attempts) await wait(QUESTION_FETCH_RETRY_MS);
      }
    }

    if (requestIdRef.current !== requestId) return;

    if (fetched.length > 0) {
      const runtimeQuestions = normalizeQuestionsForRuntime(fetched);
      if (runtimeQuestions.length > 0) {
        const activeIds = fetchedActiveCategoryIds.length
          ? fetchedActiveCategoryIds
          : deriveActiveCategoryIds(runtimeQuestions);
        saveQuestionsToCache(runtimeQuestions, { activeCategoryIds: activeIds, requestKey });
        setDebugSnapshot(buildQuestionFetchDebugSnapshot({
          source: responseData?.source || 'getQuestions',
          cacheHit: false,
          cacheInfo: getCacheInfo(),
          responseData,
          requestPayload,
          questions: runtimeQuestions,
          activeCategoryIds: activeIds,
          diagnosticsFallbackError,
        }));
        setQuestions(runtimeQuestions);
        setActiveCategoryIds(activeIds);
        setIsFromCache(false);
        setIsError(false);
        setIsLoading(false);
        return;
      }
    }

    const cached = readUsableCachedQuestions(requestKey);
    if (cached) {
      applyCachedQuestions(cached, {
        fallbackReason: lastError?.message || (networkReturned ? 'network_returned_empty_questions' : null),
      });
      if (diagnosticsFallbackError) {
        setDebugSnapshot((previous) => previous ? { ...previous, diagnosticsFallbackError } : previous);
      }
    } else if (lastError || networkReturned) {
      const nextErrorKind = networkReturned && fetched.length === 0
        ? QUESTION_LOAD_ERROR_KIND.NO_ACTIVE_QUESTIONS
        : isKnownOffline()
          ? QUESTION_LOAD_ERROR_KIND.OFFLINE_NO_CACHE
          : (lastError?.code || QUESTION_LOAD_ERROR_KIND.QUESTION_FETCH_FAILED);
      setErrorKind(nextErrorKind);
      setIsError(true);
      pushAppDiag({
        questionFetchStatus: 'failed',
        questionFetchRequestId: requestId,
        questionFetchAccessMode: questionAccessMode,
        questionFetchErrorKind: nextErrorKind,
        questionFetchCompletedAt: new Date().toISOString(),
      });
    }
    setIsLoading(false);
  }, [applyCachedQuestions, requestKey, normalizedRequestContext]);

  useEffect(() => {
    if (!enabled) {
      fetchedRequestKeyRef.current = null;
      setIsLoading(true);
      setIsError(false);
      setErrorKind(null);
      return;
    }
    if (fetchedRequestKeyRef.current === requestKey) return;
    fetchedRequestKeyRef.current = requestKey;

    const cached = readUsableCachedQuestions(requestKey);

    if (cached) {
      applyCachedQuestions(cached, {
        fallbackReason: cached.isStale ? 'stale_cache_revalidating' : null,
      });
    }

    if (cached && !cached.isStale) {
      // Cache taze (< 24 saat) → arka planda yenile, ama UI'ı bloklamaz
      setIsLoading(false);
      fetchFromNetwork({ attempts: 1, includeDiagnostics: debugEnabled }); // fire-and-forget
    } else {
      // Cache yok veya bayat → önce göster (varsa), sonra fetch et
      fetchFromNetwork({
        attempts: cached ? 1 : NO_CACHE_NETWORK_ATTEMPTS,
        forceLoading: !cached,
        includeDiagnostics: debugEnabled,
      });
    }
  }, [applyCachedQuestions, enabled, fetchFromNetwork, debugEnabled, requestKey]);

  useEffect(() => {
    if (!enabled || !debugEnabled || diagnosticsFetchRef.current === requestKey) return;
    diagnosticsFetchRef.current = requestKey;
    fetchFromNetwork({ attempts: 1, includeDiagnostics: true });
  }, [enabled, debugEnabled, fetchFromNetwork, requestKey]);

  const retry = () => {
    fetchedRequestKeyRef.current = null;
    setIsError(false);
    setErrorKind(null);
    setIsLoading(true);
    fetchFromNetwork({ attempts: NO_CACHE_NETWORK_ATTEMPTS, forceLoading: true, includeDiagnostics: debugEnabled });
    fetchedRequestKeyRef.current = requestKey;
  };

  return {
    questions,
    isLoading,
    isError,
    errorKind,
    isFromCache,
    activeCategoryIds,
    debugSnapshot,
    retry,
  };
}
