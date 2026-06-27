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

function userSafeDailyWheelError(err, fallback) {
  const body = err?.response?.data || err?.body || null;
  return body?.error || fallback;
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
    (async () => {
      const body = await refresh();
      if (cancelled || !body) return;
      if (body?.userPatch && typeof onUserUpdated === 'function') onUserUpdated(body.userPatch);
    })();
    return () => { cancelled = true; };
  }, [refresh, onUserUpdated]);

  const dismissPrompt = useCallback(() => {
    markPromptSeen();
    setShowPrompt(false);
  }, [markPromptSeen]);

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
          claimedAt: body.claimedAt,
          nextAvailableAt: body.nextAvailableAt,
        },
        diamondTotal: body.updatedDiamondTotal,
      };
      writeDailyWheelStatusCache(dailyWheelCacheKey, claimedWheelStatus);
      setWheel(claimedWheelStatus);
      setStatus('claimed');
      if (body.userPatch && typeof onUserUpdated === 'function') onUserUpdated(body.userPatch);
      return body;
    } catch (err) {
      setStatus('error');
      setError('Çark çevrilemedi. Lütfen tekrar dene.');
      setShowPrompt(false);
      setShowResult(true);
      return null;
    } finally {
      claimingRef.current = false;
      setClaiming(false);
    }
  }, [claiming, dailyWheelCacheKey, dailyWheelPayload, isSignedIn, markPromptSeen, onUserUpdated]);

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
