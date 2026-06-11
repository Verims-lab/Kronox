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
import { saveQuestionsToCache, loadQuestionsFromCache } from '@/lib/questionCache';
import { normalizeQuestionsForRuntime } from '@/lib/questionRuntimeAdapter';

const QUESTION_FETCH_RETRY_MS = 850;
const NO_CACHE_NETWORK_ATTEMPTS = 3;

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
};

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

export function useOfflineQuestions() {
  const [questions, setQuestions] = useState(() => {
    // Sync init: cache varsa anında ver — loading göstermeden
    const cached = readUsableCachedQuestions();
    return normalizeQuestionsForRuntime(cached?.questions || []);
  });
  const [isLoading, setIsLoading] = useState(() => {
    const cached = readUsableCachedQuestions();
    return !cached; // cache varsa loading false başlar
  });
  const [isError, setIsError] = useState(false);
  const [errorKind, setErrorKind] = useState(null);
  const [isFromCache, setIsFromCache] = useState(() => {
    const cached = readUsableCachedQuestions();
    return !!cached;
  });
  const [activeCategoryIds, setActiveCategoryIds] = useState(() => {
    const cached = readUsableCachedQuestions();
    const fromCache = cached?.activeCategoryIds || [];
    return fromCache.length ? fromCache : deriveActiveCategoryIds(cached?.questions || []);
  });
  const fetchedRef = useRef(false);
  const requestIdRef = useRef(0);

  const fetchFromNetwork = useCallback(async ({ attempts = 1, forceLoading = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (forceLoading) setIsLoading(true);
    setIsError(false);
    setErrorKind(null);

    let fetched = [];
    let fetchedActiveCategoryIds = [];
    let lastError = null;
    let networkReturned = false;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        // Guest/no-auth Solo play is supported through the public-safe
        // minimal projection. Direct Question.list fallback remains removed
        // so guests never receive the raw question bank.
        const res = await base44.functions.invoke('getQuestions', {});
        networkReturned = true;
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
      fetchFromNetwork({ attempts: 1 }); // fire-and-forget
    } else {
      // Cache yok veya bayat → önce göster (varsa), sonra fetch et
      fetchFromNetwork({
        attempts: cached ? 1 : NO_CACHE_NETWORK_ATTEMPTS,
        forceLoading: !cached,
      });
    }
  }, [fetchFromNetwork]);

  const retry = () => {
    fetchedRef.current = false;
    setIsError(false);
    setErrorKind(null);
    setIsLoading(true);
    fetchFromNetwork({ attempts: NO_CACHE_NETWORK_ATTEMPTS, forceLoading: true });
    fetchedRef.current = true;
  };

  return {
    questions,
    isLoading,
    isError,
    errorKind,
    isFromCache,
    activeCategoryIds,
    retry,
  };
}
