function parseExplicitYear(value) {
  if (typeof value === 'number') return Number.isFinite(value) && Number.isInteger(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || !/^-?\d{1,4}$/.test(text)) return null;
  const year = Number(text);
  return Number.isFinite(year) ? year : null;
}

export function getTimelineYearFromAnswer(answer) {
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

export function normalizeQuestionForRuntime(question) {
  if (!question || typeof question !== 'object') return null;
  const explicitYear = parseExplicitYear(question.year);
  const year = explicitYear !== null
    ? explicitYear
    : getTimelineYearFromAnswer(question.answer);

  return {
    ...question,
    year,
    state: question.state || 'A',
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
