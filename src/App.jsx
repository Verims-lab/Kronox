import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import React, { Suspense, useEffect } from 'react';
import PageNotFound from './lib/PageNotFound';
import MainMenu from './pages/MainMenu';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import BottomNav from '@/components/layout/BottomNav';
import SplashScreen from '@/components/SplashScreen';
import { NavigationStackProvider } from '@/lib/NavigationStackContext';
import BuildMarker, { KRONOX_BUILD_MARKER } from '@/components/dev/BuildMarker';
import LazyAppDiagnostics from '@/components/dev/LazyAppDiagnostics';
import AppErrorBoundary from '@/components/dev/AppErrorBoundary';
import { appDiagSetBuildMarker, pushAppDiag } from '@/lib/appDiagBus';
import { isGuestOnboardingComplete } from '@/lib/guestProfile';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import usePresenceHeartbeat from '@/hooks/usePresenceHeartbeat';
import usePreventAppZoom from '@/hooks/usePreventAppZoom';

const MarketPage = lazyWithRetry(() => import('./pages/MarketPage'), 'MarketPage');
const DailyPage = lazyWithRetry(() => import('./pages/DailyPage'), 'DailyPage');
const SoloChallenge = lazyWithRetry(() => import('./pages/SoloChallenge'), 'SoloChallenge');
const Game = lazyWithRetry(() => import('./pages/Game'), 'Game');
const SameQuestionDuelPage = lazyWithRetry(() => import('./pages/SameQuestionDuelPage'), 'SameQuestionDuelPage');
const OnlinePage = lazyWithRetry(() => import('./pages/OnlinePage'), 'OnlinePage');
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage'), 'SettingsPage');
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'), 'ProfilePage');
const ProfileEditPage = lazyWithRetry(() => import('./pages/ProfileEditPage'), 'ProfileEditPage');
const AdminPage = lazyWithRetry(() => import('./pages/AdminPage'), 'AdminPage');
const FriendsPage = lazyWithRetry(() => import('./pages/FriendsPage'), 'FriendsPage');
const LeaderboardPage = lazyWithRetry(() => import('./pages/LeaderboardPage'), 'LeaderboardPage');
const TestSuite = lazyWithRetry(() => import('./pages/TestSuite'), 'TestSuite');
const AccountDeletionPage = lazyWithRetry(() => import('./pages/AccountDeletionPage'), 'AccountDeletionPage');
const PrivacyPolicy = lazyWithRetry(() => import('./pages/PrivacyPolicy'), 'PrivacyPolicy');
const OnboardingPage = lazyWithRetry(() => import('./pages/OnboardingPage'), 'OnboardingPage');
const GameInviteNotifier = lazyWithRetry(() => import('./components/invites/GameInviteNotifier'), 'GameInviteNotifier');
const CategoryPreferenceOnboardingModal = lazyWithRetry(() => import('./components/settings/CategoryPreferenceOnboardingModal'), 'CategoryPreferenceOnboardingModal');

function PageLoader() {
  return <SplashScreen />;
}

function LegacyLobbyRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={{ pathname: '/online', search: location.search }}
      state={location.state}
      replace
    />
  );
}

