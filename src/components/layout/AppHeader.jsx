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
      <img 
        src="https://media.base44.com/images/public/69e753d5ab4c08a7c4287c25/ba8dc2ec6_Kronoxlogo.png" 
        alt="Kronox" 
        className="h-8 object-contain ml-3 cursor-pointer" 
        onClick={handleBack}
      />
    </div>
  );
}