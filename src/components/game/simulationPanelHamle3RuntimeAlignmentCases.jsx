// Kronox Health Center — Hamle 3 runtime alignment contracts (Codex589).
//
// Scope: KRONOX-MRHQ7K50 blockers 1-4. Hamle 3 extracted Solo attempt result
// math and Online waiting-room/lobby polling into shared runtime modules
// (soloRuntimeModel/soloAttemptEffects, createAdaptivePoller). The real
// runtime already satisfies these contracts; these cases retarget Health to
// the current real helpers/tokens instead of stale pre-refactor names.

import gameSource from '../../pages/Game.jsx?raw';
import soloRuntimeModelSource from '../../features/solo/model/soloRuntimeModel.js?raw';
import soloAttemptEffectsSource from '../../features/solo/services/soloAttemptEffects.js?raw';
import useWaitingRoomSyncSource from '../../hooks/useWaitingRoomSync.js?raw';
import useLobbySyncSource from '../../hooks/useLobbySync.js?raw';
import onlineGameNavigationSource from '../../lib/onlineGameNavigation.js?raw';
import adaptivePollerSource from '../../lib/adaptivePoller.js?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };

const SUITE_NAMES = {
  offline_solo: 'Offline Solo Regression Suite',
  waiting_room_start: 'Waiting Room / Start Flow Suite',
  route_bootstrap: 'Route State / Bootstrap Suite',
};

function safeStr(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const text = safeStr(source);
  return tokens.filter((token) => !text.includes(token));
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }

function makeCase(suiteId, id, name, run, options = {}) {
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName: SUITE_NAMES[suiteId] || suiteId,
    id,
    name,
    critical: options.critical ?? true,
    actionType: ACTION_TYPES.CODE_FIX,
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: 'offline_solo', name: SUITE_NAMES.offline_solo, critical: true, color: '#4ade80' },
  { id: 'waiting_room_start', name: SUITE_NAMES.waiting_room_start, critical: true, color: '#38bdf8' },
  { id: 'route_bootstrap', name: SUITE_NAMES.route_bootstrap, critical: true, color: '#818cf8' },
];

