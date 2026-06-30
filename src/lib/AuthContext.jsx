import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { withAdminStatus } from '@/lib/admin';
import { ensureDiamondEconomyForUser, getDiamondDailyKey } from '@/lib/diamondEconomy';
import { clearJokerInventoryCache, ensureStarterJokers, normalizeJokerEmail } from '@/lib/jokerInventory';
import { applyUserProgressResetMarker } from '@/lib/progressResetCache';
import { ensureGuestProfile, getCachedGuestProfile, linkPendingGuestAccount, repairGuestOnboardingCompletionIfNeeded } from '@/lib/guestProfile';
import { readSoloProgress } from '@/lib/soloLevels';
import { hydrateAuthenticatedUserProfile } from '@/lib/userProfileHydration';
import { recordAppOpenActivity } from '@/lib/appActivity';
import { ensureKronoxUserIdForCurrentActor } from '@/lib/kronoxUserId';

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

const AUTH_NULL_RETRY_DELAY_MS = 180;
const AUTH_OAUTH_RETRY_DELAY_MS = 240;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasOAuthCallbackParams() {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    return ['code', 'token', 'state', 'session_state', 'scope'].some((key) => url.searchParams.has(key))
      || window.location.pathname.includes('/login');
  } catch {
    return false;
  }
}

