import appSource from '../../App.jsx?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import onlinePageSource from '../../pages/OnlinePage.jsx?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import gameNavigationSource from '../../lib/onlineGameNavigation.js?raw';
import inviteApiSource from '../../lib/inviteApi.js?raw';
import notificationCenterSource from '../../hooks/useNotificationCenter.js?raw';
import headerNotificationsSource from '../../hooks/useHeaderNotifications.js?raw';
import incomingInvitesSource from '../invites/IncomingInvitesPanel.jsx?raw';
import onlineScreenSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import directMatchSource from '../online/DirectOnlineMatchScreen.jsx?raw';
import preGameSource from '../lobby/PreGameHourglass.jsx?raw';
import directHandoffSource from '../../hooks/useDirectOnlineGameHandoff.js?raw';
import randomHookSource from '../../hooks/useRandomMatchmaking.js?raw';
import randomApiSource from '../../lib/randomMatchmakingApi.js?raw';
import randomBackendSource from '../../../base44/functions/randomMatchmaking/entry.ts?raw';
import createInvitesBackendSource from '../../../base44/functions/createGameInvitesForTargets/entry.ts?raw';
import startLobbyGameSource from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import queueEntitySource from '../../../base44/entities/RandomMatchQueue.jsonc?raw';
import serviceWorkerSource from '../../../public/kronox-sw.js?raw';
import lobbyCodeGuardSource from '../../lib/lobbyCodeGuard.js?raw';
import navigationStackSource from '../../lib/NavigationStackContext.jsx?raw';
import runtimeScenariosSource from '../../lib/health/runtimeE2EScenarios.js?raw';
import runtimeReportSource from '../../lib/health/runtimeE2EReport.js?raw';
import runtimeHandlersSource from '../../../tests/health-e2e/scenarioHandlers.mjs?raw';
import runtimeHarnessSource from '../../../tests/health-e2e/runtimeHarness.mjs?raw';
import simulationPanelSource from './SimulationPanel.jsx?raw';
import { hasAuthoritativeOnlineGamePayload, MATCH_FOUND_DISPLAY_MS } from '../../hooks/useDirectOnlineGameHandoff';

const ONLINE_SUITE = 'online_flow';
const DUELLO_SUITE = 'duello_flow';
const RUNTIME_SUITE = 'runtime_e2e_automation';

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
const missing = (source, tokens) => tokens.filter((token) => !String(source || '').includes(token));
const present = (source, tokens) => tokens.filter((token) => String(source || '').includes(token));
const sourceContract = (source, required, reason, forbidden = []) => {
  const absent = missing(source, required);
  const foundForbidden = present(source, forbidden);
  return absent.length || foundForbidden.length
    ? fail(reason, { missing: absent, foundForbidden })
    : pass(reason);
};
const make = (suiteId, id, name, run, relatedFiles) => ({
  key: `${suiteId}.${id}`,
  suiteId,
  suiteName: suiteId === ONLINE_SUITE
    ? 'Online Direct Start Health Suite'
    : suiteId === DUELLO_SUITE
      ? 'Duello Direct Start Health Suite'
      : 'Runtime E2E Automation Framework Health Suite',
  id,
  name,
  critical: true,
  actionType: 'CODE_FIX',
  relatedFiles,
  run,
});

const LEGACY_SUITE_NAMES = Object.freeze({
  profile_navigation: 'Profile Navigation Suite',
  create_lobby_invite_gate: 'Create Lobby Invite Gate Suite',
  invite_expiration_health: 'Invite Expiration Health Suite',
  invite_contract_drift: 'Invite Flow Contract Drift Suite',
  game_invite_push_notifications: 'Game Invite Push Notification Readiness Suite',
  route_navigation_resilience: 'Route / Navigation Resilience Suite',
  online_lobby_setup: 'Online Lobby Setup Suite',
  game_invites: 'Game Invite Suite',
  online_category_taxonomy: 'Online Category Taxonomy Suite',
  lobby_code_ux: 'Lobby Code UX Suite',
  game_invite_lifecycle_v2: 'Game Invite Lifecycle V2 Suite',
  error_state_health: 'Error Empty Loading State Health Suite',
  logical_unique_guards: 'Logical Unique Guard Suite',
});

const legacyMake = (suiteId, id, name, run, relatedFiles, critical = true) => ({
  key: `${suiteId}.${id}`,
  suiteId,
  suiteName: LEGACY_SUITE_NAMES[suiteId] || suiteId,
  id,
  name,
  critical,
  actionType: 'CODE_FIX',
  relatedFiles,
  run,
});

const activeRouteSources = `${mainMenuSource}\n${onlinePageSource}\n${onlineScreenSource}\n${directMatchSource}\n${inviteApiSource}`;
const activeUiSources = `${mainMenuSource}\n${onlinePageSource}\n${onlineScreenSource}\n${directMatchSource}\n${preGameSource}`;
const directFlowSources = `${onlinePageSource}\n${onlineScreenSource}\n${directMatchSource}\n${directHandoffSource}\n${gameNavigationSource}`;
const runtimeSources = `${runtimeScenariosSource}\n${runtimeHandlersSource}\n${runtimeHarnessSource}\n${runtimeReportSource}`;

