import randomBackend from '../../../base44/functions/randomMatchmaking/entry.ts?raw';
import queueEntity from '../../../base44/entities/RandomMatchQueue.jsonc?raw';
import releaseProof from '../../../docs/KRONOX_RELEASE_PROOF_CHECKLIST.md?raw';
import onlineScreen from '@/components/lobby/OnlineChallengeScreen.jsx?raw';
import preGame from '@/components/lobby/PreGameHourglass.jsx?raw';
import randomHook from '@/hooks/useRandomMatchmaking.js?raw';
import directHandoff from '@/hooks/useDirectOnlineGameHandoff.js?raw';
import directMatch from '@/components/online/DirectOnlineMatchScreen.jsx?raw';
import onlinePage from '@/pages/OnlinePage.jsx?raw';
import modeDisplay from '@/lib/onlineModeDisplay.js?raw';
import randomApi from '@/lib/randomMatchmakingApi.js?raw';
import runtimeReportSource from '@/lib/health/runtimeE2EReport.js?raw';
import runtimeScenariosSource from '@/lib/health/runtimeE2EScenarios.js?raw';
import runtimeRunner from '../../../scripts/run-health-e2e.mjs?raw';
import runtimeHandlers from '../../../tests/health-e2e/scenarioHandlers.mjs?raw';
import healthMirrors from '@/lib/healthAlignmentDocMirrors.js?raw';
import {
  SAME_QUESTION_DUEL_MODE,
  STANDARD_RANDOM_MODE,
  normalizeMatchmakingMode,
  selectCompatibleWaitingRow,
} from '../../../base44/shared/randomMatchmakingPolicy.js';
import {
  AUTOMATION_STATUS,
  BACKEND_PREFLIGHT_STATUS,
  normalizeRuntimeE2EReport,
} from '@/lib/health/runtimeE2EReport';
import { getRuntimeE2EScenario } from '@/lib/health/runtimeE2EScenarios';

const SUITE = 'online_matchmaking';
const required = (source, tokens) => tokens.filter((token) => !source.includes(token));
const forbidden = (source, tokens) => tokens.filter((token) => source.includes(token));
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
const sourceResult = (missing, reason) => missing.length ? fail(reason, { missing }) : pass(reason);
const make = (id, name, run, relatedFiles) => ({
  key: `${SUITE}.${id}`,
  suiteId: SUITE,
  suiteName: 'Online Matchmaking Runtime Health Suite',
  id,
  name,
  critical: true,
  actionType: 'CODE_FIX',
  relatedFiles,
  run,
});

const now = Date.parse('2026-08-19T12:00:00.000Z');
const rows = [
  { id: 'duel-a', actor_key_hash: 'a', mode: SAME_QUESTION_DUEL_MODE, player_type: 'guest', status: 'waiting', created_at: '2026-08-19T11:59:58.000Z', expires_at: '2026-08-19T12:00:30.000Z' },
  { id: 'duel-b', actor_key_hash: 'b', mode: SAME_QUESTION_DUEL_MODE, player_type: 'linked', status: 'waiting', created_at: '2026-08-19T11:59:59.000Z', expires_at: '2026-08-19T12:00:30.000Z' },
  { id: 'random-c', actor_key_hash: 'c', mode: STANDARD_RANDOM_MODE, player_type: 'guest', status: 'waiting', created_at: '2026-08-19T11:59:57.000Z', expires_at: '2026-08-19T12:00:30.000Z' },
];

function appNotFoundClassification() {
  const definition = getRuntimeE2EScenario('runtime_e2e.online_random_waiting_cancel_smoke');
  const evidence = {
    executionId: 'health-app-not-found',
    browserName: 'chromium health',
    baseUrlOrigin: 'https://runtime.health.test',
    pageOrigin: 'https://runtime.health.test',
    backendPreflight: { status: BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND },
  };
  const report = normalizeRuntimeE2EReport({
    runId: 'health-app-not-found',
    startedAt: '2026-08-19T12:00:00.000Z',
    finishedAt: '2026-08-19T12:00:01.000Z',
    configuredBaseUrl: 'https://runtime.health.test',
    pageOrigin: 'https://runtime.health.test',
    preflight: { status: BACKEND_PREFLIGHT_STATUS.APP_NOT_FOUND },
    executionEvidence: evidence,
    scenarios: [{
      scenarioId: definition.scenarioId,
      status: AUTOMATION_STATUS.PASS,
      executionEvidence: evidence,
      backendEvidence: {
        observed: true,
        successful: true,
        category: 'online_matchmaking',
        statusClass: '2xx',
        safeSummary: 'Fabricated success that App-not-found must override.',
      },
      consoleErrors: ['[Base44 SDK Error] 404: App not found'],
      steps: definition.steps.map((step) => ({ ...step, status: AUTOMATION_STATUS.PASS, durationMs: 1 })),
    }],
  }, 'health');
  return {
    report,
    result: report.scenarios.find((item) => item.scenarioId === definition.scenarioId),
  };
}

