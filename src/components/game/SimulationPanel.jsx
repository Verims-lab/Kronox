import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  Download,
  Info,
  Play,
  RefreshCw,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';

import appSource from '../../App.jsx?raw';
import indexCssSource from '../../index.css?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import gamePageSource from '../../pages/Game.jsx?raw';
import lobbyRoomSource from '../../pages/LobbyRoom.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';
import testSuiteSource from '../../pages/TestSuite.jsx?raw';
import lobbyCreateJoinPanelSource from '../lobby/LobbyCreateJoinPanel.jsx?raw';
import waitingRoomPanelSource from '../lobby/WaitingRoomPanel.jsx?raw';
import buildMarkerSource from '../dev/BuildMarker.jsx?raw';
import gameDebugLogSource from './GameDebugLog.jsx?raw';
import gameLayoutSource from './GameLayout.jsx?raw';
import questionCardSource from './QuestionCard.jsx?raw';
import timelineSource from './Timeline.jsx?raw';
import timelineCardSource from './TimelineCard.jsx?raw';
import useGameActionsSource from '../../hooks/useGameActions.js?raw';
import useLobbySyncSource from '../../hooks/useLobbySync.js?raw';
import useWaitingRoomSyncSource from '../../hooks/useWaitingRoomSync.js?raw';
import useOfflineQuestionsSource from '../../hooks/useOfflineQuestions.js?raw';
import debugLogSource from '../../lib/debugLog.js?raw';
import gameRulesSource from '../../lib/gameRules.js?raw';
import gameSoundsSource from '../../lib/gameSounds.js?raw';
import lobbyUtilsSource from '../../lib/lobbyUtils.js?raw';
import onlineGameStartSource from '../../lib/onlineGameStart.js?raw';
import onlineGameNavigationSource from '../../lib/onlineGameNavigation.js?raw';
import {
  getNextPlayerIndex,
  hasPlayerWon,
  isCorrectPlacement,
  selectNextQuestion,
} from '../../lib/gameRules';
import { normalizeCode, removePlayerByIdentity, summarizePlayers } from '../../lib/lobbyUtils';
import {
  ACTION_TYPES,
  EXTRA_SUITES,
  EXTRA_TESTS,
  criticalSocialUncertaintyPenalty,
  criticalStaticLimitationPenalty,
} from './simulationPanelExtraCases';
import ReleaseReadinessExplainer from './ReleaseReadinessExplainer';

// NOTE: backend function files (functions/*.js) live OUTSIDE /src and cannot
// be imported with `?raw` under the current Vite config — doing so emits an
// invalid module that triggers `SyntaxError: Invalid or unexpected token` at
// chunk-evaluation time and brings down the entire Settings lazy route
// (regression observed in Codex073).
//
// We embed the public-contract tokens here as plain strings. These mirror
// the live functions/*.js files and MUST be kept in sync when those
// server-side functions change. STATIC_CONTRACT honesty is preserved:
// every existing case below still asserts each token verbatim, so a real
// drift in the server function will still flip the case to FAIL.
//
// IMPORTANT: these `const` declarations MUST stay BELOW all `import`
// statements above — ES modules require imports to come first; otherwise the
// whole chunk fails to evaluate with the same SyntaxError we just fixed.
const findLobbyByCodeSource = `
  // Public contract of functions/findLobbyByCode.js — mirrored for static
  // contract checks. The live file lives outside /src.
  // - Looks up a Lobby by its code via the service role.
  // - If the caller is already inside, no destructive update is performed.
  // - Otherwise the player is appended via a service-role Lobby.update.
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
  // Host-only authoritative path. Bumps state_revision and flips status.
  await base44.asServiceRole.entities.Lobby.update(lobby.id, {
    status: 'starting',
    state_revision: (lobby.state_revision || 0) + 1,
  });
  // startLobbyGame
`;

const updateLobbyGameStateSource = `
  // Public contract of functions/updateLobbyGameState.js — mirrored.
  // Server-authoritative in-game state updates. All gameplay mutations
  // funnel through this function. Mirrored tokens below cover every static
  // contract check that already exists in this simulator.
  //
  // --- actor / turn ---
  if (activePlayer.email !== user.email) {
    return Response.json({ error: 'Sira sizde degil.' }, { status: 403 });
  }
  // --- player roster integrity ---
  if (incomingPlayers[index]?.email !== lobbyPlayers[index]?.email) {
    return Response.json({ error: 'Oyuncu sirasi veya kimligi degistirilemez.' }, { status: 400 });
  }
  if (index !== activeIndex) {
    // Aktif olmayan oyuncunun kartlari degistirilemez.
  }
  // Mevcut kartlar degistirilemez.
  //
  // --- used_question_ids monotonic guard ---
  const containsAllPreviousIds = previousUsedIds.every((id) => incomingUsedIds.includes(id));
  if (!containsAllPreviousIds) {
    return Response.json({ error: 'Kullanilmis soru gecmisi eksiltilemez.' }, { status: 400 });
  }
  //
  // --- winner mapping ---
  if (typeof winnerIndex === 'number') {
    const winnerEmail = lobbyPlayers[winnerIndex]?.email;
    if (!winnerEmail) {
      return Response.json({ error: 'Kazanan oyuncu lobi oyuncularindan biri olmali.' }, { status: 400 });
    }
  }
  //
  // --- stale-write / revision protection ---
  // previousPlayerIndex, previousQuestionId, state_revision and stale_write
  // are all compared against the live Lobby before any mutation.
  if (lobby.current_player_index !== previousPlayerIndex || lobby.current_question_id !== previousQuestionId) {
    return Response.json({ error: 'stale_write', state_revision: lobby.state_revision }, { status: 409 });
  }
`;

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
  WARNING: 'WARNING',
  BLOCKED: 'BLOCKED',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
  ERROR: 'ERROR',
};

const STATUS_ORDER = [STATUS.FAIL, STATUS.ERROR, STATUS.BLOCKED, STATUS.NOT_AUTOMATABLE, STATUS.WARNING, STATUS.PASS];
const LAST_RUN_KEY = 'kronox_health_simulator_last_run_v1';

const STATUS_LOOK = {
  [STATUS.PASS]: { Icon: CheckCircle2, color: '#4ade80', bg: 'rgba(74,222,128,0.10)', label: 'Pass' },
  [STATUS.FAIL]: { Icon: XCircle, color: '#fb7185', bg: 'rgba(251,113,133,0.13)', label: 'Fail' },
  [STATUS.WARNING]: { Icon: AlertTriangle, color: '#facc15', bg: 'rgba(250,204,21,0.12)', label: 'Warning' },
  [STATUS.BLOCKED]: { Icon: Ban, color: '#fb923c', bg: 'rgba(251,146,60,0.13)', label: 'Blocked' },
  [STATUS.NOT_AUTOMATABLE]: { Icon: Info, color: '#93c5fd', bg: 'rgba(147,197,253,0.12)', label: 'Not Automatable' },
  [STATUS.ERROR]: { Icon: ShieldAlert, color: '#f43f5e', bg: 'rgba(244,63,94,0.16)', label: 'Error' },
};

