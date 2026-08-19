// Kronox Health Center — Hamle 3 runtime alignment contracts (Codex589).
//
// Scope: KRONOX-MRHQ7K50 blockers 1-4. Hamle 3 extracted Solo attempt result
// math and Online backend snapshot reconciliation into shared runtime modules.
// The real
// runtime already satisfies these contracts; these cases retarget Health to
// the current real helpers/tokens instead of stale pre-refactor names.

import gameSource from '../../pages/Game.jsx?raw';
import soloRuntimeModelSource from '../../features/solo/model/soloRuntimeModel.js?raw';
import soloAttemptEffectsSource from '../../features/solo/services/soloAttemptEffects.js?raw';
import useDirectOnlineGameHandoffSource from '../../hooks/useDirectOnlineGameHandoff.js?raw';
import onlinePageSource from '../../pages/OnlinePage.jsx?raw';
import onlineGameNavigationSource from '../../lib/onlineGameNavigation.js?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };

const SUITE_NAMES = {
  offline_solo: 'Offline Solo Regression Suite',
  waiting_room_start: 'Online Direct Start Flow Suite',
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

// These are canonical replacements inside three existing built-in suites.
// Re-registering their suite definitions would create duplicate active IDs.
export const EXTRA_SUITES = [];

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
    'Direct Online start uses a backend GAME snapshot, not route state alone',
    () => {
      const combined = `${safeStr(useDirectOnlineGameHandoffSource)}\n${safeStr(onlinePageSource)}\n${safeStr(onlineGameNavigationSource)}`;
      const missing = missingTokens(combined, [
        'getLobbySnapshot',
        'LOBBY_SNAPSHOT_SCOPES.GAME',
        'hasAuthoritativeOnlineGamePayload',
        'startLobbyGame(lobby.id, lobby.state_revision)',
        'navigateToOnlineGame(navigate, lobby',
        '/game?',
      ]);
      if (missing.length) {
        return fail('Direct start no longer proves a backend GAME-snapshot path independent of route visibility.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['src/hooks/useDirectOnlineGameHandoff.js', 'src/pages/OnlinePage.jsx', 'src/lib/onlineGameNavigation.js'],
          expected: 'getLobbySnapshot(GAME) + authoritative payload validation + host start/non-host poll + navigateToOnlineGame -> /game?lobbyId=...',
          actual: { missing },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Direct Online start reads the backend GAME snapshot, lets only the host request start, and navigates only after the authoritative payload is complete.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  /* ------------------------------------------------------------------
   * BLOCKER 3 — waiting_room_start.backend_snapshot_polling_detectable
   * ------------------------------------------------------------------ */
  makeCase('waiting_room_start', 'backend_snapshot_polling_detectable',
    'Direct-start backend polling is bounded and cleanup-safe',
    () => {
      const hookSrc = safeStr(useDirectOnlineGameHandoffSource);
      const missing = missingTokens(hookSrc, [
        'getLobbySnapshot',
        'const HANDOFF_POLL_MS = 900',
        'const HANDOFF_TIMEOUT_MS = 20 * 1000',
        'timerId = window.setTimeout(task, delayMs)',
        'window.clearTimeout(timerId)',
        'readyRef.current',
      ]);
      const cleansUpOnUnmount = hookSrc.includes('cancelled = true') && hookSrc.includes('if (timerId) window.clearTimeout(timerId)');
      if (missing.length || !cleansUpOnUnmount) {
        return fail('Direct-start polling is not detectable as a bounded, self-cleaning timer.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['src/hooks/useDirectOnlineGameHandoff.js'],
          expected: 'bounded recursive setTimeout polling with ready/cancel guards and clearTimeout cleanup',
          actual: { missing, cleansUpOnUnmount },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('The direct-start poll loop is bounded to 20 seconds, uses one recursive timeout, and stops after readiness or unmount.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),

  /* ------------------------------------------------------------------
   * BLOCKER 4 — route_bootstrap.live_lobby_priority
   * ------------------------------------------------------------------ */
  makeCase('route_bootstrap', 'live_lobby_priority',
    'Fresh backend match data has priority over route bootstrap state',
    () => {
      const handoffSrc = safeStr(useDirectOnlineGameHandoffSource);
      const pageSrc = safeStr(onlinePageSource);
      const combined = `${pageSrc}\n${handoffSrc}`;
      const missing = missingTokens(combined, [
        'routeMatch(location)',
        'initialLobby',
        'getLobbySnapshot',
        'let lobby = response?.data?.lobby || initialLobbyRef.current',
        'hasAuthoritativeOnlineGamePayload(lobby)',
      ]);
      const routeFallbackIsBootstrapOnly = handoffSrc.includes('response?.data?.lobby || initialLobbyRef.current');
      const cleansUpOnUnmount = handoffSrc.includes('cancelled = true') && handoffSrc.includes('window.clearTimeout(timerId)');
      if (missing.length || !routeFallbackIsBootstrapOnly || !cleansUpOnUnmount) {
        return fail('Live backend match priority over route bootstrap state drifted.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          files: ['src/pages/OnlinePage.jsx', 'src/hooks/useDirectOnlineGameHandoff.js'],
          expected: 'route state seeds the public ref/initial snapshot; repeated GAME snapshots take priority before direct navigation',
          actual: { missing, routeFallbackIsBootstrapOnly, cleansUpOnUnmount },
          actionType: ACTION_TYPES.CODE_FIX,
        });
      }
      return pass('Route state only bootstraps the public match reference; the direct-start hook repeatedly prefers fresh GAME snapshots and cleans up on unmount.', {
        verification: 'STATIC_CONTRACT',
        classification: 'STATIC_CHECK_LIMITATION',
        actionType: ACTION_TYPES.CODE_FIX,
      });
    }),
];