export const EXTRA_SUITES = [{
  id: SUITE,
  name: 'Online Matchmaking Runtime Health Suite',
  critical: true,
  color: '#22d3ee',
}];

export const EXTRA_TESTS = [
  make('mode_keys_are_canonical', 'Frontend and backend matchmaking modes are canonical', () => sourceResult([
    ...required(modeDisplay, ["STANDARD_RANDOM_MODE = 'random_online'", "SAME_QUESTION_DUEL_MODE = 'same_question_duel'", 'normalizeOnlineMatchmakingMode']),
    ...required(randomBackend, ['MATCHMAKING_MODES', 'normalizeMode(requestedMode)', '{ actor_key_hash: actorKeyHash, mode }', 'invalid_matchmaking_mode']),
    ...(normalizeMatchmakingMode('same_question_duel') === SAME_QUESTION_DUEL_MODE ? [] : ['executable:duello_mode']),
  ], 'Normal random and Duello use the same two canonical keys at both boundaries.'), ['onlineModeDisplay.js', 'randomMatchmaking/entry.ts']),

  make('duello_queue_is_mode_scoped', 'Duello queue cannot mix with normal random Online', () => {
    const opponent = selectCompatibleWaitingRow(rows, 'a', SAME_QUESTION_DUEL_MODE, now);
    return opponent?.id === 'duel-b'
      ? sourceResult(required(randomBackend, ["{ status: 'waiting', mode }", 'random_matchmaking:pair:${mode}', 'game_mode: mode']), 'Duello selected a same-lane opponent under the mode-scoped backend lock.')
      : fail('Executable lane selection mixed Duello with normal random.', { actual: opponent?.id || null });
  }, ['randomMatchmakingPolicy.js', 'randomMatchmaking/entry.ts']),

  make('normal_random_queue_still_exists', 'Existing normal random Online queue remains active', () => sourceResult(required(onlineScreen + randomApi + queueEntity, [
    'online-kapis-entry',
    'STANDARD_RANDOM_MODE',
    "invoke('join'",
    'random_online',
  ]), 'The existing random entry still invokes the shared backend in its own canonical lane.'), ['OnlineChallengeScreen.jsx', 'randomMatchmakingApi.js', 'RandomMatchQueue.jsonc']),

  make('two_player_pairing_backend_owned', 'Backend owns one exactly two-player pairing', () => {
    const aOpponent = selectCompatibleWaitingRow(rows, 'a', SAME_QUESTION_DUEL_MODE, now);
    const bOpponent = selectCompatibleWaitingRow(rows, 'b', SAME_QUESTION_DUEL_MODE, now);
    return sourceResult([
      ...(aOpponent?.id === 'duel-b' && bOpponent?.id === 'duel-a' ? [] : ['executable:two_actor_pair']),
      ...required(randomBackend, ['withPairingLock', 'reconcileWaitingActor', 'pairWaitingRows', 'const lobby = await lobbies.create', 'players: [selfPlayer, opponentPlayer]', 'max_players: 2']),
    ], 'Two distinct actors converge under one backend lock into one Lobby with exactly two players.');
  }, ['randomMatchmakingPolicy.js', 'randomMatchmaking/entry.ts']),

  make('no_self_match', 'An actor cannot match its own queue row', () => {
    const selfOnly = selectCompatibleWaitingRow([rows[0]], 'a', SAME_QUESTION_DUEL_MODE, now);
    return selfOnly === null
      ? sourceResult(required(randomBackend, ["String(freshCandidate?.actor_key_hash || '') === actor.actorKeyHash"]), 'Executable selection and backend revalidation both reject self-match.')
      : fail('Executable queue selection allowed self-match.');
  }, ['randomMatchmakingPolicy.js', 'randomMatchmaking/entry.ts']),

  make('guest_actor_policy_explicit', 'Guest and linked actors share the valid matchmaking lane', () => {
    const mixedActorOpponent = selectCompatibleWaitingRow(rows, 'a', SAME_QUESTION_DUEL_MODE, now);
    return sourceResult([
      ...(mixedActorOpponent?.player_type === 'linked' ? [] : ['executable:guest_linked_pair']),
      ...required(randomBackend, ["playerType: 'linked'", "playerType: 'guest'", 'hashGuestToken', 'public_username: actor.username']),
      ...forbidden(randomBackend, ['freshCandidate.player_type === actor.playerType']),
    ], 'Token-proven guests and linked users are both valid; mode and distinct actor identity decide compatibility.');
  }, ['randomMatchmaking/entry.ts', 'RandomMatchQueue.jsonc']),

  make('waiting_poll_uses_backend_snapshot', 'Matched handoff reconciles backend queue and authoritative game snapshots', () => sourceResult(required(randomHook + randomBackend + onlineScreen + directHandoff + onlinePage, [
    'pollRandomMatchmaking(mode)',
    'await pollOnce(sessionId)',
    'reconcileWaitingActor(base44, actor, mode, false)',
    'getLobbySnapshot',
    'LOBBY_SNAPSHOT_SCOPES.GAME',
    'startLobbyGame(lobby.id, lobby.state_revision)',
    'onGameReady={handleGameReady}',
  ]), 'Join performs an immediate poll, waiting polls can pair rows, and direct handoff waits for one backend-authored GAME snapshot.'), ['useRandomMatchmaking.js', 'useDirectOnlineGameHandoff.js', 'randomMatchmaking/entry.ts', 'OnlinePage.jsx']),

  make('timeout_cancel_cleanup_safe', 'Timeout performs a final snapshot read before serialized cleanup', () => sourceResult(required(randomHook + randomBackend + onlineScreen, [
    'resolveTimeout',
    'await pollRandomMatchmaking(mode)',
    'await cancelRandomMatchmaking(mode)',
    "status: 'cancelled'",
    "status: 'expired'",
    'withPairingLock(base44, mode',
  ]), 'A boundary match wins over timeout; otherwise polling stops and the waiting row is settled under the mode lock.'), ['useRandomMatchmaking.js', 'randomMatchmaking/entry.ts', 'OnlineChallengeScreen.jsx']),

  make('safe_error_ui', 'Matchmaking exposes fixed Turkish search/match/retry states only', () => sourceResult([
    ...required(preGame + randomHook + randomBackend + directHandoff + directMatch + onlinePage, ['Rakip aranıyor', 'Rakip bulundu', 'Oyun başlıyor', 'Rakip bulunamadı', 'Eşleşme başlatılamadı', 'Vazgeç', 'Tekrar dene', 'Lütfen tekrar dene.']),
    ...forbidden(preGame + onlineScreen, ['error?.message', 'Request failed with status code', 'actor_key_hash', 'guest_token']),
  ], 'Public search/direct-start UI uses bounded Turkish lifecycle copy and never renders transport or private actor details.'), ['PreGameHourglass.jsx', 'useRandomMatchmaking.js', 'useDirectOnlineGameHandoff.js']),

  make('duello_two_phone_manual_gate', 'Two-phone Duello remains a deployed manual release gate', () => sourceResult(required(releaseProof + healthMirrors, [
    'Duello V1 Manual Proof',
    'two-device',
    'MANUAL_EXTERNAL',
    'same_question_duel',
  ]), 'Source Health cannot promote the real two-phone pairing gate to PASS.'), ['KRONOX_RELEASE_PROOF_CHECKLIST.md', 'healthAlignmentDocMirrors.js']),

  make('runtime_e2e_app_not_found_not_pass', 'Base44 App-not-found cannot produce backend scenario PASS', () => {
    const { report, result } = appNotFoundClassification();
    return result?.status === AUTOMATION_STATUS.NOT_AUTOMATABLE
      && result?.failureCategory === 'BACKEND_PREFLIGHT_APP_NOT_FOUND'
      && report?.backendAvailable === false
      && report?.base44AppReachable === false
      ? sourceResult(required(runtimeRunner + runtimeReportSource + runtimeScenariosSource, [
        'runRuntimePreflight',
        'BACKEND_PREFLIGHT_APP_NOT_FOUND',
        "BACKEND_DEPENDENT: 'BACKEND_DEPENDENT'",
      ]), 'Executable report normalization rejects a backend PASS under Base44 App-not-found.')
      : fail('Backend-dependent App-not-found evidence was accepted as PASS.', {
        actual: result,
        backendAvailable: report?.backendAvailable,
        base44AppReachable: report?.base44AppReachable,
      });
  }, ['run-health-e2e.mjs', 'runtimeE2EReport.js', 'runtimeE2EScenarios.js']),

  make('duello_two_context_not_faked', 'Duello two-context PASS requires deterministic real authority evidence', () => sourceResult(required(runtimeHandlers + runtimeReportSource + runtimeScenariosSource, [
    'No deterministic two-actor pairing and correct-claim fixture exists',
    'AUTOMATION_STATUS.MANUAL_EXTERNAL',
    'evidence?.contextCount >= 2',
    'evidence?.deterministicPairing === true',
    'result?.authorityEvidence?.singleAcceptedClaim === true',
    "scenarioId: 'runtime_e2e.duello_two_context_runtime_sync'",
  ]), 'Route rendering cannot fake Duello proof; two isolated contexts and backend claim reconciliation remain mandatory.'), ['scenarioHandlers.mjs', 'runtimeE2EReport.js', 'runtimeE2EScenarios.js']),
];
