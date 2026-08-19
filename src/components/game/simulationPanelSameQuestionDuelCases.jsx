import onlineScreen from '@/components/lobby/OnlineChallengeScreen.jsx?raw';
import bottomNav from '@/components/layout/BottomNav.jsx?raw';
import duelPage from '@/pages/SameQuestionDuelPage.jsx?raw';
import duelHook from '@/hooks/useSameQuestionDuel.js?raw';
import duelArena from '@/components/duel/DuelArena.jsx?raw';
import randomBackend from '../../../base44/functions/randomMatchmaking/entry.ts?raw';
import startBackend from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import updateBackend from '../../../base44/functions/updateLobbyGameState/entry.ts?raw';
import lobbyGateway from '@/lib/dbGateway/lobbyGateway.js?raw';
import waitingRoom from '@/components/lobby/WaitingRoomPanel.jsx?raw';
import duelResult from '@/components/duel/DuelResult.jsx?raw';
import modeDisplay from '@/lib/onlineModeDisplay.js?raw';
import { PRODUCT_WORKFLOW_DOC, SECURITY_DEPLOYMENT_DOC } from '@/lib/healthAlignmentDocMirrors';
import { DB_ARCHITECTURE_IMPLEMENTATION_MIRROR } from '@/lib/dbArchitectureMirrors';

const SUITE = 'same_question_duel';
const PASS = 'PASS';
const FAIL = 'FAIL';
const required = (source, tokens) => tokens.filter((token) => !source.includes(token));
const forbidden = (source, tokens) => tokens.filter((token) => source.includes(token));
const result = (missing, reason) => missing.length
  ? { status: FAIL, reason, verification: 'SOURCE_CONNECTED', missing }
  : { status: PASS, reason, verification: 'SOURCE_CONNECTED', classification: 'STATIC_CHECK_LIMITATION' };
const make = (id, name, run, files) => ({ key: `${SUITE}.${id}`, suiteId: SUITE, suiteName: 'Duello Health Suite', id, name, critical: true, actionType: 'CODE_FIX', relatedFiles: files, run });

