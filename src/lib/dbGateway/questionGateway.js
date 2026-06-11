import { base44 } from '@/api/base44Client';
import {
  getTimelineYearFromAnswer,
  normalizeQuestionsForRuntime,
} from '@/lib/questionRuntimeAdapter';

export const QUESTION_GATEWAY_CONTRACT = Object.freeze({
  source: 'public_minimal_getQuestions_function',
  rawQuestionEntityReads: 'admin_only',
  publicFullBankFallback: false,
  minimalPlayableProjection: true,
  guestGameplayAllowed: true,
  guestNoPreferenceUsesAllActiveCategories: true,
});

export function normalizeQuestionGatewayYear(answer) {
  return getTimelineYearFromAnswer(answer);
}

export function normalizePlayableQuestionRows(rows = []) {
  return normalizeQuestionsForRuntime(rows);
}

export async function loadPlayableQuestions({
  mode = 'solo',
  levelNumber = null,
  categoryIds = [],
  limit = undefined,
} = {}) {
  const payload = {
    mode,
    ...(levelNumber ? { levelNumber } : {}),
    ...(Array.isArray(categoryIds) && categoryIds.length ? { categoryIds } : {}),
    ...(Number.isFinite(Number(limit)) ? { limit: Number(limit) } : {}),
  };
  const response = await base44.functions.invoke('getQuestions', payload);
  const rows = response?.data?.questions || response?.questions || response?.data?.rows || [];
  return normalizePlayableQuestionRows(rows);
}

export const questionGatewayTodo = Object.freeze([
  'Move all gameplay question fetches through this gateway after runtime parity proof.',
  'Keep raw Question entity reads admin-only; public SEO must use QuestionPublicProjection.',
]);
