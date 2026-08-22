export const DUELLO_RULES_VERSION = 'duello_shared_timeline_v2';
export const DUELLO_TARGET_CORRECT = 5;
export const DUELLO_MAX_QUESTIONS = 12;
export const DUELLO_ROUND_SECONDS = 10;
export const DUELLO_COUNTDOWN_SECONDS = 3;
export const DUELLO_RESULT_VISIBLE_MS = 800;

export const DUELLO_MATCH_STATE = Object.freeze({
  MATCHING: 'MATCHING',
  COUNTDOWN: 'COUNTDOWN',
  QUESTION_ACTIVE: 'QUESTION_ACTIVE',
  WAITING_FOR_OPPONENT: 'WAITING_FOR_OPPONENT',
  ROUND_RESULT: 'ROUND_RESULT',
  SUDDEN_DEATH: 'SUDDEN_DEATH',
  MATCH_FINISHED: 'MATCH_FINISHED',
});

const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const wholeNumber = (value, fallback = 0) => Math.max(0, Math.trunc(finiteNumber(value, fallback)));

export function isDuelloPlacementCorrect(cards = [], questionYear, zone) {
  const years = (Array.isArray(cards) ? cards : [])
    .map((card) => Number(card?.year))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const selectedZone = Number(zone);
  const year = Number(questionYear);
  if (!Number.isInteger(selectedZone) || selectedZone < 0 || selectedZone > years.length || !Number.isFinite(year)) {
    return false;
  }
  const lower = selectedZone === 0 ? -Infinity : years[selectedZone - 1];
  const upper = selectedZone === years.length ? Infinity : years[selectedZone];
  return year >= lower && year <= upper;
}

export function appendDuelloTimelineCard(cards = [], question = {}) {
  const year = Number(question?.year);
  if (!Number.isFinite(year)) return [...(Array.isArray(cards) ? cards : [])];
  return [
    ...(Array.isArray(cards) ? cards : []),
    {
      id: String(question?.id || ''),
      year,
      question: String(question?.question || ''),
      type: question?.type || 'metin',
      media_url: String(question?.media_url || ''),
    },
  ].sort((left, right) => Number(left?.year) - Number(right?.year));
}

export function isDuelloAnswerLate(questionDeadline, serverNowMs = Date.now()) {
  const deadlineMs = Date.parse(String(questionDeadline || ''));
  return !Number.isFinite(deadlineMs) || finiteNumber(serverNowMs, Date.now()) >= deadlineMs;
}

export function isDuelloAnswerableState(matchState) {
  return [
    DUELLO_MATCH_STATE.QUESTION_ACTIVE,
    DUELLO_MATCH_STATE.WAITING_FOR_OPPONENT,
    DUELLO_MATCH_STATE.SUDDEN_DEATH,
  ].includes(String(matchState || ''));
}

export function duelloRoundShouldResolve({ answers = [], playerCount = 2, questionDeadline = null, serverNowMs = Date.now() } = {}) {
  return (Array.isArray(answers) ? answers.length : 0) >= Math.max(1, wholeNumber(playerCount, 2))
    || isDuelloAnswerLate(questionDeadline, serverNowMs);
}

export function buildDuelloRoundTiming(serverNowMs = Date.now(), { countdown = false } = {}) {
  const nowMs = finiteNumber(serverNowMs, Date.now());
  const countdownMs = countdown ? DUELLO_COUNTDOWN_SECONDS * 1000 : 0;
  const questionStartedAtMs = nowMs + countdownMs;
  return {
    countdownEndsAt: countdown ? new Date(questionStartedAtMs).toISOString() : null,
    questionStartedAt: new Date(questionStartedAtMs).toISOString(),
    questionDeadline: new Date(questionStartedAtMs + DUELLO_ROUND_SECONDS * 1000).toISOString(),
  };
}

function publicRoundAnswer(player, answer) {
  return {
    participant_ref: String(player?.participant_ref || ''),
    answered: Boolean(answer),
    correct: Boolean(answer?.correct),
    unanswered: !answer,
    response_ms: answer ? wholeNumber(answer?.response_ms) : null,
  };
}

