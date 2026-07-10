import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KRONOX_BUILD_MARKER } from '@/components/dev/BuildMarker';
import { claimDailyWheelReward, getDailyWheelStatus } from '@/lib/dbGateway/economyGateway';
import { getCompletedGuestCredentialsPayload } from '@/lib/guestProfile';
import { normalizeDailyWheelJokerRewards } from '@/lib/dailyWheelRewards';
import {
  buildDailyStatusCacheKey,
  createDailyStatusStore,
  markDailyQuestStatusStale,
  scheduleIdleStatusRefresh,
  todayFallbackKey,
} from '@/lib/dailyStatusCache';

function normalizeFunctionBody(response) {
  return response?.data || response || {};
}

function dailyWheelActorKey(user, guestCredentials) {
  const email = String(user?.email || user?.user_email || 'guest').trim().toLowerCase();
  const guestId = String(guestCredentials?.guest_id || '').trim();
  return email && email !== 'guest' ? `auth:${email}` : `guest:${guestId || 'pending'}`;
}

function autoPopupStorageKey(user, guestCredentials, serverDate, resetAt = '') {
  const resetSuffix = resetAt ? `:${String(resetAt).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)}` : '';
  return `kronox_daily_wheel_auto_popup_seen:${dailyWheelActorKey(user, guestCredentials)}:${serverDate || todayFallbackKey()}${resetSuffix}`;
}

// Shared Daily status cache contract (60s TTL + idle-scheduled refresh)
// lives in src/lib/dailyStatusCache.js; the wheel keeps its own store
// instance so wheel/calendar invalidations stay independent.
const dailyWheelStatusStore = createDailyStatusStore();

function userSafeDailyWheelError(err, fallback) {
  const body = err?.response?.data || err?.body || null;
  return body?.error || fallback;
}

