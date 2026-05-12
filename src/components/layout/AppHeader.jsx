import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Root tab screens: /lobby, /settings (no back button, show KRONOX)
const ROOT_TAB_ROUTES = ['/lobby', '/settings'];

export default function AppHeader({ onBack } = {}) {
  const location = useLocation();
  const navigate = useNavigate();

  const isRootTab = ROOT_TAB_ROUTES.includes(location.pathname);

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    if (window.history.length > 1) { navigate(-1); }
    else { navigate('/'); }
  };

  // Hide on home and game pages
  if (!isRootTab) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center px-4 bg-background/80 backdrop-blur-md border-b border-white/10"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
    >
      <h1
        className="font-bangers text-2xl text-primary tracking-widest cursor-pointer"
        style={{ textShadow: '0 0 15px rgba(255,193,7,0.5)' }}
        onClick={handleBack}
      >
        KRONOX
      </h1>
    </div>
  );
}