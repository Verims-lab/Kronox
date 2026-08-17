// Codex602 — A3 contracts hardened during A4 with per-source proof.
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
import { auditSourceContracts, extractConstArrayLabels } from '@/lib/health/sourceProof';

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
  makeCase('no_horizontal_overflow_core_routes', 'Each active route family has a narrow-width containment contract', () => {
    const violations = auditSourceContracts([
      { file: 'src/index.css', source: indexCssSource, required: ['.kx-a1-home,', '.kronox-gameplay-root,', '.kx-a1-online,', '[data-kronox-daily-page-root="true"]', '.kx-a1-market,', '.kx-a1-profile,', '.leaderboard-page {', 'max-width: 100vw', 'overflow-x: hidden'] },
      { file: 'src/pages/MainMenu.jsx', source: mainMenuSource, required: ['overflow-x-hidden'] },
      { file: 'src/pages/MarketPage.jsx', source: marketSource, required: ['kx-a1-market', 'overflow-x-hidden'] },
      { file: 'src/pages/ProfilePage.jsx', source: profileSource, required: ['kx-a1-profile', 'overflow-x-hidden'] },
      { file: 'src/pages/FriendsPage.jsx', source: friendsSource, required: ['max-w-full', 'overflow-x-hidden'] },
      { file: 'src/pages/SettingsPage.jsx', source: settingsSource, required: ['max-w-full', 'overflow-x-hidden'] },
      { file: 'src/pages/PrivacyPolicy.jsx', source: privacySource, required: ['max-w-full', 'overflow-x-hidden'] },
    ]);
    return violations.length ? fail('A specific active route lost its narrow-width containment.', { violations }) : pass('Every audited route family has its own active-source containment proof.');
  }),
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
  makeCase('modals_have_max_height_and_internal_scroll', 'Each critical modal is viewport-bounded with an internal scroll path', () => {
    const violations = auditSourceContracts([
      { file: 'DailyWheelCard.jsx', source: wheelSource, required: ['data-kronox-daily-wheel-modal-frame="mobile-safe"', "maxHeight: 'calc(100dvh", "overflowY: 'auto'", "overscrollBehavior: 'contain'"] },
      { file: 'MarketPage.jsx', source: marketSource, required: ['data-kronox-market-modal-position="centered-safe-area"', "maxHeight: 'calc(100dvh", "overflowY: 'auto'"] },
      { file: 'FriendSelectModal.jsx', source: friendModalSource, required: ["maxHeight: 'calc(100dvh", 'overflow-y-auto'] },
      { file: 'SoloLevelStartTutorialPopup.jsx', source: soloTutorialSource, required: ["maxHeight: 'calc(100dvh", 'overflow-y-auto', "overscrollBehavior: 'contain'"] },
      { file: 'SoloSuccessPopup.jsx', source: soloSuccessSource, required: ['data-kronox-solo-result-modal="success-mobile-safe"', "maxHeight: 'calc(100dvh", 'overflow-y-auto'] },
      { file: 'SoloFailureCard.jsx', source: soloFailureSource, required: ['data-kronox-solo-result-modal="failure-mobile-safe"', "maxHeight: 'calc(100dvh", 'overflow-y-auto'] },
    ]);
    return violations.length ? fail('A specific critical modal lacks viewport bounds or internal scrolling.', { violations }) : pass('Every audited critical modal has its own max-height and scroll proof.');
  }),
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
  makeCase('leaderboard_root_contract_preserved', 'Leaderboard keeps the approved root/heading and no removed summary grid', () => {
    const violations = auditSourceContracts([
      { file: 'LeaderboardPage.jsx', source: leaderboardSource, required: ['className="leaderboard-page text-white"', 'leaderboard-heading', 'leaderboard-trophy', 'leaderboard-title'], forbidden: ['KronoxStatTile', 'leaderboard-summary', 'grid-cols-3'] },
      { file: 'src/index.css', source: indexCssSource, required: ['.my-rank-sticky', '.leaderboard-heading', '.leaderboard-trophy', '.leaderboard-title'] },
    ]);
    return violations.length ? fail('Approved Liderlik anatomy drifted or a removed summary-card grid returned.', { violations }) : pass('Exact root, centered trophy/title, sticky own row, and no summary-card grid are source-proven.');
  }),
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
  makeCase('bottom_nav_exact_visible_tabs', 'BottomNav has exactly Ana Sayfa, Liderlik, and Profil', () => {
    const labels = extractConstArrayLabels(bottomNavSource, 'TABS');
    const expected = ['Ana Sayfa', 'Liderlik', 'Profil'];
    return JSON.stringify(labels) === JSON.stringify(expected)
      ? pass('The active BottomNav array contains exactly the three approved visible tabs.')
      : fail('BottomNav visible items drifted.', { expected, actual: labels });
  }),
];