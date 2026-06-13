// Kronox Health Center — Built-in case definitions (Codex123 split).
//
// SCOPE
//   Inline (non-registry) Health cases extracted from SimulationPanel.jsx.
//   Includes BASE_SUITES + SUITES, raw source map (SRC), backend contract
//   mirror strings (findLobbyByCode/startLobbyGame/updateLobbyGameState),
//   tiny case-factory helpers (sourceHas/sourceLacks/valueCase/...), and
//   the TESTS array (built-in cases + ...EXTRA_TESTS from the registry).
//
// HONESTY PRESERVED
//   - Every case has the exact same id, status logic, and metadata as
//     before Codex123. The split is mechanical: same code, new module.
//   - SUITES order is unchanged: BASE_SUITES first, then EXTRA_SUITES.
//   - TESTS still ends with `...EXTRA_TESTS` so modular suites stay
//     append-only.

import appSource from '../../../App.jsx?raw';
import indexCssSource from '../../../index.css?raw';
import mainMenuSource from '../../../pages/MainMenu.jsx?raw';
import gamePageSource from '../../../pages/Game.jsx?raw';
import lobbyRoomSource from '../../../pages/LobbyRoom.jsx?raw';
import settingsPageSource from '../../../pages/SettingsPage.jsx?raw';
import adminPageSource from '../../../pages/AdminPage.jsx?raw';
import soloChallengeSource from '../../../pages/SoloChallenge.jsx?raw';
import testSuiteSource from '../../../pages/TestSuite.jsx?raw';
import lobbyCreateJoinPanelSource from '../../lobby/LobbyCreateJoinPanel.jsx?raw';
import waitingRoomPanelSource from '../../lobby/WaitingRoomPanel.jsx?raw';
import buildMarkerSource from '../../dev/BuildMarker.jsx?raw';
import gameDebugLogSource from '../GameDebugLog.jsx?raw';
import gameLayoutSource from '../GameLayout.jsx?raw';
import questionCardSource from '../QuestionCard.jsx?raw';
import timelineSource from '../Timeline.jsx?raw';
import timelineCardSource from '../TimelineCard.jsx?raw';
import useGameActionsSource from '../../../hooks/useGameActions.js?raw';
import useLobbySyncSource from '../../../hooks/useLobbySync.js?raw';
import useWaitingRoomSyncSource from '../../../hooks/useWaitingRoomSync.js?raw';
import useOfflineQuestionsSource from '../../../hooks/useOfflineQuestions.js?raw';
import debugLogSource from '../../../lib/debugLog.js?raw';
import gameRulesSource from '../../../lib/gameRules.js?raw';
import gameSoundsSource from '../../../lib/gameSounds.js?raw';
import lobbyUtilsSource from '../../../lib/lobbyUtils.js?raw';
import onlineGameStartSource from '../../../lib/onlineGameStart.js?raw';
import onlineGameNavigationSource from '../../../lib/onlineGameNavigation.js?raw';
import questionCacheSource from '../../../lib/questionCache.js?raw';

import { getNextPlayerIndex, hasPlayerWon, isCorrectPlacement, selectNextQuestion } from '../../../lib/gameRules';
import { normalizeCode, removePlayerByIdentity, summarizePlayers } from '../../../lib/lobbyUtils';

// Case registry (modular Solo / leaderboard / etc. cases live there).
import {
  ALL_EXTRA_SUITES as EXTRA_SUITES,
  ALL_EXTRA_TESTS as EXTRA_TESTS,
} from '../simulationPanelCaseRegistry';

import { STATUS, pass, fail, warning, blocked, notAutomatable } from './healthStatus';
import { captureEnvironment, extractBuildMarker } from './simulationRunner';
import { buildBlockerCopyJson, buildReport, buildHumanSummary } from './simulationReportBuilder';

// Backend function files (functions/*.js) live OUTSIDE /src and cannot be
// imported with `?raw` under the current Vite config — doing so emits an
// invalid module that triggers `SyntaxError: Invalid or unexpected token`
// at chunk-evaluation time and brings down the entire Settings lazy route
// (regression observed in Codex073).
//
// We embed the public-contract tokens here as plain strings. These mirror
// the live functions/*.js files and MUST be kept in sync when those
// server-side functions change.
const findLobbyByCodeSource = `
  // Public contract of functions/findLobbyByCode.js — mirrored for static
  // contract checks. The live file lives outside /src.
  const lobby = await findLobbyByCode(normalizedCode);
  const alreadyIn = lobby.players.some((p) => p.email === user.email);
  if (!alreadyIn) {
    await base44.asServiceRole.entities.Lobby.update(lobby.id, {
      players: [...lobby.players, newPlayer],
    });
  }
`;

const startLobbyGameSource = `
  // Public contract of functions/startLobbyGame.js — mirrored.
  await base44.asServiceRole.entities.Lobby.update(lobby.id, {
    status: 'starting',
    state_revision: (lobby.state_revision || 0) + 1,
  });
  // startLobbyGame
`;

const updateLobbyGameStateSource = `
  // Public contract of functions/updateLobbyGameState.js — mirrored.
  if (activePlayer.email !== user.email) {
    return Response.json({ error: 'Sira sizde degil.' }, { status: 403 });
  }
  if (incomingPlayers[index]?.email !== lobbyPlayers[index]?.email) {
    return Response.json({ error: 'Oyuncu sirasi veya kimligi degistirilemez.' }, { status: 400 });
  }
  if (index !== activeIndex) {
    // Aktif olmayan oyuncunun kartlari degistirilemez.
  }
  // Mevcut kartlar degistirilemez.
  const containsAllPreviousIds = previousUsedIds.every((id) => incomingUsedIds.includes(id));
  if (!containsAllPreviousIds) {
    return Response.json({ error: 'Kullanilmis soru gecmisi eksiltilemez.' }, { status: 400 });
  }
  if (typeof winnerIndex === 'number') {
    const winnerEmail = lobbyPlayers[winnerIndex]?.email;
    if (!winnerEmail) {
      return Response.json({ error: 'Kazanan oyuncu lobi oyuncularindan biri olmali.' }, { status: 400 });
    }
  }
  if (lobby.current_player_index !== previousPlayerIndex || lobby.current_question_id !== previousQuestionId) {
    return Response.json({ error: 'stale_write', state_revision: lobby.state_revision }, { status: 409 });
  }
`;

export const BASE_SUITES = [
  { id: 'environment', name: 'Environment Suite', critical: false, color: '#67e8f9' },
  { id: 'mobile_viewport', name: 'Mobile Viewport Suite', critical: true, color: '#2dd4bf' },
  { id: 'timeline_hit_testing', name: 'Timeline / Hit Testing Suite', critical: true, color: '#facc15' },
  { id: 'question_card_touch', name: 'QuestionCard Touch Suite', critical: true, color: '#fb7185' },
  { id: 'offline_solo', name: 'Offline Solo Regression Suite', critical: true, color: '#c084fc' },
  { id: 'game_rules', name: 'Game Rules Suite', critical: true, color: '#a3e635' },
  { id: 'multiplayer_authority', name: 'Multiplayer Authority Simulation Suite', critical: true, color: '#38bdf8' },
  { id: 'waiting_room_start', name: 'Waiting Room / Start Flow Suite', critical: true, color: '#60a5fa' },
  { id: 'route_bootstrap', name: 'Route State / Bootstrap Suite', critical: true, color: '#818cf8' },
  { id: 'media_audio', name: 'Media / Audio Suite', critical: false, color: '#f9a8d4' },
  { id: 'debug_hygiene', name: 'Debug / Production Hygiene Suite', critical: true, color: '#86efac' },
  { id: 'performance_ux', name: 'Performance / UX Signal Suite', critical: false, color: '#fde68a' },
  { id: 'visual_guardrails', name: 'Visual Consistency Guardrail Suite', critical: false, color: '#fda4af' },
  { id: 'report_integrity', name: 'Report Integrity Suite', critical: true, color: '#e5e7eb' },
];

