import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getTimelineYearFromAnswer(answer: unknown) {
  if (typeof answer === 'number' && Number.isFinite(answer)) return answer;
  const text = String(answer ?? '').trim();
  if (!text) return null;
  const match = text.match(/\b\d{3,4}\b/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

function normalizeQuestionForRuntime(question: Record<string, unknown>) {
  const legacyYear = Number(question?.year);
  const year = Number.isFinite(legacyYear)
    ? legacyYear
    : getTimelineYearFromAnswer(question?.answer);

  return {
    ...question,
    year,
    category: question?.category || 'genel',
    type: question?.type || 'metin',
    media_url: question?.media_url || '',
  };
}

Deno.serve(async (req) => {
  try {
    // Service role ile soruları çek — auth gerekmez
    const base44 = createClientFromRequest(req);
    const questions = await base44.asServiceRole.entities.Question.list('-created_date', 500);
    return Response.json({ questions: (questions || []).map(normalizeQuestionForRuntime) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
