import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import React, { Suspense, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import BottomNav from '@/components/layout/BottomNav';
import SplashScreen from '@/components/SplashScreen';
import { NavigationStackProvider } from '@/lib/NavigationStackContext';
import BuildMarker from '@/components/dev/BuildMarker';
import AppDiagnostics from '@/components/dev/AppDiagnostics';
import AppErrorBoundary from '@/components/dev/AppErrorBoundary';
import { appDiagSetBuildMarker, pushAppDiag } from '@/lib/appDiagBus';
import { isGuestOnboardingComplete } from '@/lib/guestProfile';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import usePresenceHeartbeat from '@/hooks/usePresenceHeartbeat';

const MainMenu = lazyWithRetry(() => import('./pages/MainMenu'), 'MainMenu');
const MarketPage = lazyWithRetry(() => import('./pages/MarketPage'), 'MarketPage');
const SoloChallenge = lazyWithRetry(() => import('./pages/SoloChallenge'), 'SoloChallenge');
const Game = lazyWithRetry(() => import('./pages/Game'), 'Game');
const LobbyRoom = lazyWithRetry(() => import('./pages/LobbyRoom'), 'LobbyRoom');
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
  usePresenceHeartbeat(user, guestProfile);
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
  // Codex102 — Only home + game lock viewport. All other screens scroll
  // normally and host their own ScreenHeader.
  const isViewportLockedPage = location.pathname === '/' || isGamePage;

  const handleCategoryPreferenceOnboardingComplete = () => {
    checkUserAuth?.();
  };

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

  // Determine transition direction: push (right-to-left) or pop (left-to-right)
  const getTransitionDirection = () => {
    const routeOrder = ['/', '/onboarding', '/market', '/game', '/lobby', '/profile', '/profile/edit', '/settings', '/admin', '/test-suite', '/privacy'];
    const currIdx = routeOrder.indexOf(location.pathname);
    const prevIdx = routeOrder.indexOf(prevPathRef.current);
    const direction = currIdx > prevIdx ? 'push' : 'pop';
    prevPathRef.current = location.pathname;
    return direction;
  };

  const transitionDir = getTransitionDirection();
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
        <AppDiagnostics currentUser={user} />
        <SplashScreen />
      </>
    );
  }

  // Handle authentication errors
  if (authError && !isPublicStandalonePage) {
    if (authError.type === 'user_not_registered') {
      return (
        <>
          <AppDiagnostics currentUser={user} />
          <UserNotRegisteredError />
        </>
      );
    }
    // auth_required: uygulama public — login olmadan da devam et
  }

  const shouldRouteGuestOnboarding = !isAuthenticated
    && Boolean(guestProfile)
    && !isGuestOnboardingComplete(guestProfile)
    && !isPublicStandalonePage
    && !isGamePage
    && !isOnboardingPage
    && !isOnboardingAccountLinkEntry;

  if (shouldRouteGuestOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // Render the main app
  return (
    <div style={viewportShellStyle} data-kx-route-locked={isViewportLockedPage ? 'true' : 'false'}>
      <AppDiagnostics currentUser={user} />
      {/* Codex102 — Global AppHeader removed. Each screen renders its own
          ScreenHeader so the title/back/avatar match the active page. */}
      <Suspense fallback={<PageLoader />}>
        {/*
          Codex085 — /game route is rendered OUTSIDE AnimatePresence.
          The previous mode="wait" wrapper required the previous route's exit
          animation to complete before the new route's enter animation
          started. On a slow host transition from /lobby → /game this could
          leave the new route stuck at { opacity: 0, x: 100 } → BLACK SCREEN.
          The /game route is the most timing-sensitive route in the app, so
          we render it directly (no animation wrapper) to guarantee an
          immediate mount on the host. All other routes keep the slick
          transition.
        */}
        {isGamePage ? (
          <AppErrorBoundary>
            <Routes location={location}>
              <Route path="/game" element={<Game />} />
            </Routes>
          </AppErrorBoundary>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: transitionDir === 'push' ? 100 : -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: transitionDir === 'push' ? -100 : 100 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              data-kx-route-locked={isViewportLockedPage ? 'true' : undefined}
              style={isViewportLockedPage ? { height: '100dvh', overflow: 'hidden', overscrollBehavior: 'none' } : undefined}
            >
              <AppErrorBoundary>
                <Routes location={location}>
                  <Route path="/" element={<MainMenu />} />
                  <Route path="/onboarding" element={<OnboardingPage />} />
                  <Route path="/market" element={<MarketPage />} />
                  <Route path="/solo" element={<SoloChallenge />} />
                  <Route path="/setup" element={<Navigate to="/solo" replace />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/profile/edit" element={<ProfileEditPage />} />
                  <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
                  <Route path="/friends" element={<FriendsPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route path="/lobby" element={<LobbyRoom />} />
                  <Route path="/test-suite" element={<TestSuite />} />
                  <Route path="/account-deletion" element={<AccountDeletionPage />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="*" element={<PageNotFound />} />
                </Routes>
              </AppErrorBoundary>
            </motion.div>
          </AnimatePresence>
        )}
      </Suspense>
      {isAuthenticated && !isPublicStandalonePage && (
        <Suspense fallback={null}>
          <GameInviteNotifier />
        </Suspense>
      )}
      {isAuthenticated && !isPublicStandalonePage && !isOnboardingPage && (
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
  // Codex468 — push current build marker into diag bus once at app boot
  useEffect(() => {
    appDiagSetBuildMarker('Codex468');
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
