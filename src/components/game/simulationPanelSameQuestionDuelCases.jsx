import onlineScreen from '@/components/lobby/OnlineChallengeScreen.jsx?raw';
import bottomNav from '@/components/layout/BottomNav.jsx?raw';
import duelPage from '@/pages/SameQuestionDuelPage.jsx?raw';
import duelHook from '@/hooks/useSameQuestionDuel.js?raw';
import duelArena from '@/components/duel/DuelArena.jsx?raw';
import duelResult from '@/components/duel/DuelResult.jsx?raw';
import waitingRoom from '@/components/lobby/WaitingRoomPanel.jsx?raw';
import randomHook from '@/hooks/useRandomMatchmaking.js?raw';
import randomBackend from '../../../base44/functions/randomMatchmaking/entry.ts?raw';
import randomPolicy from '../../../base44/shared/randomMatchmakingPolicy.js?raw';
import startBackend from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import updateBackend from '../../../base44/functions/updateLobbyGameState/entry.ts?raw';
import findBackend from '../../../base44/functions/findLobbyByCode/entry.ts?raw';
import lobbyGateway from '@/lib/dbGateway/lobbyGateway.js?raw';
import adaptivePoller from '@/lib/adaptivePoller.js?raw';
import modeDisplay from '@/lib/onlineModeDisplay.js?raw';
import { PRODUCT_WORKFLOW_DOC, SECURITY_DEPLOYMENT_DOC } from '@/lib/healthAlignmentDocMirrors';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '@/lib/dbArchitectureMirrors';

const SUITE = 'duello';
const PUBLIC_SNAPSHOT_BACKENDS = [startBackend, updateBackend, findBackend];
const required = (source, tokens) => tokens.filter((token) => !source.includes(token));
const forbidden = (source, tokens) => tokens.filter((token) => source.includes(token));
const requiredInEach = (sources, tokens) => sources.flatMap((source, sourceIndex) =>
  required(source, tokens).map((token) => `source_${sourceIndex + 1}:${token}`));
const sourceResult = (missing, reason, extra = {}) => missing.length
  ? { status: 'FAIL', reason, verification: 'SOURCE_CONNECTED', classification: 'REAL_PRODUCT_RISK', missing, ...extra }
  : { status: 'PASS', reason, verification: 'SOURCE_CONNECTED', classification: 'SOURCE_CONNECTED', ...extra };
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