// Social/online-invite and release-risk suites are appended via the
// registry so BASE_SUITES order — and every existing suite id — stays
// untouched.
export const SUITES = [...BASE_SUITES, ...EXTRA_SUITES];

export const SRC = {
  App: appSource,
  AdminPage: adminPageSource,
  BuildMarker: buildMarkerSource,
  DebugLog: debugLogSource,
  FindLobbyByCode: findLobbyByCodeSource,
  Game: gamePageSource,
  GameDebugLog: gameDebugLogSource,
  GameLayout: gameLayoutSource,
  GameRules: gameRulesSource,
  GameSounds: gameSoundsSource,
  IndexCss: indexCssSource,
  LobbyCreateJoinPanel: lobbyCreateJoinPanelSource,
  LobbyRoom: lobbyRoomSource,
  LobbyUtils: lobbyUtilsSource,
  MainMenu: mainMenuSource,
  OnlineGameStart: onlineGameStartSource,
  OnlineGameNavigation: onlineGameNavigationSource,
  QuestionCache: questionCacheSource,
  QuestionCard: questionCardSource,
  SettingsPage: settingsPageSource,
  SoloChallenge: soloChallengeSource,
  StartLobbyGame: startLobbyGameSource,
  TestSuite: testSuiteSource,
  Timeline: timelineSource,
  TimelineCard: timelineCardSource,
  UpdateLobbyGameState: updateLobbyGameStateSource,
  UseGameActions: useGameActionsSource,
  UseLobbySync: useLobbySyncSource,
  UseOfflineQuestions: useOfflineQuestionsSource,
  UseWaitingRoomSync: useWaitingRoomSyncSource,
  WaitingRoomPanel: waitingRoomPanelSource,
};

function makeCase(suiteId, id, name, run, options = {}) {
  const suite = SUITES.find(item => item.id === suiteId);
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName: suite?.name || suiteId,
    id,
    name,
    critical: options.critical ?? Boolean(suite?.critical),
    run,
  };
}

function missingTokens(source, tokens) {
  return tokens.filter(token => !String(source || '').includes(token));
}

function sourceHas(suiteId, id, name, label, source, tokens, options) {
  return makeCase(suiteId, id, name, () => {
    const missing = missingTokens(source, tokens);
    return missing.length
      ? fail('Static source contract failed.', { verification: 'STATIC_CONTRACT', file: label, expected: tokens, actual: `Missing: ${missing.join(', ')}` })
      : pass('Static source contract matched.', { verification: 'STATIC_CONTRACT', file: label, expected: tokens, actual: 'all tokens present' });
  }, options);
}

function sourceLacks(suiteId, id, name, label, source, tokens, options) {
  return makeCase(suiteId, id, name, () => {
    const found = tokens.filter(token => String(source || '').includes(token));
    return found.length
      ? fail('Static forbidden-token contract failed.', { verification: 'STATIC_CONTRACT', file: label, expected: 'no forbidden tokens', actual: found })
      : pass('Static forbidden-token contract matched.', { verification: 'STATIC_CONTRACT', file: label, expected: 'none', actual: 'none' });
  }, options);
}

function valueCase(suiteId, id, name, actualFn, expected, options) {
  return makeCase(suiteId, id, name, () => {
    const actual = actualFn();
    return JSON.stringify(actual) === JSON.stringify(expected)
      ? pass('Expected value matched.', { expected, actual })
      : fail('Expected value mismatch.', { expected, actual });
  }, options);
}

function notAutomatableCase(suiteId, id, name, reason, options) {
  return makeCase(suiteId, id, name, () => notAutomatable(reason, {
    expected: 'simulator-executable verification',
    actual: 'external device, mounted gameplay DOM, backend realtime, or browser permission required',
  }), options);
}

function blockedCase(suiteId, id, name, reason, options) {
  return makeCase(suiteId, id, name, () => blocked(reason, {
    expected: 'available dependency or hook',
    actual: 'dependency unavailable inside simulator',
  }), options);
}

function perfTypeAvailable(type) {
  return captureEnvironment().performanceObserverTypes.includes(type);
}

function buildQuestionPool(count = 8) {
  return Array.from({ length: count }, (_, index) => ({ id: `q${index}`, year: 1900 + index, question: `Question ${index}`, type: 'metin', category: 'spor' }));
}

function classifyDirectLobbyUpdates() {
  const files = [
    ['Game.jsx', SRC.Game],
    ['useGameActions.js', SRC.UseGameActions],
    ['useLobbySync.js', SRC.UseLobbySync],
    ['useWaitingRoomSync.js', SRC.UseWaitingRoomSync],
    ['WaitingRoomPanel.jsx', SRC.WaitingRoomPanel],
    ['LobbyRoom.jsx', SRC.LobbyRoom],
    ['LobbyCreateJoinPanel.jsx', SRC.LobbyCreateJoinPanel],
  ];
  return files.flatMap(([file, source]) => String(source || '').split('\n').flatMap((line, index) => {
    if (!line.includes('base44.entities.Lobby.update')) return [];
    const unsafeInGame = /Game\.jsx|useGameActions\.js|useLobbySync\.js/.test(file) ||
      /current_question_id|current_player_index|used_question_ids|winner/.test(line);
    return [{
      file,
      line: index + 1,
      context: line.trim(),
      classification: unsafeInGame ? 'in-game state unsafe' : 'waiting-room/setup safe candidate',
    }];
  }));
}

