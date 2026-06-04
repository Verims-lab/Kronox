import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KRONOX_BUILD_MARKER } from '@/components/dev/BuildMarker';
import { claimDailyWheelReward, getDailyWheelStatus } from '@/lib/dbGateway/economyGateway';

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

async function invokeDailyWheelFunction(name, payload = {}) {
  const response = name === 'claimDailyWheelReward'
    ? await claimDailyWheelReward(payload)
    : await getDailyWheelStatus();
  const body = normalizeFunctionBody(response);
  if (body?.ok === false) {
    const error = new Error(body?.error || 'Günlük Çark işlemi tamamlanamadı.');
    error.code = body?.code || 'daily_wheel_error';
    error.body = body;
    throw error;
  }
  return body;
}

export function useDailyWheel({ user, onUserUpdated } = {}) {
  const [status, setStatus] = useState('loading');
  const [wheel, setWheel] = useState(null);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const claimingRef = useRef(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const isSignedIn = Boolean(user?.email || user?.user_email);
  const isAvailable = status === 'available';
  const isClaimed = status === 'claimed';

  const markPromptSeen = useCallback((serverDate = wheel?.serverDate) => {
    try {
      sessionStorage.setItem(promptSessionKey(user, serverDate), '1');
    } catch {
      // Session prompt state is visual only; reward source of truth stays server-side.
    }
  }, [user, wheel?.serverDate]);

  const refresh = useCallback(async () => {
    setError('');
    if (!isSignedIn) {
      setStatus('sign_in_required');
      setWheel(null);
      setShowPrompt(false);
      return null;
    }
    setStatus('loading');
    try {
      const body = await invokeDailyWheelFunction('getDailyWheelStatus', {});
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
      return body;
    } catch (err) {
      if (err?.code === 'unauthenticated') {
        setStatus('sign_in_required');
        setWheel(null);
        setShowPrompt(false);
        return null;
      }
      setStatus('error');
      setError(err?.message || 'Günlük Çark durumu alınamadı.');
      return null;
    }
  }, [isSignedIn, user]);

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
        buildMarker: KRONOX_BUILD_MARKER,
      });
      markPromptSeen(body.serverDate);
      setShowPrompt(false);
      setLastResult(body);
      setShowResult(true);
      setWheel({
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
      });
      setStatus('claimed');
      if (body.userPatch && typeof onUserUpdated === 'function') onUserUpdated(body.userPatch);
      return body;
    } catch (err) {
      setStatus('error');
      setError(err?.message || 'Günlük Çark ödülü alınamadı.');
      setShowPrompt(false);
      setShowResult(true);
      return null;
    } finally {
      claimingRef.current = false;
      setClaiming(false);
    }
  }, [claiming, isSignedIn, markPromptSeen, onUserUpdated]);

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
