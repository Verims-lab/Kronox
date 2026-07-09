import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  claimDailyQuestReward,
  getDailyQuestStatus,
} from '@/lib/dbGateway/dailyQuestGateway';
import { getCompletedGuestCredentialsPayload } from '@/lib/guestProfile';
import {
  buildEmptyCalendarState,
  normalizeDailyTask,
} from '@/lib/dailyCalendar';
import {
  buildDailyStatusCacheKey,
  createDailyStatusStore,
  scheduleIdleStatusRefresh,
  todayFallbackKey,
} from '@/lib/dailyStatusCache';

// Shared Daily status cache contract (60s TTL + idle-scheduled refresh)
// lives in src/lib/dailyStatusCache.js; the calendar keeps its own store
// instance so wheel/calendar invalidations stay independent.
const dailyQuestStatusStore = createDailyStatusStore();

export function invalidateDailyQuestStatusCache(cacheKey = '') {
  dailyQuestStatusStore.invalidate(cacheKey);
}

function normalizeCalendarBody(body) {
  const fallback = buildEmptyCalendarState();
  const tasks = Array.isArray(body?.tasks)
    ? body.tasks.map(normalizeDailyTask)
    : (Array.isArray(body?.quests) ? body.quests.map(normalizeDailyTask) : []);
  return {
    ...fallback,
    ...body,
    tasks,
    quests: tasks,
    calendarDays: Array.isArray(body?.calendarDays) ? body.calendarDays : [],
    currentStreak: Math.max(0, Math.floor(Number(body?.currentStreak) || 0)),
    streakRewardProgress: Math.max(0, Math.floor(Number(body?.streakRewardProgress) || 0)),
    streakRewardReady: body?.streakRewardReady === true,
    dayCompleted: body?.dayCompleted === true,
    legacyCleanupDryRun: body?.legacyCleanupDryRun || null,
  };
}

function buildClaimKey(state) {
  return String(state?.streakRewardCycleId || `${state?.serverDate || todayFallbackKey()}:streak`);
}

function safeDailyRewardError(err, fallback) {
  const message = String(err?.message || '').trim();
  const normalized = message.toLocaleLowerCase('tr-TR');
  if (!message || (normalized.includes('hediye') && normalized.includes('kutusu'))) return fallback;
  return message;
}

export function useDailyQuests({ user, guestProfile, onUserUpdated } = {}) {
  const [status, setStatus] = useState('loading');
  const [state, setState] = useState(() => buildEmptyCalendarState());
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState(null);
  const claimPendingRef = useRef(new Set());

  const guestCredentials = useMemo(() => getCompletedGuestCredentialsPayload(guestProfile), [guestProfile]);
  const dailyPayload = useMemo(() => guestCredentials || {}, [guestCredentials]);
  const dailyCacheKey = useMemo(
    () => buildDailyStatusCacheKey(user, guestCredentials),
    [guestCredentials, user?.email, user?.user_email],
  );
  const isSignedIn = Boolean(user?.email || user?.user_email || guestCredentials);

  const applyDailyQuestStatusBody = useCallback((body) => {
    const next = normalizeCalendarBody(body);
    setState(next);
    setStatus('ready');
    return next;
  }, []);

  const refresh = useCallback(async () => {
    setError('');
    if (!isSignedIn) {
      setStatus('sign_in_required');
      setState(buildEmptyCalendarState());
      return null;
    }
    const cachedBody = dailyQuestStatusStore.read(dailyCacheKey);
    if (cachedBody) {
      applyDailyQuestStatusBody(cachedBody);
    } else {
      setStatus('loading');
    }
    try {
      const body = await getDailyQuestStatus(dailyPayload);
      dailyQuestStatusStore.write(dailyCacheKey, body);
      return applyDailyQuestStatusBody(body);
    } catch (err) {
      if (!cachedBody) {
        setStatus('error');
        setState(buildEmptyCalendarState());
      }
      setError(err?.message || 'Günlük verileri yüklenemedi.');
      return null;
    }
  }, [applyDailyQuestStatusBody, dailyCacheKey, dailyPayload, isSignedIn]);

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

  const claim = useCallback(async () => {
    const claimKey = buildClaimKey(state);
    if (!state?.streakRewardReady) {
      setError('7 günlük seri ödülü için seri tamamlanmalı.');
      return null;
    }
    if (claimPendingRef.current.has(claimKey)) return null;
    setError('');
    claimPendingRef.current.add(claimKey);
    setClaimingId(claimKey);
    try {
      const body = await claimDailyQuestReward({
        ...dailyPayload,
        rewardCycleId: state?.streakRewardCycleId,
      });
      if (body?.userPatch && typeof onUserUpdated === 'function') onUserUpdated(body.userPatch);
      invalidateDailyQuestStatusCache(dailyCacheKey);
      await refresh();
      return body;
    } catch (err) {
      setError(safeDailyRewardError(err, 'Seri ödülü alınamadı. Tekrar dene.'));
      return null;
    } finally {
      claimPendingRef.current.delete(claimKey);
      setClaimingId(null);
    }
  }, [dailyCacheKey, dailyPayload, onUserUpdated, refresh, state]);

  return useMemo(() => ({
    status,
    state,
    tasks: state.tasks || [],
    quests: state.tasks || [],
    calendarDays: state.calendarDays || [],
    serverDate: state.serverDate || null,
    month: state.month || null,
    currentStreak: state.currentStreak || 0,
    streakRewardProgress: state.streakRewardProgress || 0,
    streakRewardReady: state.streakRewardReady === true,
    dayCompleted: state.dayCompleted === true,
    legacyCleanupDryRun: state.legacyCleanupDryRun || null,
    error,
    claimingId,
    isSignedIn,
    refresh,
    claim,
    getClaimKey: () => buildClaimKey(state),
  }), [
    claim,
    claimingId,
    error,
    isSignedIn,
    refresh,
    state,
    status,
  ]);
}
