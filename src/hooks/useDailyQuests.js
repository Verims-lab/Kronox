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

const DAILY_STATUS_CACHE_TTL_MS = 60 * 1000;
const dailyStatusCache = new Map();

function todayFallbackKey() {
  return new Date().toISOString().slice(0, 10);
}

function buildDailyStatusCacheKey(user, guestCredentials) {
  const email = String(user?.email || user?.user_email || '').trim().toLowerCase();
  const guestId = String(guestCredentials?.guest_id || '').trim();
  if (email) return `auth:${email}:${todayFallbackKey()}`;
  if (guestId) return `guest:${guestId}:${todayFallbackKey()}`;
  return null;
}

function readDailyStatusCache(cacheKey) {
  if (!cacheKey) return null;
  const cached = dailyStatusCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > DAILY_STATUS_CACHE_TTL_MS) {
    dailyStatusCache.delete(cacheKey);
    return null;
  }
  return cached.body || null;
}

function writeDailyStatusCache(cacheKey, body) {
  if (!cacheKey || !body) return;
  dailyStatusCache.set(cacheKey, {
    cachedAt: Date.now(),
    body,
  });
}

export function invalidateDailyQuestStatusCache(cacheKey = '') {
  if (cacheKey) {
    dailyStatusCache.delete(cacheKey);
    return;
  }
  dailyStatusCache.clear();
}

function scheduleDailyStatusRefresh(callback) {
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

  const applyStatusBody = useCallback((body) => {
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
    const cachedBody = readDailyStatusCache(dailyCacheKey);
    if (cachedBody) {
      applyStatusBody(cachedBody);
    } else {
      setStatus('loading');
    }
    try {
      const body = await getDailyQuestStatus(dailyPayload);
      writeDailyStatusCache(dailyCacheKey, body);
      return applyStatusBody(body);
    } catch (err) {
      if (!cachedBody) {
        setStatus('error');
        setState(buildEmptyCalendarState());
      }
      setError(err?.message || 'Günlük verileri yüklenemedi.');
      return null;
    }
  }, [applyStatusBody, dailyCacheKey, dailyPayload, isSignedIn]);

  useEffect(() => {
    let cancelled = false;
    const cancelScheduledRefresh = scheduleDailyStatusRefresh(async () => {
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
      setError('Hediye Kutusu için 7 günlük seri tamamlanmalı.');
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
      setError(err?.message || 'Hediye Kutusu alınamadı. Tekrar dene.');
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
