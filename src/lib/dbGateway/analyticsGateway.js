import { base44 } from '@/api/base44Client';
import { KRONOX_BUILD_MARKER } from '@/components/dev/BuildMarker';
import { getLeaderboardOwnerKey, normalizeLeaderboardEmail } from '@/lib/leaderboard';

export function buildQuestionAttemptEventId({
  attemptId = '',
  questionId = '',
  placementIndex = '',
  mode = '',
} = {}) {
  return ['question_attempt', mode, attemptId, questionId, placementIndex]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(':');
}

export function normalizeQuestionAttemptEvent(payload = {}, user = null) {
  const userEmail = normalizeLeaderboardEmail(payload.user_email || user?.email || user?.user_email);
  const questionId = String(payload.question_id ?? payload.questionId ?? '').trim();
  const nowIso = new Date().toISOString();
  const event = {
    ...payload,
    event_id: payload.event_id || buildQuestionAttemptEventId({
      attemptId: payload.attempt_id,
      questionId,
      placementIndex: payload.placement_index,
      mode: payload.mode,
    }),
    user_email: userEmail,
    user_key: payload.user_key || getLeaderboardOwnerKey(userEmail),
    question_id: questionId,
    mode: payload.mode === 'online' ? 'online' : 'solo',
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

export const analyticsGatewayContract = Object.freeze({
  eventEntity: 'QuestionAttemptEvent',
  failureBlocksGameplay: false,
  currentRuntimeWiring: 'scaffolded_only',
  aggregateJob: 'aggregateQuestionStats',
});
