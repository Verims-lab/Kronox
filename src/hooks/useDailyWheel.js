import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KRONOX_BUILD_MARKER } from '@/components/dev/BuildMarker';
import { claimDailyWheelReward, getDailyWheelStatus } from '@/lib/dbGateway/economyGateway';
import { getCompletedGuestCredentialsPayload } from '@/lib/guestProfile';

function normalizeFunctionBody(response) {
  return response?.data || response || {};
}

function todayFallbackKey() {
  return new Date().toISOString().slice(0, 10);
}

function promptSessionKey(user, serverDate) {
  const email = String(user?.email || user?.user_email || 'guest').trim().toLowerCase();
  return `kronox_daily_wheel_prompt_seen:${email}:${serverDate || todayFallbackKey()}`;
}

const DAILY_REWARD_STATUS_CACHE_TTL_MS = 60 * 1000;
const dailyWheelStatusCache = new Map();

function buildDailyWheelStatusCacheKey(user, guestCredentials) {
  const email = String(user?.email || user?.user_email || '').trim().toLowerCase();
  const guestId = String(guestCredentials?.guest_id || '').trim();
  if (email) return `auth:${email}:${todayFallbackKey()}`;
  if (guestId) return `guest:${guestId}:${todayFallbackKey()}`;
  return null;
}

function readDailyWheelStatusCache(cacheKey) {
  if (!cacheKey) return null;
  const cached = dailyWheelStatusCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > DAILY_REWARD_STATUS_CACHE_TTL_MS) {
    dailyWheelStatusCache.delete(cacheKey);
    return null;
  }
  return cached.body || null;
}

function writeDailyWheelStatusCache(cacheKey, body) {
  if (!cacheKey || !body) return;
  dailyWheelStatusCache.set(cacheKey, {
    cachedAt: Date.now(),
    body,
  });
}

function scheduleDailyWheelStatusRefresh(callback) {
  if (typeof window === 'undefined') {
    callback();
    return () => {};
  }
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 2200 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, 650);
  return () => window.clearTimeout(id);
}

function userSafeDailyWheelError(err, fallback) {
  const body = err?.response?.data || err?.body || null;
  return body?.error || fallback;
}

function buildClaimResultFromStatus(body) {
  const lastReward = body?.lastReward && typeof body.lastReward === 'object' ? body.lastReward : {};
  const totalRewardAmount = Number(lastReward.totalRewardAmount) || 0;
  const rewardAmount = Number(lastReward.rewardAmount) || totalRewardAmount;
  return {
    ok: true,
    available: false,
    alreadyClaimedToday: true,
    alreadyClaimed: true,
    serverDate: body?.serverDate,
    rewardAmount,
    streakBefore: Number(lastReward.streakBefore) || 0,
    streakAfter: Number(lastReward.streakAfter ?? body?.currentStreak) || 0,
    streakBonusAmount: Number(lastReward.streakBonusAmount) || 0,
    totalRewardAmount,
    claimedAt: lastReward.claimedAt || null,
    nextAvailableAt: lastReward.nextAvailableAt || body?.nextAvailableAt || null,
    updatedDiamondTotal: Number(body?.diamondTotal) || 0,
    userPatch: body?.userPatch || (Number.isFinite(Number(body?.diamondTotal))
      ? { diamonds: Number(body.diamondTotal) }
      : null),
  };
}

async function invokeDailyWheelFunction(name, payload = {}) {
  const isClaim = name === 'claimDailyWheelReward';
  let response = null;
  try {
    response = isClaim
      ? await claimDailyWheelReward(payload)
      : await getDailyWheelStatus(payload);
  } catch (err) {
    const error = new Error(isClaim
      ? 'Çark çevrilemedi. Lütfen tekrar dene.'
      : userSafeDailyWheelError(err, 'Günlük Çark durumu alınamadı. Lütfen tekrar dene.'));
    error.code = err?.response?.data?.code || err?.code || 'daily_wheel_request_failed';
    error.body = err?.response?.data || null;
    throw error;
  }
  const body = normalizeFunctionBody(response);
  if (body?.ok === false) {
    const error = new Error(isClaim
      ? 'Çark çevrilemedi. Lütfen tekrar dene.'
      : body?.error || 'Günlük Çark işlemi tamamlanamadı.');
    error.code = body?.code || 'daily_wheel_error';
    error.body = body;
    throw error;
  }
  return body;
}

