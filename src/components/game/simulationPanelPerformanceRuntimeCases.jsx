import appSource from '../../App.jsx?raw';
import homeSource from '../../pages/MainMenu.jsx?raw';
import adminSource from '../../pages/AdminPage.jsx?raw';
import diagnosticsSource from '../dev/LazyAppDiagnostics.jsx?raw';
import wheelSource from '../dailyWheel/DailyWheelCard.jsx?raw';
import wheelHookSource from '../../hooks/useDailyWheel.js?raw';
import dailyCacheSource from '../../lib/dailyStatusCache.js?raw';
import hourglassSource from '../lobby/PreGameHourglass.jsx?raw';
import randomSource from '../../hooks/useRandomMatchmaking.js?raw';
import onlineSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import friendModalSource from '../lobby/FriendSelectModal.jsx?raw';
import tutorialSource from './SoloLevelStartTutorialPopup.jsx?raw';
import streakSource from './SoloStreakHud.jsx?raw';
import simulationSource from './SimulationPanel.jsx?raw';
import marketSource from '../../pages/MarketPage.jsx?raw';
import indexCssSource from '../../index.css?raw';
import functionGateSource from '../../../scripts/checkBase44FunctionsCompile.mjs?raw';

const SUITE_ID = 'performance_health';
const SUITE_NAME = 'Performance Runtime Cleanup Health Suite';
const RELATED_FILES = [
  'src/App.jsx',
  'src/pages/MainMenu.jsx',
  'src/components/dailyWheel/DailyWheelCard.jsx',
  'src/hooks/useRandomMatchmaking.js',
  'src/components/game/SoloLevelStartTutorialPopup.jsx',
];
const pass = (reason) => ({ status: 'PASS', reason, verification: 'STATIC_CONTRACT' });
const fail = (reason, actual) => ({ status: 'FAIL', reason, actual, verification: 'STATIC_CONTRACT' });
const missing = (source, tokens) => tokens.filter((token) => !String(source || '').includes(token));
const present = (source, tokens) => tokens.filter((token) => String(source || '').includes(token));
const makeCase = (id, name, run) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: SUITE_NAME, id, name, critical: true, actionType: 'CODE_FIX', relatedFiles: RELATED_FILES, run });

