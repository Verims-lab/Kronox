// Kronox Health Center — iOS/mobile compatibility contracts.
//
// Static checks lock the scoped pull-to-refresh, root-tab BottomNav, explicit
// parent-back route state, and bottom-sheet selector contracts. Real iOS/PWA gesture, scroll restoration,
// and VoiceOver proof remains manual.

import pullToRefreshSource from '../mobile/PullToRefresh.jsx?raw';
import selectSheetSource from '../mobile/KronoxSelectSheet.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';
import navigationStackSource from '../../lib/NavigationStackContext.jsx?raw';
import friendsPageSource from '../../pages/FriendsPage.jsx?raw';
import leaderboardPageSource from '../../pages/LeaderboardPage.jsx?raw';
import profilePageSource from '../../pages/ProfilePage.jsx?raw';
import profileEditPageSource from '../../pages/ProfileEditPage.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';
import adminPageSource from '../../pages/AdminPage.jsx?raw';
import standardTopBarSource from '../layout/StandardTopBar.jsx?raw';
import screenHeaderSource from '../layout/ScreenHeader.jsx?raw';
import categoryPreferencesSource from '../settings/CategoryPreferencesSection.jsx?raw';
import questionAnalyticsToolSource from '../admin/QuestionAnalyticsReportTool.jsx?raw';
import resetUserProgressToolSource from '../admin/ResetUserProgressTool.jsx?raw';
import gameSource from '../../pages/Game.jsx?raw';
import appSource from '../../App.jsx?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', DEVICE_TEST: 'DEVICE_TEST', MANUAL_VERIFY: 'MANUAL_VERIFY' };

function safeStr(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

function forbiddenTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => src.includes(token));
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }

function makeCase(suiteId, suiteName, id, name, run, options = {}) {
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep mobile compatibility changes scoped to non-game list/navigation/select surfaces.',
    ...options,
    run,
  };
}

const adminSelectSources = `${questionAnalyticsToolSource}\n${resetUserProgressToolSource}`;
const tabStackSources = `${bottomNavSource}\n${navigationStackSource}\n${appSource}`;

export const EXTRA_SUITES = [];

