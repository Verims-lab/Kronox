import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import React, { Suspense, lazy, useEffect, useState } from 'react';
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
import GameInviteNotifier from '@/components/invites/GameInviteNotifier';
import { appDiagSetBuildMarker, pushAppDiag } from '@/lib/appDiagBus';
import { base44 } from '@/api/base44Client';
import KronoxTutorial from '@/components/tutorial/KronoxTutorial';
import { markTutorialCompleted, shouldShowTutorialForUser } from '@/lib/tutorialProfile';

const MainMenu = lazy(() => import('./pages/MainMenu'));
const SoloChallenge = lazy(() => import('./pages/SoloChallenge'));
const Game = lazy(() => import('./pages/Game'));
const LobbyRoom = lazy(() => import('./pages/LobbyRoom'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const TestSuite = lazy(() => import('./pages/TestSuite'));

function PageLoader() {
  return <SplashScreen />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, user, checkUserAuth } = useAuth();
  const location = useLocation();
  const prevPathRef = React.useRef(location.pathname);
  const isGamePage = location.pathname === '/game';
  // Codex102 — Only home + game lock viewport. All other screens scroll
  // normally and host their own ScreenHeader.
  const isViewportLockedPage = location.pathname === '/' || isGamePage;

  // Codex085 — fetch current user for App-level diagnostics gating.
  const [currentUser, setCurrentUser] = useState(null);
  const [showProfileTutorial, setShowProfileTutorial] = useState(false);
  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u || null)).catch(() => setCurrentUser(null));
  }, [isAuthenticated]);

  useEffect(() => {
    setShowProfileTutorial(Boolean(isAuthenticated && shouldShowTutorialForUser(user)));
  }, [isAuthenticated, user?.email, user?.hasCompletedTutorial]);

  const handleProfileTutorialComplete = async () => {
    await markTutorialCompleted(user).catch(() => null);
    setShowProfileTutorial(false);
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
    const routeOrder = ['/', '/game', '/lobby', '/profile', '/settings', '/test-suite'];
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
  if (isLoadingAuth) {
    return (
      <>
        <AppDiagnostics currentUser={currentUser} />
        <SplashScreen />
      </>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return (
        <>
          <AppDiagnostics currentUser={currentUser} />
          <UserNotRegisteredError />
        </>
      );
    }
    // auth_required: uygulama public — login olmadan da devam et
  }

  // Render the main app
  return (
    <div style={viewportShellStyle} data-kx-route-locked={isViewportLockedPage ? 'true' : 'false'}>
      <AppDiagnostics currentUser={currentUser} />
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
                  <Route path="/solo" element={<SoloChallenge />} />
                  <Route path="/setup" element={<Navigate to="/solo" replace />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/friends" element={<FriendsPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route path="/lobby" element={<LobbyRoom />} />
                  <Route path="/test-suite" element={<TestSuite />} />
                  <Route path="*" element={<PageNotFound />} />
                </Routes>
              </AppErrorBoundary>
            </motion.div>
          </AnimatePresence>
        )}
      </Suspense>
      {showProfileTutorial && (
        <KronoxTutorial
          onComplete={handleProfileTutorialComplete}
          onDone={() => setShowProfileTutorial(false)}
          onSkip={() => setShowProfileTutorial(false)}
        />
      )}
      <BottomNav />
    </div>
  );
};


function App() {
  // Codex108 — push build marker into diag bus once at app boot
  useEffect(() => {
    appDiagSetBuildMarker('Codex108');
  }, []);

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationStackProvider>
            <BuildMarker />
            <GameInviteNotifier />
            <AuthenticatedApp />
          </NavigationStackProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App