export function resolveDuelloRound({
  players = [],
  answers = [],
  questionIndex = 1,
  suddenDeath = false,
} = {}) {
  const safePlayers = (Array.isArray(players) ? players : []).slice(0, 2);
  if (safePlayers.length !== 2) throw new Error('duello_requires_two_players');
  const answerRows = Array.isArray(answers) ? answers : [];
  const resolvedAnswers = safePlayers.map((player) => {
    const answer = answerRows.find((candidate) => (
      String(candidate?.participant_ref || '') === String(player?.participant_ref || '')
    ));
    return publicRoundAnswer(player, answer);
  });
  const nextPlayers = safePlayers.map((player, index) => {
    const answer = resolvedAnswers[index];
    const correctCount = wholeNumber(player?.correct_count ?? player?.claimed_count) + (answer.correct ? 1 : 0);
    const responseTotal = wholeNumber(player?.total_correct_response_time_ms) + (answer.correct ? wholeNumber(answer.response_ms) : 0);
    return {
      ...player,
      correct_count: correctCount,
      claimed_count: correctCount,
      total_correct_response_time_ms: responseTotal,
    };
  });
  const counts = nextPlayers.map((player) => wholeNumber(player.correct_count));
  const roundCorrect = resolvedAnswers.map((answer) => answer.correct);
  const atQuestionLimit = wholeNumber(questionIndex, 1) >= DUELLO_MAX_QUESTIONS;
  let winnerIndex = -1;
  let pointsAwarded = 0;
  let resultReason = '';
  let nextSuddenDeath = Boolean(suddenDeath);

  if (suddenDeath) {
    if (roundCorrect[0] !== roundCorrect[1]) {
      winnerIndex = roundCorrect[0] ? 0 : 1;
      pointsAwarded = 50;
      resultReason = 'sudden_death';
    } else if (atQuestionLimit) {
      if (counts[0] !== counts[1]) {
        winnerIndex = counts[0] > counts[1] ? 0 : 1;
        pointsAwarded = 50;
        resultReason = 'sudden_death';
      } else {
        resultReason = 'draw';
      }
    }
  } else {
    const reachedTarget = counts.map((count) => count >= DUELLO_TARGET_CORRECT);
    if (reachedTarget[0] && reachedTarget[1]) {
      if (counts[0] !== counts[1]) {
        winnerIndex = counts[0] > counts[1] ? 0 : 1;
        pointsAwarded = 50;
        resultReason = 'target';
      } else if (atQuestionLimit) {
        resultReason = 'draw';
      } else {
        nextSuddenDeath = true;
      }
    } else if (reachedTarget[0] || reachedTarget[1]) {
      winnerIndex = reachedTarget[0] ? 0 : 1;
      pointsAwarded = 50;
      resultReason = 'target';
    } else if (atQuestionLimit) {
      if (counts[0] !== counts[1]) {
        winnerIndex = counts[0] > counts[1] ? 0 : 1;
        pointsAwarded = 25;
        resultReason = 'max_questions';
      } else {
        resultReason = 'draw';
      }
    }
  }

  const finished = winnerIndex >= 0 || resultReason === 'draw';
  return {
    players: nextPlayers,
    answers: resolvedAnswers,
    finished,
    resultType: resultReason === 'draw' ? 'draw' : (winnerIndex >= 0 ? 'win' : null),
    resultReason: resultReason || null,
    winnerParticipantRef: winnerIndex >= 0 ? String(nextPlayers[winnerIndex]?.participant_ref || '') : null,
    winnerIndex,
    pointsAwarded,
    suddenDeath: nextSuddenDeath,
    nextMatchState: finished ? DUELLO_MATCH_STATE.MATCH_FINISHED : DUELLO_MATCH_STATE.ROUND_RESULT,
    questionIndex: wholeNumber(questionIndex, 1),
  };
}

export const duelloV2Contract = Object.freeze({
  rulesVersion: DUELLO_RULES_VERSION,
  simultaneous: true,
  sharedTimeline: true,
  serverDeadlineSeconds: DUELLO_ROUND_SECONDS,
  targetCorrect: DUELLO_TARGET_CORRECT,
  maxQuestions: DUELLO_MAX_QUESTIONS,
  targetOrSuddenDeathPoints: 50,
  maxQuestionWinnerPoints: 25,
  drawPoints: 0,
  speedBonus: false,
  jokerHintEnabled: false,
});