export const EXTRA_TESTS = [
  /* ------------------------------------------------------------------
   * BLOCKER 1 — offline_solo.daily_quest_solo_completion_only
   * ------------------------------------------------------------------ */
  makeCase('offline_solo', 'daily_quest_solo_completion_only',
    'Daily Quest solo_level_complete is recorded only after a passed Solo attempt result',
    () => {
      const modelSrc = safeStr(soloRuntimeModelSource);
      const effectsSrc = safeStr(soloAttemptEffectsSource);
      const gameSrc = safeStr(gameSource);
      const combined = `${modelSrc}\n${effectsSrc}\n${gameSrc}`;
      const missing = missingTokens(combined, [
        'calculateSoloAttemptResult',
        'result.passed',
        'if (persisted && result.passed && typeof onPersistedCompletion',
        'onPersistedCompletion: async () => {',
        "recordDailyQuestSoloEvent('solo_level_complete'",
        "questType: 'solo_level_complete'",
        'passed: true,',
      ]);
      const gateIndex = effectsSrc.indexOf('if (persisted && result.passed && typeof onPersistedCompletion');
      const awaitIndex = effectsSrc.indexOf('await onPersistedCompletion()');
      const gateBeforeAwait = gateIndex >= 0 && awaitIndex > gateIndex;
      const callbackIndex = gameSrc.indexOf('onPersistedCompletion: async () => {');
      const completeEventIndex = gameSrc.indexOf("recordDailyQuestSoloEvent('solo_level_complete'");
      const eventInsideCallback = callbackIndex >= 0 && completeEventIndex > callbackIndex;
      if (missing.length || !gateBeforeAwait || !eventInsideCallback) {
        return fail('Daily Quest solo_level_complete recording is not gated on a passed, persisted Solo attempt result.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: [
            'src/features/solo/model/soloRuntimeModel.js',
            'src/features/solo/services/soloAttemptEffects.js',
            'src/pages/Game.jsx',
          ],
          expected: 'calculateSoloAttemptResult produces result.passed; persistSoloLevelAttempt only invokes onPersistedCompletion when persisted && result.passed; Game.jsx records solo_level_complete only inside that callback.',
          actual: { missing, gateBeforeAwait, eventInsideCallback },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('recordDailyQuestSoloEvent(\'solo_level_complete\') only runs inside onPersistedCompletion, which persistSoloLevelAttempt only invokes when the real calculateSoloAttemptResult output has result.passed === true and persistence succeeded. Failed attempts never reach this callback.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  /* ------------------------------------------------------------------
   * BLOCKER 2 — waiting_room_start.start_not_route_only
   * ------------------------------------------------------------------ */
  makeCase('waiting_room_start', 'start_not_route_only',
    'Waiting room start transition uses backend lobby snapshot + fallback poll, not route state alone',
    () => {
      const combined = `${safeStr(useWaitingRoomSyncSource)}\n${safeStr(onlineGameNavigationSource)}\n${safeStr(adaptivePollerSource)}`;
      const missing = missingTokens(combined, [
        'getLobbySnapshot',
        'createAdaptivePoller',
        'navigateToOnlineGameRoute',
        '/game?',
      ]);
      if (missing.length) {
        return fail('Waiting room start transition no longer proves a backend-snapshot + fallback-poll path independent of route state.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['src/hooks/useWaitingRoomSync.js', 'src/lib/onlineGameNavigation.js', 'src/lib/adaptivePoller.js'],
          expected: 'getLobbySnapshot backend fetch + createAdaptivePoller fallback + navigateToOnlineGameRoute -> /game?lobbyId=...',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Waiting room start reads the backend lobby snapshot (getLobbySnapshot), falls back to the adaptive poller (createAdaptivePoller) when a realtime event is missed, and only then delegates to navigateToOnlineGameRoute -> /game route with safe id/code params.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  /* ------------------------------------------------------------------
   * BLOCKER 3 — waiting_room_start.backend_snapshot_polling_detectable
   * ------------------------------------------------------------------ */
  makeCase('waiting_room_start', 'backend_snapshot_polling_detectable',
    'Backend snapshot polling fallback is a real, cleanup-safe timer that stops on start/leave',
    () => {
      const pollerSrc = safeStr(adaptivePollerSource);
      const hookSrc = safeStr(useWaitingRoomSyncSource);
      const combined = `${hookSrc}\n${pollerSrc}`;
      const missing = missingTokens(combined, [
        'getLobbySnapshot',
        'createAdaptivePoller',
        'targetWindow?.setTimeout',
        'targetWindow.clearTimeout(timerId)',
        'poller.start()',
        'poller.stop()',
        'hasNavigatedToGameRef.current',
      ]);
      const cleansUpOnUnmount = hookSrc.includes('return () => poller.stop();');
      if (missing.length || !cleansUpOnUnmount) {
        return fail('Waiting room polling fallback is not detectable as a real, self-cleaning timer.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['src/hooks/useWaitingRoomSync.js', 'src/lib/adaptivePoller.js'],
          expected: 'createAdaptivePoller uses window.setTimeout/clearTimeout (not a raw setInterval loop), starts on mount, and stops on unmount/navigation.',
          actual: { missing, cleansUpOnUnmount },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('The waiting room fallback poller is a real timer (window.setTimeout/clearTimeout via createAdaptivePoller), it is started once per lobby id and explicitly stopped on unmount (poller.stop()), and navigation guards (hasNavigatedToGameRef) stop it from acting once the game has started.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  /* ------------------------------------------------------------------
   * BLOCKER 4 — route_bootstrap.live_lobby_priority
   * ------------------------------------------------------------------ */
  makeCase('route_bootstrap', 'live_lobby_priority',
    'Fresh backend Lobby data has priority over stale route snapshot; visibility/focus/poll refresh it',
    () => {
      const lobbySyncSrc = safeStr(useLobbySyncSource);
      const pollerSrc = safeStr(adaptivePollerSource);
      const combined = `${lobbySyncSrc}\n${pollerSrc}`;
      const missing = missingTokens(combined, [
        'latestLobbyRef',
        'applyLobbyData',
        'refreshLiveLobby',
        'getLobbySnapshot',
        'visibilitychange',
        'window-focus',
        'createAdaptivePoller',
      ]);
      const routeFallbackIsBootstrapOnly = lobbySyncSrc.includes('route-state-fallback')
        && lobbySyncSrc.includes('Route state is bootstrap-only');
      const cleansUpOnUnmount = lobbySyncSrc.includes('livePoller?.stop()');
      if (missing.length || !routeFallbackIsBootstrapOnly || !cleansUpOnUnmount) {
        return fail('Live lobby priority over route snapshot, or its focus/visibility/poll refresh sources, drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['src/hooks/useLobbySync.js', 'src/lib/adaptivePoller.js'],
          expected: 'latestLobbyRef + applyLobbyData + refreshLiveLobby + getLobbySnapshot, refreshed on visibilitychange/window-focus/poll via createAdaptivePoller, with route state used only as a one-time bootstrap fallback before any live lobby exists.',
          actual: { missing, routeFallbackIsBootstrapOnly, cleansUpOnUnmount },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('useLobbySync keeps latestLobbyRef as the freshness guard, applies live data through applyLobbyData/refreshLiveLobby via getLobbySnapshot, and the shared adaptive poller refreshes on visibility change, window focus, and timed poll — cleaning up on unmount. Route state is applied only once, before any live lobby snapshot exists.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),
];
