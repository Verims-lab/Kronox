import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Only shown on non-game pages (lobby, settings)
const BACK_ROUTES = ['/lobby', '/settings'];

export default function AppHeader({ onBack } = {}) {
  const location = useLocation();
  const navigate = useNavigate();

  const showBack = BACK_ROUTES.includes(location.pathname);

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    if (window.history.length > 1) { navigate(-1); }
    else { navigate('/'); }
  };

  // Hide on home and game pages — they have their own headers
  if (!showBack) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center px-4 bg-background/80 backdrop-blur-md border-b border-white/10"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
    >
      <button
        onClick={handleBack}
        className="w-9 h-9 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h1
        className="font-bangers text-2xl text-primary tracking-widest ml-3 cursor-pointer"
        style={{ textShadow: '0 0 15px rgba(255,193,7,0.5)' }}
        onClick={handleBack}
      >
        KRONOX
      </h1>
    </div>
  );
}