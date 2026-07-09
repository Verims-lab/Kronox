import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export const TAB_ROOTS = {
  home: '/',
  leaderboard: '/leaderboard',
  profile: '/profile',
};

const TAB_ROOT_VALUES = Object.values(TAB_ROOTS);
const SAFE_ROUTE_RE = /^\/(?!\/)/;

export const TAB_ROOT_NAVIGATION_STATE = Object.freeze({
  from: 'bottom_nav',
  tabRootNavigation: true,
  resetTabSubpage: true,
});

export function createParentRouteState(from, parentRoute, extra = {}) {
  const safeParentRoute = sanitizeInternalRoute(parentRoute, TAB_ROOTS.home);
  return {
    from,
    parentRoute: safeParentRoute,
    returnTo: safeParentRoute,
    ...extra,
  };
}

export function getProfileParentRouteState(extra = {}) {
  return createParentRouteState('profile', TAB_ROOTS.profile, extra);
}

export function getTabRootNavigationState(tabRoot) {
  const safeTabRoot = TAB_ROOT_VALUES.includes(tabRoot) ? tabRoot : TAB_ROOTS.home;
  return {
    ...TAB_ROOT_NAVIGATION_STATE,
    parentRoute: safeTabRoot,
    returnTo: safeTabRoot,
  };
}

export function sanitizeInternalRoute(route, fallback = TAB_ROOTS.home) {
  const value = typeof route === 'string' ? route.trim() : '';
  if (SAFE_ROUTE_RE.test(value)) return value;
  return fallback;
}

function routeKeyFromLocation(locationLike) {
  if (!locationLike) return '/';
  const pathname = locationLike.pathname || '/';
  const search = locationLike.search || '';
  const hash = locationLike.hash || '';
  return `${pathname}${search}${hash}`;
}

export function getTabRootForPathname(pathname = '/') {
  if (pathname === '/game') return null;
  if (pathname === '/privacy') return null;
  if (pathname === '/lobby') return TAB_ROOTS.home;
  if (pathname === '/leaderboard') return TAB_ROOTS.leaderboard;
  if (['/profile', '/profile/edit', '/friends', '/settings', '/admin', '/test-suite', '/account-deletion'].includes(pathname)) {
    return TAB_ROOTS.profile;
  }
  if (['/', '/market', '/solo', '/setup'].includes(pathname)) return TAB_ROOTS.home;
  return TAB_ROOTS.home;
}

export function getSafeBackRoute(locationLike, fallbackRoute) {
  const pathname = locationLike?.pathname || '/';
  const fallback = sanitizeInternalRoute(
    fallbackRoute || getTabRootForPathname(pathname) || TAB_ROOTS.home,
    TAB_ROOTS.home,
  );
  const state = locationLike?.state && typeof locationLike.state === 'object'
    ? locationLike.state
    : {};
  return sanitizeInternalRoute(state.returnTo || state.parentRoute, fallback);
}

const NavigationStackContext = createContext();

export function NavigationStackProvider({ children }) {
  const [stacks, setStacks] = useState({
    [TAB_ROOTS.home]: [TAB_ROOTS.home],
    [TAB_ROOTS.leaderboard]: [TAB_ROOTS.leaderboard],
    [TAB_ROOTS.profile]: [TAB_ROOTS.profile],
  });
  const [scrollPositions, setScrollPositions] = useState({});
  const [currentTab, setCurrentTab] = useState(TAB_ROOTS.home);

  const rememberRoute = useCallback((locationLike) => {
    const tabRoot = getTabRootForPathname(locationLike?.pathname || '/');
    if (!tabRoot || !TAB_ROOT_VALUES.includes(tabRoot)) return;
    const routeKey = routeKeyFromLocation(locationLike);
    setCurrentTab(tabRoot);
    setStacks((prev) => ({
      ...prev,
      [tabRoot]: [routeKey],
    }));
  }, []);

  const saveScrollForTab = useCallback((tabRoot, scrollY) => {
    if (!tabRoot || !TAB_ROOT_VALUES.includes(tabRoot)) return;
    const value = Math.max(0, Number(scrollY) || 0);
    setScrollPositions((prev) => ({ ...prev, [tabRoot]: value }));
  }, []);

  const clearScrollForTab = useCallback((tabRoot) => {
    setScrollPositions((prev) => {
      const next = { ...prev };
      delete next[tabRoot];
      return next;
    });
  }, []);

  const resetStack = useCallback((tabRoot) => {
    if (!tabRoot || !TAB_ROOT_VALUES.includes(tabRoot)) return;
    setStacks((prev) => ({
      ...prev,
      [tabRoot]: [tabRoot],
    }));
    clearScrollForTab(tabRoot);
  }, [clearScrollForTab]);

  const switchTab = useCallback((tabRoot) => {
    if (!tabRoot || !TAB_ROOT_VALUES.includes(tabRoot)) return;
    setCurrentTab(tabRoot);
  }, []);

  const getStackForTab = useCallback((tabRoot) => {
    const stack = stacks[tabRoot];
    return Array.isArray(stack) && stack.length ? stack : [tabRoot];
  }, [stacks]);

  const getScrollForTab = useCallback((tabRoot) => {
    return Math.max(0, Number(scrollPositions[tabRoot]) || 0);
  }, [scrollPositions]);

  const value = useMemo(() => ({
    stacks,
    currentTab,
    scrollPositions,
    rememberRoute,
    resetStack,
    switchTab,
    getStackForTab,
    getScrollForTab,
    saveScrollForTab,
    clearScrollForTab,
    getTabRootForPathname,
  }), [
    clearScrollForTab,
    currentTab,
    getScrollForTab,
    getStackForTab,
    rememberRoute,
    resetStack,
    saveScrollForTab,
    scrollPositions,
    stacks,
    switchTab,
  ]);

  return (
    <NavigationStackContext.Provider value={value}>
      {children}
    </NavigationStackContext.Provider>
  );
}

export function useNavigationStack() {
  const context = useContext(NavigationStackContext);
  if (!context) {
    throw new Error('useNavigationStack must be used within NavigationStackProvider');
  }
  return context;
}