export const EXTRA_SUITES = [{ id: SUITE, name: 'Duello Health Suite', critical: true, color: '#22d3ee' }];
export const EXTRA_TESTS = [
  make('entry_button_exists', 'Online main exposes Duello outside BottomNav', () => sourceResult([
    ...required(modeDisplay + onlineScreen, [
      "DUELLO_DISPLAY_NAME = 'Duello'",
      'label={DUELLO_DISPLAY_NAME}',
      'Duelloya Başla',
      '2 oyuncu · 10 kart hedefi · Rastgele rakip',
    ]),
    ...forbidden(bottomNav, ['Duello']),
  ], 'Duello entry remains on the Online screen and outside BottomNav.'), ['onlineModeDisplay.js', 'OnlineChallengeScreen.jsx', 'BottomNav.jsx']),

  make('mode_key_stable', 'Duello display name and internal mode key remain stable', () => sourceResult([
    ...required(modeDisplay + randomBackend, [
      "SAME_QUESTION_DUEL_MODE = 'same_question_duel'",
      "DUELLO_DISPLAY_NAME = 'Duello'",
    ]),
    ...forbidden(
      onlineScreen + waitingRoom + duelPage + duelArena + duelResult + PRODUCT_WORKFLOW_DOC + SECURITY_DEPLOYMENT_DOC + DB_ARCHITECTURE_IMPLEMENTATION_MIRROR,
      ['Aynı Soru ile Kapış', 'Same Question Duel', 'Düello'],
    ),
  ], 'Active product surfaces use Duello while the backend key stays same_question_duel.'), ['onlineModeDisplay.js', 'randomMatchmaking/entry.ts', 'healthAlignmentDocMirrors.js']),

  make('two_player_only', 'Duello requires exactly two players', () => sourceResult([
    ...required(randomBackend, ['max_players: 2', 'game_mode: mode']),
    ...required(startBackend, ['players.length !== 2', 'same_question_duel_requires_two_players']),
    ...required(updateBackend, ['players.length !== 2 || Number(lobby?.max_players) !== 2', 'same_question_duel_requires_two_players']),
  ], 'Matchmaking, start, and claim authority all enforce the two-player boundary.'), ['randomMatchmaking/entry.ts', 'startLobbyGame/entry.ts', 'updateLobbyGameState/entry.ts']),

  make('random_matchmaking_mode_scoped', 'Duello queue cannot mix with normal random Online', () => sourceResult([
    ...required(randomBackend, [
      'MATCHMAKING_MODES',
      '{ actor_key_hash: actorKeyHash, mode }',
      'selectOwnActiveQueueRow(rows, actorKeyHash, mode)',
      'random_matchmaking:pair:${mode}',
      'game_mode: mode',
    ]),
    ...required(randomPolicy, [
      'normalizeMatchmakingMode(row?.mode) === canonicalMode',
      "row?.status === 'waiting'",
    ]),
  ], 'Random matchmaking pairing and active-row lookup are partitioned by the canonical mode policy.'), ['randomMatchmakingPolicy.js', 'randomMatchmaking/entry.ts']),

  make('server_authored_shared_deck', 'Backend authors the Duello shared deck and opening anchors', () => sourceResult(required(startBackend, [
    "source: 'same_question_duel_server_shared_deck_v1'",
    'openingCards = sharedDeck.slice(0, 2)',
    'cards: openingCards.map',
    'onlineQuestionDeck: sharedDeck',
    'soloPreferenceWeightingApplied: false',
    'guestSoloPathUsed: false',
  ]), 'startLobbyGame creates the private shared deck without Solo buffers.'), ['startLobbyGame/entry.ts']),

  make('same_sequence_for_both_players', 'Both players reconcile against one shared sequence', () => sourceResult([
    ...required(startBackend, ['duelSequence: 1', 'duel_sequence: initialState.duelSequence']),
    ...required(updateBackend, ['const currentSequence =', 'duel_sequence: hasWon ? currentSequence : currentSequence + 1']),
    ...requiredInEach(PUBLIC_SNAPSHOT_BACKENDS, ['sequence_id: sequence', 'active_shared_card: publicActiveQuestion']),
  ], 'One Lobby sequence and one sanitized active card projection are shared by both clients.'), ['startLobbyGame/entry.ts', 'updateLobbyGameState/entry.ts', 'findLobbyByCode/entry.ts']),

  make('claim_backend_authoritative', 'Backend validates and awards every Duello claim', () => sourceResult(required(updateBackend + duelHook + duelArena, [
    "action: 'claim_shared_card'",
    'claimSameQuestionDuelCard',
    'isCorrectPlacement(playerCards',
    'same-question-duel:',
    'Hamle sunucuda doğrulanıyor',
  ]), 'The client submits a zone; backend state, correctness, and lock order decide the card.'), ['updateLobbyGameState/entry.ts', 'useSameQuestionDuel.js', 'DuelArena.jsx']),

  make('claim_idempotency', 'Duplicate submissions cannot duplicate a Duello claim', () => sourceResult(required(updateBackend, [
    'duel_processed_operation_keys',
    "claim_result: 'already_processed'",
    "claim_result: 'already_attempted'",
    "claim_result: 'card_already_resolved'",
    'nextProcessed = [...freshProcessed, operationKey].slice(-80)',
  ]), 'Lobby, sequence, actor, operation key, and bounded receipt history make retries idempotent.'), ['updateLobbyGameState/entry.ts']),

  make('stale_claim_rejected_safely', 'Stale Duello claims reconcile with safe copy', () => sourceResult([
    ...required(updateBackend, ['requestedSequence !== currentSequence', "claim_result: 'card_already_resolved'", 'lobby: publicLobby(fresh, actor)']),
    ...required(duelHook, ["data.claim_result === 'card_already_resolved'", 'Bu kart rakip tarafından alındı.', 'await refresh().catch(() => null)']),
  ], 'A stale sequence cannot claim again and returns the current safe Lobby snapshot.'), ['updateLobbyGameState/entry.ts', 'useSameQuestionDuel.js']),

  make('claim_result_reconciles_both_clients', 'Claim results and polling converge on backend state', () => sourceResult([
    ...required(updateBackend, ['state_revision: nextRevision', 'lobby: publicLobby(updated, actor)']),
    ...required(duelHook, ['acceptLobbySnapshot(data.lobby)', 'freshRevision >= currentRevision', 'createAdaptivePoller', 'poller.stop()']),
  ], 'Claim responses and adaptive refresh use the same monotonic public Lobby projection.'), ['updateLobbyGameState/entry.ts', 'useSameQuestionDuel.js']),

  make('first_to_10_wins', 'First player to ten backend-confirmed claims wins', () => sourceResult(required(startBackend + updateBackend, [
    'SAME_QUESTION_DUEL_TARGET = 10',
    'claimed_count: 0',
    'Number(winnerPlayer.claimed_count) >= SAME_QUESTION_DUEL_TARGET',
    "status: hasWon ? 'finished' : 'in_game'",
  ]), 'Backend commits terminal winner state at ten claimed cards.'), ['startLobbyGame/entry.ts', 'updateLobbyGameState/entry.ts']),

  make('result_scoring_unchanged', 'Duello keeps winner +15 and loser -6', () => sourceResult(required(updateBackend + duelHook + lobbyGateway, [
    'const ONLINE_WIN_POINTS = 15',
    'const ONLINE_LOSS_POINTS = -6',
    "source: 'same_question_duel'",
    "body?.action === 'commit_result'",
    'commitOnlineMatchResult',
  ]), 'Duello reuses the idempotent backend Online result path and fixed scoring.'), ['updateLobbyGameState/entry.ts', 'useSameQuestionDuel.js', 'lobbyGateway.js']),

  make('no_client_score_writes', 'Duello client cannot write result or score entities', () => sourceResult(forbidden(duelHook + duelPage + duelArena + duelResult, [
    'OnlineMatchResult.create',
    'User.update',
    'GuestProfile.update',
    'LeaderboardEntry.create',
    'online_progress:',
    'kronox_puan_total:',
  ]), 'The client only invokes the backend commit_result gateway.'), ['useSameQuestionDuel.js', 'SameQuestionDuelPage.jsx', 'DuelResult.jsx']),

  make('no_category_selector', 'Duello has no category selector and uses all active categories', () => sourceResult([
    ...forbidden(onlineScreen, ['OnlineCategoryCarousel', 'selectedCategories']),
    ...required(startBackend, ['allCategoriesRandom: true', 'selectedCategoryIds: []']),
  ], 'Duello uses all active Online-eligible categories with no picker.'), ['OnlineChallengeScreen.jsx', 'startLobbyGame/entry.ts']),

  make('no_full_question_bank_exposure', 'Duello exposes only the bounded active card projection', () => sourceResult([
    ...requiredInEach(PUBLIC_SNAPSHOT_BACKENDS, [
      'publicDuelActiveCard',
      'publicActiveQuestion ? [publicActiveQuestion] : []',
      'used_question_ids: gameMode === SAME_QUESTION_DUEL_MODE ? []',
    ]),
    ...PUBLIC_SNAPSHOT_BACKENDS.flatMap((source, index) => forbidden(source, [
      '? (activeQuestion ? [activeQuestion] : [])',
      'year: Number(activeQuestion.year)',
    ]).map((token) => `source_${index + 1}:${token}`)),
  ], 'Public Duello payloads contain one synthetic-ID active card with no answer year or private deck list.'), ['findLobbyByCode/entry.ts', 'startLobbyGame/entry.ts', 'updateLobbyGameState/entry.ts']),

  make('privacy_snapshot_sanitized', 'Duello public snapshots omit private actor and row identity', () => sourceResult([
    ...requiredInEach(PUBLIC_SNAPSHOT_BACKENDS, [
      'duel_timeline_${index + 1}',
      'duel_card_${sequence}',
      'publicDuelTimelineCards',
    ]),
    ...forbidden(duelPage + duelArena + duelResult, [
      'email',
      'guest_token',
      'guest_id',
      'owner_key',
      'actor_key_hash',
      'kronox_user_id',
    ]),
  ], 'UI receives username-safe identity, opaque participant refs, self-only resolved years, and synthetic card IDs.'), ['DuelArena.jsx', 'findLobbyByCode/entry.ts', 'startLobbyGame/entry.ts', 'updateLobbyGameState/entry.ts']),

  make('joker_hint_v1_policy', 'Joker and Hint are disabled in Duello V1', () => sourceResult([
    ...required(startBackend, ['jokerHintEnabled: false']),
    ...forbidden(duelArena, ['soloJokers=', 'soloHint=']),
  ], 'Duello renders no Solo Joker/Hint controls and starts with backend metadata disabling them.'), ['startLobbyGame/entry.ts', 'DuelArena.jsx']),

  make('poller_cleanup', 'Duello adaptive polling and touch timers clean up', () => sourceResult([
    ...required(adaptivePoller, ['let inFlight = false', 'clearTimer()', 'removeEventListener', 'if (!active || inFlight) return false']),
    ...required(duelHook, ['poller.stop()', 'touchDragTimerRef', 'window.clearTimeout(touchDragTimerRef.current)', 'mountedRef.current = false']),
  ], 'The shared poller prevents overlap and all Duello-owned timers/listeners stop on unmount.'), ['adaptivePoller.js', 'useSameQuestionDuel.js']),

  make('waiting_cancel_timeout_cleanup', 'Duello cancel and timeout close waiting state', () => sourceResult([
    ...required(onlineScreen, ['handleDuelCancel', 'handleDuelTimeout', 'await duel.cancel()', 'duel.resolveTimeout()']),
    ...required(randomHook, ['stopPolling()', 'window.clearTimeout(pollRef.current)', 'clearRetryWait()', 'await pollRandomMatchmaking(mode)', 'await cancelRandomMatchmaking(mode)']),
    ...required(randomBackend, ["status: 'cancelled'", "status: 'expired'", "action === 'cancel'"]),
  ], 'Explicit cancel settles its own row; timeout checks once more, and every poll/retry timer is cleared.'), ['OnlineChallengeScreen.jsx', 'useRandomMatchmaking.js', 'randomMatchmaking/entry.ts']),

  make('existing_online_modes_unchanged', 'Invite and normal random Online entries remain active', () => sourceResult(required(onlineScreen, [
    'Arkadaşını Davet Et',
    'Online Kapış',
    'useRandomMatchmaking(STANDARD_RANDOM_MODE)',
    'useRandomMatchmaking(SAME_QUESTION_DUEL_MODE)',
  ]), 'Existing invite and normal random modes remain beside the isolated Duello path.'), ['OnlineChallengeScreen.jsx']),

  make('bottom_nav_unchanged', 'BottomNav remains Ana Sayfa, Liderlik, Profil', () => {
    const labels = [...bottomNav.matchAll(/label:\s*'([^']+)'/g)].map((match) => match[1]);
    return JSON.stringify(labels) === JSON.stringify(['Ana Sayfa', 'Liderlik', 'Profil'])
      ? { status: 'PASS', reason: 'BottomNav remains exactly the three canonical tabs.', verification: 'SOURCE_CONNECTED', classification: 'SOURCE_CONNECTED' }
      : { status: 'FAIL', reason: 'BottomNav labels changed.', verification: 'SOURCE_CONNECTED', classification: 'REAL_PRODUCT_RISK', actual: labels };
  }, ['BottomNav.jsx']),

  make('runtime_manual_two_device_gate', 'Real simultaneous Duello arbitration requires two-device proof', () => ({
    status: 'NOT_AUTOMATABLE',
    reason: 'Run two real actors against deployed Base44 to prove near-simultaneous first-correct arbitration, stale-client recovery, reconnect, and one-time +15/-6 persistence.',
    verification: 'MANUAL_EXTERNAL',
    classification: 'MANUAL_EXTERNAL',
    runtimeProofRequired: true,
  }), ['randomMatchmaking/entry.ts', 'updateLobbyGameState/entry.ts', 'KRONOX_RELEASE_PROOF_CHECKLIST.md']),
];