function AdminRoute({ children }) {
  const { user, isLoadingAuth, authChecked, adminStatus } = useAuth();
  const hasAuthEmail = Boolean(user?.email);
  const parsedAdminStatus = adminStatus?.parsedIsAdmin === true || user?.admin_status_debug?.parsedIsAdmin === true;
  const isCheckingAdmin = isLoadingAuth
    || !authChecked
    || adminStatus?.loading === true
    || adminStatus?.statusCall === 'pending'
    || (hasAuthEmail && adminStatus?.called !== true && adminStatus?.statusCall !== 'success');

  if (isCheckingAdmin) return <PageLoader />;
  if (!parsedAdminStatus) return <Navigate to="/" replace state={{ adminDenied: true }} />;
  return children;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, isAuthenticated, user, guestProfile, checkUserAuth } = useAuth();
  const [nonCriticalStartupReady, setNonCriticalStartupReady] = React.useState(false);
  const location = useLocation();
  const prevPathRef = React.useRef(location.pathname);
  const isGamePage = location.pathname === '/game';
  const isOnboardingPage = location.pathname === '/onboarding';
  const isProfilePage = location.pathname === '/profile';
  const isOnboardingAccountLinkEntry = isProfilePage && (
    new URLSearchParams(location.search).get('open') === 'account-link' ||
    location.state?.openAccountLink === true
  );
  const isAccountDeletionPage = location.pathname === '/account-deletion';
  const isPrivacyPage = location.pathname === '/privacy';
  const isPublicStandalonePage = isAccountDeletionPage || isPrivacyPage;
  const hasBootstrapPlayer = isAuthenticated || Boolean(guestProfile);
  const nonCriticalModulesEnabled = nonCriticalStartupReady && !isPublicStandalonePage;
  // Codex102 — Only home + game lock viewport. All other screens scroll
  // normally and host their own ScreenHeader.
  const isViewportLockedPage = location.pathname === '/' || isGamePage;

  const handleCategoryPreferenceOnboardingComplete = () => {
    checkUserAuth?.();
  };

  useEffect(() => {
    if (!hasBootstrapPlayer || isPublicStandalonePage) {
      setNonCriticalStartupReady(false);
      return undefined;
    }

    let cancelled = false;
    const enable = () => {
      if (!cancelled) setNonCriticalStartupReady(true);
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(enable, { timeout: 3000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(idleId);
      };
    }

    const timeoutId = window.setTimeout(enable, 1400);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [hasBootstrapPlayer, isPublicStandalonePage]);

  // App-shell-owned presence heartbeat. One linked-or-guest runtime session
  // heartbeat; the hook no-ops until identity is ready and cleans up on
  // unmount/session change. Deferred until non-critical startup is enabled so
  // it never blocks first Home render.
  usePresenceHeartbeat(
    nonCriticalModulesEnabled ? user : null,
    nonCriticalModulesEnabled ? guestProfile : null,
  );

  // Codex085 — push every route change into the diag bus so the overlay
  // can show pathname AND we can detect "route_not_changed" black screens.
  useEffect(() => {
    pushAppDiag({
      lastNavTarget: location.pathname,
      lastNavPayloadKeys: Object.keys(location.state || {}),
      lastNavAt: new Date().toISOString(),
    });
    // Reset Game-mount diag every time we leave /game.
    if (prevPathRef.current === '/game' && location.pathname !== '/game') {
      pushAppDiag({ gameUnmounted: true });
    }
  }, [location.pathname, location.state]);

  const viewportShellStyle = isViewportLockedPage
    ? { width: '100%', minHeight: '100dvh', height: '100dvh', overflow: 'hidden', overscrollBehavior: 'none' }
    : { width: '100%', minHeight: '100%' };

  // Android WebView fix: never stay on /login if user is authenticated or auth check is done.
  if (location.pathname.includes('/login')) {
    if (isAuthenticated) {
      // Codex087 — honor ?next=/friends so the email deep-link survives login.
      // Only same-origin relative paths are accepted; otherwise fall back to '/'.
      const next = new URLSearchParams(location.search).get('next');
      const safeNext = (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) ? next : '/';
      return <Navigate to={safeNext} replace />;
    }
  }

  // Show loading spinner while checking auth
  if (isLoadingAuth && !isPublicStandalonePage) {
    return (
      <>
        <LazyAppDiagnostics currentUser={user} />
        <SplashScreen />
      </>
    );
  }

  // Handle authentication errors
  if (authError && !isPublicStandalonePage) {
    if (authError.type === 'user_not_registered') {
      return (
        <>
          <LazyAppDiagnostics currentUser={user} />
          <UserNotRegisteredError />
        </>
      );
    }
    // auth_required: uygulama public — login olmadan da devam et
  }

  // Profile is a guest-compatible BottomNav destination; let it resolve or repair
  // guest state locally instead of bouncing through onboarding.
  const shouldRouteGuestOnboarding = !isAuthenticated
    && Boolean(guestProfile)
    && !isGuestOnboardingComplete(guestProfile)
    && !isPublicStandalonePage
    && !isGamePage
    && !isOnboardingPage
    && !isProfilePage
    && !isOnboardingAccountLinkEntry;

  if (shouldRouteGuestOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Render the main app
  return (
    <div style={viewportShellStyle} data-kx-route-locked={isViewportLockedPage ? 'true' : 'false'}>
      <LazyAppDiagnostics currentUser={user} />
      {/* Codex102 — Global AppHeader removed. Each screen renders its own
          ScreenHeader so the title/back/avatar match the active page. */}
      {/* Codex619 — One committed route owns the visible content. The previous
          global AnimatePresence mode="sync" kept the old page visibly mounted
          after location changed, while BottomNav correctly highlighted the new
          pathname. Direct route rendering unmounts old content at commit; lazy
          routes show PageLoader instead of stale content. Page-local motion and
          resilient lazy chunk loading remain unchanged. */}
      <Suspense fallback={<PageLoader />}>
        <AppErrorBoundary>
          <Routes location={location}>
            <Route path="/" element={<MainMenu />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/market" element={<MarketPage />} />
            <Route path="/daily" element={<DailyPage />} />
            <Route path="/solo" element={<SoloChallenge />} />
            <Route path="/SoloChallenge" element={<Navigate to="/solo" replace />} />
            <Route caseSensitive path="/Game" element={<Navigate to="/solo" replace />} />
            <Route path="/setup" element={<Navigate to="/solo" replace />} />
            <Route path="/game" element={<Game />} />
            <Route path="/duel" element={<SameQuestionDuelPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/edit" element={<ProfileEditPage />} />
            <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
            <Route path="/AdminPage" element={<Navigate to="/admin" replace />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/online" element={<OnlinePage />} />
            <Route path="/lobby" element={<LegacyLobbyRedirect />} />
            <Route path="/LobbyRoom" element={<LegacyLobbyRedirect />} />
            <Route path="/test-suite" element={<TestSuite />} />
            <Route path="/TestSuite" element={<Navigate to="/test-suite" replace />} />
            <Route path="/account-deletion" element={<AccountDeletionPage />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </AppErrorBoundary>
      </Suspense>
      {isAuthenticated && nonCriticalModulesEnabled && (
        <Suspense fallback={null}>
          <GameInviteNotifier />
        </Suspense>
      )}
      {isAuthenticated && nonCriticalModulesEnabled && !isOnboardingPage && (
        <Suspense fallback={null}>
          <CategoryPreferenceOnboardingModal
            user={user}
            onCompleted={handleCategoryPreferenceOnboardingComplete}
          />
        </Suspense>
      )}
      {!isOnboardingPage && (
        !isPublicStandalonePage && <BottomNav />
      )}
    </div>
  );
};


function App() {
  usePreventAppZoom();

  // Codex498 — push current build marker into diag bus once at app boot
  useEffect(() => {
    appDiagSetBuildMarker(KRONOX_BUILD_MARKER);
    // Codex176 — App booted successfully, so any prior stale-chunk reload
    // recovered. Clear the one-time reload guards so a future deploy can
    // self-heal again.
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('kx-chunk-reloaded:'))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch { /* sessionStorage unavailable — ignore */ }
  }, []);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationStackProvider>
            <BuildMarker />
            <AuthenticatedApp />
          </NavigationStackProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