export const EXTRA_SUITES = [{ id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' }];
export const EXTRA_TESTS = [
  makeCase('heavy_admin_health_chunks_lazy_loaded', 'Heavy Admin and Health chunks load only behind guarded demand', () => {
    const absent = missing(`${appSource}\n${adminSource}\n${diagnosticsSource}`, ["lazyWithRetry(() => import('./pages/AdminPage')", "import('@/components/game/SimulationPanel')", "import('@/components/game/SimulationPanelErrorBoundary')", "import('@/components/dev/AppDiagnostics')", 'diagnosticsRequested()']);
    return absent.length ? fail('Admin, Health, or diagnostics lazy boundaries drifted.', { missing: absent }) : pass('Admin is route-lazy, Health is click-lazy, and opt-in diagnostics live in their own resilient chunk.');
  }),
  makeCase('no_new_backend_function_count_growth', 'B2 does not increase backend function count', () => {
    const absent = missing(functionGateSource, ['MAX_BASE44_FUNCTIONS = 50', 'entryFiles.length > MAX_BASE44_FUNCTIONS']);
    return absent.length ? fail('The 50-function deploy ceiling is no longer enforced.', { missing: absent }) : pass('B2 adds frontend/runtime code only and the deploy gate still enforces the 50-function ceiling.');
  }),
  makeCase('daily_wheel_timers_cleanup_on_close', 'Daily Wheel timers and effects clean on close', () => {
    const absent = missing(`${wheelSource}\n${wheelHookSource}`, ['effectSessionRef.current += 1', 'timers.forEach((id) => window.clearTimeout(id))', 'sounds.stopWheelEffects?.()', 'stopDailyWheelConfetti()', 'dailyWheelConfettiInstance?.reset?.()', 'cancelScheduledRefresh()']);
    return absent.length ? fail('Daily Wheel close/unmount cleanup drifted.', { missing: absent }) : pass('Wheel timers, stale sessions, confetti, and scheduled status refreshes are explicitly cleaned.');
  }),
  makeCase('online_waiting_timers_cleanup', 'Online waiting timers clean on cancel and unmount', () => {
    const absent = missing(`${hourglassSource}\n${randomSource}\n${onlineSource}`, ['window.clearInterval(intervalId)', 'onTimeoutRef.current?.()', 'stopPolling()', 'mountedRef.current = false', 'sessionRef.current += 1', 'pollPendingRef.current', 'tickPending']);
    return absent.length ? fail('Online countdown/poll cleanup or overlap guard drifted.', { missing: absent }) : pass('Countdowns clear, random sessions invalidate, and invite/random polls cannot overlap or update after unmount.');
  }),
  makeCase('solo_streak_effects_are_finite', 'Solo Streak effects are finite', () => {
    const absent = missing(streakSource, ['window.setTimeout', 'window.clearTimeout(timer)', 'useReducedMotion', 'duration: reduced ? 0']);
    const forbidden = present(streakSource, ['repeat: Infinity']);
    return absent.length || forbidden.length ? fail('Solo Streak visual effects are not finite and cleanup-safe.', { missing: absent, forbidden }) : pass('Solo Streak feedback uses one finite timeout, unmount cleanup, and reduced-motion transitions.');
  }),
  makeCase('modals_do_not_leave_pointer_overlays', 'Modal close paths remove overlays and locks', () => {
    const absent = missing(`${wheelSource}\n${friendModalSource}\n${tutorialSource}\n${marketSource}`, ['return resultModal ? <>{resultModal}</> : null;', "document.body.style.overflow = 'hidden'", 'document.body.style.overflow = prev', '{open && (', 'video.pause()', '{selectedProduct && (']);
    return absent.length ? fail('A critical modal lacks an explicit unmount/lock/media cleanup path.', { missing: absent }) : pass('Wheel, player select, tutorial, and Store overlays are conditionally unmounted; body/video side effects restore on close.');
  }),
  makeCase('no_home_eager_health_admin_imports', 'Home has no eager Health or Admin imports', () => {
    const forbidden = present(homeSource, ['SimulationPanel', 'AdminPage', 'AppDiagnostics', 'IntegritySnapshotTool']);
    const absent = missing(`${appSource}\n${homeSource}`, ["lazyWithRetry(() => import('./pages/AdminPage')", "() => import('@/components/dailyWheel/DailyWheelCard')"]);
    return forbidden.length || absent.length ? fail('Home can eagerly pull a heavy Admin, Health, diagnostics, or wheel surface.', { forbidden, missing: absent }) : pass('Home imports no Admin/Health/debug surface and loads the large wheel UI only when its shortcut opens.');
  }),
  makeCase('route_media_lazy_or_scoped', 'Heavy media and visual surfaces are lazy or route-scoped', () => {
    const absent = missing(`${homeSource}\n${tutorialSource}\n${hourglassSource}`, ["() => import('@/components/dailyWheel/DailyWheelCard')", 'preload="metadata"', '{open && (', 'data-kronox-pre-game-hourglass="mobile-safe"']);
    return absent.length ? fail('A heavy wheel/tutorial/waiting visual lost its demand or route scope.', { missing: absent }) : pass('Wheel code is demand-loaded, tutorial video preloads metadata only while open, and hourglass visuals are waiting-route scoped.');
  }),
  makeCase('concurrent_fetch_dedupe_guard', 'Touched status and polling reads have overlap guards', () => {
    const absent = missing(`${dailyCacheSource}\n${wheelHookSource}\n${friendModalSource}\n${randomSource}\n${onlineSource}`, ['pendingRequests', 'request(cacheKey, loader)', 'dailyWheelStatusStore.request(', 'refreshPending', 'refreshRef.current?.({ showLoading: true })', 'pollPendingRef.current', 'tickPending']);
    return absent.length ? fail('A touched critical read path can issue overlapping identical requests.', { missing: absent }) : pass('Daily status requests dedupe by actor/day and player/lobby polling paths suppress concurrent overlap.');
  }),
  makeCase('mobile_animation_reduced_motion_safe', 'Mobile animation polish respects reduced motion', () => {
    const absent = missing(`${wheelSource}\n${hourglassSource}\n${streakSource}\n${indexCssSource}\n${simulationSource}`, ['useReducedMotion', 'prefersReducedMotion ? { opacity: 0.35 }', 'reduceMotion ?', 'duration: reduced ? 0', '@media (prefers-reduced-motion: reduce)', 'mountedRef.current = false']);
    return absent.length ? fail('Reduced-motion or async-unmount performance safety drifted.', { missing: absent }) : pass('Wheel, waiting, and streak motion respect reduced motion; Health runs stop advancing after panel unmount.');
  }),
];
