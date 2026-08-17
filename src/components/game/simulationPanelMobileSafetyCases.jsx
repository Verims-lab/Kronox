// Codex601 — source-connected A3 mobile safety contracts.
import indexCssSource from '../../index.css?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import gameLayoutSource from './GameLayout.jsx?raw';
import soloStreakSource from './SoloStreakHud.jsx?raw';
import soloSuccessSource from './SoloSuccessPopup.jsx?raw';
import soloFailureSource from './SoloFailureCard.jsx?raw';
import soloTutorialSource from './SoloLevelStartTutorialPopup.jsx?raw';
import onlineSource from '../lobby/OnlineChallengeScreen.jsx?raw';
import waitingSource from '../lobby/PreGameHourglass.jsx?raw';
import friendModalSource from '../lobby/FriendSelectModal.jsx?raw';
import joinSource from '../lobby/LobbyCreateJoinPanel.jsx?raw';
import dailySource from '../../pages/DailyPage.jsx?raw';
import wheelSource from '../dailyWheel/DailyWheelCard.jsx?raw';
import marketSource from '../../pages/MarketPage.jsx?raw';
import profileSource from '../../pages/ProfilePage.jsx?raw';
import friendsSource from '../../pages/FriendsPage.jsx?raw';
import settingsSource from '../../pages/SettingsPage.jsx?raw';
import privacySource from '../../pages/PrivacyPolicy.jsx?raw';
import leaderboardSource from '../../pages/LeaderboardPage.jsx?raw';
import statePanelSource from '../ui/KronoxStatePanel.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';

const SUITE_ID = 'mobile_safety';
const SUITE_NAME = 'Mobile Safety Health Suite';
const makeCase = (id, name, run) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: SUITE_NAME, id, name, critical: false, run });
const pass = (reason) => ({ status: 'PASS', reason, verification: 'STATIC_CONTRACT', classification: 'STATIC_CHECK_LIMITATION', actionType: 'CODE_FIX' });
const fail = (reason, actual) => ({ status: 'FAIL', reason, actual, verification: 'STATIC_CONTRACT', classification: 'REAL_PRODUCT_RISK', actionType: 'CODE_FIX' });
const requireTokens = (source, tokens, reason) => {
  const missing = tokens.filter((token) => !String(source).includes(token));
  return missing.length ? fail(reason, { missing }) : pass(reason);
};

export const EXTRA_SUITES = [{ id: SUITE_ID, name: SUITE_NAME, critical: false, color: '#22d3ee' }];

export const EXTRA_TESTS = [
  makeCase('no_horizontal_overflow_core_routes', 'Core routes contain narrow-width horizontal overflow', () => requireTokens(
    `${indexCssSource}\n${mainMenuSource}\n${gameLayoutSource}\n${onlineSource}\n${dailySource}\n${marketSource}\n${profileSource}\n${friendsSource}\n${settingsSource}\n${privacySource}`,
    ['max-width: 100vw', 'overflow-x: hidden', 'max-w-full', 'overflow-x-hidden'],
    'Core route width containment is missing.',
  )),
  makeCase('bottom_nav_clearance_core_routes', 'BottomNav routes reserve safe bottom clearance', () => requireTokens(
    `${mainMenuSource}\n${dailySource}\n${marketSource}\n${profileSource}\n${friendsSource}\n${settingsSource}\n${leaderboardSource}\n${bottomNavSource}\n${indexCssSource}`,
    ['HOME_BOTTOM_NAV_HEIGHT', "paddingBottom: 'calc(6.25rem + env(safe-area-inset-bottom))'", "paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))'", 'my-rank-sticky', "height: 'calc(3.6rem + env(safe-area-inset-bottom))'"],
    'A BottomNav-visible route or sticky card lacks documented clearance.',
  )),
  makeCase('safe_area_insets_used', 'Pages and overlays use safe-area insets and 100dvh', () => requireTokens(
    `${mainMenuSource}\n${gameLayoutSource}\n${waitingSource}\n${friendModalSource}\n${wheelSource}\n${marketSource}\n${dailySource}\n${settingsSource}`,
    ['env(safe-area-inset-top)', 'env(safe-area-inset-bottom)', '100dvh'],
    'Safe-area or dynamic viewport sizing is missing from active mobile shells.',
  )),
  makeCase('modals_have_max_height_and_internal_scroll', 'Critical modals are viewport-bounded with internal scrolling', () => requireTokens(
    `${wheelSource}\n${marketSource}\n${friendModalSource}\n${soloTutorialSource}\n${soloSuccessSource}\n${soloFailureSource}`,
    ["maxHeight: 'calc(100dvh", "overflowY: 'auto'", 'overflow-y-auto', "overscrollBehavior: 'contain'"],
    'One or more critical modal families lack max-height/internal-scroll protection.',
  )),
  makeCase('solo_drag_targets_unobstructed', 'Solo overlays preserve drag and touch surfaces', () => requireTokens(
    `${gameLayoutSource}\n${soloStreakSource}\n${indexCssSource}`,
    ['pointer-events-none', 'kronox-game-drag-lock', 'kronox-question-card-drag-surface', 'touch-action: none', 'kronox-timeline-horizontal-scroll'],
    'Solo drag/timeline overlays can intercept or lose their scoped touch contract.',
  )),
  makeCase('online_waiting_screen_cancel_reachable', 'Online waiting cancel remains safe-area reachable', () => requireTokens(
    waitingSource,
    ['data-kronox-pre-game-hourglass="mobile-safe"', "minHeight: '100dvh'", "paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))'", 'min-h-11', 'Vazgeç'],
    'Pre-game waiting cancel is not protected on short or inset screens.',
  )),
  makeCase('a2_state_panels_wrap_and_retry_visible', 'A2 state panels wrap and retain a reachable retry', () => requireTokens(
    statePanelSource,
    ['data-kronox-state-panel="mobile-safe"', 'max-w-full', 'overflow-hidden', 'break-words', 'min-h-11', 'actionLabel'],
    'Shared A2 state panels are not narrow-screen safe.',
  )),
  makeCase('leaderboard_root_contract_preserved', 'Leaderboard root and centered trophy contract remain intact', () => requireTokens(
    `${leaderboardSource}\n${indexCssSource}`,
    ['className="leaderboard-page text-white"', 'leaderboard-heading', 'leaderboard-trophy', 'leaderboard-title', 'my-rank-sticky'],
    'Leaderboard root/heading/sticky-card visual contract drifted.',
  )),
  makeCase('store_popup_action_reachable', 'Store popup action is safe-area bounded and reachable', () => requireTokens(
    marketSource,
    ['data-kronox-market-modal-position="centered-safe-area"', "maxHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 2rem)'", "overflowY: 'auto'", 'data-kronox-market-modal-purchase', 'min-h-12'],
    'Store detail action is not protected by the centered safe-area modal contract.',
  )),
  makeCase('daily_wheel_modal_safe_area', 'Daily Wheel modal is bounded and cleans finite effects', () => requireTokens(
    wheelSource,
    ['data-kronox-daily-wheel-modal-frame="mobile-safe"', "maxHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 1.5rem)'", "overflowY: 'auto'", 'effectSessionRef.current += 1', 'stopDailyWheelConfetti()', 'h-11 w-11'],
    'Daily Wheel modal bounds or close-effect cleanup contract is incomplete.',
  )),
];