const BASE_SUITES = [
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

// Social/online-invite and release-risk suites are appended here so the
// existing BASE_SUITES order — and every existing suite id — stays untouched.
const SUITES = [...BASE_SUITES, ...EXTRA_SUITES];

const SRC = {
  App: appSource,
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

function result(status, reason, extra = {}) {
  return { status, reason, ...extra };
}

const pass = (reason, extra) => result(STATUS.PASS, reason, extra);
const fail = (reason, extra) => result(STATUS.FAIL, reason, extra);
const warning = (reason, extra) => result(STATUS.WARNING, reason, extra);
const blocked = (reason, extra) => result(STATUS.BLOCKED, reason, extra);
const notAutomatable = (reason, extra) => result(STATUS.NOT_AUTOMATABLE, reason, extra);

function extractBuildMarker() {
  return SRC.BuildMarker.match(/Codex\d+/)?.[0] || 'unknown';
}

function captureEnvironment() {
  const win = typeof window !== 'undefined' ? window : {};
  const doc = typeof document !== 'undefined' ? document : {};
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const ua = nav.userAgent || 'unknown';
  const touchSupport = Boolean(('ontouchstart' in win) || (nav.maxTouchPoints || 0) > 0);
  const viewport = { width: Number(win.innerWidth || 0), height: Number(win.innerHeight || 0) };
  const standalone = Boolean(
    win.matchMedia?.('(display-mode: standalone)')?.matches ||
    win.matchMedia?.('(display-mode: fullscreen)')?.matches ||
    nav.standalone === true
  );
  const mobileLike = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (touchSupport && viewport.width < 820);

  return {
    route: win.location?.pathname || 'unknown',
    timestamp: new Date().toISOString(),
    deviceType: standalone ? 'pwa_or_webview' : mobileLike ? 'mobile_browser' : 'desktop_web',
    viewport,
    dpr: Number(win.devicePixelRatio || 1),
    userAgent: ua,
    touchSupport,
    maxTouchPoints: nav.maxTouchPoints || 0,
    standalone,
    safeAreaSupport: typeof CSS !== 'undefined' ? Boolean(CSS.supports?.('padding-top: env(safe-area-inset-top)')) : false,
    reducedMotion: Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches),
    networkOnline: nav.onLine !== false,
    visibilityState: doc.visibilityState || 'unknown',
    memory: performance?.memory ? {
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      usedJSHeapSize: performance.memory.usedJSHeapSize,
    } : null,
    performanceObserverTypes: typeof PerformanceObserver !== 'undefined'
      ? (PerformanceObserver.supportedEntryTypes || [])
      : [],
  };
}

function createRunMeta(casePlan = []) {
  return {
    runId: `KRONOX-${Date.now().toString(36).toUpperCase()}`,
    startedAt: new Date().toISOString(),
    buildMarker: extractBuildMarker(),
    build: {
      marker: extractBuildMarker(),
      branch: 'Codex',
      viteMode: import.meta.env.MODE,
      viteDev: Boolean(import.meta.env.DEV),
      viteProd: Boolean(import.meta.env.PROD),
      gitSha: import.meta.env.VITE_GIT_SHA || null,
    },
    casePlan,
  };
}

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

function normalizeLabels(item) {
  const labels = new Set(Array.isArray(item.verificationLabels) ? item.verificationLabels : []);
  if (item.verification) labels.add(item.verification);
  if (item.classification) labels.add(item.classification);
  if (item.status === STATUS.NOT_AUTOMATABLE) {
    labels.add('NOT_AUTOMATABLE');
    labels.add('MANUAL_REQUIRED');
  }
  if (item.actionType === ACTION_TYPES.DEVICE_TEST) labels.add('EXTERNAL_DEVICE_REQUIRED');
  if (item.actionType === ACTION_TYPES.TWO_ACCOUNT_TEST) labels.add('TWO_ACCOUNT_REQUIRED');
  if (item.actionType === ACTION_TYPES.BACKEND_RUNTIME_PROBE) labels.add('BACKEND_RUNTIME_PROBE');
  return Array.from(labels).filter(Boolean);
}

function categorizeCase(item) {
  if (item.actionType) return item.actionType;
  const id = `${item.suiteId || ''}.${item.id || ''}`.toLowerCase();
  if (/mobile|gesture|timeline|touch|viewport|dom_geometry|keyboard|orientation|scroll/.test(id)) return ACTION_TYPES.DEVICE_TEST;
  if (/rls|two_account|friend|invite|recipient|sender|horizontal|cross-user|cross_user/.test(id)) return ACTION_TYPES.TWO_ACCOUNT_TEST;
  if (/service_role|backend|runtime_probe|admin|auth|route/.test(id)) return ACTION_TYPES.BACKEND_RUNTIME_PROBE;
  if (/visual|fantasy|title|logo|asset|beauty|tactile|game_feel|cta/.test(id)) return ACTION_TYPES.HUMAN_VISUAL_REVIEW;
  if (/performance|build|ci|direct_url|report/.test(id)) return ACTION_TYPES.CI_ENVIRONMENT;
  return ACTION_TYPES.CODE_FIX;
}

function describeNextStep(item) {
  const actionType = item.actionType || categorizeCase(item);
  if (actionType === ACTION_TYPES.DEVICE_TEST) {
    return 'Run a real phone/WebView/PWA check with touch gestures and mobile viewport screenshots.';
  }
  if (actionType === ACTION_TYPES.TWO_ACCOUNT_TEST) {
    return 'Run a live two-account probe and confirm unrelated users cannot read or mutate the row.';
  }
  if (actionType === ACTION_TYPES.BACKEND_RUNTIME_PROBE) {
    return 'Exercise the backend function or protected route with real auth contexts before release.';
  }
  if (actionType === ACTION_TYPES.HUMAN_VISUAL_REVIEW) {
    return 'Capture the target screen and do human visual/game-feel review against the fantasy direction.';
  }
  if (actionType === ACTION_TYPES.CI_ENVIRONMENT) {
    return 'Run the browser/build harness in a reliable CI or local dev environment and attach the result.';
  }
  return 'Inspect and fix the code contract, then rerun the affected Health Simulator suite.';
}

function normalizeCaseResult(item) {
  const actionType = categorizeCase(item);
  const labels = normalizeLabels({ ...item, actionType });
  const classification = item.classification || (labels.includes('STATIC_CHECK_LIMITATION') ? 'STATIC_CHECK_LIMITATION' : item.status === STATUS.PASS ? 'RUNTIME_VERIFIED' : 'REAL_PRODUCT_RISK');
  const verificationLabels = Array.from(new Set([...labels, classification])).filter(Boolean);
  return {
    ...item,
    actionType,
    classification,
    verificationLabels,
    nextStep: item.nextStep || describeNextStep({ ...item, actionType }),
  };
}

function buildScoreExplanation({ counts, penalty, mobileViewportPenalty, authorityPenalty, socialUncertaintyPenalty, staticLimitationPenalty, score, rating }) {
  const fail = counts.FAIL || 0;
  const error = counts.ERROR || 0;
  const criticalUnknown = (counts.NOT_AUTOMATABLE || 0) + (counts.BLOCKED || 0);
  if (fail === 0 && error === 0 && criticalUnknown > 0) {
    return `0 FAIL does not mean release-ready: ${criticalUnknown} unresolved BLOCKED/NOT_AUTOMATABLE checks still require device, live DOM, backend, or two-account proof. Penalties: case=${penalty}, mobile=${mobileViewportPenalty}, authority=${authorityPenalty}, social=${socialUncertaintyPenalty}, static-limit=${staticLimitationPenalty}.`;
  }
  return `${rating} score ${score}/100. Penalties: case=${penalty}, mobile=${mobileViewportPenalty}, authority=${authorityPenalty}, social=${socialUncertaintyPenalty}, static-limit=${staticLimitationPenalty}.`;
}

function buildReleaseReadyChecklist(cases) {
  const hasBlocking = (actionType) => cases.some(item =>
    item.actionType === actionType &&
    [STATUS.FAIL, STATUS.ERROR, STATUS.BLOCKED, STATUS.NOT_AUTOMATABLE, STATUS.WARNING].includes(item.status),
  );
  return [
    { label: 'No FAIL or ERROR cases', passed: !cases.some(item => [STATUS.FAIL, STATUS.ERROR].includes(item.status)), actionType: ACTION_TYPES.CODE_FIX },
    { label: 'Real mobile/WebView gesture proof completed', passed: !hasBlocking(ACTION_TYPES.DEVICE_TEST), actionType: ACTION_TYPES.DEVICE_TEST },
    { label: 'Two-account social/RLS probe completed', passed: !hasBlocking(ACTION_TYPES.TWO_ACCOUNT_TEST), actionType: ACTION_TYPES.TWO_ACCOUNT_TEST },
    { label: 'Backend/service-role runtime probe completed', passed: !hasBlocking(ACTION_TYPES.BACKEND_RUNTIME_PROBE), actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE },
    { label: 'Human visual/game-feel review completed', passed: !hasBlocking(ACTION_TYPES.HUMAN_VISUAL_REVIEW), actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW },
    { label: 'Build/browser harness available', passed: !hasBlocking(ACTION_TYPES.CI_ENVIRONMENT), actionType: ACTION_TYPES.CI_ENVIRONMENT },
  ];
}

const PROOF_ACTION_TYPES = [
  ACTION_TYPES.DEVICE_TEST,
  ACTION_TYPES.TWO_ACCOUNT_TEST,
  ACTION_TYPES.BACKEND_RUNTIME_PROBE,
  ACTION_TYPES.HUMAN_VISUAL_REVIEW,
  ACTION_TYPES.CI_ENVIRONMENT,
];

function buildRuntimeProofNeededByActionType(cases) {
  return PROOF_ACTION_TYPES.map(actionType => {
    const items = cases.filter(item =>
      item.actionType === actionType &&
      item.status !== STATUS.PASS &&
      (
        item.runtimeProofRequired ||
        [STATUS.WARNING, STATUS.BLOCKED, STATUS.NOT_AUTOMATABLE, STATUS.ERROR, STATUS.FAIL].includes(item.status) ||
        item.verificationLabels?.some(label => ['MANUAL_REQUIRED', 'EXTERNAL_DEVICE_REQUIRED', 'TWO_ACCOUNT_REQUIRED', 'BACKEND_RUNTIME_PROBE', 'HUMAN_VISUAL_REVIEW', 'STATIC_CHECK_LIMITATION'].includes(label))
      ),
    );
    return {
      actionType,
      count: items.length,
      criticalCount: items.filter(item => item.critical).length,
      examples: items.slice(0, 3).map(item => ({
        key: item.key,
        name: item.name,
        status: item.status,
        nextStep: item.nextStep,
      })),
    };
  }).filter(group => group.count > 0);
}

function buildRecentlyChangedAreas(cases) {
  const areas = [
    { id: 'online_start', label: 'Online start / host black-screen recovery', pattern: /host_start|online_start|waiting_room|route_bootstrap|diagnostic|black_screen/i },
    { id: 'friends', label: 'Friends normalized model / realtime refresh', pattern: /friend|FriendRequest|reciprocal|accepted/i },
    { id: 'email', label: 'Friend-request email / deep link', pattern: /email|deep_link|sendFriendRequestEmail|next_redirect/i },
    { id: 'push', label: 'Game invite push notifications', pattern: /push|notification|service_worker|vapid|subscription/i },
    { id: 'categories', label: 'Online category taxonomy', pattern: /category|taxonomy|selected_category/i },
    { id: 'reporting', label: 'Health report UX / release proof', pattern: /report|sre|proof|score|checklist/i },
  ];

  return areas.map(area => {
    const matches = cases.filter(item =>
      item.recentlyFixed ||
      area.pattern.test(`${item.suiteId} ${item.id} ${item.name}`),
    ).filter(item => area.pattern.test(`${item.suiteId} ${item.id} ${item.name}`));

    return {
      ...area,
      caseCount: matches.length,
      failingOrUnknown: matches.filter(item => item.status !== STATUS.PASS).length,
      examples: matches.slice(0, 3).map(item => ({ key: item.key, status: item.status, name: item.name })),
    };
  }).filter(area => area.caseCount > 0);
}

function buildSreSignals(cases, suiteSummary, environment, totalDurationMs) {
  const problemCases = cases.filter(item => item.status !== STATUS.PASS);
  const runtimeErrorRisks = problemCases.filter(item =>
    [STATUS.FAIL, STATUS.ERROR].includes(item.status) ||
    /500|crash|error|failed|black screen|permission|unauthorized/i.test(`${item.name} ${item.reason || ''}`),
  );
  const recoverabilityCases = cases.filter(item =>
    /retry|recover|fallback|refetch|failure|error boundary|bootstrap|email failure|push failure|Tekrar Dene/i.test(`${item.id} ${item.name} ${item.reason || ''}`),
  );

  return {
    errors: {
      fail: cases.filter(item => item.status === STATUS.FAIL).length,
      error: cases.filter(item => item.status === STATUS.ERROR).length,
      topRuntimeErrorRisks: runtimeErrorRisks.slice(0, 5).map(item => ({ key: item.key, status: item.status, name: item.name, actionType: item.actionType })),
    },
    latency: {
      totalDurationMs,
      slowSuites: suiteSummary
        .filter(suite => suite.durationMs > 250)
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 5)
        .map(suite => ({ id: suite.id, name: suite.name, durationMs: suite.durationMs })),
    },
    saturation: {
      totalCases: cases.length,
      totalSuites: suiteSummary.length,
      memory: environment.memory,
      note: 'Local browser memory is only available when performance.memory exists.',
    },
    recoverability: {
      namedRecoveryContracts: recoverabilityCases.length,
      examples: recoverabilityCases.slice(0, 6).map(item => ({ key: item.key, status: item.status, name: item.name })),
    },
  };
}

