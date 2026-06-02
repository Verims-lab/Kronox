export function getTimelineYearFromAnswer(answer) {
  if (Number.isFinite(answer)) return Number(answer);
  const text = String(answer ?? '').trim();
  if (!text) return null;
  const match = text.match(/\b\d{3,4}\b/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

export function normalizeQuestionForRuntime(question) {
  if (!question || typeof question !== 'object') return null;
  const year = Number.isFinite(question.year)
    ? Number(question.year)
    : getTimelineYearFromAnswer(question.answer);

  return {
    ...question,
    year,
    category: question.category || 'genel',
    type: question.type || 'metin',
    media_url: question.media_url || '',
  };
}

export function normalizeQuestionsForRuntime(questions = []) {
  return (Array.isArray(questions) ? questions : [])
    .map(normalizeQuestionForRuntime)
    .filter(Boolean);
}
