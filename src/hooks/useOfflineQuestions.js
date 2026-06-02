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
import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { saveQuestionsToCache, loadQuestionsFromCache } from '@/lib/questionCache';
import { normalizeQuestionsForRuntime } from '@/lib/questionRuntimeAdapter';

function deriveActiveCategoryIds(questions = []) {
  return Array.from(new Set(
    (questions || [])
      .map((question) => Number(question?.main_category_id))
      .filter((id) => Number.isFinite(id) && id > 0),
  ));
}

export function useOfflineQuestions() {
  const [questions, setQuestions] = useState(() => {
    // Sync init: cache varsa anında ver — loading göstermeden
    const cached = loadQuestionsFromCache();
    return normalizeQuestionsForRuntime(cached?.questions || []);
  });
  const [isLoading, setIsLoading] = useState(() => {
    const cached = loadQuestionsFromCache();
    return !cached; // cache varsa loading false başlar
  });
  const [isError, setIsError] = useState(false);
  const [isFromCache, setIsFromCache] = useState(() => {
    const cached = loadQuestionsFromCache();
    return !!cached;
  });
  const [activeCategoryIds, setActiveCategoryIds] = useState(() => {
    const cached = loadQuestionsFromCache();
    const fromCache = cached?.activeCategoryIds || [];
    return fromCache.length ? fromCache : deriveActiveCategoryIds(cached?.questions || []);
  });
  const fetchedRef = useRef(false);

  const fetchFromNetwork = async () => {
    try {
      let fetched = [];
      let fetchedActiveCategoryIds = [];

      // Authenticated backend function only. Direct Question.list fallback
      // was removed so normal users cannot fetch the raw question bank.
      const res = await base44.functions.invoke('getQuestions', {});
      if (res.data?.questions?.length > 0) {
        fetched = res.data.questions;
        fetchedActiveCategoryIds = Array.isArray(res.data.activeCategoryIds) ? res.data.activeCategoryIds : [];
      }

      if (fetched.length > 0) {
        const runtimeQuestions = normalizeQuestionsForRuntime(fetched);
        const activeIds = fetchedActiveCategoryIds.length
          ? fetchedActiveCategoryIds
          : deriveActiveCategoryIds(runtimeQuestions);
        saveQuestionsToCache(runtimeQuestions, { activeCategoryIds: activeIds });
        setQuestions(runtimeQuestions);
        setActiveCategoryIds(activeIds);
        setIsFromCache(false);
        setIsError(false);
      }
    } catch (err) {
      // Network hatası — cache varsa sorun değil, yoksa hata göster
      const cached = loadQuestionsFromCache();
      if (!cached || cached.questions.length === 0) {
        setIsError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const cached = loadQuestionsFromCache();

    if (cached && !cached.isStale) {
      // Cache taze (< 24 saat) → arka planda yenile, ama UI'ı bloklamaz
      setIsLoading(false);
      fetchFromNetwork(); // fire-and-forget
    } else {
      // Cache yok veya bayat → önce göster (varsa), sonra fetch et
      fetchFromNetwork();
    }
  }, []);

  const retry = () => {
    fetchedRef.current = false;
    setIsError(false);
    setIsLoading(true);
    fetchFromNetwork();
    fetchedRef.current = true;
  };

  return { questions, isLoading, isError, isFromCache, activeCategoryIds, retry };
}