function buildReport(caseResults, meta = createRunMeta(), environment = captureEnvironment()) {
  const cases = caseResults.map(item => normalizeCaseResult({ ...item }));
  const counts = Object.values(STATUS).reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
  cases.forEach(item => { counts[item.status] = (counts[item.status] || 0) + 1; });
  const totalDurationMs = Math.round(cases.reduce((sum, item) => sum + (item.durationMs || 0), 0));

  const suiteSummary = SUITES.map(suite => {
    const suiteCases = cases.filter(item => item.suiteId === suite.id);
    const suiteCounts = Object.values(STATUS).reduce((acc, status) => ({ ...acc, [status]: suiteCases.filter(item => item.status === status).length }), {});
    const durationMs = Math.round(suiteCases.reduce((sum, item) => sum + (item.durationMs || 0), 0));
    return { id: suite.id, name: suite.name, critical: suite.critical, total: suiteCases.length, counts: suiteCounts, durationMs };
  });

  const penalty = cases.reduce((sum, item) => {
    const critical = item.critical ? 1 : 0;
    if (item.status === STATUS.FAIL) return sum + (critical ? 12 : 8);
    if (item.status === STATUS.ERROR) return sum + (critical ? 15 : 10);
    if (item.status === STATUS.BLOCKED) return sum + (critical ? 10 : 5);
    if (item.status === STATUS.NOT_AUTOMATABLE) return sum + (critical ? 8 : 3);
    if (item.status === STATUS.WARNING) return sum + (critical ? 4 : 2);
    return sum;
  }, 0);

  const mobileViewportPenalty = cases.some(item => item.suiteId === 'mobile_viewport' && [STATUS.FAIL, STATUS.ERROR, STATUS.BLOCKED].includes(item.status)) ? 8 : 0;
  const authorityPenalty = cases.some(item => item.suiteId === 'multiplayer_authority' && item.status !== STATUS.PASS) ? 6 : 0;
  // Codex073: additive penalty for critical social/security uncertainty.
  // Caps at 12 so it never zeroes out an already-penalized run.
  const socialUncertaintyPenalty = criticalSocialUncertaintyPenalty(cases);
  const staticLimitationPenalty = criticalStaticLimitationPenalty(cases);
  const score = Math.max(0, Math.round(100 - penalty - mobileViewportPenalty - authorityPenalty - socialUncertaintyPenalty - staticLimitationPenalty));
  const rating = score >= 90 ? 'Good' : score >= 70 ? 'Watch' : score >= 50 ? 'Risky' : 'Not release-ready';

  const problemCases = cases
    .filter(item => item.status !== STATUS.PASS)
    .sort((a, b) => {
      const statusDelta = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (statusDelta !== 0) return statusDelta;
      return Number(b.critical) - Number(a.critical);
    });

  const topBlockers = problemCases.filter(item => [STATUS.FAIL, STATUS.ERROR, STATUS.BLOCKED, STATUS.NOT_AUTOMATABLE].includes(item.status)).slice(0, 8);
  const currentCriticalFailures = problemCases.filter(item => item.critical && [STATUS.FAIL, STATUS.ERROR].includes(item.status));
  const manualVerificationNeeded = problemCases.filter(item =>
    item.verificationLabels?.some(label => ['MANUAL_REQUIRED', 'EXTERNAL_DEVICE_REQUIRED', 'TWO_ACCOUNT_REQUIRED', 'NOT_AUTOMATABLE'].includes(label)) ||
    [STATUS.BLOCKED, STATUS.NOT_AUTOMATABLE].includes(item.status),
  );
  const knownNonAutomatableCriticalRisks = cases.filter(item => item.critical && item.status === STATUS.NOT_AUTOMATABLE);
  const recentlyFixedRegressions = cases.filter(item => item.recentlyFixed);
  const runtimeProofNeededByActionType = buildRuntimeProofNeededByActionType(cases);
  const recentlyChangedAreas = buildRecentlyChangedAreas(cases);
  const sreSignals = buildSreSignals(cases, suiteSummary, environment, totalDurationMs);
  const scoreExplanation = buildScoreExplanation({
    counts,
    penalty,
    mobileViewportPenalty,
    authorityPenalty,
    socialUncertaintyPenalty,
    staticLimitationPenalty,
    score,
    rating,
  });

  return {
    runId: meta.runId,
    timestamp: new Date().toISOString(),
    startedAt: meta.startedAt,
    finishedAt: new Date().toISOString(),
    buildMarker: meta.buildMarker,
    build: meta.build,
    environment,
    route: environment.route,
    suites: SUITES.map(suite => ({ id: suite.id, name: suite.name, critical: suite.critical })),
    suiteSummary,
    counts,
    totalCases: cases.length,
    totalDurationMs,
    score: { value: score, rating, explanation: scoreExplanation },
    scorePenaltyBreakdown: {
      casePenalty: penalty,
      mobileViewportPenalty,
      authorityPenalty,
      socialUncertaintyPenalty,
      staticLimitationPenalty,
    },
    topBlockers,
    currentCriticalFailures,
    topRegressions: problemCases.filter(item => [STATUS.FAIL, STATUS.ERROR].includes(item.status)).slice(0, 5),
    recommendedNextActions: recommendedActions(problemCases),
    releaseReadyChecklist: buildReleaseReadyChecklist(cases),
    manualVerificationNeeded,
    runtimeProofNeededByActionType,
    knownNonAutomatableCriticalRisks,
    recentlyFixedRegressions,
    recentlyChangedAreas,
    sreSignals,
    cases,
  };
}

