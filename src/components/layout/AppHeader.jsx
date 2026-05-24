import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Root screens: show brand title, no back button
const ROOT_ROUTES = ['/', '/lobby', '/profile', '/settings'];

export default function AppHeader({ onBack } = {}) {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on game page (GameLayout has its own top bar)
  if (location.pathname === '/game') return null;

  const isRoot = ROOT_ROUTES.includes(location.pathname);

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
        className="absolute left-1/2 -translate-x-1/2 font-bangers text-2xl text-primary tracking-widest"
        style={{ textShadow: '0 0 15px rgba(255,193,7,0.5)' }}
      >
        KRONOX
      </h1>
    </div>
  );
}