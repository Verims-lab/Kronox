import onlineScreen from '@/components/lobby/OnlineChallengeScreen.jsx?raw';
import directMatchScreen from '@/components/online/DirectOnlineMatchScreen.jsx?raw';
import bottomNav from '@/components/layout/BottomNav.jsx?raw';
import duelPage from '@/pages/SameQuestionDuelPage.jsx?raw';
import duelHook from '@/hooks/useSameQuestionDuel.js?raw';
import duelArena from '@/components/duel/DuelArena.jsx?raw';
import duelResult from '@/components/duel/DuelResult.jsx?raw';
import questionCard from '@/components/game/QuestionCard.jsx?raw';
import timeline from '@/components/game/Timeline.jsx?raw';
import waitingRoom from '@/components/lobby/WaitingRoomPanel.jsx?raw';
import randomHook from '@/hooks/useRandomMatchmaking.js?raw';
import randomBackend from '../../../base44/functions/randomMatchmaking/entry.ts?raw';
import randomPolicy from '../../../base44/shared/randomMatchmakingPolicy.js?raw';
import startBackend from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import updateBackend from '../../../base44/functions/updateLobbyGameState/entry.ts?raw';
import findBackend from '../../../base44/functions/findLobbyByCode/entry.ts?raw';
import lobbyGateway from '@/lib/dbGateway/lobbyGateway.js?raw';
import applyOnlineResult from '@/lib/applyOnlineResult.js?raw';
import adaptivePoller from '@/lib/adaptivePoller.js?raw';
import modeDisplay from '@/lib/onlineModeDisplay.js?raw';
import clientStateSource from '@/lib/duelloV2State.js?raw';
import rulesSource from '../../../base44/shared/duelloV2Rules.js?raw';
import {
  DUELLO_MATCH_STATE,
  DUELLO_MAX_QUESTIONS,
  DUELLO_RESULT_VISIBLE_MS,
  DUELLO_ROUND_SECONDS,
  DUELLO_TARGET_CORRECT,
  appendDuelloTimelineCard,
  buildDuelloRoundTiming,
  duelloRoundShouldResolve,
  duelloV2Contract,
  isDuelloAnswerLate,
  isDuelloAnswerableState,
  resolveDuelloRound,
} from '../../../base44/shared/duelloV2Rules.js';
import {
  deriveDuelloClock,
} from '@/lib/duelloV2State';
import { PRODUCT_WORKFLOW_DOC, SECURITY_DEPLOYMENT_DOC } from '@/lib/healthAlignmentDocMirrors';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '@/lib/dbArchitectureMirrors';

const SUITE = 'duello';
const PUBLIC_SNAPSHOT_BACKENDS = [startBackend, updateBackend, findBackend];
const required = (source, tokens) => tokens.filter((token) => !String(source || '').includes(token));
const forbidden = (source, tokens) => tokens.filter((token) => String(source || '').includes(token));
const requiredInEach = (sources, tokens) => sources.flatMap((source, sourceIndex) => (
  required(source, tokens).map((token) => `source_${sourceIndex + 1}:${token}`)
));
const sourceResult = (missing, reason, extra = {}) => missing.length
  ? { status: 'FAIL', reason, verification: 'EXECUTABLE_SOURCE_CONNECTED', classification: 'REAL_PRODUCT_RISK', missing, ...extra }
  : { status: 'PASS', reason, verification: 'EXECUTABLE_SOURCE_CONNECTED', classification: 'SOURCE_CONNECTED', ...extra };
const pass = (reason, extra = {}) => ({
  status: 'PASS',
  reason,
  verification: 'EXECUTABLE_SOURCE_CONNECTED',
  classification: 'SOURCE_CONNECTED',
  ...extra,
});
const fail = (reason, extra = {}) => ({
  status: 'FAIL',
  reason,
  verification: 'EXECUTABLE_SOURCE_CONNECTED',
  classification: 'REAL_PRODUCT_RISK',
  ...extra,
});
const make = (id, name, run, files) => ({
  key: `${SUITE}.${id}`,
  suiteId: SUITE,
  suiteName: 'Duello Health Suite',
  id,
  name,
  critical: true,
  actionType: 'CODE_FIX',
  relatedFiles: files,
  run,
});
const players = (left = 0, right = 0) => [
  { participant_ref: 'player-a', correct_count: left, total_correct_response_time_ms: 0 },
  { participant_ref: 'player-b', correct_count: right, total_correct_response_time_ms: 0 },
];
const answers = (left, right, leftMs = 1200, rightMs = 2200) => [
  { participant_ref: 'player-a', correct: left, response_ms: leftMs },
  { participant_ref: 'player-b', correct: right, response_ms: rightMs },
];

