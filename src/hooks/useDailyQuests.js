import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  claimDailyQuestReward,
  getDailyQuestStatus,
} from '@/lib/dbGateway/dailyQuestGateway';

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

export function useDailyQuests({ user, onUserUpdated } = {}) {
  const [status, setStatus] = useState('loading');
  const [quests, setQuests] = useState([]);
  const [serverDate, setServerDate] = useState(null);
  const [adminWarning, setAdminWarning] = useState(null);
  const [activeDefinitionCount, setActiveDefinitionCount] = useState(0);
  const [emptyStateReason, setEmptyStateReason] = useState('');
  const [error, setError] = useState('');
  const [claimingId, setClaimingId] = useState(null);
  const claimPendingRef = useRef(new Set());

  const isSignedIn = Boolean(user?.email || user?.user_email);

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
    setStatus('loading');
    try {
      const body = await getDailyQuestStatus();
      const nextQuests = Array.isArray(body?.quests) ? body.quests.map(normalizeQuest) : [];
      setQuests(nextQuests);
      setServerDate(body?.serverDate || null);
      setAdminWarning(body?.adminWarning || null);
      setActiveDefinitionCount(Math.max(0, Math.floor(Number(body?.activeDefinitionCount) || 0)));
      setEmptyStateReason(body?.emptyStateReason || (nextQuests.length ? '' : 'no_active_definitions'));
      setStatus(nextQuests.length ? 'ready' : 'empty');
      return body;
    } catch (err) {
      setStatus('error');
      setError(err?.message || 'Günlük görevler yüklenemedi.');
      setQuests([]);
      setEmptyStateReason('fetch_error');
      return null;
    }
  }, [isSignedIn]);

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
  }, [onUserUpdated, refresh, serverDate]);

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
