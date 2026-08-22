import {
  DUELLO_MATCH_STATE,
  DUELLO_MAX_QUESTIONS,
  DUELLO_ROUND_SECONDS,
  DUELLO_RULES_VERSION,
  DUELLO_TARGET_CORRECT,
  isDuelloAnswerableState,
} from '../../base44/shared/duelloV2Rules.js';

export {
  DUELLO_MATCH_STATE,
  DUELLO_MAX_QUESTIONS,
  DUELLO_ROUND_SECONDS,
  DUELLO_RULES_VERSION,
  DUELLO_TARGET_CORRECT,
  isDuelloAnswerableState,
};

const ACTIVE_ROUND_STATES = new Set([
  DUELLO_MATCH_STATE.QUESTION_ACTIVE,
  DUELLO_MATCH_STATE.WAITING_FOR_OPPONENT,
  DUELLO_MATCH_STATE.SUDDEN_DEATH,
]);

function parseTime(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function readDuelloCorrectCount(player) {
  return Math.max(0, Math.trunc(Number(player?.correct_count ?? player?.claimed_count) || 0));
}

export function readDuelloServerOffset(snapshot, localNow = Date.now()) {
  const serverNow = parseTime(snapshot?.server_now);
  return serverNow === null ? 0 : serverNow - Number(localNow || Date.now());
}

export function deriveDuelloClock(snapshot, localNow = Date.now(), serverOffsetMs = 0) {
  const serverNow = Number(localNow || Date.now()) + Number(serverOffsetMs || 0);
  const state = String(snapshot?.duel_match_state || '');
  const countdownEnd = parseTime(snapshot?.duel_countdown_ends_at || snapshot?.duel_question_started_at);
  const deadline = parseTime(snapshot?.duel_question_deadline);
  const countdownRemainingMs = state === DUELLO_MATCH_STATE.COUNTDOWN && countdownEnd !== null
    ? Math.max(0, countdownEnd - serverNow)
    : 0;
  const remainingMs = ACTIVE_ROUND_STATES.has(state) && deadline !== null
    ? Math.max(0, deadline - serverNow)
    : 0;
  const roundDurationMs = Math.max(1, Number(snapshot?.duel_round_seconds || DUELLO_ROUND_SECONDS) * 1000);
  return {
    serverNow,
    countdownRemainingMs,
    countdownValue: countdownRemainingMs > 0 ? Math.max(1, Math.ceil(countdownRemainingMs / 1000)) : 0,
    remainingMs,
    remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
    timePercent: Math.max(0, Math.min(100, (remainingMs / roundDurationMs) * 100)),
    deadlineReached: ACTIVE_ROUND_STATES.has(state) && deadline !== null && serverNow >= deadline,
  };
}

export function duelloSnapshotNeedsSync(snapshot, localNow = Date.now(), serverOffsetMs = 0) {
  if (!snapshot || snapshot?.status === 'finished') return false;
  const serverNow = Number(localNow || Date.now()) + Number(serverOffsetMs || 0);
  const state = String(snapshot?.duel_match_state || '');
  if (state === DUELLO_MATCH_STATE.COUNTDOWN) {
    const start = parseTime(snapshot?.duel_question_started_at);
    return start !== null && serverNow >= start;
  }
  if (ACTIVE_ROUND_STATES.has(state)) {
    const deadline = parseTime(snapshot?.duel_question_deadline);
    return deadline !== null && serverNow >= deadline;
  }
  if (state === DUELLO_MATCH_STATE.ROUND_RESULT) {
    const resolveAfter = parseTime(snapshot?.duel_round_resolve_after);
    return resolveAfter !== null && serverNow >= resolveAfter;
  }
  return false;
}

function compactHash(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function duelloQuestionFingerprint(snapshot) {
  const card = snapshot?.active_shared_card || snapshot?.online_question_deck?.[0] || null;
  return compactHash([
    snapshot?.match_id || snapshot?.id || '',
    snapshot?.duel_question_index || card?.sequence_id || '',
    card?.id || '',
    card?.question || '',
    card?.type || '',
    card?.media_url || '',
  ].join('|'));
}

export function duelloTimelineFingerprint(snapshot) {
  const cards = Array.isArray(snapshot?.duel_shared_timeline) ? snapshot.duel_shared_timeline : [];
  return compactHash(cards.map((card) => `${card?.id || ''}:${Number(card?.year)}`).join('|'));
}

export function duelloRoundFeedbackForActor(snapshot, participantRef) {
  const result = snapshot?.duel_round_result;
  if (!result || !participantRef) return null;
  const answer = (Array.isArray(result?.answers) ? result.answers : [])
    .find((candidate) => String(candidate?.participant_ref || '') === String(participantRef));
  if (!answer) return null;
  return {
    result: answer.correct ? 'correct' : 'wrong',
    answered: Boolean(answer.answered),
    unanswered: Boolean(answer.unanswered),
    year: Number.isFinite(Number(result?.correct_year)) ? Number(result.correct_year) : null,
    key: `${result?.question_index || 0}:${participantRef}:${answer.correct ? 'correct' : 'wrong'}`,
  };
}

export const duelloV2ClientContract = Object.freeze({
  rulesVersion: DUELLO_RULES_VERSION,
  sameQuestion: true,
  sameSharedTimeline: true,
  serverDeadlineSeconds: DUELLO_ROUND_SECONDS,
  targetCorrect: DUELLO_TARGET_CORRECT,
  maxQuestions: DUELLO_MAX_QUESTIONS,
  answerLocksImmediately: true,
  speedBonus: false,
  jokerHintEnabled: false,
});
