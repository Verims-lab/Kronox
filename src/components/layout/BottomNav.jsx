import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Trophy, UserRound } from 'lucide-react';
import { getTabRootForPathname, useNavigationStack } from '@/lib/NavigationStackContext';
import { getBottomNavHidden, subscribeBottomNavHidden } from '@/lib/bottomNavVisibility';

// Codex305 — BottomNav has exactly three visible tabs. Online remains reachable
// from the Home "Online Kapışma" CTA and is not a bottom-nav tab.
// - Ana Sayfa (Home)
// - Liderlik (Trophy)
// - Profil  (User)
const TABS = [
  { label: 'Ana Sayfa', icon: Home, path: '/' },
  { label: 'Liderlik', icon: Trophy, path: '/leaderboard' },
  { label: 'Profil', icon: UserRound, path: '/profile' },
];

// Codex103 — Only fully-immersive / commitment-critical flows hide the bar by
// route alone. /lobby is NOT here anymore because its visibility depends on
// the in-page mode/state (see lib/bottomNavVisibility.js). LobbyRoom toggles
// the runtime override when entering create/join/waiting sub-flows.
const HIDDEN_ROUTES = ['/game'];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentTab,
    switchTab,
    getStackForTab,
    resetStack,
    rememberRoute,
    getScrollForTab,
    saveScrollForTab,
  } = useNavigationStack();

  // Codex103 — subscribe to runtime visibility overrides (set by LobbyRoom for
  // mode=create/join/waiting). Static hide-by-route still wins for /game.
  const [runtimeHidden, setRuntimeHidden] = useState(getBottomNavHidden);
  useEffect(() => subscribeBottomNavHidden(setRuntimeHidden), []);

  useEffect(() => {
    rememberRoute(location);
  }, [location.pathname, location.search, location.hash, rememberRoute]);

  if (HIDDEN_ROUTES.includes(location.pathname)) return null;
  if (runtimeHidden) return null;

  const activeTab = getTabRootForPathname(location.pathname) || currentTab;
  const saveCurrentTabState = () => {
    const tabRoot = getTabRootForPathname(location.pathname);
    if (!tabRoot) return;
    rememberRoute(location);
    saveScrollForTab(tabRoot, window.scrollY || document.documentElement.scrollTop || 0);
  };

  const restoreScrollForTab = (tabRoot) => {
    const y = getScrollForTab(tabRoot);
    window.requestAnimationFrame?.(() => {
      window.requestAnimationFrame?.(() => {
        window.scrollTo({ top: y, left: 0, behavior: 'auto' });
      });
    });
  };

  const handleTabClick = (path) => {
    if (activeTab === path) {
      // Re-tapping current tab resets its stack/root without touching the other tabs.
      resetStack(path);
      switchTab(path);
      navigate(path, { replace: true });
      window.requestAnimationFrame?.(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    } else {
      saveCurrentTabState();
      switchTab(path);
      const stack = getStackForTab(path);
      const target = stack[stack.length - 1] || path;
      navigate(target, { replace: true });
      restoreScrollForTab(path);
    }
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] flex items-center justify-around"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(3.6rem + env(safe-area-inset-bottom))',
        userSelect: 'none',
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '100vw',
        background: 'rgba(10, 26, 53, 0.76)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(167, 196, 229, 0.16)',
        boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.20)',
      }}
    >
      {TABS.map(({ label, icon: Icon, path }) => {
        const isActive = activeTab === path;
        return (
          <button
            key={path}
            onClick={() => handleTabClick(path)}
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
            style={{ touchAction: 'manipulation', minHeight: '56px' }}
            aria-label={`${label} sekmesi`}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute top-0 h-[3px] w-8 rounded-full"
                style={{
                  background: '#FFC928',
                  boxShadow: '0 0 10px rgba(255, 201, 40, 0.65)',
                }}
              />
            )}
            <Icon
              className="w-5 h-5 transition-colors"
              strokeWidth={isActive ? 2.6 : 2.2}
              style={{
                color: isActive ? '#FFC928' : '#9BAEC2',
                filter: isActive ? 'drop-shadow(0 0 6px rgba(255,201,40,0.45))' : undefined,
              }}
            />
            <span
              className="font-inter text-[12px] transition-colors"
              style={{ color: isActive ? '#FFC928' : '#9BAEC2', fontWeight: isActive ? 700 : 500 }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}