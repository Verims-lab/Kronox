import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Globe, Settings } from 'lucide-react';

const TABS = [
  { label: 'Ana Sayfa', icon: Home, path: '/' },
  { label: 'Çevrimiçi', icon: Globe, path: '/lobby' },
  { label: 'Ayarlar', icon: Settings, path: '/settings' },
];

// Hide bottom nav on game and home screen (they have their own UI)
const HIDDEN_ROUTES = ['/game', '/'];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  if (HIDDEN_ROUTES.includes(location.pathname)) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] bg-card/90 backdrop-blur-md border-t border-white/10 flex items-center justify-around"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(3.5rem + env(safe-area-inset-bottom))',
        userSelect: 'none',
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '100vw',
      }}
    >
      {TABS.map(({ label, icon: Icon, path }) => {
        const isActive = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path, { replace: isActive })}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <Icon
              className={`w-5 h-5 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <span
              className={`font-inter text-[10px] transition-colors ${isActive ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}