import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  claimDailyQuestReward,
  getDailyQuestStatus,
} from '@/lib/dbGateway/dailyQuestGateway';
import { getCompletedGuestCredentialsPayload } from '@/lib/guestProfile';

function normalizeQuest(row) {
  const targetValue = Math.max(1, Math.floor(Number(row?.targetValue ?? row?.target_value) || 1));
  const progressValue = Math.max(0, Math.min(targetValue, Math.floor(Number(row?.progressValue ?? row?.progress_value) || 0)));
  return {
    id: row?.id || null,
    questKey: String(row?.questKey || row?.quest_key || ''),
    questDate: String(row?.questDate || row?.quest_date || ''),
    title: String(row?.title || ''),
    description: String(row?.description || ''),
    questType: String(row?.questType || row?.quest_type || ''),
    progressValue,
    targetValue,
    rewardDiamonds: Math.max(1, Math.floor(Number(row?.rewardDiamonds ?? row?.reward_diamonds) || 1)),
    status: String(row?.status || (progressValue >= targetValue ? 'completed' : 'active')),
    completedAt: row?.completedAt || row?.completed_at || null,
    claimedAt: row?.claimedAt || row?.claimed_at || null,
  };
}

function buildClaimKey(quest, serverDate) {
  if (quest?.id) return quest.id;
  const questKey = String(quest?.questKey || '').trim();
  const questDate = String(quest?.questDate || serverDate || '').trim();
  return questKey ? `${questKey}:${questDate}` : '';
}

const DAILY_QUEST_STATUS_CACHE_TTL_MS = 60 * 1000;
const dailyQuestStatusCache = new Map();

function todayFallbackKey() {
  return new Date().toISOString().slice(0, 10);
}

function buildDailyQuestStatusCacheKey(user, guestCredentials) {
  const email = String(user?.email || user?.user_email || '').trim().toLowerCase();
  const guestId = String(guestCredentials?.guest_id || '').trim();
  if (email) return `auth:${email}:${todayFallbackKey()}`;
  if (guestId) return `guest:${guestId}:${todayFallbackKey()}`;
  return null;
}

function readDailyQuestStatusCache(cacheKey) {
  if (!cacheKey) return null;
  const cached = dailyQuestStatusCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > DAILY_QUEST_STATUS_CACHE_TTL_MS) {
    dailyQuestStatusCache.delete(cacheKey);
    return null;
  }
  return cached.body || null;
}

function writeDailyQuestStatusCache(cacheKey, body) {
  if (!cacheKey || !body) return;
  dailyQuestStatusCache.set(cacheKey, {
    cachedAt: Date.now(),
    body,
  });
}

export function useDailyQuests({ user, guestProfile, onUserUpdated } = {}) {
  const [status, setStatus] = useState('loading');
  const [quests, setQuests] = useState([]);
  const [serverDate, setServerDate] = useState(null);
  const [adminWarning, setAdminWarning] = useState(null);
  const [activeDefinitionCount, setActiveDefinitionCount] = useState(0);
  const [emptyStateReason, setEmptyStateReason] = useState('');
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState(null);
  const claimPendingRef = useRef(new Set());

  const guestCredentials = useMemo(() => getCompletedGuestCredentialsPayload(guestProfile), [guestProfile]);
  const dailyQuestPayload = useMemo(() => guestCredentials || {}, [guestCredentials]);
  const dailyQuestCacheKey = useMemo(
    () => buildDailyQuestStatusCacheKey(user, guestCredentials),
    [guestCredentials, user?.email, user?.user_email],
  );
  const isSignedIn = Boolean(user?.email || user?.user_email || guestCredentials);

  const applyDailyQuestStatusBody = useCallback((body) => {
    const nextQuests = Array.isArray(body?.quests) ? body.quests.map(normalizeQuest) : [];
    setQuests(nextQuests);
    setServerDate(body?.serverDate || null);
    setAdminWarning(body?.adminWarning || null);
    setActiveDefinitionCount(Math.max(0, Math.floor(Number(body?.activeDefinitionCount) || 0)));
    setEmptyStateReason(body?.emptyStateReason || (nextQuests.length ? '' : 'no_active_definitions'));
    setStatus(nextQuests.length ? 'ready' : 'empty');
    return nextQuests;
  }, []);

  const refresh = useCallback(async () => {
    setError('');
    if (!isSignedIn) {
      setStatus('sign_in_required');
      setQuests([]);
      setServerDate(null);
      setAdminWarning(null);
      setActiveDefinitionCount(0);
      setEmptyStateReason('');
      return null;
    }
    const cachedBody = readDailyQuestStatusCache(dailyQuestCacheKey);
    if (cachedBody) {
      applyDailyQuestStatusBody(cachedBody);
    } else {
      setStatus('loading');
    }
    try {
      const body = await getDailyQuestStatus(dailyQuestPayload);
      writeDailyQuestStatusCache(dailyQuestCacheKey, body);
      applyDailyQuestStatusBody(body);
      return body;
    } catch (err) {
      if (!cachedBody) {
        setStatus('error');
        setQuests([]);
        setEmptyStateReason('fetch_error');
      }
      setError(err?.message || 'Günlük görevler yüklenemedi.');
      return null;
    }
  }, [applyDailyQuestStatusBody, dailyQuestCacheKey, dailyQuestPayload, isSignedIn]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const body = await refresh();
      if (cancelled || !body) return;
      if (body?.userPatch && typeof onUserUpdated === 'function') onUserUpdated(body.userPatch);
    })();
    return () => { cancelled = true; };
  }, [refresh, onUserUpdated]);

  const claim = useCallback(async (quest) => {
    const claimKey = buildClaimKey(quest, serverDate);
    if (!claimKey) {
      setError('Günlük görev ödülü doğrulanamadı. Tekrar dene.');
      return null;
    }
    if (claimPendingRef.current.has(claimKey)) return null;
    setError('');
    claimPendingRef.current.add(claimKey);
    setClaimingId(claimKey);
    try {
      const body = await claimDailyQuestReward({
        ...dailyQuestPayload,
        progressId: quest?.id || undefined,
        questKey: quest?.questKey,
        questDate: quest?.questDate || serverDate,
      });
      if (body?.userPatch && typeof onUserUpdated === 'function') onUserUpdated(body.userPatch);
      if (body?.quest) {
        setQuests((current) => current.map((item) => (
          buildClaimKey(item, serverDate) === claimKey ? normalizeQuest(body.quest) : item
        )));
      }
      await refresh();
      return body;
    } catch (err) {
      setError(err?.message || 'Ödül alınamadı. Tekrar dene.');
      return null;
    } finally {
      claimPendingRef.current.delete(claimKey);
      setClaimingId(null);
    }
  }, [dailyQuestPayload, onUserUpdated, refresh, serverDate]);

  const getClaimKey = useCallback((quest) => buildClaimKey(quest, serverDate), [serverDate]);

  return useMemo(() => ({
    status,
    quests,
    serverDate,
    adminWarning,
    activeDefinitionCount,
    emptyStateReason,
    error,
    claimingId,
    isSignedIn,
    refresh,
    claim,
    getClaimKey,
  }), [
    status,
    quests,
    serverDate,
    adminWarning,
    activeDefinitionCount,
    emptyStateReason,
    error,
    claimingId,
    isSignedIn,
    refresh,
    claim,
    getClaimKey,
  ]);
}