function buildClaimResultFromStatus(body) {
  const lastReward = body?.lastReward && typeof body.lastReward === 'object' ? body.lastReward : {};
  const hasStoredReward = Boolean(
    lastReward.rewardType ||
    lastReward.rewardId ||
    lastReward.giftBox ||
    (Array.isArray(lastReward.jokerRewards) && lastReward.jokerRewards.length) ||
    Number(lastReward.totalRewardAmount) > 0 ||
    Number(lastReward.rewardAmount) > 0
  );
  const totalRewardAmount = Number(lastReward.totalRewardAmount) || 0;
  const rewardAmount = Number(lastReward.rewardAmount) || totalRewardAmount;
  return {
    ok: true,
    available: false,
    alreadyClaimedToday: true,
    alreadyClaimed: true,
    fallbackClaimedResult: !hasStoredReward,
    serverDate: body?.serverDate,
    dailyWheelAutoPopupResetAt: body?.dailyWheelAutoPopupResetAt || null,
    rewardType: lastReward.rewardType || (hasStoredReward ? 'diamonds' : 'claimed_fallback'),
    rewardId: lastReward.rewardId || (hasStoredReward ? `diamond_${rewardAmount}` : ''),
    rewardLabel: lastReward.rewardLabel || (hasStoredReward ? '' : 'Bugünkü ödül alındı'),
    rewardSegmentIndex: Number(lastReward.rewardSegmentIndex) || 0,
    rewardSegmentCount: Number(lastReward.rewardSegmentCount) || 8,
    rewardAmount,
    streakBefore: Number(lastReward.streakBefore) || 0,
    streakAfter: Number(lastReward.streakAfter ?? body?.currentStreak) || 0,
    streakBonusAmount: Number(lastReward.streakBonusAmount) || 0,
    totalRewardAmount,
    jokerRewards: normalizeDailyWheelJokerRewards(lastReward.jokerRewards),
    giftBox: lastReward.giftBox || null,
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
    () => buildDailyStatusCacheKey(user, guestCredentials),
    [guestCredentials, user?.email, user?.user_email],
  );
  const isSignedIn = Boolean(user?.email || user?.user_email || guestCredentials);
  const isAvailable = status === 'available';
  const isClaimed = status === 'claimed';

  // No-spin close contract: closing the auto-popup does not consume the free spin;
  // it only records prompt visibility and keeps server claim authority intact.
  const markPromptSeen = useCallback((serverDate = wheel?.serverDate, resetAt = wheel?.dailyWheelAutoPopupResetAt) => {
    try {
      localStorage.setItem(autoPopupStorageKey(user, guestCredentials, serverDate, resetAt), '1');
    } catch {
      // Auto-popup state is visual only; reward source of truth stays server-side.
    }
  }, [guestCredentials, user, wheel?.dailyWheelAutoPopupResetAt, wheel?.serverDate]);

  const applyDailyWheelStatusBody = useCallback((body) => {
    setWheel(body);
    const nextStatus = body.available ? 'available' : 'claimed';
    setStatus(nextStatus);

    if (body.available) {
      const key = autoPopupStorageKey(user, guestCredentials, body.serverDate, body.dailyWheelAutoPopupResetAt);
      const alreadySeen = (() => {
        try { return localStorage.getItem(key) === '1'; } catch { return true; }
      })();
      setShowPrompt(!alreadySeen);
    } else {
      setShowPrompt(false);
    }
  }, [guestCredentials, user]);

  const refresh = useCallback(async () => {
    setError('');
    if (!isSignedIn) {
      setStatus('sign_in_required');
      setWheel(null);
      setShowPrompt(false);
      return null;
    }
    const cachedBody = dailyWheelStatusStore.read(dailyWheelCacheKey);
    if (cachedBody) {
      applyDailyWheelStatusBody(cachedBody);
    } else {
      setStatus('loading');
    }
    try {
      const body = await invokeDailyWheelFunction('getDailyWheelStatus', dailyWheelPayload);
      dailyWheelStatusStore.write(dailyWheelCacheKey, body);
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
    const cancelScheduledRefresh = scheduleIdleStatusRefresh(async () => {
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
    // Sonra/close hides the prompt without claimDailyWheelReward or Daily progress.
    markPromptSeen();
    setShowPrompt(false);
  }, [markPromptSeen]);

  const applyClaimSuccessBody = useCallback((body) => {
    markPromptSeen(body.serverDate, body.dailyWheelAutoPopupResetAt);
    setShowPrompt(false);
    setLastResult(body);
    setShowResult(true);
    const claimedWheelStatus = {
      available: false,
      alreadyClaimedToday: true,
      serverDate: body.serverDate,
      dailyWheelAutoPopupResetAt: body.dailyWheelAutoPopupResetAt || null,
      nextAvailableAt: body.nextAvailableAt,
      currentStreak: body.streakAfter,
      lastReward: {
        rewardType: body.rewardType,
        rewardId: body.rewardId,
        rewardLabel: body.rewardLabel,
        rewardSegmentIndex: body.rewardSegmentIndex,
        rewardSegmentCount: body.rewardSegmentCount,
        rewardAmount: body.rewardAmount,
        streakBefore: body.streakBefore,
        streakAfter: body.streakAfter,
        streakBonusAmount: body.streakBonusAmount,
        totalRewardAmount: body.totalRewardAmount,
        jokerRewards: normalizeDailyWheelJokerRewards(body.jokerRewards),
        giftBox: body.giftBox || null,
        balanceAfter: body.updatedDiamondTotal,
        claimedAt: body.claimedAt,
        nextAvailableAt: body.nextAvailableAt,
      },
      diamondTotal: body.updatedDiamondTotal,
    };
    dailyWheelStatusStore.write(dailyWheelCacheKey, claimedWheelStatus);
    setWheel(claimedWheelStatus);
    setStatus('claimed');
    if (body.userPatch && typeof onUserUpdated === 'function') onUserUpdated(body.userPatch);
    markDailyQuestStatusStale({
      cacheKey: dailyWheelCacheKey,
      reason: 'daily_wheel_claim_success',
      eventType: 'daily_wheel_claim',
      serverDate: body?.serverDate || '',
    });
  }, [dailyWheelCacheKey, dailyWheelPayload, markPromptSeen, onUserUpdated]);

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

  const openClaimedResult = useCallback(async () => {
    if (!isSignedIn) {
      setStatus('sign_in_required');
      return null;
    }

    setError('');
    setShowPrompt(false);

    let sourceStatus = wheel;
    if (!sourceStatus?.lastReward) {
      const refreshedStatus = await refresh().catch(() => null);
      if (refreshedStatus) sourceStatus = refreshedStatus;
    }

    if (sourceStatus?.available === true && sourceStatus?.alreadyClaimedToday !== true) {
      setShowResult(false);
      return null;
    }

    const reopenedResult = buildClaimResultFromStatus(sourceStatus || {
      available: false,
      alreadyClaimedToday: true,
      serverDate: todayFallbackKey(),
    });

    setLastResult(reopenedResult);
    setStatus('claimed');
    setShowResult(true);
    return reopenedResult;
  }, [isSignedIn, refresh, wheel]);

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
    markAutoPopupShown: markPromptSeen,
    shouldAutoOpen: showPrompt,
    closeResult: () => setShowResult(false),
    openResult: () => setShowResult(true),
    openClaimedResult,
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
    markPromptSeen,
    openClaimedResult,
  ]);
}