function cleanupOAuthUrlAfterAuth() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const oauthParams = ['code', 'token', 'state', 'session_state', 'scope'];
    if (oauthParams.some(p => url.searchParams.has(p))) {
      oauthParams.forEach(p => url.searchParams.delete(p));
      const clean = url.pathname + (url.search && url.search !== '?' ? url.search : '') + url.hash;
      window.history.replaceState({}, '', clean);
    }
    if (window.location.pathname.includes('/login')) {
      window.history.replaceState({}, '', '/');
    }
  } catch {
    // URL cleanup is visual/navigation hygiene only; auth state is already set.
  }
}

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
  const authRunIdRef = useRef(0);

  useEffect(() => {
    checkAppState();
  }, []);

  const isCurrentAuthRun = (runId) => authRunIdRef.current === runId;

  const patchAuthenticatedUser = (runId, nextUser) => {
    if (!nextUser || !isCurrentAuthRun(runId)) return;
    setUser((current) => {
      if (!current?.email || !isCurrentAuthRun(runId)) return current;
      const currentEmail = String(current.email || current.user_email || '').trim().toLowerCase();
      const nextEmail = String(nextUser.email || nextUser.user_email || '').trim().toLowerCase();
      if (currentEmail && nextEmail && currentEmail !== nextEmail) return current;
      return { ...current, ...nextUser };
    });
  };

  const patchGuestProfile = (runId, nextProfile) => {
    if (!nextProfile || !isCurrentAuthRun(runId)) return;
    setGuestProfile((current) => {
      if (!isCurrentAuthRun(runId)) return current;
      return { ...(current || {}), ...nextProfile };
    });
  };

  const warnMaintenanceSkipped = (scope, error, fallback = 'startup_maintenance_failed') => {
    console.warn(scope, {
      reason: String(error?.code || error?.message || fallback).slice(0, 120),
    });
  };

  const runAuthenticatedBootstrapMaintenance = (runId, initialUser) => {
    if (!initialUser?.email) return;

    (async () => {
      // `currentUser` is the stable authenticated actor for this run; lazy
      // initialization (Diamond economy + starter jokers) is keyed off it so
      // it runs once per identity and never re-grants on refresh/re-render.
      const currentUser = initialUser;
      let workingUser = initialUser;

      recordAppOpenActivity({ user: workingUser, guestProfile: null }).catch((activityError) => {
        warnMaintenanceSkipped('[appActivity] app-open tracking skipped', activityError, 'record_app_open_failed');
      });

      const hydrateAndPatch = async (candidate) => {
        if (!candidate || !isCurrentAuthRun(runId)) return null;
        const hydrated = await hydrateAuthenticatedUserProfile(base44, candidate);
        if (!isCurrentAuthRun(runId)) return null;
        workingUser = hydrated || candidate;
        patchAuthenticatedUser(runId, workingUser);
        return workingUser;
      };

      try {
        await hydrateAndPatch(workingUser);
      } catch (hydrateError) {
        warnMaintenanceSkipped('[userProfile] background hydrate skipped', hydrateError, 'user_profile_hydrate_failed');
      }

      try {
        const kronoxIdentity = await ensureKronoxUserIdForCurrentActor();
        if (!isCurrentAuthRun(runId)) return;
        if (kronoxIdentity?.user) {
          await hydrateAndPatch(kronoxIdentity.user);
        } else if (kronoxIdentity?.kronox_user_id) {
          workingUser = { ...workingUser, kronox_user_id: kronoxIdentity.kronox_user_id };
          patchAuthenticatedUser(runId, workingUser);
        }
      } catch (identityError) {
        warnMaintenanceSkipped('[kronoxUserId] registered ensure skipped', identityError, 'kronox_user_id_ensure_failed');
      }

      if (!isCurrentAuthRun(runId)) return;
      applyUserProgressResetMarker(workingUser);

      const economyKey = `${String(workingUser.email).trim().toLowerCase()}:${getDiamondDailyKey()}`;
      if (economyEnsureKeyRef.current !== economyKey) {
        try {
          if (!economyEnsurePromiseRef.current) {
            economyEnsurePromiseRef.current = ensureDiamondEconomyForUser(currentUser)
              .finally(() => {
                economyEnsurePromiseRef.current = null;
              });
          }
          const economy = await economyEnsurePromiseRef.current;
          if (!isCurrentAuthRun(runId)) return;
          if (economy?.user) await hydrateAndPatch(economy.user);
          if (economy?.ok !== false) economyEnsureKeyRef.current = economyKey;
        } catch (economyError) {
          warnMaintenanceSkipped('[diamondEconomy] bootstrap grant skipped', economyError, 'diamond_economy_failed');
        }
      }

      const jokerKey = normalizeJokerEmail(workingUser.email);
      if (jokerKey && jokerEnsureKeyRef.current !== jokerKey) {
        try {
          if (!jokerEnsurePromiseRef.current) {
            jokerEnsurePromiseRef.current = ensureStarterJokers(currentUser)
              .finally(() => {
                jokerEnsurePromiseRef.current = null;
              });
          }
          const jokerInit = await jokerEnsurePromiseRef.current;
          if (!isCurrentAuthRun(runId)) return;
          if (jokerInit?.ok !== false) jokerEnsureKeyRef.current = jokerKey;
        } catch (jokerError) {
          warnMaintenanceSkipped('[jokerInventory] starter grant skipped', jokerError, 'starter_joker_failed');
        }
      }

      try {
        const guestProgressSnapshot = readSoloProgress(null);
        const linkResult = await linkPendingGuestAccount({ soloProgress: guestProgressSnapshot });
        if (!isCurrentAuthRun(runId)) return;
        if (linkResult?.user) {
          await hydrateAndPatch(linkResult.user);
          applyUserProgressResetMarker(workingUser);
        }
      } catch (linkError) {
        warnMaintenanceSkipped('[guestProfile] account link merge skipped', linkError, 'account_link_failed');
      }

      try {
        if (!isCurrentAuthRun(runId)) return;
        setAdminStatus(makePendingAdminStatus(workingUser));
        const checkedUser = await withAdminStatus(workingUser, {
          onStatus: (status) => {
            if (isCurrentAuthRun(runId)) setAdminStatus(status);
          },
        });
        if (!isCurrentAuthRun(runId)) return;
        if (checkedUser) await hydrateAndPatch(checkedUser);
      } catch (adminError) {
        warnMaintenanceSkipped('[admin] status check skipped', adminError, 'admin_status_failed');
      }
    })().catch((error) => {
      warnMaintenanceSkipped('[auth] registered startup maintenance skipped', error);
    });
  };

  const runGuestBootstrapMaintenance = (runId, initialGuestProfile, { verifyProfile = true } = {}) => {
    if (!initialGuestProfile) return;

    (async () => {
      let currentGuestProfile = initialGuestProfile;

      recordAppOpenActivity({ user: null, guestProfile: currentGuestProfile }).catch((activityError) => {
        warnMaintenanceSkipped('[appActivity] guest app-open tracking skipped', activityError, 'record_app_open_failed');
      });

      if (verifyProfile) {
        try {
          const verified = await ensureGuestProfile();
          if (!isCurrentAuthRun(runId)) return;
          if (verified) {
            currentGuestProfile = verified;
            patchGuestProfile(runId, currentGuestProfile);
          }
        } catch (guestError) {
          warnMaintenanceSkipped('[guestProfile] background verify skipped', guestError, 'guest_profile_verify_failed');
        }
      }

      try {
        const identityResult = await ensureKronoxUserIdForCurrentActor();
        if (!isCurrentAuthRun(runId)) return;
        if (identityResult?.profile) {
          currentGuestProfile = identityResult.profile;
          patchGuestProfile(runId, currentGuestProfile);
        } else if (identityResult?.kronox_user_id) {
          currentGuestProfile = {
            ...currentGuestProfile,
            kronox_user_id: identityResult.kronox_user_id,
          };
          patchGuestProfile(runId, currentGuestProfile);
        }
      } catch (identityError) {
        warnMaintenanceSkipped('[kronoxUserId] guest ensure skipped', identityError, 'kronox_user_id_ensure_failed');
      }

      try {
        currentGuestProfile = await repairGuestOnboardingCompletionIfNeeded(currentGuestProfile);
        if (!isCurrentAuthRun(runId)) return;
        if (currentGuestProfile) patchGuestProfile(runId, currentGuestProfile);
      } catch (repairError) {
        warnMaintenanceSkipped('[guestProfile] onboarding repair skipped', repairError, 'guest_profile_repair_failed');
      }
    })().catch((error) => {
      warnMaintenanceSkipped('[auth] guest startup maintenance skipped', error);
    });
  };

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
      setAuthChecked(true);
    }
  };

  const checkUserAuth = async () => {
    const runId = authRunIdRef.current + 1;
    authRunIdRef.current = runId;

    try {
      setAuthError(null);
      if (!authChecked) setIsLoadingAuth(true);

      const cachedGuestProfile = getCachedGuestProfile();
      let currentUser = await base44.auth.me();

      if (!currentUser) {
        const retryDelay = hasOAuthCallbackParams()
          ? AUTH_OAUTH_RETRY_DELAY_MS
          : (cachedGuestProfile ? 0 : AUTH_NULL_RETRY_DELAY_MS);
        if (retryDelay > 0) {
          await wait(retryDelay);
          if (!isCurrentAuthRun(runId)) return null;
          currentUser = await base44.auth.me().catch(() => null);
        }
      }

      if (!isCurrentAuthRun(runId)) return null;

      if (currentUser?.email) {
        setGuestProfile(null);
        setUser(currentUser || null);
        setIsAuthenticated(!!currentUser);
        setAdminStatus(makePendingAdminStatus(currentUser));
        setAuthError(null);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        cleanupOAuthUrlAfterAuth();
        runAuthenticatedBootstrapMaintenance(runId, currentUser);
        return currentUser;
      }

      setAdminStatus(makePendingAdminStatus(null));
      let currentGuestProfile = cachedGuestProfile;
      let verifiedDuringCriticalPath = false;

      if (!currentGuestProfile) {
        currentGuestProfile = await ensureGuestProfile().catch((guestError) => {
          warnMaintenanceSkipped('[guestProfile] app-owned guest identity unavailable', guestError, 'guest_profile_unavailable');
          return null;
        });
        verifiedDuringCriticalPath = Boolean(currentGuestProfile);
      }

      if (!isCurrentAuthRun(runId)) return null;

      setUser(currentUser || null);
      setGuestProfile(currentGuestProfile || null);
      setIsAuthenticated(!!currentUser);
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);

      if (currentGuestProfile) {
        runGuestBootstrapMaintenance(runId, currentGuestProfile, {
          verifyProfile: !verifiedDuringCriticalPath,
        });
      }

      return null;
    } catch (error) {
      if (!isCurrentAuthRun(runId)) return null;
      console.error('User auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
      setAdminStatus(EMPTY_ADMIN_STATUS);
      const cachedGuestProfile = getCachedGuestProfile();
      const fallbackGuestProfile = cachedGuestProfile || await ensureGuestProfile().catch(() => null);
      if (!isCurrentAuthRun(runId)) return null;
      setGuestProfile(fallbackGuestProfile);
      if (fallbackGuestProfile) {
        runGuestBootstrapMaintenance(runId, fallbackGuestProfile, {
          verifyProfile: !cachedGuestProfile,
        });
      }
      // auth_required = uygulama public, login gerektirmiyor — hata değil
      if (error?.message?.includes('user_not_registered')) {
        setAuthError({ type: 'user_not_registered', message: 'User not registered' });
      }
      return null;
    } finally {
      if (isCurrentAuthRun(runId)) {
        setIsLoadingAuth(false);
        setAuthChecked(true);
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    authRunIdRef.current += 1;
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
      setUser,
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