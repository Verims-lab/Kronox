// Kronox Health Center — Startup / Daily status cache performance contracts
// (Codex559 audit pass).
//
// Locks in the shared Daily Wheel / Daily Calendar status caching contract:
//   • One shared pure helper module (src/lib/dailyStatusCache.js) owns the
//     60s TTL status cache and the idle-scheduled (post-paint) refresh so
//     Home first render is never blocked on Daily status network calls.
//   • useDailyWheel and useDailyQuests consume the shared helper instead of
//     re-declaring duplicated cache/scheduler code.
//   • Both hooks preserve the cached body during a failed background refresh
//     (no blanking of previously rendered status on transient errors).
//   • MainMenu/Home never calls the Daily Wheel / Daily Calendar status
//     backend functions directly — status flows only through the hooks'
//     idle-scheduled refresh path.

import dailyStatusCacheSource from '../../lib/dailyStatusCache.js?raw';
import useDailyWheelSource from '../../hooks/useDailyWheel.js?raw';
import useDailyQuestsSource from '../../hooks/useDailyQuests.js?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
};

const SUITE_ID = 'startup_status_cache_health';
const SUITE_NAME = 'Startup / Daily Status Cache Suite';

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    ...options,
    run,
  };
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }

function safeStr(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { /* fall through */ }
  try { return JSON.stringify(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const text = safeStr(source);
  return tokens.filter((token) => !text.includes(token));
}

function forbiddenTokens(source, tokens) {
  const text = safeStr(source);
  return tokens.filter((token) => text.includes(token));
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#a3e635' },
];

export const EXTRA_TESTS = [
  makeCase('shared_daily_status_cache_helper_exists',
    'Shared Daily status cache helper owns TTL cache + idle refresh scheduling',
    () => {
      const missing = missingTokens(dailyStatusCacheSource, [
        'DAILY_STATUS_CACHE_TTL_MS = 60 * 1000',
        'export function buildDailyStatusCacheKey',
        'export function createDailyStatusStore',
        'export function scheduleIdleStatusRefresh',
        'requestIdleCallback',
        'cancelIdleCallback',
      ]);
      if (missing.length) {
        return fail('src/lib/dailyStatusCache.js no longer declares the shared TTL cache / idle refresh contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/lib/dailyStatusCache.js',
          missing,
        });
      }
      return pass('Shared helper declares 60s TTL store factory, actor/day cache key, and idle-scheduled refresh with cleanup.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_wheel_status_uses_shared_cache_and_preserves_cached_state',
    'useDailyWheel consumes the shared cache and keeps cached status through failed refresh',
    () => {
      const missing = missingTokens(useDailyWheelSource, [
        "from '@/lib/dailyStatusCache'",
        'createDailyStatusStore()',
        'scheduleIdleStatusRefresh(',
        'buildDailyStatusCacheKey(user, guestCredentials)',
        // cached body renders immediately; only a cache miss shows loading
        'if (cachedBody) {',
        // transient refresh failure must not blank a previously cached status
        "if (!cachedBody) setStatus('error')",
      ]);
      const forbidden = forbiddenTokens(useDailyWheelSource, [
        // duplicated local cache/scheduler code must not return to the hook
        'DAILY_REWARD_STATUS_CACHE_TTL_MS',
        'dailyWheelStatusCache = new Map()',
        'function scheduleDailyWheelStatusRefresh',
      ]);
      if (missing.length || forbidden.length) {
        return fail('useDailyWheel drifted from the shared cached-status / idle-refresh contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/hooks/useDailyWheel.js',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Wheel status uses the shared TTL cache, idle-scheduled refresh, and cache-preserving error handling.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('daily_calendar_status_uses_shared_cache_and_preserves_cached_state',
    'useDailyQuests consumes the shared cache and keeps cached status through failed refresh',
    () => {
      const missing = missingTokens(useDailyQuestsSource, [
        "from '@/lib/dailyStatusCache'",
        'createDailyStatusStore()',
        'scheduleIdleStatusRefresh(',
        'buildDailyStatusCacheKey(user, guestCredentials)',
        // invalidation export stays available for cross-hook cache busting
        'export function invalidateDailyQuestStatusCache',
        'if (cachedBody) {',
        'if (!cachedBody) {',
      ]);
      const forbidden = forbiddenTokens(useDailyQuestsSource, [
        'DAILY_QUEST_STATUS_CACHE_TTL_MS',
        'dailyStatusCache = new Map()',
        'function scheduleDailyQuestStatusRefresh',
      ]);
      if (missing.length || forbidden.length) {
        return fail('useDailyQuests drifted from the shared cached-status / idle-refresh contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/hooks/useDailyQuests.js',
          actual: { missing, forbidden },
        });
      }
      return pass('Daily Calendar status uses the shared TTL cache, idle-scheduled refresh, cache-preserving error handling, and keeps the invalidation export.', {
        verification: 'STATIC_CONTRACT',
      });
    }),

  makeCase('home_does_not_call_daily_status_backend_directly',
    'Home shell reads Daily Wheel/Calendar readiness only through the idle-refresh hooks',
    () => {
      const forbidden = forbiddenTokens(mainMenuSource, [
        // Home must never issue the status network calls itself — the hooks
        // own idle-scheduled refresh so first render is never blocked.
        'getDailyWheelStatus(',
        'getDailyQuestStatus(',
        'claimDailyWheelReward(',
      ]);
      const missing = missingTokens(mainMenuSource, [
        // ready badges are derived, non-blocking status reads
        'dailyWheel?.isAvailable === true',
        "dailyQuests?.status === 'ready'",
      ]);
      if (missing.length || forbidden.length) {
        return fail('MainMenu drifted from the non-blocking Daily status contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'src/pages/MainMenu.jsx',
          actual: { missing, forbidden },
        });
      }
      return pass('Home derives shortcut ready badges from hook state only; Daily status network calls stay in the idle-scheduled hook path.', {
        verification: 'STATIC_CONTRACT',
      });
    }),
];