export function useDailyWheel({ user, guestProfile, onUserUpdated } = {}) {
  const [status, setStatus] = useState('loading');
  const [wheel, setWheel] = useState(null);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const claimingRef = useRef(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const guestCredentials = useMemo(() => getCompletedGuestCredentialsPayload(guestProfile), [guestProfile]);
  const dailyWheelPayload = useMemo(() => guestCredentials || {}, [guestCredentials]);
  const dailyWheelCacheKey = useMemo(
    () => buildDailyWheelStatusCacheKey(user, guestCredentials),
    [guestCredentials, user?.email, user?.user_email],
  );
  const isSignedIn = Boolean(user?.email || user?.user_email || guestCredentials);
  const isAvailable = status === 'available';
  const isClaimed = status === 'claimed';

  const markPromptSeen = useCallback((serverDate = wheel?.serverDate) => {
    try {
      sessionStorage.setItem(promptSessionKey(user, serverDate), '1');
    } catch {
      // Session prompt state is visual only; reward source of truth stays server-side.
    }
  }, [user, wheel?.serverDate]);

  const applyDailyWheelStatusBody = useCallback((body) => {
    setWheel(body);
    const nextStatus = body.available ? 'available' : 'claimed';
    setStatus(nextStatus);

    if (body.available) {
      const key = promptSessionKey(user, body.serverDate);
      const alreadySeen = (() => {
        try { return sessionStorage.getItem(key) === '1'; } catch { return true; }
      })();
      setShowPrompt(!alreadySeen);
    } else {
      setShowPrompt(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    setError('');
    if (!isSignedIn) {
      setStatus('sign_in_required');
      setWheel(null);
      setShowPrompt(false);
      return null;
    }
    const cachedBody = readDailyWheelStatusCache(dailyWheelCacheKey);
    if (cachedBody) {
      applyDailyWheelStatusBody(cachedBody);
    } else {
      setStatus('loading');
    }
    try {
      const body = await invokeDailyWheelFunction('getDailyWheelStatus', dailyWheelPayload);
      writeDailyWheelStatusCache(dailyWheelCacheKey, body);
      applyDailyWheelStatusBody(body);
      return body;
    } catch (err) {
      if (err?.code === 'unauthenticated') {
        setStatus('sign_in_required');
        setWheel(null);
        setShowPrompt(false);
        return null;
      }
      if (!cachedBody) setStatus('error');
      setError(userSafeDailyWheelError(err, 'Günlük Çark durumu alınamadı. Lütfen tekrar dene.'));
      return null;
    }
  }, [applyDailyWheelStatusBody, dailyWheelCacheKey, dailyWheelPayload, isSignedIn]);

  useEffect(() => {
    let cancelled = false;
    const cancelScheduledRefresh = scheduleDailyWheelStatusRefresh(async () => {
      const body = await refresh();
      if (cancelled || !body) return;
      if (body?.userPatch && typeof onUserUpdated === 'function') onUserUpdated(body.userPatch);
    });
    return () => {
      cancelled = true;
      cancelScheduledRefresh();
    };
  }, [refresh, onUserUpdated]);

  const dismissPrompt = useCallback(() => {
    markPromptSeen();
    setShowPrompt(false);
  }, [markPromptSeen]);

  const applyClaimSuccessBody = useCallback((body) => {
    markPromptSeen(body.serverDate);
    setShowPrompt(false);
    setLastResult(body);
    setShowResult(true);
    const claimedWheelStatus = {
      available: false,
      alreadyClaimedToday: true,
      serverDate: body.serverDate,
      nextAvailableAt: body.nextAvailableAt,
      currentStreak: body.streakAfter,
      lastReward: {
        rewardAmount: body.rewardAmount,
        streakBefore: body.streakBefore,
        streakAfter: body.streakAfter,
        streakBonusAmount: body.streakBonusAmount,
        totalRewardAmount: body.totalRewardAmount,
        balanceAfter: body.updatedDiamondTotal,
        claimedAt: body.claimedAt,
        nextAvailableAt: body.nextAvailableAt,
      },
      diamondTotal: body.updatedDiamondTotal,
    };
    writeDailyWheelStatusCache(dailyWheelCacheKey, claimedWheelStatus);
    setWheel(claimedWheelStatus);
    setStatus('claimed');
    if (body.userPatch && typeof onUserUpdated === 'function') onUserUpdated(body.userPatch);
  }, [dailyWheelCacheKey, markPromptSeen, onUserUpdated]);

  const claim = useCallback(async () => {
    if (claiming) return null;
    if (claimingRef.current) return null;
    if (!isSignedIn) {
      setStatus('sign_in_required');
      return null;
    }
    setError('');
    claimingRef.current = true;
    setClaiming(true);
    try {
      const body = await invokeDailyWheelFunction('claimDailyWheelReward', {
        ...dailyWheelPayload,
        buildMarker: KRONOX_BUILD_MARKER,
      });
      applyClaimSuccessBody(body);
      return body;
    } catch (err) {
      const recoveredStatus = await refresh().catch(() => null);
      if (recoveredStatus?.alreadyClaimedToday && recoveredStatus?.available === false) {
        const expectedBalanceAfter = Number(recoveredStatus?.lastReward?.balanceAfter);
        const visibleDiamondTotal = Number(recoveredStatus?.diamondTotal);
        const needsBalanceRepair = Number.isFinite(expectedBalanceAfter) &&
          Number.isFinite(visibleDiamondTotal) &&
          expectedBalanceAfter > visibleDiamondTotal;
        const recoveredClaim = needsBalanceRepair
          ? await invokeDailyWheelFunction('claimDailyWheelReward', {
              ...dailyWheelPayload,
              buildMarker: KRONOX_BUILD_MARKER,
              recoveryFromClaimFailure: true,
            }).catch(() => null)
          : null;

        if (recoveredClaim) {
          applyClaimSuccessBody(recoveredClaim);
          return recoveredClaim;
        }

        if (!needsBalanceRepair) {
          const recoveredResult = buildClaimResultFromStatus(recoveredStatus);
          setLastResult(recoveredResult);
          setStatus('claimed');
          setError('');
          if (recoveredResult.userPatch && typeof onUserUpdated === 'function') {
            onUserUpdated(recoveredResult.userPatch);
          }
        } else {
          setStatus('error');
          setError(userSafeDailyWheelError(err, 'Çark ödülü doğrulanamadı. Lütfen tekrar dene.'));
        }
      } else {
        setStatus('error');
        setError(userSafeDailyWheelError(err, 'Çark çevrilemedi. Lütfen tekrar dene.'));
      }
      setShowPrompt(false);
      setShowResult(true);
      return null;
    } finally {
      claimingRef.current = false;
      setClaiming(false);
    }
  }, [applyClaimSuccessBody, claiming, dailyWheelPayload, isSignedIn, onUserUpdated, refresh]);

  return useMemo(() => ({
    status,
    wheel,
    error,
    claiming,
    showPrompt,
    showResult,
    lastResult,
    isSignedIn,
    isAvailable,
    isClaimed,
    refresh,
    claim,
    dismissPrompt,
    closeResult: () => setShowResult(false),
    openResult: () => setShowResult(true),
  }), [
    status,
    wheel,
    error,
    claiming,
    showPrompt,
    showResult,
    lastResult,
    isSignedIn,
    isAvailable,
    isClaimed,
    refresh,
    claim,
    dismissPrompt,
  ]);
}
