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
 * must attempt the public-safe online gameplay projection before any no-cache
 * fallback.
 */
import { useCallback, useState, useEffect, useRef } from 'react';
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

const QUESTION_FETCH_RETRY_MS = 850;
const NO_CACHE_NETWORK_ATTEMPTS = 3;
const GAMEPLAY_QUESTION_PROJECTION_LIMIT = 1200;
const GAMEPLAY_QUESTION_REQUEST_VERSION = 'per_category_projection_v2';

export const QUESTION_LOAD_ERROR_KIND = {
  NO_ACTIVE_QUESTIONS: 'no_active_questions',
  OFFLINE_NO_CACHE: 'offline_no_cache',
  QUESTION_FETCH_FAILED: 'question_fetch_failed',
};

export const QUESTION_LOAD_CONTRACTS = {
  EMPTY_CACHE_IS_NOT_OFFLINE: 'empty_cache_is_not_offline_online_fetch_first',
  RETRY_REFETCHES_ONLINE: 'retry_clears_transient_error_and_refetches_online',
  OFFLINE_NO_CACHE_REQUIRES_KNOWN_OFFLINE: 'offline_no_cache_requires_known_offline_and_no_cache',
  GUEST_QUESTION_FETCH_USES_PUBLIC_PROJECTION: 'guest_question_fetch_uses_public_minimal_projection',
  GAMEPLAY_QUESTION_FETCH_REQUESTS_CATEGORY_COVERAGE: 'gameplay_question_fetch_requests_per_category_projection_v2',
};

function buildGameplayQuestionRequestPayload({ includeDiagnostics = false } = {}) {
  return {
    mode: 'gameplay_runtime',
    projectionVersion: GAMEPLAY_QUESTION_REQUEST_VERSION,
    requireCategoryCoverage: true,
    limit: GAMEPLAY_QUESTION_PROJECTION_LIMIT,
    ...(includeDiagnostics ? { includeDiagnostics: true } : {}),
  };
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

function readUsableCachedQuestions() {
  const cached = loadQuestionsFromCache();
  const questions = normalizeQuestionsForRuntime(cached?.questions || []);
  if (!cached || questions.length === 0) return null;
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
    projectionVersion: responseData?.projectionVersion || responseData?.projectionDiagnostics?.projectionVersion || null,
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
    projectionCappedBeforeCategoryCoverage: responseData?.projectionCappedBeforeCategoryCoverage ?? responseData?.projectionDiagnostics?.projectionCappedBeforeCategoryCoverage ?? null,
    projectionDiagnostics: responseData?.projectionDiagnostics || null,
    fallbackReason,
    diagnosticsFallbackError,
    generatedAt: new Date().toISOString(),
  };
}

export function useOfflineQuestions({ debugEnabled = false } = {}) {
  const initialCached = readUsableCachedQuestions();
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
  const fetchedRef = useRef(false);
  const diagnosticsFetchRef = useRef(false);
  const requestIdRef = useRef(0);

  const fetchFromNetwork = useCallback(async ({ attempts = 1, forceLoading = false, includeDiagnostics = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (forceLoading) setIsLoading(true);
    setIsError(false);
    setErrorKind(null);

    let fetched = [];
    let fetchedActiveCategoryIds = [];
    let lastError = null;
    let networkReturned = false;
    let responseData = null;
    let diagnosticsFallbackError = null;
    let requestPayload = buildGameplayQuestionRequestPayload({ includeDiagnostics });

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        // Guest/no-auth Solo play is supported through the public-safe
        // minimal projection. Direct Question.list fallback remains removed
        // so guests never receive the raw question bank.
        let res;
        requestPayload = buildGameplayQuestionRequestPayload({ includeDiagnostics });
        try {
          res = await base44.functions.invoke('getQuestions', requestPayload);
        } catch (diagnosticError) {
          if (!includeDiagnostics) throw diagnosticError;
          diagnosticsFallbackError = diagnosticError?.message || String(diagnosticError);
          requestPayload = buildGameplayQuestionRequestPayload();
          res = await base44.functions.invoke('getQuestions', requestPayload);
        }
        networkReturned = true;
        responseData = res.data || null;
        if (Array.isArray(res.data?.questions) && res.data.questions.length > 0) {
          fetched = res.data.questions;
          fetchedActiveCategoryIds = Array.isArray(res.data.activeCategoryIds) ? res.data.activeCategoryIds : [];
        }
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
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
        saveQuestionsToCache(runtimeQuestions, { activeCategoryIds: activeIds });
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

    const cached = readUsableCachedQuestions();
    if (cached) {
      setDebugSnapshot(buildQuestionFetchDebugSnapshot({
        source: 'local cache fallback',
        cacheHit: true,
        cacheInfo: getCacheInfo(),
        questions: cached.questions,
        activeCategoryIds: cached.activeCategoryIds,
        fallbackReason: lastError?.message || (networkReturned ? 'network_returned_empty_questions' : null),
        diagnosticsFallbackError,
      }));
      setQuestions(cached.questions);
      setActiveCategoryIds(cached.activeCategoryIds);
      setIsFromCache(true);
      setIsError(false);
    } else if (lastError || networkReturned) {
      const nextErrorKind = networkReturned && fetched.length === 0
        ? QUESTION_LOAD_ERROR_KIND.NO_ACTIVE_QUESTIONS
        : isKnownOffline()
          ? QUESTION_LOAD_ERROR_KIND.OFFLINE_NO_CACHE
          : (lastError?.code || QUESTION_LOAD_ERROR_KIND.QUESTION_FETCH_FAILED);
      setErrorKind(nextErrorKind);
      setIsError(true);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const cached = readUsableCachedQuestions();

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
  }, [fetchFromNetwork, debugEnabled]);

  useEffect(() => {
    if (!debugEnabled || diagnosticsFetchRef.current) return;
    diagnosticsFetchRef.current = true;
    fetchFromNetwork({ attempts: 1, includeDiagnostics: true });
  }, [debugEnabled, fetchFromNetwork]);

  const retry = () => {
    fetchedRef.current = false;
    setIsError(false);
    setErrorKind(null);
    setIsLoading(true);
    fetchFromNetwork({ attempts: NO_CACHE_NETWORK_ATTEMPTS, forceLoading: true, includeDiagnostics: debugEnabled });
    fetchedRef.current = true;
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