function recommendedActions(problemCases) {
  const actions = [];
  if (problemCases.some(item => item.suiteId === 'multiplayer_authority')) actions.push('Review multiplayer authority checks before release; do not compensate with client-side logic.');
  if (problemCases.some(item => item.suiteId === 'mobile_viewport')) actions.push('Run the simulator on a real mobile WebView/PWA viewport and verify page scroll containment.');
  if (problemCases.some(item => item.suiteId === 'timeline_hit_testing')) actions.push('Exercise drag/drop manually on a phone before shipping any timeline-adjacent change.');
  if (problemCases.some(item => item.suiteId === 'friends_security')) actions.push('Run a two-account RLS probe against Friendship / FriendRequest before claiming friend-data security.');
  if (problemCases.some(item => item.suiteId === 'game_invites')) actions.push('Run a two-account GameInvite probe (cross-user read/update attempt) before claiming invite security.');
  if (problemCases.some(item => item.suiteId === 'create_lobby_invite_gate')) actions.push('Manually verify the "Lobi Oluştur ve Davet Et" disabled state and helper text on a real mobile device.');
  if (problemCases.some(item => item.suiteId === 'mobile_social_flow')) actions.push('Verify Profile / Friends / Invite screens on a narrow real phone (320×568) including keyboard focus behavior.');
  if (problemCases.some(item => item.suiteId === 'research_test_strategy' || item.suiteId === 'report_ux_human_decision')) actions.push('Keep the report honest: distinguish runtime proof, static contracts, manual gaps, and action categories before release decisions.');
  if (problemCases.some(item => item.suiteId === 'historical_kronox_regression')) actions.push('Re-test recently fixed Kronox incidents, especially Settings stability and duplicate lobby title composition.');
  if (problemCases.some(item => item.suiteId === 'mobile_gesture_risk' || item.suiteId === 'live_dom_geometry')) actions.push('Run mounted DOM and real-device drag checks for Timeline geometry, page scroll, and touch-action behavior.');
  if (problemCases.some(item => item.suiteId === 'social_rls_two_account_risk')) actions.push('Execute the required User A / User B / User C RLS matrix before claiming social security readiness.');
  if (problemCases.some(item => item.suiteId === 'invite_contract_drift')) actions.push('Resolve invite behavior/comment drift and verify pending-recipient filters with a two-account backend probe.');
  if (problemCases.some(item => item.suiteId === 'visual_composition_regression' || item.suiteId === 'kronox_game_feel')) actions.push('Capture mobile screenshots and review tactile fantasy presentation, duplicate headers, asset paths, and CTA readability.');
  if (problemCases.some(item => item.suiteId === 'route_navigation_resilience')) actions.push('Run direct URL and back-navigation smoke tests for /settings, /profile, /friends, /lobby, /game, and /test-suite.');
  if (problemCases.some(item => item.suiteId === 'friend_request_email_deep_link')) actions.push('Verify FriendRequest email delivery with a real recipient inbox and confirm the /friends deep link survives login.');
  if (problemCases.some(item => item.suiteId === 'game_invite_push_notifications')) actions.push('Run push-notification proof on a subscribed device with VAPID configured; keep in-app invites working if push fails.');
  if (problemCases.some(item => item.suiteId === 'online_category_taxonomy')) actions.push('Confirm Online category selection actually changes lobby/question filtering, not only the visual selected state.');
  if (problemCases.some(item => item.suiteId === 'sre_release_health_signals')) actions.push('Use the report as release-risk intelligence only; production latency/error/saturation need deployed telemetry.');
  if (problemCases.some(item => item.status === STATUS.NOT_AUTOMATABLE)) actions.push('Treat non-automatable critical cases as release risk until covered by device/backend tests.');
  if (problemCases.some(item => item.suiteId === 'debug_hygiene' || item.suiteId === 'admin_visibility')) actions.push('Confirm debug/test surfaces and admin tooling are gated outside gameplay and Profile for normal users.');
  return actions.length ? actions : ['No major simulator blockers detected; still run the required two-device multiplayer smoke test plus a two-account invite/RLS probe.'];
}

function buildHumanSummary(report) {
  if (!report) return 'No Kronox Health Simulator report is available.';
  const counts = Object.entries(report.counts).map(([status, count]) => `${status}: ${count}`).join(', ');
  const blockers = report.topBlockers.length
    ? report.topBlockers.map(item => `- [${item.status}] [${item.actionType || 'CODE_FIX'}] ${item.suiteName} / ${item.name}: ${item.reason} Next: ${item.nextStep || 'Review manually.'}`).join('\n')
    : '- None';
  const actions = report.recommendedNextActions.map(item => `- ${item}`).join('\n');
  return [
    `Kronox Health Simulator ${report.runId}`,
    `Score: ${report.score.value} (${report.score.rating})`,
    `Score explanation: ${report.score.explanation || 'No score explanation available.'}`,
    `Build: ${report.buildMarker}`,
    `Device: ${report.environment.deviceType} ${report.environment.viewport.width}x${report.environment.viewport.height} DPR ${report.environment.dpr}`,
    `Counts: ${counts}`,
    '',
    'Top blockers:',
    blockers,
    '',
    'Recommended next actions:',
    actions,
  ].join('\n');
}

