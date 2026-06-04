import { base44 } from '@/api/base44Client';
import { KRONOX_BUILD_MARKER } from '@/components/dev/BuildMarker';
import { getLeaderboardOwnerKey, normalizeLeaderboardEmail } from '@/lib/leaderboard';
import {
  QUESTION_ANALYTICS_EVENT_TYPES,
  QUESTION_ANALYTICS_SOURCES,
} from '@/lib/questionAnalyticsContracts';

export function buildQuestionAttemptEventId({
  attemptId = '',
  questionId = '',
  eventType = '',
  placementIndex = '',
  mode = '',
} = {}) {
  return ['question_attempt', mode, attemptId, questionId, eventType, placementIndex]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(':');
}

function normalizeAnalyticsEventType(value) {
  const eventType = String(value || '').trim();
  return Object.values(QUESTION_ANALYTICS_EVENT_TYPES).includes(eventType)
    ? eventType
    : QUESTION_ANALYTICS_EVENT_TYPES.SHOWN;
}

function normalizeQuestionAnalyticsTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag || '').trim()).filter(Boolean).join(',');
  }
  return String(value || '').trim();
}

export function getQuestionAnalyticsMetadata(question = {}) {
  const categoryId = Number(question?.main_category_id ?? question?.category_id);
  const answerYear = Number(question?.year ?? question?.answer_year ?? question?.answer);
  return {
    question_id: String(question?.id ?? question?.question_id ?? '').trim(),
    category_id: Number.isFinite(categoryId) ? categoryId : undefined,
    sub_category: String(question?.sub_category ?? question?.subcategory ?? '').trim(),
    tags: normalizeQuestionAnalyticsTags(question?.tag ?? question?.tags),
    answer_year: Number.isFinite(answerYear) ? answerYear : undefined,
  };
}

export function normalizeQuestionAttemptEvent(payload = {}, user = null) {
  const userEmail = normalizeLeaderboardEmail(payload.user_email || user?.email || user?.user_email);
  const questionId = String(payload.question_id ?? payload.questionId ?? '').trim();
  const eventType = normalizeAnalyticsEventType(payload.event_type ?? payload.eventType);
  const nowIso = new Date().toISOString();
  const event = {
    ...payload,
    event_type: eventType,
    event_id: payload.event_id || buildQuestionAttemptEventId({
      attemptId: payload.attempt_id,
      questionId,
      eventType,
      placementIndex: payload.placement_index,
      mode: payload.mode,
    }),
    user_email: userEmail,
    user_key: payload.user_key || getLeaderboardOwnerKey(userEmail),
    question_id: questionId,
    mode: payload.mode === 'online' ? 'online' : 'solo',
    tags: normalizeQuestionAnalyticsTags(payload.tags ?? payload.tag),
    source: payload.source || QUESTION_ANALYTICS_SOURCES.DECK,
    build_marker: payload.build_marker || KRONOX_BUILD_MARKER,
    created_at: payload.created_at || nowIso,
  };
  return event;
}

export async function recordQuestionAttemptEvent(payload = {}, { user = null } = {}) {
  const row = normalizeQuestionAttemptEvent(payload, user);
  if (!row.question_id || !row.mode) {
    return { ok: false, skipped: 'missing_question_or_mode' };
  }
  if (!row.user_email) {
    return { ok: false, skipped: 'missing_authenticated_user' };
  }
  try {
    const created = await base44.entities.QuestionAttemptEvent.create(row);
    return { ok: true, row: created };
  } catch (error) {
    return {
      ok: false,
      skipped: 'analytics_write_failed',
      error: error?.message || String(error),
    };
  }
}

export function recordSoloQuestionAnalyticsEvent(payload = {}, options = {}) {
  return recordQuestionAttemptEvent({
    ...payload,
    mode: 'solo',
  }, options);
}

export const analyticsGatewayContract = Object.freeze({
  eventEntity: 'QuestionAttemptEvent',
  eventTypes: QUESTION_ANALYTICS_EVENT_TYPES,
  failureBlocksGameplay: false,
  currentRuntimeWiring: 'solo_shown_answered_swap_events_best_effort',
  aggregateJob: 'aggregateQuestionStats',
  manualReportFunction: 'sendQuestionAnalyticsReportEmail',
  projectionRuntimeUpdate: 'deferred_to_admin_aggregateQuestionStats',
});