export const EXTRA_SUITES = [{ id: SUITE, name: 'Duello Health Suite', critical: true, color: '#22d3ee' }];
export const EXTRA_TESTS = [
  make('online_entry_button_exists', 'Online main exposes Duello outside BottomNav', () => result([
    ...required(modeDisplay + onlineScreen, ["DUELLO_DISPLAY_NAME = 'Duello'", 'label={DUELLO_DISPLAY_NAME}', 'Duelloya Başla', '2 oyuncu · 10 kart hedefi · Rastgele rakip']),
    ...forbidden(bottomNav, ['Duello']),
  ], 'Duello entry is present only on the Online screen.'), ['onlineModeDisplay.js', 'OnlineChallengeScreen.jsx', 'BottomNav.jsx']),
  make('mode_is_two_player_only', 'Duello requires exactly two players', () => result(required(startBackend + updateBackend + randomBackend, [
    'same_question_duel_requires_two_players', 'players.length !== 2', 'max_players: 2',
  ]), 'Backend start, claim, and matchmaking enforce exactly two players.'), ['randomMatchmaking/entry.ts', 'startLobbyGame/entry.ts', 'updateLobbyGameState/entry.ts']),
  make('random_matchmaking_is_mode_scoped', 'Duello queue cannot mix with normal random Online', () => result(required(randomBackend, [
    "const SAME_QUESTION_DUEL_MODE = 'same_question_duel'", 'normalizeMode(row?.mode) === mode', 'random_matchmaking:pair:${mode}', 'game_mode: mode',
  ]), 'Random matchmaking is partitioned by mode.'), ['randomMatchmaking/entry.ts']),
  make('server_authored_shared_deck', 'Duello deck and opening context are server-authored', () => result(required(startBackend, [
    "source: 'same_question_duel_server_shared_deck_v1'", 'openingCards = sharedDeck.slice(0, 2)', 'cards: openingCards.map', 'onlineQuestionDeck: sharedDeck',
  ]), 'Both players receive the same two server-authored opening anchors and shared sequence.'), ['startLobbyGame/entry.ts']),
  make('no_category_selector', 'Duello has no category selector and uses all active categories', () => result([
    ...forbidden(onlineScreen, ['OnlineCategoryCarousel', 'selectedCategories']),
    ...required(startBackend, ['allCategoriesRandom: true', 'selectedCategoryIds: []']),
  ], 'Duello uses the all-active random category policy with no selector.'), ['OnlineChallengeScreen.jsx', 'startLobbyGame/entry.ts']),
  make('first_correct_claim_backend_owned', 'First correct claim is backend-arbitrated', () => result(required(updateBackend + duelHook + duelArena, [
    "action: 'claim_shared_card'", 'claimSameQuestionDuelCard', 'isCorrectPlacement(playerCards', 'same-question-duel:', 'Hamle sunucuda doğrulanıyor',
  ]), 'Client submits placement only; backend lock and evaluation decide the claim.'), ['updateLobbyGameState/entry.ts', 'useSameQuestionDuel.js', 'DuelArena.jsx']),
  make('claim_idempotency', 'Repeated Duello submissions cannot duplicate a card', () => result(required(updateBackend, [
    'duel_processed_operation_keys', "claim_result: 'already_processed'", "claim_result: 'already_attempted'", "claim_result: 'card_already_resolved'",
  ]), 'Sequence, actor, operation window, and lock provide idempotent claim handling.'), ['updateLobbyGameState/entry.ts']),
  make('first_to_10_wins', 'First player to ten backend-confirmed claims wins', () => result(required(startBackend + updateBackend, [
    'SAME_QUESTION_DUEL_TARGET = 10', 'claimed_count: 0', 'Number(winnerPlayer.claimed_count) >= SAME_QUESTION_DUEL_TARGET', "status: hasWon ? 'finished' : 'in_game'",
  ]), 'Backend commits terminal winner state at ten claimed cards.'), ['startLobbyGame/entry.ts', 'updateLobbyGameState/entry.ts']),
  make('result_scoring_unchanged', 'Duello reuses winner +15 / loser -6 result authority', () => result(required(updateBackend + duelHook + lobbyGateway, [
    'const ONLINE_WIN_POINTS = 15', 'const ONLINE_LOSS_POINTS = -6', "source: 'same_question_duel'", "body?.action === 'commit_result'", 'commitOnlineMatchResult',
  ]), 'Duello uses the existing backend result commit and fixed score rule.'), ['updateLobbyGameState/entry.ts', 'useSameQuestionDuel.js', 'lobbyGateway.js']),
  make('no_client_score_writes', 'Duello client has no direct score/result entity writes', () => result(forbidden(duelHook + duelPage + duelArena, [
    'OnlineMatchResult.create', 'User.update', 'GuestProfile.update', 'SoloLeaderboardEntry.create', 'online_progress:',
  ]), 'Duello client only invokes the existing backend result commit.'), ['useSameQuestionDuel.js', 'SameQuestionDuelPage.jsx']),
  make('privacy_public_snapshot_sanitized', 'Duello public UI and snapshot omit private actor identity', () => result([
    ...forbidden(duelPage + duelArena, ['email', 'guest_token', 'guest_id', 'owner_key', 'actor_key_hash', 'kronox_user_id']),
    ...required(updateBackend, ['participant_ref:', 'claimed_by_self:', 'active_shared_card:']),
  ], 'Duello surfaces use username-safe players and opaque participant refs only.'), ['DuelArena.jsx', 'updateLobbyGameState/entry.ts']),
  make('joker_hint_v1_policy', 'Joker and Hint are disabled in Duello V1', () => result(required(startBackend + duelArena, [
    'jokerHintEnabled: false', 'interactionPaused={pending || !canAttempt}',
  ]), 'Duello gameplay passes no Solo Joker or Hint controls.'), ['startLobbyGame/entry.ts', 'DuelArena.jsx']),
  make('cancel_timeout_cleanup', 'Duello wait cancel and timeout clean queue/polling', () => result(required(onlineScreen + duelHook, [
    'handleDuelCancel', 'duel.cancel()', 'handleDuelTimeout', 'return () => { cancelled = true; poller.stop(); }',
  ]), 'Waiting and gameplay poll owners stop on cancel, timeout, or unmount.'), ['OnlineChallengeScreen.jsx', 'useSameQuestionDuel.js']),
  make('existing_online_modes_unchanged', 'Invite and normal random Online entries remain active', () => result(required(onlineScreen, [
    'Arkadaşını Davet Et', 'Rastgele Eşleş', "useRandomMatchmaking('random_online')", 'useRandomMatchmaking(SAME_QUESTION_DUEL_MODE)',
  ]), 'Existing invite and normal random modes remain alongside Duello.'), ['OnlineChallengeScreen.jsx']),
  make('bottom_nav_unchanged', 'BottomNav remains Ana Sayfa, Liderlik, Profil', () => {
    const labels = [...bottomNav.matchAll(/label:\s*'([^']+)'/g)].map((match) => match[1]);
    return JSON.stringify(labels) === JSON.stringify(['Ana Sayfa', 'Liderlik', 'Profil'])
      ? { status: PASS, reason: 'BottomNav remains exactly the three canonical tabs.', verification: 'EXECUTABLE_SOURCE_SIMULATION' }
      : { status: FAIL, reason: 'BottomNav labels changed.', actual: labels };
  }, ['BottomNav.jsx']),
  make('old_display_names_absent', 'Old temporary Duello display names are absent', () => result(forbidden(
    onlineScreen + waitingRoom + duelPage + duelResult + PRODUCT_WORKFLOW_DOC + SECURITY_DEPLOYMENT_DOC + DB_ARCHITECTURE_IMPLEMENTATION_MIRROR,
    ['Aynı Soru ile Kapış', 'Same Question Duel', 'Düello'],
  ), 'Active UI and documentation mirrors use only the final Duello display name.'), ['OnlineChallengeScreen.jsx', 'WaitingRoomPanel.jsx', 'SameQuestionDuelPage.jsx', 'DuelResult.jsx', 'healthAlignmentDocMirrors.js', 'dbArchitectureMirrors.js']),
  make('two_device_runtime_proof', 'Real simultaneous Duello first-correct arbitration requires two-device proof', () => ({
    status: 'NOT_AUTOMATABLE',
    reason: 'Run two real actors in Duello against the deployed Base44 functions to prove network-order arbitration, reconnect, and +15/-6 persistence.',
    verification: 'MANUAL_TWO_ACCOUNT_RUNTIME',
  }), ['randomMatchmaking/entry.ts', 'updateLobbyGameState/entry.ts']),
];