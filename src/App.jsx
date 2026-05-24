import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import BottomNav from '@/components/layout/BottomNav';
import AppHeader from '@/components/layout/AppHeader';
import SplashScreen from '@/components/SplashScreen';
import { NavigationStackProvider } from '@/lib/NavigationStackContext';
import BuildMarker from '@/components/dev/BuildMarker';

const MainMenu = lazy(() => import('./pages/MainMenu'));
const SoloChallenge = lazy(() => import('./pages/SoloChallenge'));
const Game = lazy(() => import('./pages/Game'));
const LobbyRoom = lazy(() => import('./pages/LobbyRoom'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const TestSuite = lazy(() => import('./pages/TestSuite'));

function PageLoader() {
  return <SplashScreen />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();
  const location = useLocation();
  const prevPathRef = React.useRef(location.pathname);
  const isGamePage = location.pathname === '/game';
  const isHomePage = location.pathname === '/' || location.pathname === '/solo';
  const isViewportLockedPage = location.pathname === '/' || isGamePage;

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
      return <Navigate to="/" replace />;
    }
  }

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return <SplashScreen />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    // auth_required: uygulama public — login olmadan da devam et
  }

  // Render the main app
  return (
    <div style={viewportShellStyle} data-kx-route-locked={isViewportLockedPage ? 'true' : 'false'}>
      {!isGamePage && !isHomePage && <AppHeader />}
      <Suspense fallback={<PageLoader />}>
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
            <Routes location={location}>
              <Route path="/" element={<MainMenu />} />
              <Route path="/solo" element={<SoloChallenge />} />
              <Route path="/setup" element={<Navigate to="/solo" replace />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/lobby" element={<LobbyRoom />} />
              <Route path="/game" element={<Game />} />
              <Route path="/test-suite" element={<TestSuite />} />
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Suspense>
      <BottomNav />
    </div>
  );
};


function App() {
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