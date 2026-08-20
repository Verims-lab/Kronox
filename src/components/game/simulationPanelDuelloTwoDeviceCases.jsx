import onlineScreen from '@/components/lobby/OnlineChallengeScreen.jsx?raw';
import preGame from '@/components/lobby/PreGameHourglass.jsx?raw';
import directMatch from '@/components/online/DirectOnlineMatchScreen.jsx?raw';
import duelArena from '@/components/duel/DuelArena.jsx?raw';
import randomHook from '@/hooks/useRandomMatchmaking.js?raw';
import directHandoff from '@/hooks/useDirectOnlineGameHandoff.js?raw';
import randomApi from '@/lib/randomMatchmakingApi.js?raw';
import navigation from '@/lib/onlineGameNavigation.js?raw';
import runtimeScenarios from '@/lib/health/runtimeE2EScenarios.js?raw';
import runtimeCapabilities from '@/lib/health/runtimeE2ECapabilities.js?raw';
import simulationPanel from '@/components/game/SimulationPanel.jsx?raw';
import randomBackend from '../../../base44/functions/randomMatchmaking/entry.ts?raw';
import startBackend from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import updateBackend from '../../../base44/functions/updateLobbyGameState/entry.ts?raw';
import findBackend from '../../../base44/functions/findLobbyByCode/entry.ts?raw';
import runner from '../../../scripts/run-health-e2e.mjs?raw';
import handlers from '../../../tests/health-e2e/scenarioHandlers.mjs?raw';
import harness from '../../../tests/health-e2e/runtimeHarness.mjs?raw';
import {
  SAME_QUESTION_DUEL_MODE,
  STANDARD_RANDOM_MODE,
  normalizeMatchmakingMode,
  selectCompatibleWaitingRow,
} from '../../../base44/shared/randomMatchmakingPolicy.js';
import {
  MATCHMAKING_PHASE,
  initialRandomMatchmakingState,
  randomMatchmakingReducer,
} from '@/lib/randomMatchmakingState';

const PRODUCT_SUITE = 'duello_flow';
const RUNTIME_SUITE = 'runtime_e2e_automation';
const PRODUCT_FILES = ['randomMatchmaking/entry.ts', 'useRandomMatchmaking.js', 'PreGameHourglass.jsx'];
const RUNTIME_FILES = ['run-health-e2e.mjs', 'scenarioHandlers.mjs', 'runtimeE2ECapabilities.js'];
const required = (source, tokens) => tokens.filter((token) => !String(source || '').includes(token));
const forbidden = (source, tokens) => tokens.filter((token) => String(source || '').includes(token));
const pass = (reason, extra = {}) => ({ status: 'PASS', reason, verification: 'EXECUTABLE_SOURCE_CONNECTED', classification: 'SOURCE_CONNECTED', ...extra });
const fail = (reason, extra = {}) => ({ status: 'FAIL', reason, verification: 'EXECUTABLE_SOURCE_CONNECTED', classification: 'REAL_PRODUCT_RISK', ...extra });
const sourceResult = (missing, reason) => missing.length ? fail(reason, { missing }) : pass(reason);
const make = (suiteId, id, name, run, relatedFiles) => ({
  key: `${suiteId}.${id}`,
  suiteId,
  suiteName: suiteId === PRODUCT_SUITE ? 'Duello Direct Start Health Suite' : 'Runtime E2E Automation Framework Health Suite',
  id,
  name,
  critical: true,
  actionType: 'CODE_FIX',
  relatedFiles,
  run,
});

const now = Date.parse('2026-08-20T12:00:00.000Z');
const queueRows = [
  { id: 'duel-a', actor_key_hash: 'actor-a', mode: SAME_QUESTION_DUEL_MODE, status: 'waiting', created_at: '2026-08-20T11:59:55.000Z', expires_at: '2026-08-20T12:00:30.000Z' },
  { id: 'duel-b', actor_key_hash: 'actor-b', mode: SAME_QUESTION_DUEL_MODE, status: 'waiting', created_at: '2026-08-20T11:59:56.000Z', expires_at: '2026-08-20T12:00:30.000Z' },
  { id: 'online-c', actor_key_hash: 'actor-c', mode: STANDARD_RANDOM_MODE, status: 'waiting', created_at: '2026-08-20T11:59:54.000Z', expires_at: '2026-08-20T12:00:30.000Z' },
];

