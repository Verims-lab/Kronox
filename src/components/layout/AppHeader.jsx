import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Phase 3 audit (Codex124) — DEPRECATED.
//   App.jsx Codex102 stopped rendering this component globally; every
//   screen now renders its own <ScreenHeader />. We are leaving the file
//   on disk because deletion needs a cross-grep verification pass and a
//   Health-source-token review (the file is referenced as a "Codex102"
//   note inside App.jsx comments). If no consumer is found in Phase 4,
//   this file can be safely deleted. DO NOT add new features to it.

// Root screens: show brand title, no back button
const ROOT_ROUTES = ['/', '/lobby', '/profile', '/settings'];

export default function AppHeader({ onBack } = {}) {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on game page (GameLayout has its own top bar)
  if (location.pathname === '/game') return null;

  const isRoot = ROOT_ROUTES.includes(location.pathname);
  const isLobbyRoute = location.pathname === '/lobby';
  const titleClassName = isLobbyRoute
    ? 'absolute left-1/2 -translate-x-1/2 font-cinzel text-2xl font-black tracking-[0.18em]'
    : 'absolute left-1/2 -translate-x-1/2 font-bangers text-2xl text-primary tracking-widest';
  const titleStyle = isLobbyRoute
    ? {
        color: '#facc15',
        textShadow: '0 0 18px rgba(250,204,21,0.5), 0 2px 4px rgba(0,0,0,0.7)',
      }
    : { textShadow: '0 0 15px rgba(255,193,7,0.5)' };

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    if (window.history.length > 1) { navigate(-1); }
    else { navigate('/'); }
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center px-4 bg-background/80 backdrop-blur-md border-b border-white/10"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
    >
      {/* Back button for non-root routes */}
      {!isRoot && (
        <button
          onClick={handleBack}
          className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all"
          style={{ minHeight: 44, minWidth: 44 }}
          aria-label="Geri"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {/* Brand title — centered absolutely so it's always visually centered */}
      <h1
        className={titleClassName}
        style={titleStyle}
      >
        KRONOX
      </h1>
    </div>
  );
}