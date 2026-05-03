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

export function useOfflineQuestions() {
  const [questions, setQuestions] = useState(() => {
    // Sync init: cache varsa anında ver — loading göstermeden
    const cached = loadQuestionsFromCache();
    return cached?.questions || [];
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
  const fetchedRef = useRef(false);

  const fetchFromNetwork = async () => {
    try {
      let fetched = [];
      try {
        const res = await base44.functions.invoke('getQuestions', {});
        if (res.data?.questions?.length > 0) fetched = res.data.questions;
      } catch (_e) { /* fallthrough to direct entity */ }

      if (fetched.length === 0) {
        const direct = await base44.entities.Question.list('-created_date', 500);
        fetched = direct || [];
      }

      if (fetched.length > 0) {
        saveQuestionsToCache(fetched);
        setQuestions(fetched);
        setIsFromCache(false);
        setIsError(false);
      }
    } catch (err) {
      // Network hatası — cache'deki veri varsa sorun değil
      const cached = loadQuestionsFromCache();
      if (!cached || cached.questions.length === 0) {
        setIsError(true);
      }
      // Cache varsa: sessizce devam et
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

  return { questions, isLoading, isError, isFromCache, retry };
}