export const EXTRA_SUITES = [{ id: SUITE, name: 'Duello Health Suite', critical: true, color: '#22d3ee' }];
export const EXTRA_TESTS = [
  make('entry_button_exists', 'Online main exposes Duello outside BottomNav', () => sourceResult([
    ...required(modeDisplay + onlineScreen, [
      "DUELLO_DISPLAY_NAME = 'Duello'",
      'testId="duello-entry"',
      'onClick={handleStartDuel}',
    ]),
    ...forbidden(bottomNav, ['Duello']),
  ], 'Duello entry remains on the Online screen and outside BottomNav.'), ['onlineModeDisplay.js', 'OnlineChallengeScreen.jsx', 'BottomNav.jsx']),

  make('mode_key_stable', 'Duello display name and internal mode key remain stable', () => sourceResult([
    ...required(modeDisplay + randomBackend, [
      "SAME_QUESTION_DUEL_MODE = 'same_question_duel'",
      "DUELLO_DISPLAY_NAME = 'Duello'",
    ]),
    ...forbidden(
      onlineScreen + waitingRoom + duelPage + duelArena + duelResult,
      ['Aynı Soru ile Kapış', 'Same Question Duel', 'Düello'],
    ),
  ], 'The display name is Duello while the backend key remains same_question_duel.'), ['onlineModeDisplay.js', 'randomMatchmaking/entry.ts']),

  make('two_player_mode_scoped', 'Duello remains exactly two-player and isolated from Online Kapış', () => sourceResult([
    ...required(randomBackend + startBackend + updateBackend, [
      'max_players: 2',
      'same_question_duel_requires_two_players',
      'players.length !== 2',
    ]),
    ...required(randomPolicy + randomBackend, [
      'normalizeMatchmakingMode(row?.mode) === canonicalMode',
      'random_matchmaking:pair:${mode}',
      'game_mode: mode',
    ]),
  ], 'Queue selection, session creation, and round authority preserve the two-player Duello lane.'), ['randomMatchmakingPolicy.js', 'randomMatchmaking/entry.ts', 'startLobbyGame/entry.ts', 'updateLobbyGameState/entry.ts']),

  make('v2_rules_contract', 'Duello V2 constants protect the simultaneous shared-timeline contract', () => (
    duelloV2Contract.simultaneous
      && duelloV2Contract.sharedTimeline
      && DUELLO_TARGET_CORRECT === 5
      && DUELLO_MAX_QUESTIONS === 12
      && DUELLO_ROUND_SECONDS === 10
      && DUELLO_RESULT_VISIBLE_MS === 800
      && duelloV2Contract.targetOrSuddenDeathPoints === 50
      && duelloV2Contract.maxQuestionWinnerPoints === 25
      && duelloV2Contract.drawPoints === 0
      && duelloV2Contract.speedBonus === false
      ? pass('Executable V2 constants preserve same-time play, target 5, 12 questions, 10 seconds, and +50/+25/0.')
      : fail('Duello V2 constants drifted.', { actual: duelloV2Contract })
  ), ['base44/shared/duelloV2Rules.js']),

  make('same_question_same_deadline', 'Both players receive one shared question index and deadline', () => sourceResult([
    ...required(startBackend, [
      'firstQuestion',
      'current_question_id: initialState.firstQuestion.id',
      'duel_sequence: initialState.duelSequence',
      'duel_question_deadline: duelTiming.questionDeadline',
    ]),
    ...requiredInEach(PUBLIC_SNAPSHOT_BACKENDS, [
      'active_shared_card: publicActiveQuestion',
      'duel_question_index: duelSequence',
      'duel_question_deadline:',
    ]),
  ], 'All public snapshots project one active card, sequence, and authoritative deadline from one Lobby row.'), ['startLobbyGame/entry.ts', 'findLobbyByCode/entry.ts', 'updateLobbyGameState/entry.ts']),

  make('same_starting_timeline', 'Both players begin with one identical authoritative timeline', () => sourceResult(required(startBackend, [
    'const openingCards = sharedDeck.slice(0, 2)',
    'playersWithCards: players.map',
    'cards: openingCards.map((card) => ({ ...card }))',
    'sharedTimeline: openingCards',
    'oneAuthoritativeSharedTimeline: true',
  ]), 'The server creates one pair of anchors and clones that same timeline into both player snapshots.'), ['startLobbyGame/entry.ts']),

  make('timeline_grows_after_every_round', 'Every resolved round inserts the correct card chronologically', () => {
    const next = appendDuelloTimelineCard([
      { id: 'a', year: 1985 },
      { id: 'b', year: 2005 },
    ], { id: 'q', year: 1998, question: 'Shared event' });
    return next.map((card) => card.year).join(',') === '1985,1998,2005'
      ? sourceResult(required(updateBackend, [
        'appendDuelloTimelineCard(lobby?.duel_shared_timeline, currentQuestion)',
        'duel_shared_timeline: sharedTimeline',
        'cards: sharedTimeline.map',
      ]), 'The pure helper sorts 1998 between 1985/2005, and backend resolution applies it to the shared state for both players.')
      : fail('Shared timeline insertion order is incorrect.', { actual: next });
  }, ['base44/shared/duelloV2Rules.js', 'updateLobbyGameState/entry.ts']),

  make('timeline_inserts_regardless_of_answers', 'Correct event insertion is independent of player correctness', () => sourceResult(required(updateBackend, [
    'const resolution = resolveDuelloRound({',
    'const sharedTimeline = appendDuelloTimelineCard(lobby?.duel_shared_timeline, currentQuestion);',
    'duel_shared_timeline: sharedTimeline',
  ]), 'Backend resolution appends the correct event before using the round outcome, including both-wrong or unanswered rounds.'), ['updateLobbyGameState/entry.ts']),

  make('next_round_reuses_identical_timeline', 'Both players start the next round from one grown timeline', () => sourceResult(required(updateBackend + duelHook, [
    'nextPlayers = resolution.players.map',
    'cards: sharedTimeline.map',
    'duel_sequence: sequence + 1',
    'duel_shared_timeline',
    'freshRevision >= currentRevision',
  ]), 'One revision advances the sequence while both clients reconcile the same backend timeline.'), ['updateLobbyGameState/entry.ts', 'useSameQuestionDuel.js']),

  make('server_timer_authority', 'Ten-second timer derives from server/shared timestamps', () => {
    const now = Date.parse('2026-08-22T12:00:00.000Z');
    const timing = buildDuelloRoundTiming(now);
    const snapshot = {
      duel_match_state: DUELLO_MATCH_STATE.QUESTION_ACTIVE,
      duel_question_deadline: timing.questionDeadline,
      duel_round_seconds: DUELLO_ROUND_SECONDS,
    };
    const clock = deriveDuelloClock(snapshot, now, 0);
    return clock.remainingSeconds === 10 && clock.timePercent === 100
      ? sourceResult(required(clientStateSource + duelArena, [
        'snapshot?.server_now',
        'serverOffsetMs',
        'duel_question_deadline',
        'data-testid="duello-time-bar"',
        "transition: 'width 100ms linear'",
      ]), 'Executable timing starts at exactly 10 seconds and the UI derives a smooth bar from backend timestamps.')
      : fail('Duello shared timer did not start at 10 seconds.', { actual: clock });
  }, ['base44/shared/duelloV2Rules.js', 'src/lib/duelloV2State.js', 'DuelArena.jsx']),

  make('answer_lock_and_late_rejection', 'Answers lock once and late submissions cannot count', () => {
    const deadline = '2026-08-22T12:00:10.000Z';
    const boundaryLate = isDuelloAnswerLate(deadline, Date.parse(deadline));
    const opponentCanStillAnswer = isDuelloAnswerableState(DUELLO_MATCH_STATE.WAITING_FOR_OPPONENT);
    return boundaryLate && opponentCanStillAnswer
      ? sourceResult([
        ...required(updateBackend + duelHook, [
        "answer_result: 'already_processed'",
        "answer_result: 'locked'",
        "answer_result: 'late'",
        'answers.some((answer: any)',
        'isDuelloAnswerableState(matchState)',
        'setLocallyLockedSequence(sequence)',
        "setNotice('CEVABIN KİLİTLENDİ')",
        ]),
        ...requiredInEach(PUBLIC_SNAPSHOT_BACKENDS, [
          'isDuelloAnswerableState(duelMatchState)',
          'Date.now() < deadlineMs',
        ]),
      ], 'The client locks A immediately while WAITING_FOR_OPPONENT remains answerable for B; backend receipts are idempotent and reject deadline-boundary answers.')
      : fail('Duello answer lock, opponent answer window, or deadline boundary behavior drifted.', {
        actual: { boundaryLate, opponentCanStillAnswer },
      });
  }, ['base44/shared/duelloV2Rules.js', 'updateLobbyGameState/entry.ts', 'useSameQuestionDuel.js']),

  make('round_resolves_both_or_deadline', 'Round resolves only after both answers or the deadline', () => {
    const deadline = '2026-08-22T12:00:10.000Z';
    const before = Date.parse('2026-08-22T12:00:09.999Z');
    const atDeadline = Date.parse(deadline);
    const oneEarly = duelloRoundShouldResolve({ answers: answers(true, false).slice(0, 1), playerCount: 2, questionDeadline: deadline, serverNowMs: before });
    const bothEarly = duelloRoundShouldResolve({ answers: answers(true, false), playerCount: 2, questionDeadline: deadline, serverNowMs: before });
    const oneExpired = duelloRoundShouldResolve({ answers: answers(true, false).slice(0, 1), playerCount: 2, questionDeadline: deadline, serverNowMs: atDeadline });
    return !oneEarly && bothEarly && oneExpired
      ? pass('Executable policy waits for both players, while the same one-answer state resolves at the server deadline.')
      : fail('Both-answer/deadline resolution policy drifted.', { actual: { oneEarly, bothEarly, oneExpired } });
  }, ['base44/shared/duelloV2Rules.js']),

  make('unanswered_player_no_penalty', 'An unanswered player gets no correct count and no extra penalty', () => {
    const result = resolveDuelloRound({
      players: players(2, 2),
      answers: answers(true, false).slice(0, 1),
      questionIndex: 3,
    });
    return result.players[0].correct_count === 3
      && result.players[1].correct_count === 2
      && result.answers[1].unanswered
      ? pass('The answered player is evaluated normally; the missing player remains unchanged and is marked unanswered.')
      : fail('Unanswered-player behavior drifted.', { actual: result });
  }, ['base44/shared/duelloV2Rules.js']),

  make('simultaneous_feedback_auto_advance', 'Both players receive brief feedback and automatic advance', () => sourceResult([
    ...required(updateBackend + duelHook, [
      'DUELLO_RESULT_VISIBLE_MS',
      'duel_round_resolve_after',
      'duelloRoundFeedbackForActor',
      "setNotice(nextFeedback.unanswered ? 'SÜRE DOLDU'",
    ]),
    ...required(duelArena, ['AnimatePresence', 'feedback']),
    ...forbidden(duelArena + duelHook, ['DEVAM', 'Devam Et', 'Continue']),
  ], 'One ROUND_RESULT snapshot drives both feedback views for about 0.8 seconds, then sync advances automatically.'), ['updateLobbyGameState/entry.ts', 'useSameQuestionDuel.js', 'DuelArena.jsx']),

  make('target_five_after_round', 'First to five wins only after the active round resolves', () => {
    const result = resolveDuelloRound({ players: players(4, 3), answers: answers(true, false), questionIndex: 5 });
    return result.finished && result.winnerParticipantRef === 'player-a' && result.pointsAwarded === 50
      ? sourceResult(required(updateBackend, [
        'const shouldResolve = duelloRoundShouldResolve({',
        '? buildDuelloRoundResolutionUpdate',
        'duel_pending_finish: resolution.finished ?',
      ]), 'Executable resolution awards target victory only from the completed two-player round snapshot.')
      : fail('Target-five resolution drifted.', { actual: result });
  }, ['base44/shared/duelloV2Rules.js', 'updateLobbyGameState/entry.ts']),

  make('simultaneous_five_five_sudden_death', 'Simultaneous 5-5 enters Sudden Death', () => {
    const result = resolveDuelloRound({ players: players(4, 4), answers: answers(true, true), questionIndex: 5 });
    return !result.finished && result.suddenDeath && result.players.every((player) => player.correct_count === 5)
      ? pass('A 4-4 round where both answer correctly becomes 5-5 and continues in ANİ ÖLÜM.')
      : fail('Simultaneous 5-5 did not enter Sudden Death.', { actual: result });
  }, ['base44/shared/duelloV2Rules.js']),

  make('sudden_death_differential_wins', 'Sudden Death ends on a differential round', () => {
    const result = resolveDuelloRound({ players: players(5, 5), answers: answers(true, false), questionIndex: 6, suddenDeath: true });
    return result.finished && result.resultReason === 'sudden_death' && result.winnerParticipantRef === 'player-a' && result.pointsAwarded === 50
      ? pass('The first Sudden Death differential round ends with the correct +50 winner.')
      : fail('Sudden Death differential resolution drifted.', { actual: result });
  }, ['base44/shared/duelloV2Rules.js']),

  make('sudden_death_equal_round_continues', 'Sudden Death continues when both are right or both are wrong', () => {
    const bothRight = resolveDuelloRound({ players: players(5, 5), answers: answers(true, true), questionIndex: 6, suddenDeath: true });
    const bothWrong = resolveDuelloRound({ players: players(5, 5), answers: answers(false, false), questionIndex: 6, suddenDeath: true });
    return !bothRight.finished && bothRight.suddenDeath && !bothWrong.finished && bothWrong.suddenDeath
      ? pass('Equal Sudden Death outcomes preserve the shared match and load another round.')
      : fail('An equal Sudden Death round ended prematurely.', { actual: { bothRight, bothWrong } });
  }, ['base44/shared/duelloV2Rules.js']),

  make('max_twelve_higher_count_plus_25', 'Question 12 non-target higher count wins +25', () => {
    const result = resolveDuelloRound({ players: players(3, 3), answers: answers(true, false), questionIndex: 12 });
    return result.finished && result.resultReason === 'max_questions' && result.winnerParticipantRef === 'player-a' && result.pointsAwarded === 25
      ? pass('At question 12, a 4-3 non-target result ends with +25 for the higher correct count.')
      : fail('Question-12 +25 resolution drifted.', { actual: result });
  }, ['base44/shared/duelloV2Rules.js']),

  make('max_twelve_draw_zero', 'Question 12 equal count is a draw with zero points', () => {
    const result = resolveDuelloRound({ players: players(3, 3), answers: answers(false, false), questionIndex: 12 });
    return result.finished && result.resultType === 'draw' && !result.winnerParticipantRef && result.pointsAwarded === 0
      ? pass('Equal correct counts at question 12 produce a backend draw with zero points.')
      : fail('Question-12 draw behavior drifted.', { actual: result });
  }, ['base44/shared/duelloV2Rules.js']),

  make('no_speed_bonus_or_tiebreak', 'Response time is diagnostic only and never changes points or winner', () => {
    const fastLoser = resolveDuelloRound({ players: players(4, 4), answers: answers(false, true, 1, 9999), questionIndex: 5 });
    return fastLoser.winnerParticipantRef === 'player-b' && fastLoser.pointsAwarded === 50 && duelloV2Contract.speedBonus === false
      ? sourceResult(required(rulesSource + updateBackend, [
        'speedBonus: false',
        'total_correct_response_time_ms',
        'pointsAwarded = 50',
        'pointsAwarded = 25',
      ]), 'A one-millisecond wrong answer cannot beat a slower correct answer; timing remains diagnostic only.')
      : fail('Response speed affected winner or points.', { actual: fastLoser });
  }, ['base44/shared/duelloV2Rules.js', 'updateLobbyGameState/entry.ts']),

  make('backend_authoritative_score_write', 'Only backend result commit applies Duello +50/+25/0', () => sourceResult([
    ...required(updateBackend + duelHook + lobbyGateway, [
      "source: 'same_question_duel_v2'",
      'duel_points_awarded',
      "body?.action === 'commit_result'",
      'commitOnlineMatchResult',
      'applyOnlineMatchToCurrentUser',
    ]),
    ...forbidden(duelHook + duelPage + duelArena + duelResult, [
      'OnlineMatchResult.create',
      'User.update',
      'GuestProfile.update',
      'LeaderboardEntry.create',
      'kronox_puan_total:',
    ]),
  ], 'The client requests one idempotent backend result commit and never writes final score entities directly.'), ['updateLobbyGameState/entry.ts', 'useSameQuestionDuel.js', 'lobbyGateway.js']),

  make('standard_online_scoring_isolated', 'Online Kapış scoring remains +15/-6 and separate from Duello', () => sourceResult(required(updateBackend + applyOnlineResult, [
    'const ONLINE_WIN_POINTS = 15',
    'const ONLINE_LOSS_POINTS = -6',
    "scoreRule: 'winner_15_loser_minus_6'",
    "duelloScoreRule: 'backend_50_25_0_no_speed_bonus'",
  ]), 'Standard Online retains +15/-6 while Duello uses its own backend-owned points field.'), ['updateLobbyGameState/entry.ts', 'applyOnlineResult.js']),

  make('solo_components_reused', 'Duello reuses Solo QuestionCard and Timeline without Joker/Hint gaps', () => sourceResult([
    ...required(duelArena, [
      "import QuestionCard from '@/components/game/QuestionCard'",
      "import Timeline from '@/components/game/Timeline'",
      '<QuestionCard',
      '<Timeline',
      'data-testid="duello-shared-timeline"',
    ]),
    ...required(questionCard + timeline, ['QuestionCard', 'DropZone']),
    ...forbidden(duelArena, ['KronoKalkan', 'Kart Değiştir', 'Zamanı Dondur', 'İPUCU', 'soloJokers', 'soloHint']),
  ], 'Duello directly composes the existing Solo card and timeline components with no Joker or Hint placeholder.'), ['DuelArena.jsx', 'QuestionCard.jsx', 'Timeline.jsx']),

  make('duello_ui_contract', 'Duello UI exposes player counts, X/12, lock state, and bottom timer', () => sourceResult([
    ...required(duelArena, [
      'data-testid="duello-question-progress"',
      '{Math.max(1, sequence)} / 12',
      'myCorrectCount',
      'opponentCorrectCount',
      'CEVABIN KİLİTLENDİ',
      'data-testid="duello-time-bar"',
      'ANİ ÖLÜM',
    ]),
    ...forbidden(duelArena + duelHook, ['DEVAM', 'DOĞRU.', 'YANLIŞ.', 'ANİ ÖLÜM.']),
  ], 'Responsive Duello chrome contains only the V2-specific player, progress, status, and shared timer elements.'), ['DuelArena.jsx', 'useSameQuestionDuel.js']),

  make('no_solo_level_joker_hint', 'Duello has no Solo level, Joker, or Hint state', () => sourceResult([
    ...required(startBackend, ['jokerHintEnabled: false']),
    ...forbidden(duelHook + duelPage + duelArena + duelResult, [
      'currentLevel',
      'levelNumber',
      'jokerInventory',
      'hintCredits',
      'consumeJoker',
      'consumeHint',
    ]),
  ], 'The V2 session and UI omit Solo progression and all inventory-backed assistance.'), ['startLobbyGame/entry.ts', 'useSameQuestionDuel.js', 'DuelArena.jsx']),

  make('no_lobby_active_flow', 'Duello remains search to match-found to direct /duel', () => sourceResult([
    ...required(onlineScreen + directMatchScreen + randomHook, ['duello-search-screen', 'duello-match-found-screen', 'SAME_QUESTION_DUEL_MODE']),
    ...forbidden(onlineScreen + duelPage + duelArena, ["navigate('/lobby')", 'WaitingRoomPanel', 'Hazırım', 'Manuel Başlat']),
  ], 'Duello has no active ready-room or lobby transition.'), ['OnlineChallengeScreen.jsx', 'SameQuestionDuelPage.jsx', 'DuelArena.jsx']),

  make('result_and_rematch_state', 'Result supports winner, loser, draw, backend points, and honest gated rematch', () => sourceResult(required(duelResult + duelHook, [
    "isDraw ? 'BERABERE!'",
    "isWinner ? 'KAZANDIN!' : 'DUELLO SONA ERDİ'",
    'earnedPoints',
    'RÖVANŞ İSTE',
    'data-kronox-rematch-state="gated-pending"',
    'ANA SAYFA',
  ]), 'One result component renders all terminal states; rematch is visibly gated rather than pretending to work.'), ['DuelResult.jsx', 'useSameQuestionDuel.js']),

  make('reconnect_from_snapshot', 'Reconnect reconstructs one monotonic authoritative snapshot', () => sourceResult(required(duelHook + adaptivePoller + clientStateSource, [
    'getLobbySnapshot',
    'freshRevision >= currentRevision',
    'createAdaptivePoller',
    'duelloSnapshotNeedsSync',
    'syncDuelloRound',
    'poller.stop()',
  ]), 'Question, timeline, counts, remaining time, and phase are rebuilt from the latest non-regressing snapshot.'), ['useSameQuestionDuel.js', 'adaptivePoller.js', 'duelloV2State.js']),

  make('privacy_and_question_bank', 'Public Duello snapshots omit private identity, raw errors, answer years, and the full bank', () => sourceResult([
    ...requiredInEach(PUBLIC_SNAPSHOT_BACKENDS, [
      'publicDuelActiveCard',
      'publicDuelTimelineCards',
      'publicActiveQuestion ? [publicActiveQuestion] : []',
      'used_question_ids: gameMode === SAME_QUESTION_DUEL_MODE ? []',
      'server_now:',
    ]),
    ...forbidden(duelPage + duelHook + duelArena + duelResult, [
      'email',
      'guest_token',
      'guest_id',
      'owner_key',
      'actor_key_hash',
      'provider_id',
      'answer_year',
      'correct_year',
      'error?.message',
    ]),
  ], 'UI receives username-safe identities and one answer-free active card; correct year appears only in resolved round feedback.'), ['findLobbyByCode/entry.ts', 'startLobbyGame/entry.ts', 'updateLobbyGameState/entry.ts', 'DuelArena.jsx']),

  make('docs_and_mirrors_v2', 'Canonical mirrors describe the Duello V2 contract', () => sourceResult(required(
    PRODUCT_WORKFLOW_DOC + SECURITY_DEPLOYMENT_DOC + DB_ARCHITECTURE_IMPLEMENTATION_MIRROR,
    [
      'Duello V2',
      'shared timeline',
      '10-second',
      'Sudden Death',
      '+50',
      '+25',
      'no speed bonus',
    ],
  ), 'Architecture, workflow, and security mirrors agree on the V2 shared-state and scoring rules.'), ['healthAlignmentDocMirrors.js', 'dbArchitectureMirrors.js']),

  make('waiting_cancel_timeout_cleanup', 'Duello search cancel and timeout still clean their mode-scoped queue', () => sourceResult(required(onlineScreen + randomHook + randomBackend, [
    'handleDuelCancel',
    'handleDuelTimeout',
    "await cancelRandomMatchmaking(mode, 'cancel')",
    "await cancelRandomMatchmaking(mode, 'timeout')",
    'findOwnActiveRow(base44, actor.actorKeyHash, mode)',
    "status: 'cancelled'",
    "status: 'expired'",
  ]), 'Cancel, timeout, retry, and unmount settle only the current actor queue state and owned timers.'), ['OnlineChallengeScreen.jsx', 'useRandomMatchmaking.js', 'randomMatchmaking/entry.ts']),

  make('existing_online_modes_unchanged', 'Invite and Online Kapış remain beside isolated Duello', () => sourceResult(required(onlineScreen, [
    'Arkadaşını Davet Et',
    'Online Kapış',
    'useRandomMatchmaking(STANDARD_RANDOM_MODE)',
    'useRandomMatchmaking(SAME_QUESTION_DUEL_MODE)',
  ]), 'Existing invite and standard random Online modes remain active and separate.'), ['OnlineChallengeScreen.jsx']),

  make('bottom_nav_unchanged', 'BottomNav remains Ana Sayfa, Liderlik, Profil', () => {
    const labels = [...bottomNav.matchAll(/label:\s*'([^']+)'/g)].map((match) => match[1]);
    return JSON.stringify(labels) === JSON.stringify(['Ana Sayfa', 'Liderlik', 'Profil'])
      ? pass('BottomNav remains exactly the three canonical tabs.')
      : fail('BottomNav labels changed.', { actual: labels });
  }, ['BottomNav.jsx']),

  make('runtime_manual_two_actor_gate', 'True Duello synchronization requires two isolated actors', () => ({
    status: 'NOT_AUTOMATABLE',
    reason: 'Run the dedicated Runtime E2E scenario with distinct A/B storage states to prove same question, deadline, answer independence, timeline growth, and next-round convergence against deployed Base44.',
    verification: 'MANUAL_EXTERNAL',
    classification: 'TWO_ACTOR_REQUIRED',
    runtimeProofRequired: true,
  }), ['tests/health-e2e/scenarioHandlers.mjs', 'docs/KRONOX_RELEASE_PROOF_CHECKLIST.md']),
];
