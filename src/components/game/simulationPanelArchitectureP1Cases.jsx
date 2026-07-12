// Kronox Health Center - Hamle 3 P1 architecture evidence.

import gameSource from '../../pages/Game.jsx?raw';
import soloAttemptViewModelSource from '../../features/solo/viewModel/useSoloAttemptViewModel.js?raw';
import soloAttemptEffectsSource from '../../features/solo/services/soloAttemptEffects.js?raw';
import adaptivePollerSource from '../../lib/adaptivePoller.js?raw';
import useLobbySyncSource from '../../hooks/useLobbySync.js?raw';
import useWaitingRoomSyncSource from '../../hooks/useWaitingRoomSync.js?raw';
import lobbyGatewaySource from '../../lib/dbGateway/lobbyGateway.js?raw';
import findLobbyByCodeSource from '../../../base44/functions/findLobbyByCode/entry.ts?raw';
import getOnlinePlayerSelectionSource from '../../../base44/functions/getOnlinePlayerSelection/entry.ts?raw';
import getDailyQuestStatusSource from '../../../base44/functions/getDailyQuestStatus/entry.ts?raw';
import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import currentPlayerProfileSource from '../../features/profile/viewModel/useCurrentPlayerProfile.js?raw';
import jokerInventorySource from '../../lib/jokerInventory.js?raw';
import ensureJokerSource from '../../../base44/functions/ensureUserJokerInventory/entry.ts?raw';
import spendJokerSource from '../../../base44/functions/spendUserJoker/entry.ts?raw';
import marketSource from '../../lib/market.js?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';
import jsconfigSource from '../../../jsconfig.json?raw';
import canvasConfettiTypesSource from '../../types/canvas-confetti.d.ts?raw';
import { createAdaptivePoller } from '@/lib/adaptivePoller';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };
const SUITE_ID = 'architecture_p1_health';
const SUITE_NAME = 'Architecture P1 Health Suite';

function sourceText(value) {
  return typeof value === 'string' ? value : String(value || '');
}

function missing(source, tokens) {
  const text = sourceText(source);
  return tokens.filter((token) => !text.includes(token));
}

function forbidden(source, tokens) {
  const text = sourceText(source);
  return tokens.filter((token) => text.includes(token));
}

function count(source, token) {
  return sourceText(source).split(token).length - 1;
}

function section(source, startToken, endToken) {
  const text = sourceText(source);
  const start = text.indexOf(startToken);
  if (start < 0) return '';
  const end = text.indexOf(endToken, start + startToken.length);
  return text.slice(start, end < 0 ? text.length : end);
}

function pass(reason, extra = {}) {
  return { status: STATUS.PASS, reason, ...extra };
}

function fail(reason, extra = {}) {
  return { status: STATUS.FAIL, reason, ...extra };
}

function makeCase(id, name, run) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: true,
    actionType: ACTION_TYPES.CODE_FIX,
    nextStep: 'Keep Hamle 3 ownership, privacy, projection, and fallback boundaries connected to production runtime.',
    run,
  };
}