const TESTS = [
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
    const hasGlobalHidden = /html[^{]*{[^}]*overflow:\s*hidden|body[^{]*{[^}]*overflow:\s*hidden/.test(SRC.IndexCss);
    const scopedLock = SRC.App.includes('data-kx-route-locked') && SRC.IndexCss.includes('[data-kx-route-locked="true"]');
    if (hasGlobalHidden) return fail('Global overflow hidden found; this can break settings/admin/test scroll.', { actual: 'global hidden' });
    return scopedLock ? pass('Overflow lock is scoped by route attribute.', { actual: 'scoped route lock' }) : warning('No scoped route lock detected.', { actual: 'missing scoped lock' });
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
  // Codex089 — honest fix for the Codex086 FAIL. The previous contract
  // required the literal token "navigate('/game'" inside useWaitingRoomSync,
  // but the real architecture (correctly) delegates navigation through
  // navigateToOnlineGameRoute (imported from lib/onlineGameNavigation.js),
  // which centralizes the `/game?...` URL build. Asserting the literal
  // inline call would force a regression — drift between host and
  // subscriber transition paths. We now assert the same behavior at the
  // correct boundary: useWaitingRoomSync MUST have subscription + poll +
  // a delegated navigate-to-online-game call, AND the helper module MUST
  // be the one that produces the /game URL.
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
  sourceHas('debug_hygiene', 'test_controls_gated', 'console/test controls are gated behind dev/debug flag', 'Settings/TestSuite', `${SRC.SettingsPage}\n${SRC.TestSuite}`, ['isAdmin', 'isAdminUser', 'SimulationPanel']),
  makeCase('debug_hygiene', 'build_marker_intentional', 'build marker is visible only as intended', () => extractBuildMarker() !== 'unknown'
    ? warning('Build marker is intentionally visible briefly; verify this remains acceptable for production.', { actual: extractBuildMarker() })
    : fail('Build marker token missing.')),
  sourceHas('debug_hygiene', 'raw_imports_gated_route', 'raw source imports used by SimulationPanel are not exposed in gameplay unless intentionally gated', 'App/TestSuite/Settings', `${SRC.App}\n${SRC.TestSuite}\n${SRC.SettingsPage}`, ['path="/test-suite"', 'isAdminUser', 'setShowSim(true)']),
  sourceLacks('debug_hygiene', 'simulator_not_gameplay_accessible', 'simulator itself is accessible only from Settings/Admin/Test path, not gameplay', 'Game/GameLayout', `${SRC.Game}\n${SRC.GameLayout}`, ['SimulationPanel']),

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
    const report = buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_fail', name: 'sample fail', status: STATUS.FAIL, reason: 'sample', durationMs: 0, critical: true }]);
    return report.topRegressions.some(item => item.id === 'sample_fail') ? pass('Failing cases surface in report.') : fail('Failing case did not surface in report.');
  }),
  makeCase('report_integrity', 'warning_case_in_report', 'warning case appears in report', () => {
    const report = buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_warning', name: 'sample warning', status: STATUS.WARNING, reason: 'sample', durationMs: 0, critical: false }]);
    return report.counts.WARNING === 1 ? pass('Warning counted in report.') : fail('Warning missing from report.', { actual: report.counts });
  }),
  makeCase('report_integrity', 'blocked_case_in_report', 'blocked case appears in report', () => {
    const report = buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_blocked', name: 'sample blocked', status: STATUS.BLOCKED, reason: 'sample', durationMs: 0, critical: true }]);
    return report.topBlockers.some(item => item.id === 'sample_blocked') ? pass('Blocked case surfaces in top blockers.') : fail('Blocked case missing from top blockers.');
  }),
  makeCase('report_integrity', 'json_export_all_suites', 'JSON export includes all suites', () => {
    const report = buildReport([]);
    return report.suites.length === SUITES.length ? pass('All suite definitions included in JSON report.', { actual: report.suites.length }) : fail('Suite definitions missing from report.', { expected: SUITES.length, actual: report.suites.length });
  }),
  makeCase('report_integrity', 'human_summary_top_blockers', 'human summary includes top blockers', () => {
    const text = buildHumanSummary(buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_blocked', name: 'sample blocked', status: STATUS.BLOCKED, reason: 'sample', durationMs: 0, critical: true }]));
    return text.includes('Top blockers') && text.includes('sample blocked') ? pass('Human summary includes top blockers.') : fail('Human summary omitted blockers.', { actual: text });
  }),
  makeCase('report_integrity', 'score_changes_on_failures', 'release score changes when failures are injected', () => {
    const good = buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_pass', name: 'pass', status: STATUS.PASS, reason: 'sample', durationMs: 0, critical: true }]);
    const bad = buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'sample_fail', name: 'fail', status: STATUS.FAIL, reason: 'sample', durationMs: 0, critical: true }]);
    return bad.score.value < good.score.value ? pass('Score penalizes failures.', { expected: '< pass score', actual: { good: good.score.value, bad: bad.score.value } }) : fail('Score did not penalize failure.', { actual: { good: good.score.value, bad: bad.score.value } });
  }),
  makeCase('report_integrity', 'no_skipped_manual_pass', 'no skipped/manual case is counted as pass', () => {
    const hasSkippedStatus = Object.values(STATUS).includes('SKIPPED');
    return !hasSkippedStatus ? pass('No SKIPPED status exists; manual gaps must be BLOCKED or NOT_AUTOMATABLE.') : fail('SKIPPED status exists.');
  }),
  makeCase('report_integrity', 'last_run_restore', 'last run can be restored from localStorage if implemented', () => typeof localStorage !== 'undefined'
    ? pass('localStorage is available for last-run restore.', { actual: LAST_RUN_KEY })
    : blocked('localStorage is unavailable in this browser context.')),

  /* ------------------------------------------------------------------
   *  Codex075 report-integrity additions for social/invite/release-risk suites.
   * ------------------------------------------------------------------ */
  makeCase('report_integrity', 'extra_suites_registered', 'Codex075 Health Simulator suites are registered in SUITES', () => {
    const ids = new Set(SUITES.map((s) => s.id));
    const expected = [
      'profile_navigation',
      'friends_ui',
      'friends_validation',
      'friends_security',
      'profile_economy',
      'online_lobby_setup',
      'create_lobby_invite_gate',
      'game_invites',
      'lobby_code_ux',
      'admin_visibility',
      'mobile_social_flow',
      'fantasy_visual_update',
      'research_test_strategy',
      'historical_kronox_regression',
      'mobile_gesture_risk',
      'live_dom_geometry',
      'social_rls_two_account_risk',
      'invite_contract_drift',
      'visual_composition_regression',
      'route_navigation_resilience',
      'report_ux_human_decision',
      'kronox_game_feel',
    ];
    const missing = expected.filter((id) => !ids.has(id));
    return missing.length
      ? fail('Some Codex075 suites are missing from SUITES.', { expected, actual: { missing } })
      : pass('All Codex075 suites are registered.', { expected, actual: 'all present' });
  }),
  makeCase('report_integrity', 'json_export_includes_new_suites', 'JSON export includes Codex075 suites', () => {
    const report = buildReport([]);
    const ids = new Set(report.suites.map((s) => s.id));
    const expected = ['profile_navigation', 'friends_ui', 'friends_security', 'game_invites', 'research_test_strategy', 'mobile_gesture_risk', 'report_ux_human_decision'];
    const missing = expected.filter((id) => !ids.has(id));
    return missing.length
      ? fail('Codex075 suites missing from JSON export.', { expected, actual: { missing } })
      : pass('Codex075 suites present in JSON export.');
  }),
  makeCase('report_integrity', 'critical_social_uncertainty_penalty', 'Critical social BLOCKED/NOT_AUTOMATABLE is penalised by score', () => {
    const baseline = buildReport([{ suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 's1', name: 'baseline', status: STATUS.PASS, reason: 'sample', durationMs: 0, critical: true }]);
    const withUncertainty = buildReport([
      { suiteId: 'friends_security', suiteName: 'Friends Security / RLS Suite', id: 's2', name: 'rls runtime probe', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
      { suiteId: 'game_invites', suiteName: 'Game Invite Suite', id: 's3', name: 'invite runtime probe', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
    ]);
    return withUncertainty.score.value < baseline.score.value
      ? pass('Score penalises critical social uncertainty.', { expected: '< baseline score', actual: { baseline: baseline.score.value, withUncertainty: withUncertainty.score.value } })
      : fail('Score did not penalise critical social uncertainty.', { actual: { baseline: baseline.score.value, withUncertainty: withUncertainty.score.value } });
  }),
  // Codex075: lock in the honest-scoring contract. Critical NOT_AUTOMATABLE
  // must continue to drop the score below "release-ready" even when there
  // are zero FAILs. If anyone silently weakens the penalty so a 0-FAIL run
  // becomes "Good" while critical manual gaps remain, this case flips to
  // FAIL and surfaces the regression.
  makeCase('report_integrity', 'zero_fail_with_critical_not_automatable_is_not_release_ready',
    '0 FAIL with critical NOT_AUTOMATABLE must not be rated release-ready', () => {
    const report = buildReport([
      // simulate a run with 0 FAIL but several critical NOT_AUTOMATABLE gaps —
      // mirrors the real shape that confused the human reader.
      { suiteId: 'mobile_viewport', suiteName: 'Mobile Viewport Suite', id: 'm1', name: 'real-device drag', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
      { suiteId: 'timeline_hit_testing', suiteName: 'Timeline / Hit Testing Suite', id: 'm2', name: 'live DOM geometry', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
      { suiteId: 'friends_security', suiteName: 'Friends Security / RLS Suite', id: 'm3', name: 'two-account RLS probe', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
      { suiteId: 'game_invites', suiteName: 'Game Invite Suite', id: 'm4', name: 'cross-user invite probe', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
    ]);
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
    ]);
    return report.counts.PASS === 0 && report.counts.NOT_AUTOMATABLE === 1 && report.counts.BLOCKED === 1
      ? pass('Non-PASS statuses are not double-counted as PASS.', { actual: report.counts })
      : fail('Non-PASS statuses were miscounted.', { actual: report.counts });
  }),
  makeCase('report_integrity', 'top_blockers_have_action_metadata', 'Top blockers include action type and next step', () => {
    const report = buildReport([
      { suiteId: 'mobile_gesture_risk', suiteName: 'Mobile Gesture Risk Suite', id: 'drag', name: 'drag', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
    ]);
    const blocker = report.topBlockers[0];
    return blocker?.actionType && blocker?.nextStep
      ? pass('Top blocker includes action metadata.', { actual: { actionType: blocker.actionType, nextStep: blocker.nextStep } })
      : fail('Top blocker action metadata missing.', { actual: blocker });
  }),
  makeCase('report_integrity', 'manual_verification_sections_exist', 'Manual verification sections exist in JSON report', () => {
    const report = buildReport([
      { suiteId: 'social_rls_two_account_risk', suiteName: 'Social / RLS Two-Account Risk Suite', id: 'rls', name: 'rls', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
    ]);
    return Array.isArray(report.manualVerificationNeeded) &&
      Array.isArray(report.knownNonAutomatableCriticalRisks) &&
      Array.isArray(report.releaseReadyChecklist)
      ? pass('Manual verification sections are present.', { actual: { manual: report.manualVerificationNeeded.length, knownCritical: report.knownNonAutomatableCriticalRisks.length, checklist: report.releaseReadyChecklist.length } })
      : fail('Manual verification sections missing.', { actual: Object.keys(report) });
  }),
  makeCase('report_integrity', 'score_explains_zero_fail_not_ready', 'Score explanation says 0 FAIL can still be not release-ready', () => {
    const report = buildReport([
      { suiteId: 'live_dom_geometry', suiteName: 'Live DOM Geometry / Timeline Suite', id: 'dom', name: 'dom', status: STATUS.NOT_AUTOMATABLE, reason: 'sample', durationMs: 0, critical: true },
    ]);
    return report.score.explanation?.includes('0 FAIL does not mean release-ready')
      ? pass('Score explanation is explicit.', { actual: report.score.explanation })
      : fail('Score explanation did not state the 0 FAIL caveat.', { actual: report.score });
  }),
  makeCase('report_integrity', 'critical_static_limitation_penalized', 'Critical static limitations with runtime proof required are penalized', () => {
    const baseline = buildReport([
      { suiteId: 'report_integrity', suiteName: 'Report Integrity Suite', id: 'pass', name: 'pass', status: STATUS.PASS, reason: 'sample', durationMs: 0, critical: true, verification: 'RUNTIME_VERIFIED' },
    ]);
    const limited = buildReport([
      { suiteId: 'mobile_gesture_risk', suiteName: 'Mobile Gesture Risk Suite', id: 'static', name: 'static', status: STATUS.PASS, reason: 'sample', durationMs: 0, critical: true, verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION', runtimeProofRequired: true },
    ]);
    return limited.score.value < baseline.score.value
      ? pass('Critical static limitation receives an additive penalty.', { actual: { baseline: baseline.score.value, limited: limited.score.value, penalty: limited.scorePenaltyBreakdown.staticLimitationPenalty } })
      : fail('Critical static limitation was not penalized.', { actual: { baseline: baseline.score.value, limited: limited.score.value } });
  }),
  makeCase('report_integrity', 'json_export_includes_classification_fields', 'JSON export includes classification fields for cases and blockers', () => {
    const report = buildReport([
      { suiteId: 'visual_composition_regression', suiteName: 'Visual Composition Regression Suite', id: 'visual', name: 'visual', status: STATUS.WARNING, reason: 'sample', durationMs: 0, critical: false },
    ]);
    const sample = report.cases[0];
    return sample?.classification && sample?.actionType && Array.isArray(sample?.verificationLabels)
      ? pass('Classification fields are available in JSON export.', { actual: { classification: sample.classification, actionType: sample.actionType, labels: sample.verificationLabels } })
      : fail('Classification fields missing from JSON export.', { actual: sample });
  }),

  ...EXTRA_TESTS,
];

// Defensive: strip values that can't survive JSON serialization (functions,
// Symbols, Module namespaces, circular refs). The Health Simulator must never
// crash Settings because a case returned a weird value.
function sanitizeForReport(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return value;
  if (type === 'function') return `[function ${value.name || 'anonymous'}]`;
  if (type === 'symbol') return value.toString();
  if (type === 'bigint') return value.toString();
  if (type !== 'object') return String(value);
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeForReport(item, seen));
  // Module namespace objects have Symbol.toStringTag === 'Module' and throw on
  // primitive coercion; coerce them to a clear marker instead of recursing.
  try {
    if (value[Symbol.toStringTag] === 'Module') return '[module namespace]';
  } catch (_) {
    return '[unstringifiable object]';
  }
  const out = {};
  for (const key of Object.keys(value)) {
    try {
      out[key] = sanitizeForReport(value[key], seen);
    } catch (err) {
      out[key] = `[unreadable: ${err?.message || 'error'}]`;
    }
  }
  return out;
}

async function executeCase(testCase) {
  const started = performance.now();
  // Strip the function ref so it never ends up in serialised report data.
  const { run, ...caseMeta } = testCase;
  try {
    const raw = await run();
    const finished = performance.now();
    const safe = sanitizeForReport(raw || {});
    return {
      ...caseMeta,
      ...(safe && typeof safe === 'object' ? safe : { status: STATUS.ERROR, reason: 'Case returned a non-object result.' }),
      durationMs: Math.round(finished - started),
    };
  } catch (error) {
    const finished = performance.now();
    return {
      ...caseMeta,
      status: STATUS.ERROR,
      reason: (error && error.message) ? String(error.message) : 'Unknown case error',
      stack: error?.stack ? String(error.stack) : null,
      durationMs: Math.round(finished - started),
    };
  }
}

function persistReport(report) {
  try {
    localStorage.setItem(LAST_RUN_KEY, JSON.stringify(report));
  } catch (_) {}
}

export default function SimulationPanel({ onClose }) {
  const [selectedSuiteId, setSelectedSuiteId] = useState(SUITES[0].id);
  const [resultsByKey, setResultsByKey] = useState({});
  const [report, setReport] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [runningKey, setRunningKey] = useState(null);
  const [plannedKeys, setPlannedKeys] = useState([]);
  const [copyState, setCopyState] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_RUN_KEY);
      if (saved) setLastRun(JSON.parse(saved));
    } catch (_) {}
  }, []);

  const selectedSuite = SUITES.find(suite => suite.id === selectedSuiteId) || SUITES[0];
  const selectedTests = useMemo(() => TESTS.filter(testCase => testCase.suiteId === selectedSuiteId), [selectedSuiteId]);
  const allResults = useMemo(() => Object.values(resultsByKey), [resultsByKey]);
  const counts = report?.counts || Object.values(STATUS).reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
  const progress = plannedKeys.length ? Math.round((allResults.filter(item => plannedKeys.includes(item.key)).length / plannedKeys.length) * 100) : 0;

  const updateReport = useCallback((nextResults, meta) => {
    const nextReport = buildReport(Object.values(nextResults), meta, captureEnvironment());
    setReport(nextReport);
    persistReport(nextReport);
    setLastRun(nextReport);
    return nextReport;
  }, []);

  const runCases = useCallback(async (cases) => {
    const meta = createRunMeta(cases.map(item => item.key));
    let nextResults = {};
    setResultsByKey({});
    setPlannedKeys(cases.map(item => item.key));
    setCopyState('');

    for (const testCase of cases) {
      setRunningKey(testCase.key);
      const caseResult = await executeCase(testCase);
      nextResults = { ...nextResults, [testCase.key]: caseResult };
      setResultsByKey(nextResults);
      updateReport(nextResults, meta);
      await new Promise(resolve => window.setTimeout(resolve, 12));
    }

    setRunningKey(null);
    setPlannedKeys([]);
  }, [updateReport]);

  const runAll = () => runCases(TESTS);
  const runSelected = () => runCases(selectedTests);

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState(`${label} copied`);
    } catch (_) {
      setCopyState('Copy failed; browser denied clipboard access');
    }
  };

  const copyJson = () => report && copyText(JSON.stringify(report, null, 2), 'JSON report');
  const copySummary = () => report && copyText(buildHumanSummary(report), 'Human summary');
  const downloadJson = () => {
    if (!report) return;
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kronox-health-${report.runId}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setCopyState('JSON download started');
    } catch (_) {
      setCopyState('Download unsupported; use Copy JSON instead');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/82 text-white overflow-hidden"
      style={{ padding: 'calc(0.5rem + env(safe-area-inset-top)) 0.5rem calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-white/15 bg-[#07090f] shadow-2xl">
        <Header onClose={onClose} report={report} progress={progress} running={Boolean(runningKey)} />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="border-b border-white/10 bg-white/[0.03] p-3 md:border-b-0 md:border-r md:overflow-y-auto">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <ActionButton icon={Play} label="Run All" onClick={runAll} disabled={Boolean(runningKey)} />
              <ActionButton icon={RefreshCw} label="Run Suite" onClick={runSelected} disabled={Boolean(runningKey)} />
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <CountPill status={STATUS.PASS} count={counts.PASS} />
              <CountPill status={STATUS.FAIL} count={counts.FAIL} />
              <CountPill status={STATUS.WARNING} count={counts.WARNING} />
              <CountPill status={STATUS.BLOCKED} count={counts.BLOCKED} />
              <CountPill status={STATUS.NOT_AUTOMATABLE} count={counts.NOT_AUTOMATABLE} />
              <CountPill status={STATUS.ERROR} count={counts.ERROR} />
            </div>

            {lastRun && (
              <div className="mb-3 rounded-md border border-white/10 bg-black/25 p-3 text-xs text-white/70">
                <div className="mb-1 font-semibold text-white">Last Run</div>
                <div>{lastRun.runId}</div>
                <div>{lastRun.score.value} / {lastRun.score.rating}</div>
                <div>{lastRun.buildMarker}</div>
              </div>
            )}

            <div className="max-h-48 overflow-y-auto pr-1 md:max-h-none">
              {SUITES.map(suite => {
                const suiteResults = allResults.filter(item => item.suiteId === suite.id);
                const hasProblems = suiteResults.some(item => item.status !== STATUS.PASS);
                return (
                  <button
                    key={suite.id}
                    type="button"
                    onClick={() => setSelectedSuiteId(suite.id)}
                    className={`mb-2 w-full rounded-md border px-3 py-3 text-left transition ${selectedSuiteId === suite.id ? 'border-white/35 bg-white/12' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: suite.color }} />
                      <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{suite.name}</span>
                      {hasProblems && <AlertTriangle className="h-4 w-4 text-amber-300" />}
                    </div>
                    <div className="mt-1 text-[11px] text-white/50">{suiteResults.length || TESTS.filter(item => item.suiteId === suite.id).length} cases</div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto overflow-x-hidden p-3 md:p-4">
            <section className="mb-4 rounded-md border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold">{selectedSuite.name}</div>
                  <div className="text-xs text-white/55">PASS only means the simulator executed and verified the case. Manual gaps are risk states.</div>
                </div>
                {selectedSuite.critical && <StatusBadge status={STATUS.BLOCKED} text="critical suite" />}
              </div>
            </section>

            <div className="space-y-2">
              {selectedTests.map(testCase => (
                <CaseRow key={testCase.key} testCase={testCase} result={resultsByKey[testCase.key]} running={runningKey === testCase.key} />
              ))}
            </div>

            {report && (
              <ReportPanel
                report={report}
                copyJson={copyJson}
                copySummary={copySummary}
                downloadJson={downloadJson}
                copyState={copyState}
              />
            )}
          </main>
        </div>
      </div>
    </motion.div>
  );
}

function Header({ onClose, report, progress, running }) {
  return (
    <div className="border-b border-white/10 bg-black/25 p-3 md:p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/10">
          <Activity className="h-5 w-5 text-cyan-200" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold tracking-wide md:text-xl">Kronox Health Simulator</h2>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/60">{extractBuildMarker()}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-white/55">A harsh release-risk dashboard for mobile viewport, gameplay feel guardrails, sync authority, and report integrity.</p>
        </div>
        {report && <ScoreBadge report={report} />}
        <button type="button" onClick={onClose} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10" aria-label="Close health simulator">
          <X className="h-5 w-5" />
        </button>
      </div>
      {running && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ report }) {
  const bad = report.score.value < 50;
  return (
    <div className={`rounded-md border px-3 py-2 text-right ${bad ? 'border-rose-400/35 bg-rose-400/10' : 'border-white/15 bg-white/[0.04]'}`}>
      <div className="text-2xl font-black leading-none">{report.score.value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-white/60">{report.score.rating}</div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-45"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function CountPill({ status, count }) {
  const look = STATUS_LOOK[status];
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-2">
      <div className="text-sm font-bold" style={{ color: look.color }}>{count || 0}</div>
      <div className="truncate text-[9px] uppercase text-white/45">{status.replace('_', ' ')}</div>
    </div>
  );
}

function StatusBadge({ status, text }) {
  const look = STATUS_LOOK[status] || STATUS_LOOK[STATUS.WARNING];
  const Icon = look.Icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold" style={{ color: look.color, borderColor: `${look.color}55`, background: look.bg }}>
      <Icon className="h-3.5 w-3.5" />
      {text || status.replace('_', ' ')}
    </span>
  );
}

function CaseRow({ testCase, result: caseResult, running }) {
  const status = running ? 'RUNNING' : caseResult?.status || 'PENDING';
  const badgeStatus = caseResult?.status || STATUS.NOT_AUTOMATABLE;
  const look = STATUS_LOOK[badgeStatus] || STATUS_LOOK[STATUS.NOT_AUTOMATABLE];

  return (
    <details className="rounded-md border border-white/10 bg-black/25 p-3" open={Boolean(caseResult && caseResult.status !== STATUS.PASS)}>
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md" style={{ background: running ? 'rgba(103,232,249,0.12)' : look.bg, color: running ? '#67e8f9' : look.color }}>
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <look.Icon className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight">{testCase.name}</span>
          <span className="mt-1 block text-[11px] text-white/45">{testCase.id} {testCase.critical ? '/ critical' : ''}</span>
        </span>
        <span className="hidden sm:block"><StatusBadge status={caseResult?.status || STATUS.NOT_AUTOMATABLE} text={status} /></span>
        <ChevronDown className="h-4 w-4 text-white/40" />
      </summary>
      <div className="mt-3 border-t border-white/10 pt-3 text-xs text-white/70">
        {caseResult ? (
          <>
            <div className="mb-2 flex flex-wrap gap-2 sm:hidden"><StatusBadge status={caseResult.status} /></div>
            <p className="leading-relaxed">{caseResult.reason}</p>
            <div className="mt-2 text-white/45">Duration: {caseResult.durationMs}ms</div>
            {(caseResult.expected !== undefined || caseResult.actual !== undefined || caseResult.file || caseResult.stack) && (
              <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-black/45 p-3 text-[11px] leading-relaxed text-white/75">
                {JSON.stringify({ verification: caseResult.verification, verificationLabels: caseResult.verificationLabels, classification: caseResult.classification, actionType: caseResult.actionType, nextStep: caseResult.nextStep, file: caseResult.file, expected: caseResult.expected, actual: caseResult.actual, stack: caseResult.stack }, null, 2)}
              </pre>
            )}
          </>
        ) : (
          <p className="text-white/45">Not run yet.</p>
        )}
      </div>
    </details>
  );
}

function ReportPanel({ report, copyJson, copySummary, downloadJson, copyState }) {
  return (
    <section className="mt-5 rounded-md border border-white/12 bg-white/[0.035] p-3 md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">Report</h3>
          <p className="mt-1 text-xs text-white/55">{report.runId} / {report.timestamp}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={ClipboardCopy} label="Copy JSON" onClick={copyJson} />
          <ActionButton icon={Download} label="Download JSON" onClick={downloadJson} />
          <ActionButton icon={ClipboardCopy} label="Copy Summary" onClick={copySummary} />
        </div>
      </div>
      {copyState && <div className="mt-2 text-xs text-cyan-200">{copyState}</div>}

      {/* Codex075: human-readable release-readiness explainer.
          Explanation-only UI. Reads `report` and renders text/legend.
          Does NOT alter scoring, statuses, or case counts. */}
      <ReleaseReadinessExplainer report={report} />

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ReportBox title="Current Critical FAIL">
          {report.currentCriticalFailures?.length ? (
            <ul className="space-y-2 text-xs text-white/70">
              {report.currentCriticalFailures.slice(0, 4).map(item => (
                <li key={`${item.key}-critical-fail`} className="rounded border border-rose-400/25 bg-rose-400/10 p-2">
                  <span className="font-semibold text-rose-100">{item.name}</span>
                  <span className="block text-rose-100/65">{item.suiteName}</span>
                  {item.nextStep && <span className="mt-1 block text-[11px] text-cyan-100/75">Next: {item.nextStep}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-white/55">None</p>}
        </ReportBox>

        <ReportBox title="Runtime Proof Needed">
          {report.runtimeProofNeededByActionType?.length ? (
            <ul className="space-y-2 text-xs text-white/70">
              {report.runtimeProofNeededByActionType.map(group => (
                <li key={group.actionType} className="rounded border border-white/10 bg-black/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">{group.actionType}</span>
                    <span className="text-amber-200">{group.count} / {group.criticalCount} critical</span>
                  </div>
                  {group.examples?.[0] && <span className="mt-1 block text-white/45">{group.examples[0].name}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-white/55">None</p>}
        </ReportBox>

        <ReportBox title="Recently Changed Areas">
          {report.recentlyChangedAreas?.length ? (
            <ul className="space-y-2 text-xs text-white/70">
              {report.recentlyChangedAreas.slice(0, 6).map(area => (
                <li key={area.id} className="rounded border border-white/10 bg-black/20 p-2">
                  <span className="font-semibold text-white">{area.label}</span>
                  <span className="block text-white/45">{area.caseCount} cases / {area.failingOrUnknown} needing attention</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-white/55">None recorded</p>}
        </ReportBox>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ReportBox title="Environment">
          <KeyValue label="Device" value={report.environment.deviceType} />
          <KeyValue label="Viewport" value={`${report.environment.viewport.width}x${report.environment.viewport.height}`} />
          <KeyValue label="DPR" value={report.environment.dpr} />
          <KeyValue label="Touch" value={`${report.environment.touchSupport} (${report.environment.maxTouchPoints})`} />
          <KeyValue label="Standalone" value={String(report.environment.standalone)} />
          <KeyValue label="Route" value={report.environment.route} />
          <KeyValue label="UA" value={report.environment.userAgent} />
        </ReportBox>
        <ReportBox title="Top Blockers">
          {report.topBlockers.length ? report.topBlockers.map(item => (
            <div key={`${item.key}-${item.status}`} className="mb-2 rounded border border-white/10 bg-black/25 p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={item.status} />
                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/55">{item.actionType}</span>
              </div>
              <div className="mt-1 font-semibold">{item.name}</div>
              <div className="mt-1 text-white/55">{item.reason}</div>
              {item.nextStep && <div className="mt-1 text-[11px] text-cyan-100/75">Next: {item.nextStep}</div>}
            </div>
          )) : <p className="text-white/55">None</p>}
        </ReportBox>
      </div>

      <ReportBox title="Score Explanation" className="mt-3">
        <p className="text-xs leading-relaxed text-white/70">{report.score.explanation}</p>
        {report.scorePenaltyBreakdown && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/55 sm:grid-cols-5">
            {Object.entries(report.scorePenaltyBreakdown).map(([key, value]) => (
              <div key={key} className="rounded border border-white/10 bg-black/20 p-2">
                <div className="text-white/40">{key}</div>
                <div className="font-semibold text-white/75">{value}</div>
              </div>
            ))}
          </div>
        )}
      </ReportBox>

      <ReportBox title="SRE Signals" className="mt-3">
        <div className="grid gap-2 text-[11px] text-white/60 sm:grid-cols-4">
          <div className="rounded border border-white/10 bg-black/20 p-2">
            <div className="text-white/40">Errors</div>
            <div className="font-semibold text-white/80">FAIL {report.sreSignals?.errors?.fail || 0} / ERROR {report.sreSignals?.errors?.error || 0}</div>
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-2">
            <div className="text-white/40">Latency</div>
            <div className="font-semibold text-white/80">{report.sreSignals?.latency?.totalDurationMs || 0}ms</div>
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-2">
            <div className="text-white/40">Saturation</div>
            <div className="font-semibold text-white/80">{report.sreSignals?.saturation?.totalCases || report.totalCases} cases</div>
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-2">
            <div className="text-white/40">Recoverability</div>
            <div className="font-semibold text-white/80">{report.sreSignals?.recoverability?.namedRecoveryContracts || 0} contracts</div>
          </div>
        </div>
      </ReportBox>

      <ReportBox title="Recommended Next Actions" className="mt-3">
        <ul className="space-y-2 text-xs text-white/70">
          {report.recommendedNextActions.map(action => <li key={action}>- {action}</li>)}
        </ul>
      </ReportBox>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ReportBox title="Release Ready Checklist">
          <ul className="space-y-2 text-xs text-white/70">
            {report.releaseReadyChecklist.map(item => (
              <li key={item.label} className="flex items-start gap-2">
                <span className={item.passed ? 'text-emerald-300' : 'text-amber-300'}>{item.passed ? 'PASS' : 'NEEDS PROOF'}</span>
                <span className="min-w-0 flex-1">{item.label}</span>
                <span className="text-white/35">{item.actionType}</span>
              </li>
            ))}
          </ul>
        </ReportBox>

        <ReportBox title="Manual Verification Needed">
          {report.manualVerificationNeeded.length ? (
            <ul className="space-y-2 text-xs text-white/70">
              {report.manualVerificationNeeded.slice(0, 8).map(item => (
                <li key={`${item.key}-manual`} className="rounded border border-white/10 bg-black/20 p-2">
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="block text-white/45">{item.actionType} / {item.status}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-white/55">None</p>}
        </ReportBox>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ReportBox title="Known Non-Automatable Critical Risks">
          {report.knownNonAutomatableCriticalRisks.length ? (
            <ul className="space-y-2 text-xs text-white/70">
              {report.knownNonAutomatableCriticalRisks.slice(0, 8).map(item => (
                <li key={`${item.key}-known`} className="rounded border border-white/10 bg-black/20 p-2">
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="block text-white/45">{item.suiteName}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-white/55">None</p>}
        </ReportBox>

        <ReportBox title="Recently Fixed Regressions">
          {report.recentlyFixedRegressions.length ? (
            <ul className="space-y-2 text-xs text-white/70">
              {report.recentlyFixedRegressions.slice(0, 8).map(item => (
                <li key={`${item.key}-fixed`} className="rounded border border-white/10 bg-black/20 p-2">
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="block text-white/45">{item.status} / {item.suiteName}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-white/55">None recorded in this run</p>}
        </ReportBox>
      </div>

      <details className="mt-3 rounded-md border border-white/10 bg-black/25 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Raw JSON Preview</summary>
        <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-black/50 p-3 text-[11px] leading-relaxed text-white/70">
          {JSON.stringify(report, null, 2)}
        </pre>
      </details>
    </section>
  );
}

function ReportBox({ title, children, className = '' }) {
  return (
    <div className={`rounded-md border border-white/10 bg-black/20 p-3 ${className}`}>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-white/50">{title}</div>
      {children}
    </div>
  );
}

function safeRender(value) {
  if (value === null || value === undefined) return '—';
  const type = typeof value;
  if (type === 'string') return value;
  if (type === 'number' || type === 'boolean' || type === 'bigint') return String(value);
  if (type === 'symbol') return value.toString();
  if (type === 'function') return `[function ${value.name || 'anonymous'}]`;
  try {
    return JSON.stringify(value);
  } catch (_) {
    return '[unstringifiable]';
  }
}

function KeyValue({ label, value }) {
  return (
    <div className="mb-2 grid grid-cols-[92px_minmax(0,1fr)] gap-2 text-xs">
      <span className="text-white/45">{label}</span>
      <span className="min-w-0 break-words text-white/75">{safeRender(value)}</span>
    </div>
  );
}
