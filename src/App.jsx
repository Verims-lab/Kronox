import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { Loader2 } from 'lucide-react';
import BottomNav from '@/components/layout/BottomNav';
import AppHeader from '@/components/layout/AppHeader';
import { base44 } from '@/api/base44Client';

const PlayerSetup = lazy(() => import('./pages/PlayerSetup'));
const Game = lazy(() => import('./pages/Game'));
const LobbyRoom = lazy(() => import('./pages/LobbyRoom'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TestSuite = lazy(() => import('./pages/TestSuite'));

function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
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
    // auth_required: uygulama public — login olmadan da devam et
  }

  // Render the main app
  return (
    <div style={{ width: '100%', minHeight: '100%' }}>
      <AppHeader />
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
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App