async function runAdaptivePollerProbe() {
  const timers = new Map();
  let timerSequence = 0;
  const listeners = new Map();
  const windowObject = {
    setTimeout(callback, delay) {
      timerSequence += 1;
      timers.set(timerSequence, { callback, delay });
      return timerSequence;
    },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const documentObject = {
    visibilityState: 'visible',
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
  };

  let releaseTask = () => {};
  let calls = 0;
  const gate = new Promise((resolve) => { releaseTask = () => resolve(); });
  const poller = createAdaptivePoller({
    task: async () => { calls += 1; await gate; },
    minDelayMs: 100,
    maxDelayMs: 500,
    backoffFactor: 2,
    windowObject,
    documentObject,
  });
  poller.start();
  const first = poller.trigger('manual');
  const overlapping = await poller.trigger('manual-overlap');
  const inFlight = poller.getState().inFlight;
  releaseTask();
  await first;
  poller.stop();

  const failingPoller = createAdaptivePoller({
    task: async () => { throw new Error('expected probe failure'); },
    minDelayMs: 100,
    maxDelayMs: 500,
    backoffFactor: 2,
    windowObject,
    documentObject,
  });
  failingPoller.start();
  await failingPoller.trigger('failure-1');
  await failingPoller.trigger('failure-2');
  const failureState = failingPoller.getState();
  failingPoller.stop();

  return {
    oneCall: calls === 1,
    overlapRejected: overlapping === false,
    observedInFlight: inFlight === true,
    stopped: poller.getState().active === false,
    backoffBounded: failureState.failureCount === 2 && failureState.nextDelayMs === 400,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' },
];

export const EXTRA_TESTS = [
  makeCase('solo_runtime_uses_viewmodel_and_effect_adapter',
    'Production Solo runtime uses reducer-owned counters and an external persistence adapter',
    () => {
      const combined = `${gameSource}\n${soloAttemptViewModelSource}\n${soloAttemptEffectsSource}`;
      const required = missing(combined, [
        'useSoloAttemptViewModel',
        'useReducer(',
        'soloAttemptReducer',
        'usedMoveCount: state.usedMoves',
        'evaluateSoloPlacement',
        'persistSoloLevelAttempt',
        'markPersistRequested',
        'markPersistSucceeded',
        'markPersistFailed',
      ]);
      const retired = forbidden(gameSource, ['const [usedMoveCount', 'const [mistakeCount', 'setUsedMoveCount(', 'setMistakeCount(']);
      if (required.length || retired.length) return fail('Solo runtime ownership drifted back into local page counters/effects.', {
        verification: 'RUNTIME_CONNECTED_SOURCE',
        actual: { missing: required, forbidden: retired },
      });
      return pass('Game uses the Solo attempt ViewModel/reducer and keeps persistence in the effect adapter.', { verification: 'RUNTIME_CONNECTED_SOURCE' });
    }),

  makeCase('adaptive_poller_is_non_overlapping_and_bounded',
    'Shared fallback poller prevents overlap and applies bounded backoff',
    async () => {
      const probe = await runAdaptivePollerProbe();
      if (Object.values(probe).some((value) => value !== true)) return fail('Adaptive poller executable probe failed.', {
        verification: 'EXECUTABLE_HELPER',
        actual: probe,
      });
      const required = missing(`${adaptivePollerSource}\n${useLobbySyncSource}\n${useWaitingRoomSyncSource}`, [
        'if (!active || inFlight) return false',
        "visibilityState === 'hidden'",
        "run('network-online')",
        'createAdaptivePoller',
      ]);
      const oldLoops = forbidden(`${useLobbySyncSource}\n${useWaitingRoomSyncSource}`, ['window.setInterval', 'pollIntervalId']);
      if (required.length || oldLoops.length) return fail('Lobby hooks no longer share the adaptive fallback owner.', {
        verification: 'EXECUTABLE_HELPER_AND_RUNTIME_SOURCE',
        actual: { probe, missing: required, forbidden: oldLoops },
      });
      return pass('Fallback polling is non-overlapping, visibility-aware, bounded, and shared by both lobby hooks.', { verification: 'EXECUTABLE_HELPER_AND_RUNTIME_SOURCE' });
    }),

  makeCase('waiting_room_snapshot_excludes_private_game_payload',
    'Waiting-room projection returns roster/config before private game fields',
    () => {
      const publicLobbySource = section(findLobbyByCodeSource, 'function publicLobby(', '\nfunction readTime(');
      const rosterSource = section(publicLobbySource, 'const rosterProjection = {', "if (scope === 'waiting_room') return rosterProjection;");
      const required = missing(`${lobbyGatewaySource}\n${publicLobbySource}`, [
        "WAITING_ROOM: 'waiting_room'",
        "GAME: 'game'",
        'snapshot_scope: scope',
        "includeCards: scope === 'game'",
        "if (scope === 'waiting_room') return rosterProjection",
        'current_question_id:',
        'used_question_ids:',
        'online_question_deck:',
      ]);
      const privateRosterFields = forbidden(rosterSource, ['current_question_id:', 'used_question_ids:', 'online_question_deck:', 'online_deck_meta:']);
      if (required.length || privateRosterFields.length) return fail('Waiting-room DTO can expose active game payload or lost its scoped projection.', {
        verification: 'RUNTIME_CONNECTED_SOURCE',
        actual: { missing: required, forbiddenInRoster: privateRosterFields },
      });
      return pass('Waiting-room reads stop at the roster/config projection; participant game reads retain the separate game scope.', { verification: 'RUNTIME_CONNECTED_SOURCE' });
    }),

  makeCase('social_profiles_are_batched_and_public',
    'Online player selection batches profile rows and returns sanitized public DTOs',
    () => {
      const required = missing(getOnlinePlayerSelectionSource, [
        'PUBLIC_PROFILE_SCAN_LIMIT = 1200',
        'async function loadPublicProfilesByEmail',
        ".list('-updated_date', PUBLIC_PROFILE_SCAN_LIMIT)",
        'const publicProfilesByEmail = await loadPublicProfilesByEmail',
        'targetEmailReturned: false',
        "publicIdentity: 'username'",
        'rawGuestIdReturned: false',
        'ownerKeyReturned: false',
      ]);
      const perProfileCalls = count(getOnlinePlayerSelectionSource, ".list('-updated_date', PUBLIC_PROFILE_SCAN_LIMIT)");
      const retired = forbidden(getOnlinePlayerSelectionSource, ['getUserPublicProfile', 'Promise.all(friends.map']);
      if (required.length || perProfileCalls !== 1 || retired.length) return fail('Social profile loading regressed to N+1 or unsafe DTO output.', {
        verification: 'RUNTIME_CONNECTED_SOURCE',
        actual: { missing: required, userListCalls: perProfileCalls, forbidden: retired },
      });
      return pass('Online selection performs one bounded profile batch and returns username/avatar/presence through opaque refs only.', { verification: 'RUNTIME_CONNECTED_SOURCE' });
    }),

  makeCase('daily_status_repairs_are_guarded_and_projection_writes_conditional',
    'Daily status has one guarded assignment repair and skips unchanged summary writes',
    () => {
      const serveSource = section(getDailyQuestStatusSource, 'Deno.serve(', '});');
      const required = missing(getDailyQuestStatusSource, [
        'DAILY_PROGRESS_HISTORY_ROW_LIMIT = 420',
        "reason: 'projection_unchanged'",
        "assignmentRepair: 'guarded_idempotent_missing_today_rows_only'",
        "receiptReconciliation: 'guarded_same_player_same_day_daily_wheel_claim_only'",
        "summaryProjectionWrite: 'only_when_value_changes'",
        'redundantSecondAssignmentRepair: false',
        'noKronoxPuan: true',
        'noLeaderboardImpact: true',
      ]);
      const assignmentCalls = count(serveSource, 'await ensureTodayTasks(');
      if (required.length || assignmentCalls !== 1) return fail('Daily read repair/projection policy drifted or duplicate assignment repair returned.', {
        verification: 'RUNTIME_CONNECTED_SOURCE',
        actual: { missing: required, assignmentCalls },
      });
      return pass('Daily keeps one idempotent assignment repair, bounded history, receipt-only wheel reconciliation, and conditional summary projection writes.', { verification: 'RUNTIME_CONNECTED_SOURCE' });
    }),

  makeCase('leaderboard_page_is_materialized_read_only',
    'Leaderboard page reads the materialized projection without repair or publish mutations',
    () => {
      const required = missing(leaderboardPageSource, ['loadSoloLeaderboardSnapshot', 'LEADERBOARD_FAST_SNAPSHOT_OPTIONS', 'getCachedSoloLeaderboardSnapshot']);
      const writes = forbidden(leaderboardPageSource, ['publishSoloLeaderboardEntry(', 'ensureSoloProgressBackfill(', 'syncGuestProfileProgress(', '.entities.User.list(']);
      if (required.length || writes.length) return fail('Leaderboard hot read path regained repair/private-write work.', {
        verification: 'RUNTIME_CONNECTED_SOURCE',
        actual: { missing: required, forbidden: writes },
      });
      return pass('Leaderboard first paint is a cached/materialized public projection read with no repair or publish mutation.', { verification: 'RUNTIME_CONNECTED_SOURCE' });
    }),

  makeCase('canonical_profile_and_guest_inventory_paths_are_shared',
    'Profile and Leaderboard share one actor resolver; guest inventory uses verified backend ownership',
    () => {
      const combined = `${currentPlayerProfileSource}\n${profilePageSource}\n${leaderboardPageSource}\n${jokerInventorySource}\n${ensureJokerSource}\n${spendJokerSource}`;
      const required = missing(combined, [
        'export function useCurrentPlayerProfile',
        'linkedUser',
        'guestCredentials',
        'useCurrentPlayerProfile()',
        'resolveJokerClientActor',
        'cacheKey: `guest:${guestId}`',
        'async function resolveJokerPlayer',
        'hashGuestToken(guestId, guestToken)',
        'guest_profile_incomplete',
        'playerType: player.playerType',
        'rawGuestTokenServerStored: false',
      ]);
      const ensureResponse = section(ensureJokerSource, 'return json({\n      ok: true,', '\n    });');
      const spendResponse = section(spendJokerSource, 'return json({\n      ok: true,', '\n    });');
      const leaks = forbidden(`${ensureResponse}\n${spendResponse}`, ['userEmail: email', 'normalizedOwnerKey: email']);
      if (required.length || leaks.length) return fail('Canonical profile ownership or token-proven guest inventory privacy drifted.', {
        verification: 'RUNTIME_CONNECTED_SOURCE',
        actual: { missing: required, forbidden: leaks },
      });
      return pass('Profile/Leaderboard share AuthContext mapping and guest Joker inventory is backend-verified with sanitized responses.', { verification: 'RUNTIME_CONNECTED_SOURCE' });
    }),

  makeCase('guest_inventory_is_visible_and_store_restriction_is_explicit',
    'Guest Profile shows real inventory while Store login restriction stays explicit',
    () => {
      const required = missing(`${profilePageSource}\n${gameSource}\n${marketSource}`, [
        'playerAvailable={Boolean(player)}',
        'ensureUserHintInventory({ guestCredentials })',
        'guestCredentials: guestRecordPayload',
        "reason: 'login_required'",
        "error: 'Mağaza için giriş yapmalısın.'",
      ]);
      const fakeBalances = forbidden(profilePageSource, ['hintBalance: 3', 'balance: 3', 'Giriş yaptığında başlangıç jokerlerin burada görünür.']);
      if (required.length || fakeBalances.length) return fail('Guest inventory is hidden/faked or Store restriction is no longer explicit.', {
        verification: 'RUNTIME_CONNECTED_SOURCE',
        actual: { missing: required, forbidden: fakeBalances },
      });
      return pass('Completed guests see backend-owned Joker/Hint balances and can spend them in Solo; Store purchase remains explicitly login-gated.', { verification: 'RUNTIME_CONNECTED_SOURCE' });
    }),

  makeCase('home_mobile_geometry_and_bottom_nav_contract',
    'Home keeps safe viewport geometry above the three-tab BottomNav',
    () => {
      const required = missing(`${mainMenuSource}\n${bottomNavSource}`, [
        "minHeight: '100dvh'",
        "height: '100dvh'",
        'env(safe-area-inset-bottom)',
        'HOME_BOTTOM_NAV_HEIGHT',
        "overflowX: 'hidden'",
        "width: '100%'",
        "maxWidth: '100vw'",
        "{ label: 'Ana Sayfa'",
        "{ label: 'Liderlik'",
        "{ label: 'Profil'",
      ]);
      const extraTabs = forbidden(bottomNavSource, ["label: 'Online'", "label: 'Günlük'", "label: 'Mağaza'", "label: 'Çark'"]);
      if (required.length || extraTabs.length) return fail('Home/BottomNav mobile geometry or three-tab ownership drifted.', {
        verification: 'RUNTIME_CONNECTED_SOURCE',
        actual: { missing: required, forbidden: extraTabs },
      });
      return pass('Home uses safe-area-aware 100dvh bounds and BottomNav remains exactly Ana Sayfa, Liderlik, Profil.', { verification: 'RUNTIME_CONNECTED_SOURCE' });
    }),

  makeCase('typecheck_noise_is_reduced_without_runtime_alias_changes',
    'Typecheck recognizes Vite raw imports and uses a narrow declaration for canvas-confetti',
    () => {
      const required = missing(`${jsconfigSource}\n${canvasConfettiTypesSource}`, [
        '"vite/client"',
        '"canvas-confetti": ["./src/types/canvas-confetti.d.ts"]',
        '"src/types/**/*.d.ts"',
        "declare module 'canvas-confetti'",
        'interface ConfettiInstance',
      ]);
      const retired = forbidden(jsconfigSource, ['"types": []']);
      if (required.length || retired.length) return fail('Typecheck progress configuration drifted back to raw-module/vendor noise.', {
        verification: 'STATIC_TYPECHECK_CONFIG',
        actual: { missing: required, forbidden: retired },
      });
      return pass('Typecheck resolves Vite raw imports and the one untyped vendor module through a scoped declaration.', { verification: 'STATIC_TYPECHECK_CONFIG' });
    }),
];
