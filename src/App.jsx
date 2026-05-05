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

const PlayerSetup = lazy(() => import('./pages/PlayerSetup'));
const Game = lazy(() => import('./pages/Game'));
const LobbyRoom = lazy(() => import('./pages/LobbyRoom'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TestSuite = lazy(() => import('./pages/TestSuite'));

function PageLoader() {
  return <SplashScreen />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();
  const location = useLocation();
  const isGamePage = location.pathname === '/game';
  const isHomePage = location.pathname === '/';

  // Android WebView fix: never stay on /login if user is authenticated or auth check is done.
  if (location.pathname.includes('/login')) {
    if (isAuthenticated || !isLoadingAuth) {
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
    <div style={{ width: '100%', minHeight: '100%' }}>
      {!isGamePage && !isHomePage && <AppHeader />}
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <Routes location={location}>
              <Route path="/" element={<PlayerSetup />} />
              <Route path="/settings" element={<SettingsPage />} />
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
            <AuthenticatedApp />
          </NavigationStackProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App