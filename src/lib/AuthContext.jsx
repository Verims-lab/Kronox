import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { withAdminStatus } from '@/lib/admin';
import { ensureDiamondEconomyForUser, getDiamondDailyKey } from '@/lib/diamondEconomy';
import { clearJokerInventoryCache, ensureStarterJokers, normalizeJokerEmail } from '@/lib/jokerInventory';
import { applyUserProgressResetMarker } from '@/lib/progressResetCache';
import { ensureGuestProfile, linkPendingGuestAccount, repairGuestOnboardingCompletionIfNeeded } from '@/lib/guestProfile';
import { readSoloProgress } from '@/lib/soloLevels';
import { hydrateAuthenticatedUserProfile } from '@/lib/userProfileHydration';
import { recordAppOpenActivity } from '@/lib/appActivity';

const AuthContext = createContext();

const EMPTY_ADMIN_STATUS = {
  loading: false,
  called: false,
  statusCall: 'idle',
  authEmailRaw: '',
  normalizedEmail: '',
  responseShape: '',
  responseShapeKeys: [],
  responseKeys: [],
  dataKeys: [],
  nestedDataKeys: [],
  parsedIsAdmin: false,
  role: '',
  status: '',
  source: 'AdminUser',
  statusFunction: '',
  backendDebug: null,
  reason: 'not_checked',
  error: '',
};

