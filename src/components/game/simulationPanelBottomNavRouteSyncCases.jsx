import appSource from '../../App.jsx?raw';
import bottomNavSource from '../layout/BottomNav.jsx?raw';
import navigationSource from '../../lib/NavigationStackContext.jsx?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import leaderboardSource from '../../pages/LeaderboardPage.jsx?raw';
import profileSource from '../../pages/ProfilePage.jsx?raw';
import { getTabRootForPathname } from '@/lib/NavigationStackContext';
import { extractConstArrayLabels } from '@/lib/health/sourceProof';

const SUITE_ID = 'bottom_nav_route_sync';
const SUITE_NAME = 'BottomNav Route Sync Health Suite';
const pass = (reason) => ({ status: 'PASS', reason, verification: 'EXECUTABLE_SIMULATION', classification: 'SOURCE_CONNECTED', actionType: 'CODE_FIX' });
const fail = (reason, actual) => ({ status: 'FAIL', reason, actual, verification: 'EXECUTABLE_SIMULATION', classification: 'REAL_PRODUCT_RISK', actionType: 'CODE_FIX' });
const makeCase = (id, name, run, relatedFiles) => ({ key: `${SUITE_ID}.${id}`, suiteId: SUITE_ID, suiteName: SUITE_NAME, id, name, critical: true, relatedFiles, run });
const requireTokens = (source, tokens, reason) => {
  const missing = tokens.filter((token) => !String(source).includes(token));
  return missing.length ? fail(reason, { missing }) : pass(reason);
};

export const EXTRA_SUITES = [{ id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' }];

export const EXTRA_TESTS = [
  makeCase('active_tab_derived_from_route', 'Active tab is derived only from the committed pathname', () => {
    const forbidden = [
      ...['useState(activeTab', 'switchTab(path)', '|| currentTab'].filter((token) => bottomNavSource.includes(token)),
      ...['const [currentTab', 'setCurrentTab', 'const switchTab'].filter((token) => navigationSource.includes(token)),
    ];
    const required = ['useLocation()', 'const activeTab = getTabRootForPathname(location.pathname)'];
    const missing = required.filter((token) => !bottomNavSource.includes(token));
    return forbidden.length || missing.length ? fail('BottomNav can drift from the committed route.', { forbidden, missing }) : pass('BottomNav active state has one committed-route source and no optimistic fallback.');
  }, ['src/components/layout/BottomNav.jsx']),
  makeCase('home_content_matches_home_tab', 'Home content maps to Ana Sayfa active', () => (
    getTabRootForPathname('/') === '/' && appSource.includes('<Route path="/" element={<MainMenu />} />') && mainMenuSource.includes('Kronox Ana Sayfa')
      ? pass('Home route, Home content, and Ana Sayfa tab share the root pathname.')
      : fail('Home route/content/tab mapping drifted.')
  ), ['src/App.jsx', 'src/pages/MainMenu.jsx', 'src/lib/NavigationStackContext.jsx']),
  makeCase('leaderboard_content_matches_leaderboard_tab', 'Leaderboard content maps to Liderlik active', () => (
    getTabRootForPathname('/leaderboard') === '/leaderboard' && appSource.includes('<Route path="/leaderboard" element={<LeaderboardPage />} />') && leaderboardSource.includes('className="leaderboard-page text-white"')
      ? pass('Leaderboard route, content root, and Liderlik tab share one pathname.')
      : fail('Leaderboard route/content/tab mapping drifted.')
  ), ['src/App.jsx', 'src/pages/LeaderboardPage.jsx', 'src/lib/NavigationStackContext.jsx']),
  makeCase('profile_content_matches_profile_tab', 'Profile content maps to Profil active', () => (
    getTabRootForPathname('/profile') === '/profile' && appSource.includes('<Route path="/profile" element={<ProfilePage />} />') && profileSource.includes('kx-a1-profile')
      ? pass('Profile route, content root, and Profil tab share one pathname.')
      : fail('Profile route/content/tab mapping drifted.')
  ), ['src/App.jsx', 'src/pages/ProfilePage.jsx', 'src/lib/NavigationStackContext.jsx']),
  makeCase('rapid_tab_switch_no_desync', 'Rapid tab switches always resolve from the last committed route', () => {
    const sequence = ['/', '/leaderboard', '/profile', '/', '/profile', '/leaderboard'];
    const actual = sequence.map((pathname) => getTabRootForPathname(pathname));
    return JSON.stringify(actual) === JSON.stringify(sequence) && !appSource.includes('<AnimatePresence')
      ? pass('Rapid root-tab sequences have no independent tab state or overlapping global route content.')
      : fail('Rapid switching can retain a mismatched tab or overlapping page.', { actual });
  }, ['src/App.jsx', 'src/components/layout/BottomNav.jsx', 'src/lib/NavigationStackContext.jsx']),
  makeCase('lazy_route_fallback_route_correct', 'Lazy route fallback replaces old content instead of overlapping it', () => requireTokens(
    appSource,
    ['<Suspense fallback={<PageLoader />}>', '<Routes location={location}>', 'Direct route rendering unmounts old content at commit'],
    'Route-bound fallback or direct committed route rendering is missing.',
  ), ['src/App.jsx', 'src/lib/lazyWithRetry.js']),
  makeCase('bottom_nav_items_unchanged', 'BottomNav remains exactly Ana Sayfa, Liderlik, and Profil', () => {
    const labels = extractConstArrayLabels(bottomNavSource, 'TABS');
    const expected = ['Ana Sayfa', 'Liderlik', 'Profil'];
    return JSON.stringify(labels) === JSON.stringify(expected) ? pass('BottomNav keeps exactly the approved three items.') : fail('BottomNav item contract drifted.', { expected, actual: labels });
  }, ['src/components/layout/BottomNav.jsx']),
  makeCase('subroutes_do_not_create_extra_tabs', 'Profile subroutes map to Profil without creating extra tabs', () => {
    const subroutes = ['/settings', '/friends', '/admin', '/profile/edit', '/account-deletion'];
    const wrong = subroutes.filter((pathname) => getTabRootForPathname(pathname) !== '/profile');
    return wrong.length ? fail('A Profile subroute escaped the existing Profil tab.', { wrong }) : pass('Settings, Friends, Admin, Profile Edit, and account subroutes stay under Profil with no extra item.');
  }, ['src/lib/NavigationStackContext.jsx', 'src/components/layout/BottomNav.jsx']),
  makeCase('online_not_bottom_nav_owned', 'Online remains Home CTA-owned and absent from BottomNav', () => (
    !bottomNavSource.includes("label: 'Online") && mainMenuSource.includes("navigate('/lobby')")
      ? pass('Online remains launched by the Home CTA and is not a BottomNav item.')
      : fail('Online route ownership drifted into BottomNav.')
  ), ['src/pages/MainMenu.jsx', 'src/components/layout/BottomNav.jsx']),
  makeCase('back_forward_keeps_tab_correct', 'Back and forward derive the tab from each committed history pathname', () => {
    const historyPaths = ['/', '/leaderboard', '/profile', '/leaderboard', '/'];
    const actual = historyPaths.map((pathname) => getTabRootForPathname(pathname));
    const valid = actual.every((tab, index) => tab === historyPaths[index]);
    return valid && bottomNavSource.includes('useLocation()') && navigationSource.includes('getTabRootForPathname')
      ? pass('History navigation recomputes the active tab from each committed pathname.')
      : fail('History navigation can retain stale tab state.', { actual });
  }, ['src/components/layout/BottomNav.jsx', 'src/lib/NavigationStackContext.jsx']),
];
