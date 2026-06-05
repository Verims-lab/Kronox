/**
 * useOfflineQuestions — Offline-first soru yükleme hook'u.
 *
 * Strateji (Android "offline-first" önerisi):
 * 1. localStorage cache'i anında yükle → UI hemen kullanılabilir
 * 2. Arka planda API'den taze veri çek (stale-while-revalidate)
 * 3. API başarılı → cache güncelle
 * 4. API başarısız + cache var → cache'le devam et (offline oynanabilir)
 * 5. API başarısız + cache yok → hata göster
 */
import { useCallback, useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { saveQuestionsToCache, loadQuestionsFromCache } from '@/lib/questionCache';
import { normalizeQuestionsForRuntime } from '@/lib/questionRuntimeAdapter';

const AUTH_SETTLE_RETRY_MS = 650;
const QUESTION_FETCH_RETRY_MS = 850;
const NO_CACHE_NETWORK_ATTEMPTS = 2;

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

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

  const waitForAuthSession = useCallback(async () => {
    const first = await base44.auth.me().catch(() => null);
    if (first?.email) return first;
    await wait(AUTH_SETTLE_RETRY_MS);
    return base44.auth.me().catch(() => null);
  }, []);

  const fetchFromNetwork = useCallback(async ({ attempts = 1, forceLoading = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (forceLoading) setIsLoading(true);
    setIsError(false);

    let fetched = [];
    let fetchedActiveCategoryIds = [];
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        // getQuestions is auth-protected. On a cold app/WebView open, auth
        // can settle a beat after the game route mounts, so wait once before
        // treating a no-cache fetch as final failure.
        await waitForAuthSession();

        // Authenticated backend function only. Direct Question.list fallback
        // was removed so normal users cannot fetch the raw question bank.
        const res = await base44.functions.invoke('getQuestions', {});
        if (res.data?.questions?.length > 0) {
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
    } else if (lastError || fetched.length === 0) {
      setIsError(true);
    }
    setIsLoading(false);
  }, [waitForAuthSession]);

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
    setIsLoading(true);
    fetchFromNetwork({ attempts: NO_CACHE_NETWORK_ATTEMPTS, forceLoading: true });
    fetchedRef.current = true;
  };

  return { questions, isLoading, isError, isFromCache, activeCategoryIds, retry };
}