function makePendingAdminStatus(currentUser) {
  const authEmailRaw = String(currentUser?.email || '');
  const normalizedEmail = authEmailRaw.trim().toLowerCase();
  return {
    ...EMPTY_ADMIN_STATUS,
    loading: Boolean(normalizedEmail),
    statusCall: normalizedEmail ? 'pending' : 'skipped',
    authEmailRaw,
    normalizedEmail,
    reason: normalizedEmail ? 'pending' : 'no_auth_email',
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [adminStatus, setAdminStatus] = useState(EMPTY_ADMIN_STATUS);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [guestProfile, setGuestProfile] = useState(null);
  const economyEnsurePromiseRef = useRef(null);
  const economyEnsureKeyRef = useRef('');
  const jokerEnsurePromiseRef = useRef(null);
  const jokerEnsureKeyRef = useRef('');

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setAuthError(null);
      await checkUserAuth();
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      let currentUser = await base44.auth.me();

      // Android WebView: token URL'de varsa ama me() null döndürdüyse,
      // 800ms bekleyip bir kez daha dene (WebView'de token geç okunuyor olabilir).
      if (!currentUser) {
        // WebView may store the token async — retry once after a short delay
        await new Promise(r => setTimeout(r, 600));
        currentUser = await base44.auth.me().catch(() => null);
      }

      let currentGuestProfile = null;

      if (currentUser?.email) {
        setGuestProfile(null);
        currentUser = await hydrateAuthenticatedUserProfile(base44, currentUser);
        applyUserProgressResetMarker(currentUser);
        const economyKey = `${String(currentUser.email).trim().toLowerCase()}:${getDiamondDailyKey()}`;
        if (economyEnsureKeyRef.current !== economyKey) {
          try {
            if (!economyEnsurePromiseRef.current) {
              economyEnsurePromiseRef.current = ensureDiamondEconomyForUser(currentUser)
                .finally(() => {
                  economyEnsurePromiseRef.current = null;
                });
            }
            const economy = await economyEnsurePromiseRef.current;
            if (economy?.user) {
              currentUser = await hydrateAuthenticatedUserProfile(base44, economy.user);
            }
            if (economy?.ok !== false) economyEnsureKeyRef.current = economyKey;
          } catch (economyError) {
            console.warn('[diamondEconomy] bootstrap grant skipped:', economyError?.message || economyError);
          }
        }
        const jokerKey = normalizeJokerEmail(currentUser.email);
        if (jokerKey && jokerEnsureKeyRef.current !== jokerKey) {
          try {
            if (!jokerEnsurePromiseRef.current) {
              jokerEnsurePromiseRef.current = ensureStarterJokers(currentUser)
                .finally(() => {
                  jokerEnsurePromiseRef.current = null;
                });
            }
            const jokerInit = await jokerEnsurePromiseRef.current;
            if (jokerInit?.ok !== false) jokerEnsureKeyRef.current = jokerKey;
          } catch (jokerError) {
            console.warn('[jokerInventory] starter grant skipped:', jokerError?.message || jokerError);
          }
        }
        try {
          const guestProgressSnapshot = readSoloProgress(null);
          const linkResult = await linkPendingGuestAccount({ soloProgress: guestProgressSnapshot });
          if (linkResult?.user) {
            currentUser = await hydrateAuthenticatedUserProfile(base44, linkResult.user);
            applyUserProgressResetMarker(currentUser);
          }
        } catch (linkError) {
          console.warn('[guestProfile] account link merge skipped', {
            reason: String(linkError?.code || linkError?.message || 'account_link_failed').slice(0, 120),
          });
        }
        currentUser = await hydrateAuthenticatedUserProfile(base44, currentUser);
        setAdminStatus(makePendingAdminStatus(currentUser));
        currentUser = await withAdminStatus(currentUser, { onStatus: setAdminStatus });
        currentUser = await hydrateAuthenticatedUserProfile(base44, currentUser);
      } else {
        setAdminStatus(makePendingAdminStatus(currentUser));
        currentGuestProfile = await ensureGuestProfile().catch((guestError) => {
          console.warn('[guestProfile] app-owned guest identity unavailable', {
            reason: String(guestError?.message || 'guest_profile_unavailable').slice(0, 120),
          });
          return null;
        });
        if (currentGuestProfile) {
          currentGuestProfile = await repairGuestOnboardingCompletionIfNeeded(currentGuestProfile)
            .catch(() => currentGuestProfile);
        }
      }

      const nextUser = currentUser || null;
      const nextGuestProfile = currentUser?.email ? null : currentGuestProfile;
      setUser(currentUser || null);
      setGuestProfile(nextGuestProfile);
      setIsAuthenticated(!!currentUser);
      setAuthError(null);
      recordAppOpenActivity({ user: nextUser, guestProfile: nextGuestProfile }).catch((activityError) => {
        console.warn('[appActivity] app-open tracking skipped', {
          reason: String(activityError?.message || 'record_app_open_failed').slice(0, 120),
        });
      });

      // Yalnızca geçerli oturum onaylandıktan sonra OAuth parametrelerini temizle.
      if (currentUser) {
        const url = new URL(window.location.href);
        const oauthParams = ['code', 'token', 'state', 'session_state', 'scope'];
        if (oauthParams.some(p => url.searchParams.has(p))) {
          oauthParams.forEach(p => url.searchParams.delete(p));
          const clean = url.pathname + (url.search && url.search !== '?' ? url.search : '') + url.hash;
          window.history.replaceState({}, '', clean);
        }
        // Kullanıcı zaten giriş yapmışsa /login path'inde kalmasın
        if (window.location.pathname.includes('/login')) {
          window.history.replaceState({}, '', '/');
        }
      }
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
      setAdminStatus(EMPTY_ADMIN_STATUS);
      const fallbackGuestProfile = await ensureGuestProfile().catch(() => null);
      setGuestProfile(fallbackGuestProfile);
      if (fallbackGuestProfile) {
        recordAppOpenActivity({ user: null, guestProfile: fallbackGuestProfile }).catch(() => null);
      }
      // auth_required = uygulama public, login gerektirmiyor — hata değil
      if (error?.message?.includes('user_not_registered')) {
        setAuthError({ type: 'user_not_registered', message: 'User not registered' });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAdminStatus(EMPTY_ADMIN_STATUS);
    setGuestProfile(null);
    economyEnsureKeyRef.current = '';
    economyEnsurePromiseRef.current = null;
    jokerEnsureKeyRef.current = '';
    jokerEnsurePromiseRef.current = null;
    clearJokerInventoryCache();
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout('/');
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin('/');
  };

  const refreshAdminStatus = async () => {
    if (!user?.email) {
      setAdminStatus(makePendingAdminStatus(user));
      return null;
    }
    setAdminStatus(makePendingAdminStatus(user));
    const checkedUser = await withAdminStatus(user, { onStatus: setAdminStatus });
    setUser(checkedUser);
    return checkedUser?.admin_status_debug || null;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      authChecked,
      adminStatus,
      guestProfile,
      isGuest: !isAuthenticated && Boolean(guestProfile),
      refreshAdminStatus,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
