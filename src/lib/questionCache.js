/**
 * questionCache — localStorage tabanlı soru önbelleği.
 * Offline-first: Ağ yokken son başarılı fetch'ten gelen sorularla oyun başlatılabilir.
 * TTL: 24 saat (sorular sık değişmez)
 */

const CACHE_KEY = 'kronox_questions_v1';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 saat

export function saveQuestionsToCache(questions) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      questions,
      savedAt: Date.now(),
    }));
  } catch (e) {
    // localStorage dolu olabilir (QuotaExceededError) — sessizce geç
    console.warn('[questionCache] save failed:', e.message);
  }
}

export function loadQuestionsFromCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { questions, savedAt } = JSON.parse(raw);
    if (!questions || !Array.isArray(questions) || questions.length === 0) return null;
    return { questions, savedAt, isStale: Date.now() - savedAt > TTL_MS };
  } catch (e) {
    return null;
  }
}

export function clearQuestionsCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch (_) {}
}

export function getCacheInfo() {
  const cached = loadQuestionsFromCache();
  if (!cached) return null;
  const ageMinutes = Math.floor((Date.now() - cached.savedAt) / 60000);
  return {
    count: cached.questions.length,
    ageMinutes,
    isStale: cached.isStale,
  };
}