import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Settings } from 'lucide-react';

const TABS = [
  { label: 'Oyna', icon: Play, path: '/' },
  { label: 'Ayarlar', icon: Settings, path: '/settings' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  // Only show on home and settings
  const showOn = ['/', '/settings'];
  if (!showOn.includes(location.pathname)) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-md border-t border-border/50 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-1 relative transition-colors"
          >
            {isActive && (
              <motion.div
                layoutId="bottom-nav-indicator"
                className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            )}
            <tab.icon
              className={`w-5 h-5 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span
              className={`font-inter text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}