// Additional Codex639 cases extend the canonical duello_flow and
// runtime_e2e_automation suites; they must not register either suite again.
export const EXTRA_SUITES = [];

export const EXTRA_TESTS = [
  make(PRODUCT_SUITE, 'duello_start_does_not_fail_for_normal_waiting', 'Normal Duello waiting remains searching', () => {
    const state = randomMatchmakingReducer(initialRandomMatchmakingState, { type: 'SEARCH_STARTED' });
    return state.phase === MATCHMAKING_PHASE.SEARCHING && !state.errorMessage
      ? sourceResult(required(randomBackend, ['recoverable: true', "status: matched ? 'matched' : 'waiting'", 'random_matchmaking_lock_unavailable']), 'Normal waiting and recoverable lock contention stay in searching.')
      : fail('SEARCH_STARTED produced a terminal failure.', { actual: state });
  }, PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_queue_mode_key_canonical', 'Duello mode key is canonical end to end', () => (
    normalizeMatchmakingMode('same_question_duel') === SAME_QUESTION_DUEL_MODE
      ? sourceResult(required(randomApi + randomBackend, ['normalizeOnlineMatchmakingMode', 'normalizeMode(requestedMode)', 'same_question_duel']), 'Client and backend normalize Duello to same_question_duel.')
      : fail('Duello canonical mode normalization failed.')
  ), PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_queue_is_mode_scoped', 'Duello queue is isolated from Online Kapış', () => {
    const candidate = selectCompatibleWaitingRow(queueRows, 'actor-a', SAME_QUESTION_DUEL_MODE, now);
    return candidate?.id === 'duel-b'
      ? sourceResult(required(randomBackend, ['random_matchmaking:pair:${mode}', "{ status: 'waiting', mode }", 'game_mode: mode']), 'Executable selection and backend locking remain mode-scoped.')
      : fail('Duello selected a cross-mode queue row.', { actual: candidate?.id || null });
  }, PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_two_distinct_actors_pair', 'Two distinct Duello actors can pair', () => {
    const candidate = selectCompatibleWaitingRow(queueRows, 'actor-a', SAME_QUESTION_DUEL_MODE, now);
    return candidate?.actor_key_hash === 'actor-b'
      ? sourceResult(required(randomBackend, ['const queue = queueStore(base44);', 'pairWaitingRows', 'players: [selfPlayer, opponentPlayer]', 'max_players: 2', 'selectCommittedPairingPeer', 'PAIRING_RECONCILE_GRACE_MS', "queue.update(rowId(freshCandidate), { status: 'matched' })"]), 'Distinct actors use the bound queue store, stage reciprocal rows, receive stale-read grace, and finalize one two-player backend session.')
      : fail('Executable pairing did not select the distinct actor.');
  }, PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_no_self_match_false_positive', 'Self-match protection does not reject a real opponent', () => {
    const candidate = selectCompatibleWaitingRow(queueRows, 'actor-a', SAME_QUESTION_DUEL_MODE, now);
    const selfOnly = selectCompatibleWaitingRow([queueRows[0]], 'actor-a', SAME_QUESTION_DUEL_MODE, now);
    return candidate?.id === 'duel-b' && selfOnly === null
      ? sourceResult(required(randomBackend, ["String(freshCandidate?.actor_key_hash || '') === actor.actorKeyHash", 'selfMatchPrevented: true']), 'Self rows are rejected while a distinct second actor remains eligible.')
      : fail('Executable self-match policy produced a false positive.');
  }, PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_same_screen_match_found', 'Duello shows Rakip bulundu on the search surface', () => sourceResult(required(preGame + onlineScreen, [
    "phase === 'matched' || phase === 'directStarting'",
    'Rakip bulundu',
    "testId=\"duello-search-screen\"",
    "source: match.mode === SAME_QUESTION_DUEL_MODE ? 'duello'",
  ]), 'The same Online-owned flow renders searching then matched without a waiting-room screen.'), PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_direct_game_after_match_phase_contract', 'Matched Duello enters direct game through the direct-start phase', () => sourceResult(required(directMatch + directHandoff + navigation, [
    "setPhase('directStarting')",
    'hasAuthoritativeOnlineGamePayload',
    "? '/duel?' : '/game?'",
  ]), 'The matched handoff waits for an authoritative payload and navigates directly to /duel.'), PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_no_lobby_after_match', 'Active Duello never routes through lobby', () => sourceResult([
    ...required(navigation + handlers, ["route === '/duel'", 'LOBBY_STILL_PRESENT']),
    ...forbidden(onlineScreen + directMatch + navigation, ["navigate('/lobby'", 'navigate("/lobby"', '>Lobi<']),
  ], 'Active search, match-found, and navigation sources contain no lobby transition.'), PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_retry_cleans_stale_attempt', 'Retry settles stale own queue before rejoin', () => sourceResult(required(randomHook + randomBackend, [
    'await cancelRandomMatchmaking(mode)',
    'cleanup?.cancelled !== true',
    'clearRetryWait()',
    'duplicateWaitingRows',
    "status: 'cancelled'",
  ]), 'Retry requires confirmed own-row cleanup and clears prior retry/poll timers before joining.'), PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_cancel_cleans_own_queue_only', 'Cancel settles only the caller queue row', () => sourceResult([
    ...required(randomBackend, ['findOwnActiveRow(base44, actor.actorKeyHash, mode)', "status: 'cancelled'", 'cancelled_at: new Date().toISOString()']),
    ...forbidden(randomBackend, ['paired_actor_key_hash: actor.actorKeyHash,\n      status: \'cancelled\'']),
  ], 'Cancel resolves the caller row under the mode lock and does not cancel a committed peer match.'), PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_timeout_safe_copy', 'Duello timeout uses bounded safe copy', () => {
    const state = randomMatchmakingReducer(initialRandomMatchmakingState, { type: 'TIMED_OUT' });
    return state.phase === MATCHMAKING_PHASE.TIMEOUT && state.errorMessage === 'Tekrar dene.'
      ? sourceResult(required(preGame, ['Rakip bulunamadı', 'Tekrar dene']), 'Timeout is distinct from a classified start failure.')
      : fail('Timeout reducer copy drifted.', { actual: state });
  }, PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_error_copy_safe_and_classified', 'Duello terminal errors are safe and classified', () => sourceResult([
    ...required(randomApi + randomBackend + preGame, ['SAFE_ERROR_SUFFIXES', 'DUELLO', 'errorCategory', 'Eşleşme başlatılamadı', 'Lütfen tekrar dene']),
    ...forbidden(preGame + onlineScreen, ['error?.message', 'Request failed with status code']),
  ], 'Public copy is fixed while automation receives an allowlisted DUELLO_* category.'), PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_no_private_identity_leak', 'Duello diagnostics and UI omit private identity', () => sourceResult([
    ...required(randomApi + randomBackend, ['safeDiagnostics', 'matchedOpponentPublicSafe', 'actorKind']),
    ...forbidden(preGame + onlineScreen + directMatch + duelArena, ['guest_token', 'guest_id', 'owner_key', 'actor_key_hash', 'provider_id', 'auth_id', 'email']),
  ], 'Duello renders only fixed UI and boolean/allowlisted diagnostic fields.'), PRODUCT_FILES),

  make(PRODUCT_SUITE, 'duello_no_question_bank_leak_before_game', 'Duello exposes only one sanitized active card', () => sourceResult([
    ...required(startBackend + updateBackend + findBackend, ['publicDuelActiveCard', 'publicActiveQuestion ? [publicActiveQuestion] : []', 'used_question_ids: gameMode === SAME_QUESTION_DUEL_MODE ? []']),
    ...forbidden(duelArena, ['online_question_deck', 'answer_year', 'correct_year']),
  ], 'Public Duello snapshots expose a bounded synthetic active-card projection, never the full deck or answer year.'), PRODUCT_FILES),

  make(RUNTIME_SUITE, 'duello_two_actor_requires_two_storage_states', 'Two-actor Duello requires external A/B fixtures', () => sourceResult(required(runner + handlers + runtimeCapabilities, [
    'KRONOX_E2E_STORAGE_STATE_A',
    'KRONOX_E2E_STORAGE_STATE_B',
    'hasTwoStorageStates',
    'else if (config.hasStorageStateA) contextOptions.storageState = STORAGE_STATE_A_PATH',
    'TWO_ACTOR_REQUIRED',
    'AUTOMATION_STATUS.MANUAL_EXTERNAL',
  ]), 'Without both A/B fixtures, the real pairing scenario remains MANUAL_EXTERNAL.'), RUNTIME_FILES),

  make(RUNTIME_SUITE, 'duello_two_actor_same_screen_match_found', 'Two-actor E2E observes searching and matched on both screens', () => sourceResult(required(handlers, [
    'actorA: { searchObserved: false, matchFoundObserved: false',
    'actorB: { searchObserved: false, matchFoundObserved: false',
    'duello-search-screen',
    'duello-match-found-screen',
  ]), 'Mutation observers preserve same-screen search/match evidence on both actors.'), RUNTIME_FILES),

  make(RUNTIME_SUITE, 'duello_two_actor_direct_game_start', 'Two-actor E2E proves direct shared /duel start', () => sourceResult(required(handlers + duelArena, [
    "route === '/duel'",
    'sharedSessionFingerprintMatched',
    'sharedActiveCardFingerprintMatched',
    'data-kronox-duello-sequence',
  ]), 'Both contexts must reach /duel with matching anonymized session/card fingerprints.'), RUNTIME_FILES),

  make(RUNTIME_SUITE, 'duello_lobby_observed_is_fail', 'Any active Duello lobby observation fails E2E', () => sourceResult(required(handlers, [
    "routeHistoryA.some((route) => route === '/lobby' || route === '/LobbyRoom')",
    "routeHistoryB.some((route) => route === '/lobby' || route === '/LobbyRoom')",
    'LOBBY_STILL_PRESENT: Duello observed',
  ]), 'Route history and DOM observers fail the scenario if either lobby route appears.'), RUNTIME_FILES),

  make(RUNTIME_SUITE, 'duello_start_failure_has_precise_category', 'Duello E2E records only precise safe start categories', () => sourceResult(required(handlers + directHandoff + randomApi + randomBackend, [
    'data-matchmaking-error-category',
    '/^DUELLO_[A-Z_]+$/',
    'DUELLO_UNKNOWN_START_FAILURE',
    'DUELLO_DIRECT_START_PAYLOAD_MISSING',
    'SAFE_ERROR_SUFFIXES',
  ]), 'Terminal failures expose an allowlisted DUELLO_* category without raw transport details.'), RUNTIME_FILES),

  make(RUNTIME_SUITE, 'duello_retry_does_not_duplicate_queue', 'Duello retry cannot duplicate an active own row', () => sourceResult(required(randomHook + randomBackend, [
    'clearRetryWait()',
    'await cancelRandomMatchmaking(mode)',
    'duplicateWaitingRows',
    'createWaitingRow',
  ]), 'Client retry cleanup and backend own-row reconciliation prevent duplicate active waits.'), RUNTIME_FILES),

  make(RUNTIME_SUITE, 'duello_pollers_cleanup_on_cancel_retry_unmount', 'Duello pollers and retry timers clean up', () => sourceResult(required(randomHook, [
    'window.clearTimeout(pollRef.current)',
    'window.clearTimeout(retryWaitRef.current.id)',
    'stopPolling()',
    'mountedRef.current = false',
  ]), 'Cancel, retry, match, timeout, and unmount settle owned timers without overlap.'), RUNTIME_FILES),

  make(RUNTIME_SUITE, 'duello_public_snapshot_privacy', 'Two-actor E2E exports hashes and booleans only', () => sourceResult([
    ...required(handlers + harness, ['safeRuntimeFingerprint', 'assertPublicTextSafe(pageA)', 'assertPublicTextSafe(pageB)', 'sanitizeAutomationValue']),
    ...forbidden(handlers, ['authorityEvidence.sessionRefs', 'authorityEvidence.cardInputs']),
  ], 'Runtime evidence compares fingerprints locally and never exports raw session/card values.'), RUNTIME_FILES),

  make(RUNTIME_SUITE, 'online_no_lobby_contract_preserved', 'Online Kapış no-lobby proof remains active', () => sourceResult(required(handlers + navigation, [
    'active Online flow reached a lobby route',
    "runtime.safeRoute() === '/game'",
    "? '/duel?' : '/game?'",
  ]), 'The existing Online scenario still fails on lobby and requires direct /game.'), RUNTIME_FILES),

  make(RUNTIME_SUITE, 'full_run_excludes_e2e_after_duello_update', 'Duello update preserves Full Health and Runtime E2E separation', () => sourceResult(required(runtimeScenarios + simulationPanel, [
    'fullRunExcluded: true',
    "const runAll = () => runPack('full')",
    'if (runtimeAutomationSelected) return',
  ]), 'Runtime E2E remains a separate CLI gate and cannot run inside Full Health.'), RUNTIME_FILES),
];