export const EXTRA_SUITES = [
  { id: ONLINE_SUITE, name: 'Online Direct Start Health Suite', critical: true, color: '#38bdf8' },
  { id: DUELLO_SUITE, name: 'Duello Direct Start Health Suite', critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  make(ONLINE_SUITE, 'no_active_lobby_route', 'Active Online and invite entry points use /online, never /lobby', () => sourceContract(
    `${appSource}\n${activeRouteSources}`,
    ["path=\"/online\"", "navigate('/online')", 'verifiedLobby'],
    'Home, Online, and accepted-invite entry points are owned by /online.',
    ["navigate('/lobby')", 'to="/lobby"'],
  ), ['src/App.jsx', 'src/pages/MainMenu.jsx', 'src/pages/OnlinePage.jsx', 'src/lib/inviteApi.js']),

  make(ONLINE_SUITE, 'no_lobby_screen_after_match', 'Matched flow cannot mount a waiting-room or active-lobby surface', () => sourceContract(
    directFlowSources,
    ['DirectOnlineMatchScreen', 'useDirectOnlineGameHandoff', 'onGameReady={handleGameReady}'],
    'A match remains on the direct transition surface until the game payload is ready.',
    ['WaitingRoomPanel', 'ActiveLobbyCard', 'LobbyCreateJoinPanel'],
  ), ['src/pages/OnlinePage.jsx', 'src/components/online/DirectOnlineMatchScreen.jsx']),

  make(ONLINE_SUITE, 'no_lobby_copy_visible', 'Active Online surfaces contain no visible Lobi copy', () => {
    const visibleLobbyCopy = /["'`>][^\n"'`<]*\bLobi\b/i.test(activeUiSources);
    return visibleLobbyCopy
      ? fail('A user-visible Lobi label remains in the active Online surface.')
      : pass('The active Online selection, search, match-found, and transition surfaces contain no Lobi copy.');
  }, ['src/pages/OnlinePage.jsx', 'src/components/lobby/OnlineChallengeScreen.jsx', 'src/components/online/DirectOnlineMatchScreen.jsx']),

  make(ONLINE_SUITE, 'legacy_lobby_route_not_active_flow', 'Legacy /lobby is redirect-only and cannot prove gameplay', () => sourceContract(
    `${appSource}\n${lobbyRoomSource}`,
    ['function LegacyLobbyRedirect()', "pathname: '/online'", 'replace', '<Navigate'],
    'Both legacy route aliases redirect to the canonical Online surface.',
    ['<WaitingRoomPanel', '<OnlineChallengeScreen'],
  ), ['src/App.jsx', 'src/pages/LobbyRoom.jsx']),

  make(ONLINE_SUITE, 'match_found_direct_game_start', 'Backend-authored match payload gates direct game start', () => {
    const valid = hasAuthoritativeOnlineGamePayload({
      id: 'public-match',
      status: 'in_game',
      players: [{ participant_ref: 'a' }, { participant_ref: 'b' }],
      current_question_id: 'public-question',
      online_question_deck: [{ id: 'public-question' }],
    });
    const invalid = hasAuthoritativeOnlineGamePayload({ id: 'public-match', status: 'waiting', players: [{}, {}] });
    const contract = sourceContract(directFlowSources, [
      'LOBBY_SNAPSHOT_SCOPES.GAME',
      'current_actor_is_host === true',
      'startLobbyGame(lobby.id, lobby.state_revision)',
      'hasAuthoritativeOnlineGamePayload(lobby)',
      'navigateToOnlineGame(navigate, lobby',
      'replace: true',
    ], 'Only a participant-specific backend GAME snapshot can trigger direct navigation.');
    return valid && !invalid && contract.status === 'PASS'
      ? pass('Executable payload validation rejects waiting/incomplete state and accepts one authoritative started match.')
      : fail('Direct start can bypass the authoritative match payload gate.', { valid, invalid, contract });
  }, ['src/hooks/useDirectOnlineGameHandoff.js', 'src/pages/OnlinePage.jsx', 'src/lib/onlineGameNavigation.js']),

  make(ONLINE_SUITE, 'online_kapis_search_state_visible', 'Online Kapış exposes the bounded 30-second search state', () => sourceContract(
    `${onlineScreenSource}\n${preGameSource}`,
    ['testId="online-kapis-entry"', 'testId="online-kapis-search-screen"', '30 saniye içinde eşleşme aranıyor.', 'Rakip aranıyor', 'durationMs={30 * 1000}', 'Vazgeç'],
    'Online Kapış renders the approved search state and cancel action.',
  ), ['src/components/lobby/OnlineChallengeScreen.jsx', 'src/components/lobby/PreGameHourglass.jsx']),

  make(ONLINE_SUITE, 'online_kapis_start_returns_2xx_or_searching', 'A valid Online Kapış start becomes a successful waiting/search response', () => sourceContract(
    `${randomBackendSource}\n${randomHookSource}\n${randomApiSource}`,
    ['ok: true', 'attemptCandidatePairing', 'candidateFound: false', 'lockAttempted: false', "type: 'SEARCH_STARTED'", 'matchmakingStatusClass'],
    'A valid lone actor receives backend waiting state and the client enters searching without lock churn.',
  ), ['base44/functions/randomMatchmaking/entry.ts', 'src/hooks/useRandomMatchmaking.js', 'src/lib/randomMatchmakingApi.js']),

  make(ONLINE_SUITE, 'online_kapis_no_opponent_is_searching_not_failed', 'No available Online Kapış opponent remains searching', () => sourceContract(
    `${randomBackendSource}\n${randomHookSource}\n${preGameSource}`,
    ['if (!candidate)', 'candidateFound: false', 'lockAttempted: false', "status: matched ? 'matched' : 'waiting'", 'return MATCHMAKING_PHASE.SEARCHING', 'Rakip aranıyor'],
    'An empty compatible queue is represented as waiting/searching, never as a start failure.',
  ), ['base44/functions/randomMatchmaking/entry.ts', 'src/hooks/useRandomMatchmaking.js', 'src/components/lobby/PreGameHourglass.jsx']),

  make(ONLINE_SUITE, 'online_kapis_backend_5xx_is_not_hidden', 'Online Kapış preserves genuine backend 5xx classification', () => sourceContract(
    `${randomBackendSource}\n${randomApiSource}\n${randomHookSource}`,
    ["statusClass: permissionDenied ? '4xx' : '5xx'", 'matchmakingStatusClass', "type: 'FAILED'", 'NETWORK_FAILURE'],
    'Server failures retain safe 5xx/error classification and cannot be reported as a successful queue start.',
  ), ['base44/functions/randomMatchmaking/entry.ts', 'src/lib/randomMatchmakingApi.js', 'src/hooks/useRandomMatchmaking.js']),

  make(ONLINE_SUITE, 'online_kapis_permission_denied_is_not_hidden', 'Online Kapış preserves product-critical permission failures', () => sourceContract(
    `${randomBackendSource}\n${randomApiSource}`,
    ['PERMISSION_DENIED', 'permissionDenied ? 403', "fallbackSuffix = status === 401 || status === 403", 'matchmakingErrorCategory'],
    'Actor/RLS denial remains a safe terminal permission category rather than waiting or optional telemetry.',
  ), ['base44/functions/randomMatchmaking/entry.ts', 'src/lib/randomMatchmakingApi.js']),

  make(ONLINE_SUITE, 'online_kapis_match_found_same_screen', 'Online Kapış shows Rakip bulundu on the same transition surface', () => sourceContract(
    `${onlinePageSource}\n${onlineScreenSource}\n${directMatchSource}\n${preGameSource}`,
    ['onMatchFound', 'setMatch(nextMatch)', 'testId={isDuello ? \'duello-match-found-screen\' : \'online-match-found-screen\'}', "phase === 'matched' || phase === 'directStarting'", "? 'Rakip bulundu'", 'Oyun başlıyor'],
    'Match-found is a phase of the same /online search experience, not a new lobby.',
  ), ['src/pages/OnlinePage.jsx', 'src/components/online/DirectOnlineMatchScreen.jsx', 'src/components/lobby/PreGameHourglass.jsx']),

  make(ONLINE_SUITE, 'online_kapis_direct_game_after_match', 'Online Kapış navigates directly to /game after the bounded matched phase', () => sourceContract(
    `${directHandoffSource}\n${gameNavigationSource}`,
    ['export const MATCH_FOUND_DISPLAY_MS = 1000', 'MATCH_FOUND_DISPLAY_MS - (Date.now() - matchedAt)', "const routePrefix = lobby?.game_mode === 'same_question_duel' ? '/duel?' : '/game?'", 'onGameReadyRef.current?.(lobby'],
    'Online Kapış keeps the approved 800-1500ms matched phase and then enters /game.',
  ), ['src/hooks/useDirectOnlineGameHandoff.js', 'src/lib/onlineGameNavigation.js']),

  make(ONLINE_SUITE, 'online_kapis_cancel_cleans_own_queue', 'Online Kapış cancel settles only the caller queue before returning to selection', () => sourceContract(
    `${onlineScreenSource}\n${directMatchSource}\n${randomHookSource}\n${randomApiSource}\n${randomBackendSource}`,
    ['const cancelled = await random.cancel()', 'if (!cancelled) return', "await cancelRandomMatchmaking(mode, 'cancel')", "data?.status === 'matched'", 'cancelled: false', 'publicQueueState(row,', 'await consumeRandomMatchmaking(match.queueMode)', "invoke('cancel'", "invoke('consume'", "status: 'cancelled'", "status: 'consumed'", 'withPairingLock(base44, mode'],
    'Pre-match cancel is serialized, a concurrent match is reconciled instead of orphaned, and post-match error exit consumes its queue row.',
  ), ['src/components/lobby/OnlineChallengeScreen.jsx', 'src/components/online/DirectOnlineMatchScreen.jsx', 'src/hooks/useRandomMatchmaking.js', 'base44/functions/randomMatchmaking/entry.ts']),

  make(ONLINE_SUITE, 'online_kapis_retry_cleans_stale_attempt', 'Online Kapış retry confirms own stale-attempt cleanup before rejoin', () => sourceContract(
    `${randomHookSource}\n${randomApiSource}\n${randomBackendSource}`,
    ["cancelRandomMatchmaking(mode, 'retry')", "cleanup_reason: ['cancel', 'retry', 'timeout']", "queueAction = cleanupReason === 'retry'", 'retryCleanupObserved', 'duplicateWaitingRows'],
    'Retry is actor/mode scoped, idempotent, and cannot create a second active waiting row.',
  ), ['src/hooks/useRandomMatchmaking.js', 'src/lib/randomMatchmakingApi.js', 'base44/functions/randomMatchmaking/entry.ts']),

  make(ONLINE_SUITE, 'online_kapis_no_lobby', 'Online Kapış search, match-found, and direct start preserve no-lobby flow', () => sourceContract(
    `${directFlowSources}\n${runtimeHandlersSource}`,
    ['online-kapis-search-screen', 'online-match-found-screen', "runtime.safeRoute() === '/game'", 'LOBBY_STILL_PRESENT'],
    'Online Kapış remains /online search to same-screen match-found to direct /game.',
    ["navigate('/lobby')", 'WaitingRoomPanel'],
  ), ['src/components/lobby/OnlineChallengeScreen.jsx', 'src/components/online/DirectOnlineMatchScreen.jsx', 'tests/health-e2e/scenarioHandlers.mjs']),

  make(ONLINE_SUITE, 'online_kapis_timeout_safe_copy', 'Online timeout exposes safe retry copy and expires stale queue state', () => {
    const contract = sourceContract(
      `${preGameSource}\n${randomHookSource}\n${randomBackendSource}`,
      ['Rakip bulunamadı', 'Tekrar dene', "type: 'TIMED_OUT'", "status: 'expired'", "status: 'timeout'"],
      'Timeout has bounded Turkish recovery copy and an expired backend queue state.',
    );
    const rawUiError = present(`${preGameSource}\n${randomHookSource}`, ['Request failed with status code', 'error?.message']);
    return contract.status === 'PASS' && !rawUiError.length
      ? pass('Timeout has bounded Turkish recovery copy and an expired backend queue state.')
      : fail('Timeout copy or backend cleanup drifted.', { contract, foundForbidden: rawUiError });
  }, ['src/components/lobby/PreGameHourglass.jsx', 'src/hooks/useRandomMatchmaking.js', 'base44/functions/randomMatchmaking/entry.ts']),

  make(DUELLO_SUITE, 'duello_search_state_visible', 'Duello exposes its mode-scoped 30-second search state', () => sourceContract(
    onlineScreenSource,
    ['testId="duello-entry"', 'testId="duello-search-screen"', '30 saniye içinde Duello rakibi aranıyor.', 'SAME_QUESTION_DUEL_MODE', 'duel.start()'],
    'Duello uses the shared bounded search surface in its own queue lane.',
  ), ['src/components/lobby/OnlineChallengeScreen.jsx']),

  make(DUELLO_SUITE, 'duello_match_found_same_screen', 'Duello shows Rakip bulundu before direct navigation', () => sourceContract(
    `${onlineScreenSource}\n${directMatchSource}\n${preGameSource}`,
    ["source: match.mode === SAME_QUESTION_DUEL_MODE ? 'duello' : 'online_kapis'", "testId={isDuello ? 'duello-match-found-screen'", 'Rakip bulundu', 'Oyun başlıyor'],
    'Duello uses the same match-found transition surface without a ready room.',
  ), ['src/components/lobby/OnlineChallengeScreen.jsx', 'src/components/online/DirectOnlineMatchScreen.jsx']),

  make(DUELLO_SUITE, 'duello_direct_game_after_match', 'Duello enters /duel from one authoritative shared session', () => sourceContract(
    `${directHandoffSource}\n${gameNavigationSource}`,
    ['LOBBY_SNAPSHOT_SCOPES.GAME', "lobby?.game_mode === 'same_question_duel' ? '/duel?' : '/game?'", 'current_question_id', 'online_question_deck.length > 0'],
    'Duello direct start waits for one backend-authored active shared card before /duel.',
  ), ['src/hooks/useDirectOnlineGameHandoff.js', 'src/lib/onlineGameNavigation.js']),

  make(DUELLO_SUITE, 'duello_no_lobby', 'Duello active flow has no lobby route, UI, or manual start', () => sourceContract(
    directFlowSources,
    ['duello-match-found-screen', "game_mode === 'same_question_duel' ? '/duel?'"],
    'Duello transitions from search to match-found to /duel only.',
    ["navigate('/lobby')", 'WaitingRoomPanel', 'Hazırım', 'Manuel Başlat'],
  ), ['src/pages/OnlinePage.jsx', 'src/components/online/DirectOnlineMatchScreen.jsx', 'src/lib/onlineGameNavigation.js']),

  make(DUELLO_SUITE, 'duello_two_actor_proof_still_manual_without_fixtures', 'Duello cannot PASS without two isolated deterministic actors', () => sourceContract(
    runtimeSources,
    ['AUTOMATION_STATUS.MANUAL_EXTERNAL', 'KRONOX_E2E_STORAGE_STATE_A and KRONOX_E2E_STORAGE_STATE_B', "'TWO_ACTOR_REQUIRED'", 'twoIsolatedActors', 'deterministicResultFixture'],
    'Duello remains MANUAL_EXTERNAL without two isolated actors; full result/rematch proof stays optional and separate.',
  ), ['src/lib/health/runtimeE2EScenarios.js', 'tests/health-e2e/scenarioHandlers.mjs']),

  make(RUNTIME_SUITE, 'online_no_lobby_route_for_pass', 'Runtime Online PASS excludes every lobby route and surface', () => sourceContract(
    runtimeSources,
    ["route === '/lobby' || route === '/LobbyRoom'", "fail('LOBBY_STILL_PRESENT:", "'LOBBY_STILL_PRESENT'", 'lobbyRouteObserved'],
    'Runtime E2E records and rejects lobby route evidence.',
  ), ['tests/health-e2e/scenarioHandlers.mjs', 'src/lib/health/runtimeE2EScenarios.js']),

  make(RUNTIME_SUITE, 'online_lobby_observed_after_match_is_fail', 'A lobby observed after pairing is a named Runtime E2E failure', () => sourceContract(
    runtimeHandlersSource,
    ['evidence.lobbyRouteObserved ||= lobbyRouteObserved', 'evidence.lobbyScreenObserved ||= lobbyScreenObserved', "fail('LOBBY_STILL_PRESENT:", "'LOBBY_STILL_PRESENT'"],
    'Route and DOM lobby observations produce LOBBY_STILL_PRESENT, never PASS.',
  ), ['tests/health-e2e/scenarioHandlers.mjs']),

  make(RUNTIME_SUITE, 'online_match_found_same_screen_required', 'Runtime proof requires the same-screen matched selector and copy', () => sourceContract(
    runtimeSources,
    ['online-match-found-screen', "text.includes('Rakip bulundu')", "text.includes('Oyun başlıyor')", 'matchFoundObserved'],
    'Runtime E2E cannot skip the approved same-screen Rakip bulundu phase.',
  ), ['src/lib/health/runtimeE2EScenarios.js', 'tests/health-e2e/scenarioHandlers.mjs']),

  make(RUNTIME_SUITE, 'online_direct_game_start_required_or_precise_gap', 'Runtime Online requires /game or a precise direct-start gap', () => sourceContract(
    runtimeSources,
    ["runtime.safeRoute() === '/game'", 'directGameStartObserved', 'MATCH_FOUND_DIRECT_GAME_PENDING', 'TWO_ACTOR_REQUIRED', 'BACKEND_RUNTIME_RESPONSE_NOT_OBSERVED', 'PERMISSION_DENIED'],
    'Online direct start is proven by game root plus backend evidence or reports a precise setup/runtime gap.',
  ), ['tests/health-e2e/scenarioHandlers.mjs', 'src/lib/health/runtimeE2EScenarios.js']),

  make(RUNTIME_SUITE, 'duello_no_lobby_contract_manual_external', 'Duello manual proof explicitly requires no lobby and direct /duel', () => sourceContract(
    runtimeScenariosSource,
    ['Both contexts show Rakip bulundu on the same search screen and enter /duel directly without /lobby.', 'MANUAL_EXTERNAL', 'two isolated actors'],
    'Duello external proof includes the no-lobby/direct-start product contract.',
  ), ['src/lib/health/runtimeE2EScenarios.js']),

  make(RUNTIME_SUITE, 'route_visibility_backend_gate_source_contract', 'Route visibility source contract requires backend-dependent proof', () => sourceContract(
    `${runtimeHandlersSource}\n${runtimeReportSource}`,
    ['requireSuccessfulBackendAction', 'backendMatchEvidence', 'result?.backendEvidence?.successful === true', 'BACKEND_PREFLIGHT_APP_NOT_FOUND'],
    'Runtime normalization and Online handler both require real backend evidence.',
  ), ['tests/health-e2e/scenarioHandlers.mjs', 'src/lib/health/runtimeE2EReport.js']),

  make(RUNTIME_SUITE, 'full_run_e2e_separation_source_contract', 'Full Health source contract excludes Runtime E2E automation', () => sourceContract(
    `${simulationPanelSource}\n${runtimeScenariosSource}`,
    ["const runAll = () => runPack('full')", 'if (runtimeAutomationSelected) return', 'fullRunExcluded: true', 'externalAutomation: true'],
    'Runtime browser automation remains a separate explicit run and report.',
  ), ['src/components/game/SimulationPanel.jsx', 'src/lib/health/runtimeE2EScenarios.js']),

  make(ONLINE_SUITE, 'match_found_no_private_identity_leak', 'Match-found UI and evidence expose no private identity fields', () => {
    const publicSurface = `${directMatchSource}\n${preGameSource}\n${directHandoffSource}`;
    const privateTokens = ['email', 'provider_id', 'owner_key', 'raw_guest_id', 'guest_token', 'actor_key_hash', 'player_key', 'auth_id'];
    const leaked = present(publicSurface.toLowerCase(), privateTokens);
    return leaked.length
      ? fail('Private identity keys reached the match-found surface or its public evidence.', { foundForbidden: leaked })
      : pass('Match-found renders only mode/status copy and a bounded safe evidence object.');
  }, ['src/components/online/DirectOnlineMatchScreen.jsx', 'src/hooks/useDirectOnlineGameHandoff.js']),

  make(ONLINE_SUITE, 'no_raw_backend_error_on_search_timeout', 'Search timeout and handoff failure never render raw backend errors', () => sourceContract(
    `${onlineScreenSource}\n${preGameSource}\n${directMatchSource}\n${directHandoffSource}`,
    ['Rakip bulunamadı', 'Eşleşme başlatılamadı', 'Lütfen tekrar dene.'],
    'All public search/handoff failures use fixed Turkish copy.',
    ['error.message', 'error?.message', 'response.data.error', 'Request failed with status code', 'stack'],
  ), ['src/components/lobby/OnlineChallengeScreen.jsx', 'src/components/lobby/PreGameHourglass.jsx', 'src/hooks/useDirectOnlineGameHandoff.js']),

  make(ONLINE_SUITE, 'no_question_bank_leak_before_game', 'Search and match-found surfaces receive no question bank or answers', () => {
    const preGamePublicSurface = `${onlineScreenSource}\n${directMatchSource}\n${preGameSource}`;
    const leaked = present(preGamePublicSurface, ['online_question_deck', 'used_question_ids', 'answer_year', 'correct_answer', 'getQuestions']);
    const backendGate = missing(directHandoffSource, ['LOBBY_SNAPSHOT_SCOPES.GAME', 'hasAuthoritativeOnlineGamePayload']);
    return leaked.length || backendGate.length
      ? fail('Question/deck data can reach the pre-game public surface or bypass the backend game-payload gate.', { foundForbidden: leaked, missing: backendGate })
      : pass('Search and match-found UI receive no deck/answer props; game data is read only for the authoritative direct-start gate.');
  }, ['src/components/lobby/OnlineChallengeScreen.jsx', 'src/components/online/DirectOnlineMatchScreen.jsx', 'src/hooks/useDirectOnlineGameHandoff.js']),
];

// These existing case ids predate direct start. The registry replaces them
// one-for-one so suite totals and severity stay stable while their original
// identity, invite, expiry, routing, and uniqueness protections remain active.
export const LEGACY_OVERRIDDEN_CASE_KEYS = new Set([
  'profile_navigation.online_and_solo_intact',
  'create_lobby_invite_gate.error_state_surfaced',
  'invite_expiration_health.notification_deep_link_handles_expired_invite',
  'invite_contract_drift.accept_invite_existing_lobby_path',
  'game_invite_push_notifications.notification_click_target_is_same_origin',
  'route_navigation_resilience.notification_invite_link_bootstraps_lobby_route',
  'online_lobby_setup.authenticated_user_identity_used',
  'game_invites.invites_created_after_lobby',
  'invite_contract_drift.create_lobby_creates_invites_after_lobby',
  'online_category_taxonomy.online_screen_uses_current_metadata_and_retry',
  'online_category_taxonomy.selected_category_ids_forwarded_to_lobby',
  'route_navigation_resilience.lobby_create_join_modes_static',
  'lobby_code_ux.acik_lobiye_gir_preserved',
  'game_invite_lifecycle_v2.game_invite_open_shared_action',
  'game_invite_lifecycle_v2.game_invite_accept_navigates_lobby',
  'route_navigation_resilience.profile_and_home_route_ownership_uses_parent_back_state',
  'error_state_health.online_social_failure_is_local',
  'error_state_health.online_empty_players_not_global_error',
  'logical_unique_guards.lobby_code_unique_guard',
]);

export const LEGACY_OVERRIDE_TESTS = [
  legacyMake('profile_navigation', 'online_and_solo_intact',
    'Home keeps Solo direct play and Online Kapış entry intact', () => sourceContract(
      `${mainMenuSource}\n${appSource}\n${onlinePageSource}`,
      ["navigate('/game', { state: { ...buildSoloGameConfigForLevel", "navigate('/online')", 'path="/online"', '<OnlineChallengeScreen'],
      'Home still owns independent Solo and Online entry points after lobby removal.',
      ["navigate('/lobby')"],
    ), ['src/pages/MainMenu.jsx', 'src/App.jsx', 'src/pages/OnlinePage.jsx']),

  legacyMake('create_lobby_invite_gate', 'error_state_surfaced',
    'Friend-match creation failure is recoverable and cleans its private session', () => sourceContract(
      `${onlinePageSource}\n${onlineScreenSource}`,
      ['Davet gönderilemedi. Lütfen tekrar dene.', 'setScreenError', 'if (created?.id) await leaveLobby(created.id).catch(() => null)', '<KronoxStatePanel'],
      'Invite creation keeps a safe local error and best-effort private-session cleanup.',
      ['error.message', 'Request failed with status code'],
    ), ['src/pages/OnlinePage.jsx', 'src/components/lobby/OnlineChallengeScreen.jsx']),

  legacyMake('invite_expiration_health', 'notification_deep_link_handles_expired_invite',
    'Notification deep link rejects expired invites on the canonical Online route', () => sourceContract(
      `${onlinePageSource}\n${appSource}`,
      ['queryInviteId', 'isGameInviteExpired', 'Davetin süresi doldu. Yeni bir davet iste.', 'DirectInvitePanel', "navigate('/online'", 'path="/online"'],
      'Expired invite deep links stay on the direct Online surface with safe copy.',
      ["navigate('/lobby')"],
    ), ['src/pages/OnlinePage.jsx', 'src/App.jsx']),

  legacyMake('invite_contract_drift', 'accept_invite_existing_lobby_path',
    'Accepted invite uses the shared action and canonical direct Online handoff', () => sourceContract(
      `${notificationCenterSource}\n${inviteApiSource}\n${onlinePageSource}`,
      ['openNotificationCenterGameInvite', 'openGameInviteAction', "navigate('/online'", 'joinedLobby', 'verifiedLobby', '<DirectOnlineMatchScreen'],
      'Invite acceptance preserves verified/joined backend state and enters direct start.',
      ["navigate('/lobby')"],
    ), ['src/hooks/useNotificationCenter.js', 'src/lib/inviteApi.js', 'src/pages/OnlinePage.jsx']),

  legacyMake('game_invite_push_notifications', 'notification_click_target_is_same_origin',
    'Push notification click is same-origin and targets the canonical Online route', () => sourceContract(
      serviceWorkerSource,
      ['resolveSameOriginTarget', 'target.origin !== self.location.origin', "targetUrl || '/online'", 'client.navigate(target)', 'self.clients.openWindow(target)'],
      'Push clicks reject cross-origin targets and fall back to /online.',
      ['/lobby'],
    ), ['public/kronox-sw.js'], false),

  legacyMake('route_navigation_resilience', 'notification_invite_link_bootstraps_lobby_route',
    'Notification inviteId bootstraps the canonical Online direct-start route', () => sourceContract(
      `${onlinePageSource}\n${appSource}`,
      ['queryInviteId', 'DirectInvitePanel', 'acceptGameInvite', "navigate('/online', { replace: true", 'joinedLobby', 'verifiedLobby'],
      'Invite deep links resolve on /online and preserve backend verification state.',
      ["navigate('/lobby'"],
    ), ['src/pages/OnlinePage.jsx', 'src/App.jsx']),

  legacyMake('online_lobby_setup', 'authenticated_user_identity_used',
    'Direct Online matchmaking resolves current guest or linked actor identity', () => sourceContract(
      `${onlinePageSource}\n${randomApiSource}\n${randomBackendSource}`,
      ['const actor = user || completedGuest', 'isGuestOnboardingComplete', 'deriveDisplayName(user)', 'withActorProof', 'getStoredGuestCredentials', 'resolveOnlineActor'],
      'Direct Online supports completed guests and linked users through backend actor proof.',
    ), ['src/pages/OnlinePage.jsx', 'src/lib/randomMatchmakingApi.js', 'base44/functions/randomMatchmaking/entry.ts']),

  legacyMake('game_invites', 'invites_created_after_lobby',
    'Friend invite rows are created only after the private match session exists', () => {
      const createIndex = onlinePageSource.indexOf('const response = await createLobby');
      const sessionIndex = onlinePageSource.indexOf('created = response?.data?.lobby');
      const inviteIndex = onlinePageSource.indexOf('const summary = await createGameInvites');
      const contract = sourceContract(`${onlinePageSource}\n${inviteApiSource}`,
        ['host: actor', 'lobby: created', 'inviteTargets: selectedTargets', 'playerCount: 2', 'target_refs: unique'],
        'Friend invite creation retains backend-owned target refs and a two-player session.');
      return createIndex >= 0 && sessionIndex > createIndex && inviteIndex > sessionIndex && contract.status === 'PASS'
        ? pass('The private session is created first, then one backend-owned invite row is requested.')
        : fail('Friend invite ordering or target-ref ownership drifted.', { createIndex, sessionIndex, inviteIndex, contract });
    }, ['src/pages/OnlinePage.jsx', 'src/lib/inviteApi.js']),

  legacyMake('invite_contract_drift', 'create_lobby_creates_invites_after_lobby',
    'Friend-match invite ordering and opaque target-ref contract remain backend-owned', () => sourceContract(
      `${onlinePageSource}\n${inviteApiSource}\n${createInvitesBackendSource}`,
      ['const response = await createLobby', 'const summary = await createGameInvites', 'target_refs: unique', 'normalizeTargetRefs', 'resolveInviteActor', 'player_count'],
      'Direct friend matching creates the private session before normalized backend invite rows.',
    ), ['src/pages/OnlinePage.jsx', 'src/lib/inviteApi.js', 'base44/functions/createGameInvitesForTargets/entry.ts']),

  legacyMake('online_category_taxonomy', 'online_screen_uses_current_metadata_and_retry',
    'Online selection uses the current all-active-category contract', () => sourceContract(
      onlineScreenSource,
      ['label="Online Kapış"', 'label={DUELLO_DISPLAY_NAME}', 'const random = useRandomMatchmaking(STANDARD_RANDOM_MODE)', 'onRetry'],
      'Online exposes its current modes and retry surfaces without a category selector.',
      ['selectedCategories', 'CategoryCarousel', 'veya kodla katıl'],
    ), ['src/components/lobby/OnlineChallengeScreen.jsx']),

  legacyMake('online_category_taxonomy', 'selected_category_ids_forwarded_to_lobby',
    'Direct Online ignores Solo category preferences and starts from all active categories', () => sourceContract(
      `${onlineScreenSource}\n${randomBackendSource}\n${startLobbyGameSource}`,
      ['selected_category_ids: []', 'selectedCategoriesOnly: false', 'allCategoriesRandom: true', 'return Array.from(activeMainCategoryIds)'],
      'The private match session carries no client category choice and backend start uses all active categories.',
      ['selectedCategories: [...selectedCategories]', 'selectedCategoriesOnly: true'],
    ), ['src/components/lobby/OnlineChallengeScreen.jsx', 'base44/functions/randomMatchmaking/entry.ts', 'base44/functions/startLobbyGame/entry.ts']),

  legacyMake('route_navigation_resilience', 'lobby_create_join_modes_static',
    'Canonical /online owns selection and direct start; legacy lobby aliases redirect only', () => sourceContract(
      `${appSource}\n${onlinePageSource}\n${lobbyRoomSource}`,
      ['path="/online"', '<OnlineChallengeScreen', '<DirectOnlineMatchScreen', 'function LegacyLobbyRedirect()', "pathname: '/online'", '<Navigate'],
      'Route ownership matches the no-lobby product journey.',
      ['<WaitingRoomPanel', '<LobbyCreateJoinPanel'],
    ), ['src/App.jsx', 'src/pages/OnlinePage.jsx', 'src/pages/LobbyRoom.jsx']),

  legacyMake('lobby_code_ux', 'acik_lobiye_gir_preserved',
    'Join-by-code UI is retired from the active Online journey', () => sourceContract(
      `${onlinePageSource}\n${onlineScreenSource}\n${lobbyRoomSource}`,
      ['<OnlineChallengeScreen', '<DirectOnlineMatchScreen', "pathname: '/online'", '<Navigate'],
      'The legacy route redirects and active Online has no join-code step.',
      ['AÇIK LOBİYE GİR', 'veya kodla katıl', '<LobbyCreateJoinPanel'],
    ), ['src/pages/OnlinePage.jsx', 'src/components/lobby/OnlineChallengeScreen.jsx', 'src/pages/LobbyRoom.jsx'], false),

  legacyMake('game_invite_lifecycle_v2', 'game_invite_open_shared_action',
    'Header invite open uses the shared action and canonical Online handoff', () => sourceContract(
      `${headerNotificationsSource}\n${notificationCenterSource}\n${inviteApiSource}`,
      ['openNotificationCenterGameInvite', 'openGameInviteAction', "source: 'header_notifications'", "navigate('/online'", 'verifiedLobby'],
      'Header invite acceptance uses shared lifecycle state before direct start.',
      ["navigate('/lobby'"],
    ), ['src/hooks/useNotificationCenter.js', 'src/lib/inviteApi.js']),

  legacyMake('game_invite_lifecycle_v2', 'game_invite_accept_navigates_lobby',
    'Incoming invite acceptance enters direct Online handoff with verified backend state', () => sourceContract(
      `${incomingInvitesSource}\n${notificationCenterSource}\n${inviteApiSource}`,
      ['openNotificationCenterGameInvite', "source: 'online_pending_panel'", "navigate('/online'", 'joinedLobby', 'verifiedLobby'],
      'Incoming invite acceptance closes the notification and enters /online direct start.',
      ["navigate('/lobby'"],
    ), ['src/components/invites/IncomingInvitesPanel.jsx', 'src/hooks/useNotificationCenter.js', 'src/lib/inviteApi.js']),

  legacyMake('route_navigation_resilience', 'profile_and_home_route_ownership_uses_parent_back_state',
    'Tab route ownership keeps Online and legacy redirect aliases under Home', () => sourceContract(
      navigationStackSource,
      ["if (pathname === '/online' || pathname === '/lobby') return TAB_ROOTS.home;", "['/profile', '/profile/edit', '/friends', '/settings', '/admin', '/test-suite', '/account-deletion']", 'createParentRouteState', 'getProfileParentRouteState'],
      'Online belongs to the Home stack while Profile subpages retain parent-back state.',
    ), ['src/lib/NavigationStackContext.jsx']),

  legacyMake('error_state_health', 'online_social_failure_is_local',
    'Online social failure stays local while Online Kapış remains available', () => sourceContract(
      onlineScreenSource,
      ['label="Online Kapış"', 'const ctaDisabledRandom = loading || creating;', '<FriendSelectModal', '<KronoxStatePanel'],
      'Friend-list failure cannot disable random Online matching.',
    ), ['src/components/lobby/OnlineChallengeScreen.jsx'], false),

  legacyMake('error_state_health', 'online_empty_players_not_global_error',
    'An empty friend list does not remove Online Kapış or Duello', () => sourceContract(
      onlineScreenSource,
      ['label="Online Kapış"', 'label={DUELLO_DISPLAY_NAME}', 'onClick={handleStartRandom}', 'onClick={handleStartDuel}'],
      'Random modes remain independent from the optional friend-selection list.',
    ), ['src/components/lobby/OnlineChallengeScreen.jsx'], false),

  legacyMake('logical_unique_guards', 'lobby_code_unique_guard',
    'Private friend-match session codes keep the server-side uniqueness guard', () => sourceContract(
      `${lobbyCodeGuardSource}\n${onlinePageSource}`,
      ['export async function generateUniqueLobbyCode', 'isLobbyCodeTaken', "invoke('findLobbyByCode'", 'LOBBY_CODE_MAX_ATTEMPTS', 'const code = await generateUniqueLobbyCode()', 'createLobby({ code, playerName, maxPlayers: 2 })'],
      'The remaining private backend session path still checks code collisions before create.',
    ), ['src/lib/lobbyCodeGuard.js', 'src/pages/OnlinePage.jsx']),
];

export const ONLINE_DIRECT_START_HEALTH_CONTRACT = Object.freeze({
  matchFoundDisplayMs: MATCH_FOUND_DISPLAY_MS,
  requiredCaseCount: 25,
  actualCaseCount: EXTRA_TESTS.length,
  queueTerminalStates: Object.freeze(['cancelled', 'expired', 'consumed']),
  queueEntitySupportsConsumed: queueEntitySource.includes('"consumed"'),
});
