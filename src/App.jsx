import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import React, { Suspense, lazy } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { Loader2 } from 'lucide-react';
import BottomNav from '@/components/layout/BottomNav';
import AppHeader from '@/components/layout/AppHeader';

const PlayerSetup = lazy(() => import('./pages/PlayerSetup'));
const Game = lazy(() => import('./pages/Game'));
const LobbyRoom = lazy(() => import('./pages/LobbyRoom'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
  if (authError.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }
  // For auth_required or any other error: app is public — continue as guest
  // Do NOT block rendering or show error screen
  }

  // Render the main app
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '-100%', opacity: 0 }}
        transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
        style={{ position: 'absolute', width: '100%', minHeight: '100%' }}
      >
        <AppHeader />
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            <Route path="/" element={<PlayerSetup />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/lobby" element={<LobbyRoom />} />
            <Route path="/game" element={<Game />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
        {/* BottomNav is hidden on /game internally */}
        <BottomNav />
      </motion.div>
    </AnimatePresence>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App