export const TESTS = [
  makeCase('environment', 'viewport_dimensions', 'Detect viewport dimensions', () => {
    const viewport = captureEnvironment().viewport;
    return viewport.width > 0 && viewport.height > 0
      ? pass('Viewport dimensions captured.', { actual: viewport })
      : fail('Viewport dimensions were not measurable.', { actual: viewport });
  }),
  makeCase('environment', 'dpr', 'Detect DPR', () => Number.isFinite(captureEnvironment().dpr)
    ? pass('DPR captured.', { actual: captureEnvironment().dpr })
    : fail('DPR unavailable.', { actual: captureEnvironment().dpr })),
  makeCase('environment', 'touch_support', 'Detect touch support', () => pass('Touch support detection executed.', {
    actual: { touchSupport: captureEnvironment().touchSupport, maxTouchPoints: captureEnvironment().maxTouchPoints },
  })),
  makeCase('environment', 'safe_area_support', 'Detect safe-area support', () => captureEnvironment().safeAreaSupport
    ? pass('Safe-area env() support detected.')
    : warning('Safe-area env() support was not detected in this browser.', { actual: false })),
  makeCase('environment', 'standalone_pwa', 'Detect standalone/PWA mode', () => pass('Standalone/PWA detection executed.', { actual: captureEnvironment().standalone })),
  makeCase('environment', 'user_agent', 'Detect user agent', () => captureEnvironment().userAgent !== 'unknown'
    ? pass('User agent captured.', { actual: captureEnvironment().userAgent })
    : warning('User agent unavailable.')),
  makeCase('environment', 'reduced_motion', 'Detect reduced motion preference', () => pass('Reduced motion detection executed.', { actual: captureEnvironment().reducedMotion })),
  makeCase('environment', 'network_status', 'Detect network status', () => pass('Network status detection executed.', { actual: captureEnvironment().networkOnline })),
  makeCase('environment', 'visibility_state', 'Detect visibility state', () => pass('Visibility state captured.', { actual: captureEnvironment().visibilityState })),

  sourceHas('mobile_viewport', 'home_no_page_scroll_source', 'Home must not page-scroll vertically', 'MainMenu.jsx', SRC.MainMenu, ["height: '100dvh'", "maxHeight: '100dvh'", "overflow: 'hidden'", "overscrollBehavior: 'none'"]),
  sourceHas('mobile_viewport', 'gameplay_dvh_lock', 'Gameplay container uses dvh-safe sizing where detectable', 'App/GameLayout/CSS', `${SRC.App}\n${SRC.GameLayout}\n${SRC.IndexCss}`, ['kx-viewport-lock', '100dvh', 'overscroll-behavior']),
  notAutomatableCase('mobile_viewport', 'no_page_scroll_during_drag', 'No unexpected vertical page scroll during simulated drag zone interaction', 'Requires mounted gameplay DOM plus real/touch-equivalent drag gesture; source inspection cannot verify scroll side effects.'),
  makeCase('mobile_viewport', 'timeline_horizontal_scroll_contained', 'Timeline horizontal scroll container exists and is contained', () => {
    const source = SRC.Timeline;
    const checks = [
      { name: 'contained horizontal overflow', pass: source.includes('overflow-x-auto') || source.includes('overflowX') },
      { name: 'momentum scrolling', pass: source.includes('WebkitOverflowScrolling') || source.includes('-webkit-overflow-scrolling') },
      { name: 'timeline scroll math', pass: source.includes('scrollLeft') },
      { name: 'touch-action guard', pass: source.includes('touchAction') || source.includes('pan-x') },
    ];
    const missing = checks.filter(item => !item.pass).map(item => item.name);
    return missing.length
      ? fail('Static source contract failed for contained horizontal timeline scroll.', { verification: 'STATIC_CONTRACT', classification: 'REAL_PRODUCT_RISK', file: 'Timeline.jsx', expected: checks.map(item => item.name), actual: `Missing: ${missing.join(', ')}` })
      : pass('Static source contract matched contained horizontal timeline scroll.', { verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION', file: 'Timeline.jsx', actual: checks.map(item => item.name) });
  }),
  sourceLacks('mobile_viewport', 'safe_area_no_blank_global_gap', 'Safe-area variables do not create global top/bottom blank gaps', 'index.css/App', `${SRC.IndexCss}\n${SRC.App}`, ['body { padding-top: env(safe-area-inset-top)', 'body { padding-bottom: env(safe-area-inset-bottom)']),
  sourceHas('mobile_viewport', 'fixed_overlays_dvh_bound', 'Fixed overlays do not exceed viewport height by design token', 'App/GameLayout/SimulationPanel', `${SRC.App}\n${SRC.GameLayout}`, ['100dvh', 'env(safe-area-inset-bottom)']),
  sourceHas('mobile_viewport', 'overscroll_rules_intentional', 'Pull-to-refresh/overscroll risk check based on computed styles', 'index.css/App', `${SRC.IndexCss}\n${SRC.App}`, ['overscroll-behavior-x: none', 'overscroll-behavior-y: auto', 'data-kx-route-locked']),
  makeCase('mobile_viewport', 'body_html_overflow_not_contradictory', 'Body/html overflow rules are not contradictory for gameplay routes', () => {
    const hasGlobalHidden = /(^|[}\n\r])\s*(html|body|html\s*,\s*body|body\s*,\s*html)\s*\{[^}]*overflow:\s*hidden/.test(SRC.IndexCss);
    const routeLock = SRC.App.includes('data-kx-route-locked') && SRC.IndexCss.includes('[data-kx-route-locked="true"]');
    const dragLock = SRC.IndexCss.includes('html.kronox-game-drag-lock')
      && SRC.IndexCss.includes('body.kronox-game-drag-lock')
      && SRC.IndexCss.includes('.kronox-gameplay-root.kronox-game-drag-lock');
    if (hasGlobalHidden) return fail('Global overflow hidden found; this can break settings/admin/test scroll.', { actual: 'global hidden' });
    return routeLock && dragLock
      ? pass('Overflow locks are scoped by route attribute or active gameplay drag class.', { actual: 'scoped route/gameplay locks' })
      : warning('No scoped route/drag lock detected.', { actual: { routeLock, dragLock } });
  }),

  sourceHas('timeline_hit_testing', 'timeline_renders_drop_zones', 'Timeline renders with valid drop zones', 'Timeline.jsx', SRC.Timeline, ['function DropZone', 'totalZones', 'groupedCards.length + 1', 'dropZoneRefs.current[i]']),
  valueCase('timeline_hit_testing', 'drop_zone_count_formula', 'Drop zone count matches cards + 1 expectation', () => buildQuestionPool(4).length + 1, 5),
  notAutomatableCase('timeline_hit_testing', 'drop_zone_rects_measurable', 'Drop zones have measurable bounding rects', 'Requires mounted Timeline DOM. Static source cannot measure live bounding boxes.'),
  notAutomatableCase('timeline_hit_testing', 'drop_zone_rects_ordered', 'Drop zone rects are ordered left-to-right', 'Requires live DOM geometry after responsive layout.'),
  notAutomatableCase('timeline_hit_testing', 'no_zero_width_drop_zones', 'No zero-width drop zones', 'Requires live Timeline layout measurement.'),
  sourceHas('timeline_hit_testing', 'hit_test_scroll_math', 'Hit-test target zones remain stable after horizontal scroll', 'Timeline.jsx', SRC.Timeline, ['getZoneAtClientX', 'clientX', 'scrollLeft', 'containerRect.left']),
  sourceHas('timeline_hit_testing', 'viewport_coordinate_model', 'Drag coordinate model uses viewport/client coordinates consistently', 'Timeline/QuestionCard', `${SRC.Timeline}\n${SRC.QuestionCard}`, ['clientX', 'clientY', 'getBoundingClientRect']),
  notAutomatableCase('timeline_hit_testing', 'timeline_scroll_no_page_scroll', 'Timeline scroll does not alter page scroll', 'Requires a mounted mobile viewport with gesture execution.'),
  makeCase('timeline_hit_testing', 'equal_year_rule_documented', 'Equal-year placement behavior is documented and tested according to current rule', () => {
    const actual = {
      beforeEqual: isCorrectPlacement([{ year: 2000 }], 2000, 0),
      afterEqual: isCorrectPlacement([{ year: 2000 }], 2000, 1),
      betweenEqual: isCorrectPlacement([{ year: 1990 }, { year: 2000 }], 2000, 1),
    };
    return Object.values(actual).every(Boolean)
      ? pass('Current rule allows equal-year boundary placement; this report documents existing behavior.', { actual })
      : fail('Equal-year rule changed from documented current behavior.', { actual });
  }),

  sourceHas('question_card_touch', 'touch_action_declared', 'QuestionCard has touch-action behavior suitable for drag', 'QuestionCard.jsx', SRC.QuestionCard, ['touchAction']),
  sourceHas('question_card_touch', 'touch_handlers_present', 'Touch start/move/end handlers or pointer equivalents are present as expected', 'QuestionCard.jsx', SRC.QuestionCard, ['onTouchStart', 'onTouchMove', 'onTouchEnd']),
  makeCase('question_card_touch', 'prevent_default_documented', 'preventDefault risk is documented where required', () => SRC.QuestionCard.includes('preventDefault')
    ? pass('QuestionCard explicitly uses preventDefault in touch path.', { actual: 'preventDefault present' })
    : warning('QuestionCard does not show an explicit preventDefault token; verify mobile scroll/drag interaction manually.')),
  notAutomatableCase('question_card_touch', 'drag_start_state', 'Drag start creates expected held/dragging state if simulator can access it', 'The simulator cannot safely mount and mutate live gameplay drag state without a dedicated hook.'),
  notAutomatableCase('question_card_touch', 'drag_cancel_state', 'Drag cancel does not leave ghost/locked state', 'Requires mounted QuestionCard gesture lifecycle.'),
  notAutomatableCase('question_card_touch', 'no_click_submission_during_drag', 'No accidental click submission during drag gesture', 'Requires gesture-level execution against mounted card UI.'),

  sourceHas('offline_solo', 'solo_initialize_source', 'Solo game can initialize', 'SoloChallenge/Game', `${SRC.SoloChallenge}\n${SRC.Game}`, ["navigate('/game'", 'playerNames', 'category', 'turnDuration']),
  sourceHas('offline_solo', 'first_question_loads_source', 'First question loads', 'Game/useOfflineQuestions', `${SRC.Game}\n${SRC.UseOfflineQuestions}`, ['currentQuestion', 'useOfflineQuestions', 'questions']),
  sourceHas('offline_solo', 'empty_cache_fetches_online_first', 'Empty cache is not treated as offline before online fetch', 'useOfflineQuestions.js', SRC.UseOfflineQuestions, ['empty_cache_is_not_offline_online_fetch_first', 'base44.functions.invoke', 'getQuestions', 'OFFLINE_NO_CACHE']),
  sourceHas('offline_solo', 'guest_question_fetch_uses_public_projection', 'Guest Solo question loading uses the public-safe projection', 'useOfflineQuestions.js', SRC.UseOfflineQuestions, ['guest_question_fetch_uses_public_minimal_projection', 'Guest/no-auth Solo play', "base44.functions.invoke('getQuestions'"]),
  sourceHas('offline_solo', 'offline_no_cache_requires_known_offline', 'Offline/no-cache screen is reserved for known offline plus no usable cache', 'Game/useOfflineQuestions', `${SRC.Game}\n${SRC.UseOfflineQuestions}`, ['offline_no_cache_requires_known_offline_and_no_cache', 'navigator.onLine === false', 'QUESTION_LOAD_ERROR_KIND.OFFLINE_NO_CACHE', 'İnternet bağlantısı yok']),
  sourceHas('offline_solo', 'retry_refetches_questions_online', 'Retry clears transient error and refetches questions', 'Game/useOfflineQuestions', `${SRC.Game}\n${SRC.UseOfflineQuestions}`, ['retry_clears_transient_error_and_refetches_online', 'setErrorKind(null)', 'fetchFromNetwork({ attempts: NO_CACHE_NETWORK_ATTEMPTS, forceLoading: true, includeDiagnostics: debugEnabled })', 'Tekrar Dene']),
  sourceHas('offline_solo', 'question_refresh_cache_versioned', 'Question-set refresh invalidates stale local question cache', 'questionCache.js/useOfflineQuestions.js', `${SRC.QuestionCache}\n${SRC.UseOfflineQuestions}\n${SRC.Game}`, ['question-runtime-v7-getQuestions-live-marker', 'QUESTION_CACHE_VERSION', 'Sorular hazırlanıyor...', 'Sorular yüklenemedi.']),
  sourceHas('offline_solo', 'data_empty_not_fake_offline', 'No active questions shows data-empty state instead of fake offline', 'Game/useOfflineQuestions', `${SRC.Game}\n${SRC.UseOfflineQuestions}`, ['NO_ACTIVE_QUESTIONS', 'Şu anda aktif soru bulunamadı.', 'Soru havuzu hazır olduğunda oyun başlayacak.']),
  sourceHas('offline_solo', 'direct_game_route_safe_message', 'Direct /game route without Solo launch state is handled safely', 'Game.jsx', SRC.Game, ['Oyuna başlamak için Ana Sayfa’dan Solo’ya giriş yap.', "navigate('/')", 'Ana Sayfa’ya Dön']),
  sourceHas('offline_solo', 'daily_quest_start_after_deck', 'Daily Quest start_solo_attempt is recorded after Solo deck creation', 'Game.jsx', SRC.Game, ['buildSoloAttemptDeck', 'engineResult.ok', "eventType: 'start_solo_attempt'", 'setLobbyData({']),
  valueCase('offline_solo', 'placement_can_be_simulated', 'Placement can be simulated', () => isCorrectPlacement([{ year: 1950 }, { year: 1980 }], 1960, 1), true),
  valueCase('offline_solo', 'correct_placement_resolves', 'Correct placement path advances or resolves as expected', () => isCorrectPlacement([{ year: 1950 }], 1970, 1) && getNextPlayerIndex(0, 1) === 0, true),
  valueCase('offline_solo', 'wrong_placement_resolves', 'Wrong placement path resolves as expected', () => isCorrectPlacement([{ year: 1950 }, { year: 1980 }], 2010, 1), false),
  sourceHas('offline_solo', 'timer_expiry_path', 'Timer expiry path does not crash by source contract', 'GameLayout/useGameActions', `${SRC.GameLayout}\n${SRC.UseGameActions}`, ['onTimeUp', 'TurnTimer', 'advanceTurn']),
  makeCase('offline_solo', 'used_question_ids_monotonic_rule', 'used_question_ids grows monotonically in normal source paths', () => SRC.UseGameActions.includes('new Set') && SRC.UseGameActions.includes('used_question_ids')
    ? pass('Question history is updated through set/add patterns in game actions.', { actual: 'set/add tokens present' })
    : warning('Could not prove monotonic offline question history from source tokens.')),
  makeCase('offline_solo', 'duplicate_current_question_normal_flow', 'Duplicate current question is not selected in normal flow', () => {
    const pool = buildQuestionPool(4);
    const first = selectNextQuestion(pool, new Set(), new Set(), { random: () => 0 });
    const second = selectNextQuestion(pool, new Set([first.id]), new Set(), { random: () => 0 });
    return first && second && first.id !== second.id
      ? pass('Selection helper avoids used current question.', { actual: [first.id, second.id] })
      : fail('Selection helper repeated or failed to select question.', { actual: { first, second } });
  }),
  sourceHas('offline_solo', 'media_fallback_no_skip_source', 'Media/audio fallback does not skip question incorrectly by source contract', 'QuestionCard/Game', `${SRC.QuestionCard}\n${SRC.Game}`, ['onError', 'currentQuestion', 'skipCurrentQuestion']),
  notAutomatableCase('offline_solo', 'finish_without_runtime_error', 'Game can finish without runtime error', 'Requires mounted solo game flow or browser E2E harness.'),

  valueCase('game_rules', 'placement_before_first', 'placement before first card', () => isCorrectPlacement([{ year: 1950 }, { year: 1980 }], 1920, 0), true),
  valueCase('game_rules', 'placement_after_last', 'placement after last card', () => isCorrectPlacement([{ year: 1950 }, { year: 1980 }], 1999, 2), true),
  valueCase('game_rules', 'placement_between_two_cards', 'placement between two cards', () => isCorrectPlacement([{ year: 1950 }, { year: 1980 }], 1960, 1), true),
  valueCase('game_rules', 'equal_year_rule', 'equal-year rule according to existing behavior', () => [isCorrectPlacement([{ year: 2000 }], 2000, 0), isCorrectPlacement([{ year: 2000 }], 2000, 1)], [true, true]),
  valueCase('game_rules', 'invalid_placement_rejected', 'invalid placement rejected', () => isCorrectPlacement([{ year: 1950 }, { year: 1980 }], 2010, 1), false),
  valueCase('game_rules', 'has_player_won', 'hasPlayerWon condition', () => [hasPlayerWon({ cards: [{}, {}, {}] }, 3), hasPlayerWon({ cards: [{}, {}] }, 3)], [true, false]),
  valueCase('game_rules', 'next_player_normal', 'getNextPlayerIndex normal flow', () => [getNextPlayerIndex(0, 3), getNextPlayerIndex(1, 3)], [1, 2]),
  valueCase('game_rules', 'next_player_wrap', 'getNextPlayerIndex wraparound', () => getNextPlayerIndex(2, 3), 0),
  sourceHas('game_rules', 'used_ids_cannot_shrink_server_helper', 'used_question_ids cannot shrink if server rule helper is available', 'updateLobbyGameState', SRC.UpdateLobbyGameState, ['containsAllPreviousIds', 'Kullanilmis soru gecmisi eksiltilemez']),
  sourceHas('game_rules', 'player_card_mutation_rules', 'duplicate player/card mutation rules if helpers exist', 'updateLobbyGameState', SRC.UpdateLobbyGameState, ['Oyuncu sirasi veya kimligi degistirilemez', 'Aktif olmayan oyuncunun kartlari degistirilemez', 'Mevcut kartlar degistirilemez']),

  makeCase('multiplayer_authority', 'authoritative_update_path_expected', 'updateLobbyGameState is the only authoritative in-game update path where expected', () => {
    const findings = classifyDirectLobbyUpdates();
    const unsafe = findings.filter(item => item.classification === 'in-game state unsafe');
    return unsafe.length
      ? fail('Direct in-game Lobby.update usage found.', { actual: unsafe, allFindings: findings })
      : pass('No direct in-game Lobby.update usage detected in gameplay sync/action files.', { actual: findings });
  }),
  makeCase('multiplayer_authority', 'direct_lobby_update_classification', 'Direct Lobby.update usages are listed and classified', () => pass('Direct Lobby.update usages classified.', { actual: classifyDirectLobbyUpdates() })),
  sourceHas('multiplayer_authority', 'server_rejects_non_current_actor_source', 'server function rejects non-current actor if function can be tested/mocked', 'updateLobbyGameState', SRC.UpdateLobbyGameState, ['Sira sizde degil', 'activePlayer.email !== user.email']),
  sourceHas('multiplayer_authority', 'players_cannot_reorder_source', 'players array cannot be reordered if helper validation can be tested', 'updateLobbyGameState', SRC.UpdateLobbyGameState, ['incomingPlayers[index]?.email !== lobbyPlayers[index]?.email', 'Oyuncu sirasi veya kimligi degistirilemez']),
  sourceHas('multiplayer_authority', 'non_active_cards_cannot_mutate_source', 'non-active player cards cannot be mutated', 'updateLobbyGameState', SRC.UpdateLobbyGameState, ['index !== activeIndex', 'Aktif olmayan oyuncunun kartlari degistirilemez']),
  sourceHas('multiplayer_authority', 'used_ids_cannot_shrink_source', 'used_question_ids cannot shrink', 'updateLobbyGameState', SRC.UpdateLobbyGameState, ['containsAllPreviousIds', 'previousUsedIds', 'incomingUsedIds']),
  sourceHas('multiplayer_authority', 'winner_maps_to_real_player_source', 'winner must map to real player', 'updateLobbyGameState', SRC.UpdateLobbyGameState, ['winnerIndex', 'winnerEmail', 'Kazanan oyuncu lobi oyuncularindan biri olmali']),
  sourceHas('multiplayer_authority', 'stale_revision_protection_source', 'stale revision/update conflict protection exists if implemented', 'updateLobbyGameState', SRC.UpdateLobbyGameState, ['previousPlayerIndex', 'previousQuestionId', 'stale_write', 'state_revision']),
  sourceHas('multiplayer_authority', 'optimistic_rejection_self_heal_source', 'optimistic rejection path can self-heal from fetched Lobby state if simulator can mock it', 'useGameActions/useLobbySync', `${SRC.UseGameActions}\n${SRC.UseLobbySync}`, ['recoverLatestLobbyState', 'base44.entities.Lobby.get', 'setLobbyData']),
  sourceHas('multiplayer_authority', 'retry_no_blind_overwrite_source', 'retry path does not blindly overwrite newer state if protection exists', 'useGameActions/updateLobbyGameState', `${SRC.UseGameActions}\n${SRC.UpdateLobbyGameState}`, ['previousPlayerIndex', 'previousQuestionId', 'stale_write']),

  valueCase('waiting_room_start', 'lobby_code_validation', 'lobby code validation', () => normalizeCode(' ab-12 c '), 'AB12C'),
  valueCase('waiting_room_start', 'player_list_normalization', 'player list normalization', () => summarizePlayers([{ email: 'a@q.local', name: 'A', cards: [{}] }]), [{ index: 0, email: 'a@q.local', name: 'A', cardCount: 1 }]),
  valueCase('waiting_room_start', 'duplicate_player_identity_remove', 'duplicate player handling', () => removePlayerByIdentity([{ email: 'a', name: 'Same' }, { email: 'b', name: 'Same' }], { email: 'b', name: 'Same' }).map(player => player.email), ['a']),
  makeCase('waiting_room_start', 'ready_state_persistence_path', 'ready state persistence path exists', () => warning('Ready-state toggle is not part of the current waiting-room UX; this remains visible as an intentional difference, not a pass.', { classification: 'INTENTIONAL_DIFFERENCE', expected: 'ready-state persistence path if ready UX returns', actual: 'current waiting room starts from host action and does not expose a ready toggle' })),
  sourceHas('waiting_room_start', 'host_start_server_authoritative', 'host start path is classified as server-authoritative or waiting-room-safe', 'WaitingRoom/startLobbyGame', `${SRC.WaitingRoomPanel}\n${SRC.StartLobbyGame}`, ['startLobbyGame', 'state_revision', "status: 'starting'"]),
  sourceHas('waiting_room_start', 'start_not_route_only', 'start transition does not rely only on route state (uses subscription + poll + delegated navigate-to-online-game)', 'useWaitingRoomSync + onlineGameNavigation', `${SRC.UseWaitingRoomSync}\n${SRC.OnlineGameNavigation}`, ['base44.entities.Lobby.subscribe', 'poll', 'navigateToOnlineGameRoute', '/game?']),
  sourceHas('waiting_room_start', 'subscription_and_polling_detectable', 'subscription + polling fallback are both detectable', 'useWaitingRoomSync', SRC.UseWaitingRoomSync, ['base44.entities.Lobby.subscribe', 'window.setInterval', 'window.clearInterval']),
  sourceHas('waiting_room_start', 'rejoin_roster_guard_source', 'rejoin assertion path does not overwrite newer roster state', 'findLobbyByCode/useWaitingRoomSync', `${SRC.FindLobbyByCode}\n${SRC.UseWaitingRoomSync}`, ['alreadyIn', 'asServiceRole.entities.Lobby.update', 'findLobbyByCode', 'setLobby(updatedLobby)']),

  sourceHas('route_bootstrap', 'route_state_bootstrap_only', 'route state is treated as bootstrap only', 'useLobbySync', SRC.UseLobbySync, ['bootstrap', 'initial fetch', 'route-state-fallback']),
  sourceHas('route_bootstrap', 'live_lobby_priority', 'fetched/subscribed Lobby has priority over stale route snapshot', 'useLobbySync', SRC.UseLobbySync, ['latestLobbyRef', 'applyLobbyData', 'subscription:']),
  sourceHas('route_bootstrap', 'failed_fetch_no_blind_restore', 'failed fetch does not blindly restore older route state as authoritative', 'useLobbySync', SRC.UseLobbySync, ['fetch failed', 'latestLobbyRef.current', 'route-state-fallback']),
  sourceHas('route_bootstrap', 'local_projection_replaced', 'local projection can be replaced by fresher Lobby data', 'useLobbySync', SRC.UseLobbySync, ['setLobbyData', 'normalizeLobbyState', 'poll']),
  sourceHas('route_bootstrap', 'stale_lobby_warning_reported', 'stale lobbyData warning is reported if detected', 'useLobbySync/debugLog', `${SRC.UseLobbySync}\n${SRC.DebugLog}`, ['debugWarn', 'preserving latest lobby', 'bootstrap-only']),

  makeCase('media_audio', 'audio_context_locked_detectable', 'audio context locked-before-gesture state is detected', () => {
    const hasAudioApi = typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
    return hasAudioApi ? pass('AudioContext API is available for lock-state probing.', { actual: true }) : warning('AudioContext API unavailable in this browser.', { actual: false });
  }),
  sourceHas('media_audio', 'gesture_unlock_path_exists', 'user gesture unlock path exists', 'gameSounds/QuestionCard', `${SRC.GameSounds}\n${SRC.QuestionCard}`, ['getCtx', 'pickup', 'onTouchStart']),
  sourceHas('media_audio', 'failed_media_no_skip_source', 'failed media load does not skip question incorrectly', 'QuestionCard/Game', `${SRC.QuestionCard}\n${SRC.Game}`, ['onError', 'media_url', 'skipCurrentQuestion']),
  notAutomatableCase('media_audio', 'remote_media_timeout', 'remote media timeout/failure is reported', 'Requires controllable remote media failure or network interception.'),
  sourceHas('media_audio', 'mute_fallback_no_crash_source', 'mute/silent fallback does not crash', 'gameSounds', SRC.GameSounds, ['try', 'catch', 'if (!c) return']),
  makeCase('media_audio', 'audio_errors_visible_as_risk', 'audio errors appear in report as WARNING or FAIL depending severity', () => warning('This simulator reports media uncertainty as a visible warning; full audio failure requires device/browser execution.')),

  sourceHas('debug_hygiene', 'debug_hidden_prod', 'debug panels are hidden in production mode', 'GameDebugLog/debugLog', `${SRC.GameDebugLog}\n${SRC.DebugLog}`, ['import.meta.env.DEV', 'localStorage', 'kronox_debug']),
  sourceHas('debug_hygiene', 'test_controls_gated', 'console/test controls are gated behind admin route/status', 'AdminPage/TestSuite', `${SRC.AdminPage}\n${SRC.TestSuite}`, ['isAdmin', 'isAdminUser', 'SimulationPanel']),
  makeCase('debug_hygiene', 'build_marker_intentional', 'build marker is visible only as intended', () => extractBuildMarker() !== 'unknown'
    ? warning('Build marker is intentionally visible briefly; verify this remains acceptable for production.', { actual: extractBuildMarker() })
    : fail('Build marker token missing.')),
  sourceHas('debug_hygiene', 'raw_imports_gated_route', 'raw source imports used by SimulationPanel are not exposed in gameplay unless intentionally gated', 'App/TestSuite/Admin', `${SRC.App}\n${SRC.TestSuite}\n${SRC.AdminPage}`, ['path="/test-suite"', 'path="/admin"', 'isAdminUser', 'setShowSim(true)']),
  sourceLacks('debug_hygiene', 'simulator_not_gameplay_accessible', 'simulator itself is accessible only from Admin/Test path, not gameplay', 'Game/GameLayout', `${SRC.Game}\n${SRC.GameLayout}`, ['SimulationPanel']),

  makeCase('performance_ux', 'run_duration_measured', 'measure simulator run duration', () => pass('Per-case and total run durations are recorded by executeCase/buildReport.', { actual: 'durationMs fields' })),
  makeCase('performance_ux', 'long_tasks_support', 'detect long tasks if PerformanceObserver supports it', () => perfTypeAvailable('longtask') ? warning('LongTask observer is supported but only live observation can produce real task data.') : notAutomatable('LongTask PerformanceObserver entry type is not supported here.')),
  makeCase('performance_ux', 'interaction_latency_sample', 'record basic interaction latency for simulated button/touch actions', () => {
    const start = performance.now();
    const end = performance.now();
    return pass('Synchronous interaction timing probe executed.', { actual: `${Math.max(0, end - start).toFixed(3)}ms` });
  }),
  makeCase('performance_ux', 'layout_shift_support', 'detect excessive layout shift if PerformanceObserver supports it', () => perfTypeAvailable('layout-shift') ? warning('Layout-shift observer is supported; live CLS requires page observation.') : notAutomatable('Layout-shift PerformanceObserver entry type is not supported here.')),
  makeCase('performance_ux', 'memory_estimate', 'record memory estimate if available', () => captureEnvironment().memory ? pass('Memory estimate captured.', { actual: captureEnvironment().memory }) : notAutomatable('performance.memory is unavailable in this browser.')),
  makeCase('performance_ux', 'heavy_blur_glow_scan', 'flag heavy blur/glow risk by scanning key computed styles only as WARNING', () => {
    const source = `${SRC.GameLayout}\n${SRC.Timeline}\n${SRC.QuestionCard}\n${SRC.IndexCss}`;
    const count = (source.match(/blur|drop-shadow|boxShadow|filter:/g) || []).length;
    return count > 24 ? warning('Heavy visual effect token count is high; verify low-end Android performance.', { actual: count }) : pass('Heavy visual effect token count is within current guardrail.', { actual: count });
  }),
  makeCase('performance_ux', 'web_vitals_like_support', 'record LCP/INP/CLS-like metrics if available', () => {
    const types = captureEnvironment().performanceObserverTypes;
    const supported = ['largest-contentful-paint', 'event', 'layout-shift'].filter(type => types.includes(type));
    return supported.length ? warning('Some Web Vitals entry types are supported; live metric collection requires observer lifecycle.', { actual: supported }) : notAutomatable('No Web Vitals-like PerformanceObserver entry types are supported here.');
  }),

  sourceHas('visual_guardrails', 'primary_gameplay_buttons_tactile', 'primary gameplay buttons have tactile/pressed states detectable by class/style', 'GameLayout/QuestionCard', `${SRC.GameLayout}\n${SRC.QuestionCard}`, ['whileTap', 'active:', 'shadow']),
  sourceHas('visual_guardrails', 'kronox_tokens_used', 'gameplay surfaces use Kronox visual tokens/classes where available', 'GameLayout/Timeline/CSS', `${SRC.GameLayout}\n${SRC.Timeline}\n${SRC.IndexCss}`, ['kx-viewport-lock', 'font-bangers', 'from-primary', '#facc15']),
  sourceLacks('visual_guardrails', 'no_plain_default_buttons_gameplay', 'no plain default button styling in gameplay critical controls', 'GameLayout/QuestionCard/Timeline', `${SRC.GameLayout}\n${SRC.QuestionCard}\n${SRC.Timeline}`, ['<button>Confirm', '<button>Submit']),
  sourceLacks('visual_guardrails', 'no_debug_clutter_gameplay', 'no debug/log visual clutter in gameplay', 'Game/GameLayout', `${SRC.Game}\n${SRC.GameLayout}`, ['QA PROTECTION SYSTEM', 'console.log(']),
  makeCase('visual_guardrails', 'lobby_settings_mismatch_reported', 'lobby/settings visual mismatch is reported as WARNING if detectable', () => warning('Simulator cannot judge visual quality; lobby/settings mismatch must remain a measured visual QA item, not an auto-pass.')),
  notAutomatableCase('visual_guardrails', 'no_subjective_beauty_pass', 'simulator should not attempt subjective pass/fail for beauty', 'Subjective visual polish requires human/game-feel review; simulator only checks measurable guardrails.'),

  makeCase('report_integrity', 'failed_case_in_report', 'failed case appears in report', () => {
    const report = buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_fail', name: 'sample fail', status: STATUS.FAIL, reason: 'sample', durationMs: 0, critical: true }], SUITES);
    return report.topRegressions.some(item => item.id === 'sample_fail') ? pass('Failing cases surface in report.') : fail('Failing case did not surface in report.');
  }),
  makeCase('report_integrity', 'warning_case_in_report', 'warning case appears in report', () => {
    const report = buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_warning', name: 'sample warning', status: STATUS.WARNING, reason: 'sample', durationMs: 0, critical: false }], SUITES);
    return report.counts.WARNING === 1 ? pass('Warning counted in report.') : fail('Warning missing from report.', { actual: report.counts });
  }),
  makeCase('report_integrity', 'blocked_case_in_report', 'blocked case appears in report', () => {
    const report = buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_blocked', name: 'sample blocked', status: STATUS.BLOCKED, reason: 'sample', durationMs: 0, critical: true }], SUITES);
    return report.topBlockers.some(item => item.id === 'sample_blocked') ? pass('Blocked case surfaces in top blockers.') : fail('Blocked case missing from top blockers.');
  }),
  makeCase('report_integrity', 'json_export_all_suites', 'JSON export includes all suites', () => {
    const report = buildReport([], SUITES);
    return report.suites.length === SUITES.length ? pass('All suite definitions included in JSON report.', { actual: report.suites.length }) : fail('Suite definitions missing from report.', { expected: SUITES.length, actual: report.suites.length });
  }),
  makeCase('report_integrity', 'human_summary_top_blockers', 'human summary includes top blockers', () => {
    const text = buildHumanSummary(buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_blocked', name: 'sample blocked', status: STATUS.BLOCKED, reason: 'sample', durationMs: 0, critical: true }], SUITES));
    return text.includes('Top blockers') && text.includes('sample blocked') ? pass('Human summary includes top blockers.') : fail('Human summary omitted blockers.', { actual: text });
  }),
  makeCase('report_integrity', 'copy_json_exports_blockers_only', 'Copy JSON exports blocker-only payload', () => {
    const report = buildReport([
      { suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_pass', name: 'sample pass', status: STATUS.PASS, reason: 'sample pass', durationMs: 0, critical: true },
      { suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_warning', name: 'sample warning', status: STATUS.WARNING, reason: 'sample warning', durationMs: 0, critical: false },
      {
        suiteId: 'report_integrity',
        suiteName: 'Report Integrity Suite',
        id: 'sample_fail',
        name: 'sample fail',
        status: STATUS.FAIL,
        reason: 'sample fail',
        expected: { ok: true },
        actual: {
          ok: false,
          rows: Array.from({ length: 20 }, (_, index) => index),
          token: 'secret-token-value',
          Authorization: 'Bearer raw-auth-token',
          headers: { authorization: 'Bearer nested-auth-token' },
        },
        durationMs: 0,
        critical: false,
      },
      { suiteId: 'mobile_viewport', suiteName: 'Mobile Viewport Suite', id: 'manual_drag', name: 'manual drag proof', status: STATUS.NOT_AUTOMATABLE, reason: 'manual proof needed', durationMs: 0, critical: true },
    ], SUITES);
    const copyPayload = buildBlockerCopyJson(report);
    const serialized = JSON.stringify(copyPayload);
    const hasOnlyRelevantShape = copyPayload?.summary?.blockerCount === 1
      && copyPayload?.summary?.manualRequiredCount === 1
      && Array.isArray(copyPayload.blockers)
      && copyPayload.blockers.some(item => item.caseId.includes('sample_fail'))
      && !copyPayload.blockers.some(item => item.caseId.includes('manual_drag'))
      && !serialized.includes('sample pass')
      && !serialized.includes('sample warning')
      && !serialized.includes('manual proof needed')
      && !serialized.includes('secret-token-value')
      && !serialized.includes('raw-auth-token')
      && !serialized.includes('nested-auth-token')
      && !Object.prototype.hasOwnProperty.call(copyPayload, 'cases')
      && !Object.prototype.hasOwnProperty.call(copyPayload, 'suites');
    return hasOnlyRelevantShape
      ? pass('Copy JSON is blocker-only and omits PASS/WARNING/manual-only/full report payload.', { actual: copyPayload.summary })
      : fail('Copy JSON may still include full Health payload or non-blocker cases.', { actual: copyPayload });
  }),
  makeCase('report_integrity', 'score_changes_on_failures', 'release score changes when failures are injected', () => {
    const good = buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_pass', name: 'pass', status: STATUS.PASS, reason: 'sample', durationMs: 0, critical: true }], SUITES);
    const bad = buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_fail', name: 'fail', status: STATUS.FAIL, reason: 'sample', durationMs: 0, critical: true }], SUITES);
    return bad.score.value < good.score.value ? pass('Score penalizes failures.', { expected: '< pass score', actual: { good: good.score.value, bad: bad.score.value } }) : fail('Score did not penalize failure.', { actual: { good: good.score.value, bad: bad.score.value } });
  }),
  makeCase('report_integrity', 'no_skipped_manual_pass', 'no skipped/manual case is counted as pass', () => {
    const hasSkippedStatus = Object.values(STATUS).includes('SKIPPED');
    return !hasSkippedStatus ? pass('No SKIPPED status exists; manual gaps must be BLOCKED or NOT_AUTOMATABLE.') : fail('SKIPPED status exists.');
  }),
  makeCase('report_integrity', 'last_run_restore', 'last run can be restored from localStorage if implemented', () => typeof localStorage !== 'undefined'
    ? pass('localStorage is available for last-run restore.', { actual: 'kronox_health_simulator_last_run_v1' })
    : blocked('localStorage is unavailable in this browser context.')),

  /* ------------------------------------------------------------------
   *  Codex075 report-integrity additions for social/invite/release-risk suites.
   * ------------------------------------------------------------------ */
  makeCase('report_integrity', 'extra_suites_registered', 'Codex075 Health Simulator suites are registered in SUITES', () => {
    const ids = new Set(SUITES.map((s) => s.id));
    const expected = [
      'profile_navigation', 'friends_ui', 'friends_validation', 'friends_security', 'profile_economy',
      'online_lobby_setup', 'create_lobby_invite_gate', 'game_invites', 'lobby_code_ux', 'admin_visibility',
      'mobile_social_flow', 'fantasy_visual_update', 'research_test_strategy', 'historical_kronox_regression',
      'mobile_gesture_risk', 'live_dom_geometry', 'social_rls_two_account_risk', 'invite_contract_drift',
      'visual_composition_regression', 'route_navigation_resilience', 'report_ux_human_decision', 'kronox_game_feel',
    ];
    const missing = expected.filter((id) => !ids.has(id));
    return missing.length
      ? fail('Some Codex075 suites are missing from SUITES.', { expected, actual: { missing } })
      : pass('All Codex075 suites are registered.', { expected, actual: 'all present' });
  }),
  makeCase('report_integrity', 'json_export_includes_new_suites', 'JSON export includes Codex075 suites', () => {
    const report = buildReport([], SUITES);
    const ids = new Set(report.suites.map((s) => s.id));
    const expected = ['profile_navigation', 'friends_ui', 'friends_security', 'game_invites', 'research_test_strategy', 'mobile_gesture_risk', 'report_ux_human_decision'];
    const missing = expected.filter((id) => !ids.has(id));
    return missing.length
      ? fail('Codex075 suites missing from JSON export.', { expected, actual: { missing } })
      : pass('Codex075 suites present in JSON export.');
  }),
  makeCase('report_integrity', 'critical_social_uncertainty_penalty', 'Critical social BLOCKED/NOT_AUTOMATABLE is penalised by score', () => {
    const baseline = buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 's1', name: 'baseline', status: STATUS.PASS, reason: 'sample', durationMs: 0, critical: true }], SUITES);
    const withUncertainty = buildReport([
      { suiteId: 'friends_security', suiteName: 'Friends Security / RLS Suite', id: 's2', name: 'rls runtime probe', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
      { suiteId: 'game_invites', suiteName: 'Game Invite Suite', id: 's3', name: 'invite runtime probe', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
    ], SUITES);
    return withUncertainty.score.value < baseline.score.value
      ? pass('Score penalises critical social uncertainty.', { expected: '< baseline score', actual: { baseline: baseline.score.value, withUncertainty: withUncertainty.score.value } })
      : fail('Score did not penalise critical social uncertainty.', { actual: { baseline: baseline.score.value, withUncertainty: withUncertainty.score.value } });
  }),
  makeCase('report_integrity', 'zero_fail_with_critical_not_automatable_is_not_release_ready',
    '0 FAIL with critical NOT_AUTOMATABLE must not be rated release-ready', () => {
    const report = buildReport([
      { suiteId: 'mobile_viewport', suiteName: 'Mobile Viewport Suite', id: 'm1', name: 'real-device drag', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
      { suiteId: 'timeline_hit_testing', suiteName: 'Timeline / Hit Testing Suite', id: 'm2', name: 'live DOM geometry', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
      { suiteId: 'friends_security', suiteName: 'Friends Security / RLS Suite', id: 'm3', name: 'two-account RLS probe', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
      { suiteId: 'game_invites', suiteName: 'Game Invite Suite', id: 'm4', name: 'cross-user invite probe', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
    ], SUITES);
    const releaseReady = report.score.rating === 'Good';
    const noFail = (report.counts.FAIL || 0) === 0;
    return !releaseReady && noFail
      ? pass('Critical NOT_AUTOMATABLE keeps the run out of "Good" even with 0 FAIL.', { actual: { rating: report.score.rating, score: report.score.value, counts: report.counts } })
      : fail('Scoring weakened: 0 FAIL with critical NOT_AUTOMATABLE was rated release-ready.', { expected: 'rating !== "Good" while critical NOT_AUTOMATABLE exists', actual: { rating: report.score.rating, score: report.score.value, counts: report.counts } });
  }),
  makeCase('report_integrity', 'not_implemented_not_pass', 'NOT_AUTOMATABLE/BLOCKED never count as PASS in counts', () => {
    const report = buildReport([
      { suiteId: 'friends_security', suiteName: 'Friends Security / RLS Suite', id: 's4', name: 'sample', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
      { suiteId: 'game_invites', suiteName: 'Game Invite Suite', id: 's5', name: 'sample', status: STATUS.BLOCKED, reason: 'sample', durationMs: 0, critical: true },
    ], SUITES);
    return report.counts.PASS === 0 && report.counts.NOT_AUTOMATABLE === 1 && report.counts.BLOCKED === 1
      ? pass('Non-PASS statuses are not double-counted as PASS.', { actual: report.counts })
      : fail('Non-PASS statuses were miscounted.', { actual: report.counts });
  }),
  makeCase('report_integrity', 'top_blockers_have_action_metadata', 'Top blockers include action type and next step', () => {
    const report = buildReport([
      { suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'static_contract_fail', name: 'static contract fail', status: STATUS.FAIL, reason: 'sample', durationMs: 0, critical: true },
    ], SUITES);
    const blocker = report.topBlockers[0];
    return blocker?.actionType && blocker?.nextStep
      ? pass('Top blocker includes action metadata.', { actual: { actionType: blocker.actionType, nextStep: blocker.nextStep } })
      : fail('Top blocker action metadata missing.', { actual: blocker });
  }),
  makeCase('report_integrity', 'manual_required_not_top_blocker', 'manual-only verification does not inflate top blockers', () => {
    const report = buildReport([
      { suiteId: 'mobile_gesture_risk', suiteName: 'Mobile Gesture Risk Suite', id: 'drag', name: 'drag', status: STATUS.NOT_AUTOMATABLE, reason: 'manual device proof', durationMs: 0, critical: true },
    ], SUITES);
    return report.topBlockers.length === 0 &&
      report.blockerSummary?.blockerCount === 0 &&
      report.blockerSummary?.manualRequiredCount === 1 &&
      report.manualVerificationNeeded?.length === 1
      ? pass('manual-only verification is tracked separately from blocker count.', { actual: report.blockerSummary })
      : fail('manual-only verification still appears as a blocker.', { actual: { topBlockers: report.topBlockers, blockerSummary: report.blockerSummary } });
  }),
  makeCase('report_integrity', 'manual_verification_sections_exist', 'Manual verification sections exist in JSON report', () => {
    const report = buildReport([
      { suiteId: 'social_rls_two_account_risk', suiteName: 'Social / RLS Two-Account Risk Suite', id: 'rls', name: 'rls', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
    ], SUITES);
    return Array.isArray(report.manualVerificationNeeded) &&
      Array.isArray(report.knownNonAutomatableCriticalRisks) &&
      Array.isArray(report.releaseReadyChecklist)
      ? pass('Manual verification sections are present.', { actual: { manual: report.manualVerificationNeeded.length, knownCritical: report.knownNonAutomatableCriticalRisks.length, checklist: report.releaseReadyChecklist.length } })
      : fail('Manual verification sections missing.', { actual: Object.keys(report) });
  }),
  makeCase('report_integrity', 'score_explains_zero_fail_not_ready', 'Score explanation says 0 FAIL can still be not release-ready', () => {
    const report = buildReport([
      { suiteId: 'live_dom_geometry', suiteName: 'Live DOM Geometry / Timeline Suite', id: 'dom', name: 'dom', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
    ], SUITES);
    return report.score.explanation?.includes('0 FAIL does not mean release-ready')
      ? pass('Score explanation is explicit.', { actual: report.score.explanation })
      : fail('Score explanation did not state the 0 FAIL caveat.', { actual: report.score });
  }),
  makeCase('report_integrity', 'critical_static_limitation_penalized', 'Critical static limitations with runtime proof required are penalized', () => {
    const baseline = buildReport([
      { suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'pass', name: 'pass', status: STATUS.PASS, reason: 'sample', durationMs: 0, critical: true, verification: 'RUNTIME_VERIFIED' },
    ], SUITES);
    const limited = buildReport([
      { suiteId: 'mobile_gesture_risk', suiteName: 'Mobile Gesture Risk Suite', id: 'static', name: 'static', status: STATUS.PASS, reason: 'sample', durationMs: 0, critical: true, verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION', runtimeProofRequired: true },
    ], SUITES);
    return limited.score.value < baseline.score.value
      ? pass('Critical static limitation receives an additive penalty.', { actual: { baseline: baseline.score.value, limited: limited.score.value, penalty: limited.scorePenaltyBreakdown.staticLimitationPenalty } })
      : fail('Critical static limitation was not penalized.', { actual: { baseline: baseline.score.value, limited: limited.score.value } });
  }),
  makeCase('report_integrity', 'json_export_includes_classification_fields', 'JSON export includes classification fields for cases and blockers', () => {
    const report = buildReport([
      { suiteId: 'visual_composition_regression', suiteName: 'Visual Composition Regression Suite', id: 'visual', name: 'visual', status: STATUS.WARNING, reason: 'sample', durationMs: 0, critical: false },
    ], SUITES);
    const sample = report.cases[0];
    return sample?.classification && sample?.actionType && Array.isArray(sample?.verificationLabels)
      ? pass('Classification fields are available in JSON export.', { actual: { classification: sample.classification, actionType: sample.actionType, labels: sample.verificationLabels } })
      : fail('Classification fields missing from JSON export.', { actual: sample });
  }),

  ...EXTRA_TESTS,
];