export const EXTRA_TESTS = [
  makeCase('mobile_gesture_risk', 'Mobile Gesture Risk Suite',
    'scoped_pull_to_refresh_component_exists',
    'Reusable PullToRefresh component exists and is scoped to its container',
    () => {
      const missing = missingTokens(pullToRefreshSource, [
        'data-kronox-pull-to-refresh="scoped"',
        "node.addEventListener('touchmove', handleTouchMove, { passive: false })",
        "node.addEventListener('touchstart', handleTouchStart, { passive: true })",
        "overscrollBehaviorY: 'contain'",
        'getScrollableAncestor',
        'onRefresh',
      ]);
      const forbidden = forbiddenTokens(pullToRefreshSource, [
        "document.addEventListener('touchmove'",
        "window.addEventListener('touchmove'",
        'document.body.style.overflow',
      ]);
      if (missing.length || forbidden.length) return fail('PullToRefresh is missing scoped native-touch contracts or uses global gesture handlers.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/components/mobile/PullToRefresh.jsx',
        actual: { missing, forbidden },
      });
      return pass('PullToRefresh uses scoped touch listeners, a real onRefresh callback, and container-level overscroll containment.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('friends_ui', 'Friends UI Suite',
    'friends_page_uses_pull_to_refresh',
    'FriendsPage uses PullToRefresh for real friend/request reloads',
    () => {
      const missing = missingTokens(friendsPageSource, [
        "import PullToRefresh from '@/components/mobile/PullToRefresh'",
        '<PullToRefresh',
        'onRefresh={() => refresh(user.email)}',
        'loadFriendsPageSnapshot(email)',
        'setFriends(snapshot.friends)',
        'setIncoming(snapshot.incoming)',
        'setOutgoing(snapshot.outgoing)',
      ]);
      if (missing.length) return fail('FriendsPage does not wire PullToRefresh to the real friend/request reload path.', { verification: 'STATIC_CONTRACT', missing });
      return pass('FriendsPage pull-to-refresh calls the same authoritative refresh that reloads friends and requests.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('leaderboard_health', 'Leaderboard / Liderlik Health Suite',
    'leaderboard_page_uses_pull_to_refresh',
    'LeaderboardPage uses PullToRefresh for real leaderboard reloads',
    () => {
      const missing = missingTokens(leaderboardPageSource, [
        "import PullToRefresh from '@/components/mobile/PullToRefresh'",
        '<PullToRefresh',
        'onRefresh={loadLeaderboard}',
        'loadSoloLeaderboardSnapshot',
      ]);
      const forbidden = forbiddenTokens(leaderboardPageSource, ['publishSoloLeaderboardEntry(', 'ensureSoloProgressBackfill(']);
      if (missing.length || forbidden.length) return fail('LeaderboardPage refresh no longer uses its pure materialized read path.', { verification: 'STATIC_CONTRACT', actual: { missing, forbidden } });
      return pass('LeaderboardPage pull-to-refresh calls the materialized snapshot reader without publishing or backfilling on read.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('admin_visibility', 'Admin Visibility Suite',
    'admin_maintenance_lists_use_pull_to_refresh',
    'Admin maintenance lists use PullToRefresh without bypassing admin auth',
    () => {
      const missing = missingTokens(`${adminPageSource}\n${adminSelectSources}`, [
        "import PullToRefresh from '@/components/mobile/PullToRefresh'",
        '<PullToRefresh onRefresh={refreshAdminMaintenanceLists}',
        'registerAdminRefresh',
        'AdminRefreshContext.Provider',
        'useContext(AdminRefreshContext)',
        'parsedAdminStatus',
        'if (!isAdmin)',
      ]);
      if (missing.length) return fail('Admin maintenance pull-to-refresh is missing or may bypass the existing AdminUser gate.', { verification: 'STATIC_CONTRACT', missing });
      return pass('Admin Ekranı refresh is inside the admin-gated page and triggers registered maintenance list reloads.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('mobile_gesture_risk', 'Mobile Gesture Risk Suite',
    'pull_to_refresh_respects_reduced_motion_and_game_drag_boundary',
    'PullToRefresh respects reduced motion and does not touch gameplay drag surfaces',
    () => {
      const missing = missingTokens(pullToRefreshSource, [
        "matchMedia('(prefers-reduced-motion: reduce)')",
        "reducedMotion ? 'none'",
        "refreshing && !reducedMotion ? 'animate-spin' : ''",
      ]);
      const forbidden = forbiddenTokens(gameSource, [
        '<PullToRefresh',
        'data-kronox-pull-to-refresh',
      ]);
      if (missing.length || forbidden.length) return fail('PullToRefresh reduced-motion or gameplay-boundary contract drifted.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Pull-to-refresh animations are reduced-motion aware and the component is absent from gameplay code.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('route_navigation_resilience', 'Route / Navigation Resilience Suite',
    'bottom_nav_opens_tab_roots_without_stale_subpages',
    'BottomNav opens Home/Liderlik/Profile roots and does not restore stale subpages',
    () => {
      const missing = missingTokens(tabStackSources, [
        'TAB_ROOTS',
        "leaderboard: '/leaderboard'",
        'getTabRootForPathname',
        'rememberRoute(location)',
        'getTabRootNavigationState',
        'resetTabSubpage',
        'navigate(path, { replace: true, state: getTabRootNavigationState(path) })',
        'window.scrollTo({ top: 0',
      ]);
      const forbidden = forbiddenTokens(bottomNavSource, ["label: 'Online'", 'path: TAB_ROOTS.online', 'getStackForTab(path)']);
      if (missing.length || forbidden.length) return fail('BottomNav root-tab or visible tab contract is incomplete.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('BottomNav always opens tab roots for Home, Liderlik, and Profile, with no visible Online tab and no stale Profile subpage restore.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('route_navigation_resilience', 'Route / Navigation Resilience Suite',
    'bottom_nav_active_retap_resets_root',
    'Tapping any BottomNav tab resets that tab to its root',
    () => {
      const missing = missingTokens(bottomNavSource, [
        'resetStack(path)',
        'switchTab(path)',
        'state: getTabRootNavigationState(path)',
        "window.scrollTo({ top: 0",
        "HIDDEN_ROUTES = ['/game']",
      ]);
      if (missing.length) return fail('Active tab re-tap reset or /game hidden rule is missing.', { verification: 'STATIC_CONTRACT', missing });
      return pass('BottomNav taps reset the selected tab root and scroll to top; /game remains full-screen.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('route_navigation_resilience', 'Route / Navigation Resilience Suite',
    'profile_and_home_route_ownership_uses_parent_back_state',
    'Profile/Home subroutes use explicit parent route state and Online remains Home-owned',
    () => {
      const combined = [
        navigationStackSource,
        profilePageSource,
        profileEditPageSource,
        friendsPageSource,
        settingsPageSource,
        leaderboardPageSource,
        standardTopBarSource,
        screenHeaderSource,
      ].map(safeStr).join('\n');
      const missing = missingTokens(combined, [
        "['/profile', '/profile/edit', '/friends', '/settings', '/admin', '/test-suite', '/account-deletion']",
        "if (pathname === '/lobby') return TAB_ROOTS.home",
        "if (['/', '/market', '/solo', '/setup'].includes(pathname)) return TAB_ROOTS.home",
        'createParentRouteState',
        'getProfileParentRouteState',
        'getSafeBackRoute(location, \'/profile\')',
        "createParentRouteState('leaderboard', '/leaderboard')",
        "navigate('/friends', { state: getProfileParentRouteState() })",
        "navigate('/settings', { state: getProfileParentRouteState() })",
        "navigate('/profile/edit', { state: getProfileParentRouteState() })",
        'navigate(getSafeBackRoute(location), { replace: true })',
      ]);
      const forbidden = forbiddenTokens(`${profileEditPageSource}\n${settingsPageSource}\n${friendsPageSource}\n${standardTopBarSource}\n${screenHeaderSource}`, [
        "navigate('/profile');",
        'navigate(-1)',
        'window.history.length',
      ]);
      if (missing.length || forbidden.length) return fail('Tab route ownership or parent-back route state drifted.', {
        verification: 'STATIC_CONTRACT',
        actual: { missing, forbidden },
      });
      return pass('Profile/Home subroutes carry explicit parent routes, back falls to parent/tab root instead of Home/browser history, and Online lobby stays Home-owned.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('category_preferences_health', 'Profile Info Category Preferences Suite',
    'category_preferences_has_no_raw_select_controls',
    'CategoryPreferencesSection remains custom touch UI with no raw native select',
    () => {
      const forbidden = forbiddenTokens(categoryPreferencesSource, ['<select', '</select>']);
      const missing = missingTokens(categoryPreferencesSource, [
        'activeCategories.map',
        'aria-pressed={selected}',
        'toggleCategory',
        'saveUserCategoryPreferences(user, selectedIds, activeCategories)',
      ]);
      if (forbidden.length || missing.length) return fail('Category preferences may have native select controls or lost save behavior.', {
        verification: 'STATIC_CONTRACT',
        actual: { forbidden, missing },
      });
      return pass('CategoryPreferencesSection is already a custom touch selector and preserves current save validation.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('ui_shared_components', 'UI Shared Components / Phase 3 Suite',
    'kronox_bottom_sheet_selector_exists',
    'Kronox bottom-sheet selector exists with keyboard, backdrop, dark mode, and reduced-motion contracts',
    () => {
      const missing = missingTokens(selectSheetSource, [
        'role="dialog"',
        'aria-modal="true"',
        "event.key === 'Escape'",
        'Seçim penceresini kapat',
        'focus',
        "matchMedia('(prefers-reduced-motion: reduce)')",
        "paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'",
        'bg-slate-950',
        'border-amber-300/30',
      ]);
      if (missing.length) return fail('Kronox bottom-sheet selector accessibility/theme contracts are incomplete.', { verification: 'STATIC_CONTRACT', missing });
      return pass('KronoxSelectSheet has dialog semantics, Escape/backdrop close, focus return, safe-area padding, dark styling, and reduced-motion handling.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('admin_visibility', 'Admin Visibility Suite',
    'admin_tools_no_raw_selects_and_keep_validation',
    'Current Admin tools use Kronox bottom-sheet selectors and removed Daily Quest manager stays absent',
    () => {
      const forbidden = forbiddenTokens(adminSelectSources, ['<select', '</select>']);
      const missing = missingTokens(adminSelectSources, [
        'KronoxSelectSheet',
        'PERIOD_OPTIONS',
        'MODE_OPTIONS',
        'normalizedTarget',
        'confirmEmail',
        'confirmationMatches',
        'Preview reset',
        'Execute reset',
      ]);
      const removedManagerForbidden = forbiddenTokens(adminPageSource, [
        'DailyQuestDefinitionManager',
        'Günlük Görev Yönetimi',
        'questTypeOptions',
        'statusOptions',
        'DAILY_QUEST_V1_TYPES.includes',
      ]);
      if (forbidden.length || missing.length || removedManagerForbidden.length) return fail('Current Admin tools still contain native selects, lost validation guards, or restored the removed Daily Quest manager.', {
        verification: 'STATIC_CONTRACT',
        actual: { forbidden, missing, removedManagerForbidden },
      });
      return pass('Current Admin report/reset controls use KronoxSelectSheet, destructive reset keeps exact confirmation, and removed Daily Quest manager UI stays absent.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('mobile_viewport', 'Mobile Viewport Suite',
    'ios_pwa_pull_to_refresh_runtime_proof_required',
    'Real iOS/PWA pull-to-refresh proof remains manual',
    () => notAutomatable('Static source proves scoped callbacks. Real iOS Safari/PWA rubber-band behavior still requires pulling Friends, Leaderboard, and Admin lists on device.', {
      verification: 'NOT_AUTOMATABLE',
      verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'],
      actionType: ACTION_TYPES.DEVICE_TEST,
    }),
    { actionType: ACTION_TYPES.DEVICE_TEST }),

  makeCase('route_navigation_resilience', 'Route / Navigation Resilience Suite',
    'real_mobile_tab_stack_scroll_proof_required',
    'Real mobile tab stack and scroll restoration proof remains manual',
    () => notAutomatable('Static source verifies stack/scroll storage. Browser history, subroute restoration, and iOS scroll timing need a real mobile/PWA smoke test.', {
      verification: 'NOT_AUTOMATABLE',
      verificationLabels: ['NOT_AUTOMATABLE', 'MANUAL_REQUIRED'],
      actionType: ACTION_TYPES.DEVICE_TEST,
    }),
    { actionType: ACTION_TYPES.DEVICE_TEST }),

  makeCase('ui_shared_components', 'UI Shared Components / Phase 3 Suite',
    'real_voiceover_bottom_sheet_proof_required',
    'Real VoiceOver/accessibility proof for bottom sheets remains manual',
    () => notAutomatable('Static source checks dialog and keyboard contracts, but VoiceOver announcement and focus behavior must be tested on a real device/browser.', {
      verification: 'NOT_AUTOMATABLE',
      verificationLabels: ['NOT_AUTOMATABLE', 'MANUAL_REQUIRED'],
      actionType: ACTION_TYPES.MANUAL_VERIFY,
    }),
    { actionType: ACTION_TYPES.MANUAL_VERIFY }),
];
