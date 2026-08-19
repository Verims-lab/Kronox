import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getLobbySnapshot, updateLobbyGameState } from '@/lib/dbGateway/lobbyGateway';
import { createAdaptivePoller } from '@/lib/adaptivePoller';
import { applyOnlineMatchToCurrentUser } from '@/lib/applyOnlineResult';
import { buildOnlineScorePopupState } from '@/lib/onlineScorePopup';

export default function useSameQuestionDuel() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const lobbyId = location.state?.lobbyId || params.get('lobbyId') || '';
  const [lobby, setLobby] = useState(location.state?.initialLobby || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [touchDragPos, setTouchDragPos] = useState(null);
  const [touchDragEnd, setTouchDragEnd] = useState(null);
  const [scoreResult, setScoreResult] = useState(null);
  const appliedResultRef = useRef(false);
  const lastClaimRef = useRef('');
  const mountedRef = useRef(true);
  const touchDragTimerRef = useRef(null);

  const acceptLobbySnapshot = useCallback((fresh) => {
    if (!fresh || !mountedRef.current) return false;
    setLobby((current) => {
      const freshRevision = Number(fresh?.state_revision) || 0;
      const currentRevision = Number(current?.state_revision) || 0;
      return !current || freshRevision >= currentRevision ? fresh : current;
    });
    return true;
  }, []);

  const refresh = useCallback(async () => {
    if (!lobbyId) return;
    const response = await getLobbySnapshot({ lobbyId });
    const fresh = response?.data?.lobby;
    acceptLobbySnapshot(fresh);
    if (fresh && mountedRef.current) setError('');
    return fresh || null;
  }, [acceptLobbySnapshot, lobbyId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (touchDragTimerRef.current) {
        window.clearTimeout(touchDragTimerRef.current);
        touchDragTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!lobbyId) {
      setError('Duello bilgisi bulunamadı.');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    refresh().catch(() => { if (!cancelled) setError('Duello yüklenemedi. Lütfen tekrar dene.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    const poller = createAdaptivePoller({ task: refresh, minDelayMs: 1000, maxDelayMs: 4000 });
    poller.start();
    return () => { cancelled = true; poller.stop(); };
  }, [lobbyId, refresh]);

  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  const myIndex = players.findIndex((player) => player?.is_self);
  const myPlayer = myIndex >= 0 ? players[myIndex] : null;
  const opponent = myIndex >= 0 ? players.find((_, index) => index !== myIndex) || null : null;
  const activeCard = lobby?.active_shared_card || lobby?.online_question_deck?.[0] || null;
  const canAttempt = Boolean(myPlayer && activeCard?.can_attempt !== false && !pending && lobby?.status !== 'finished');

  useEffect(() => {
    setSelectedZone(null);
    setFeedback(null);
  }, [activeCard?.sequence_id]);

  useEffect(() => {
    const claim = lobby?.recent_claim;
    const key = claim?.sequence_id ? `${claim.sequence_id}:${claim.participant_ref || 'skip'}` : '';
    if (!key || key === lastClaimRef.current) return;
    lastClaimRef.current = key;
    setNotice(claim.skipped ? 'İkiniz de bilemediniz. Yeni kart açıldı.' : claim.claimed_by_self ? 'Kartı sen aldın.' : 'Rakip kartı aldı.');
  }, [lobby?.recent_claim]);

  const submitPlacement = useCallback(async (zone) => {
    if (!canAttempt || !lobbyId || !activeCard?.sequence_id) return;
    setPending(true);
    setError('');
    try {
      const response = await updateLobbyGameState({
        action: 'claim_shared_card',
        lobbyId,
        sequence_id: activeCard.sequence_id,
        placement_zone: zone,
        operation_key: `same_question_duel:${activeCard.sequence_id}`,
      });
      const data = response?.data || {};
      if (!data?.success || data?.error) throw new Error('Duello hamlesi doğrulanamadı.');
      if (!mountedRef.current) return;
      acceptLobbySnapshot(data.lobby);
      if (data.claim_result === 'claimed') {
        const resolvedSelf = data.lobby?.players?.find((player) => player?.is_self);
        const resolvedCards = Array.isArray(resolvedSelf?.cards) ? resolvedSelf.cards : [];
        const resolvedYear = Number(resolvedCards[resolvedCards.length - 1]?.year);
        setFeedback({
          result: 'correct',
          year: Number.isFinite(resolvedYear) ? resolvedYear : null,
          guessedYear: activeCard.sequence_id,
        });
        setNotice('Kartı sen aldın.');
      } else if (data.claim_result === 'wrong') {
        setFeedback({ result: 'wrong', year: null, guessedYear: `${activeCard.sequence_id}:${zone}` });
        setNotice('Yanlış yerleştirme. Rakip hâlâ kartı alabilir.');
      } else if (data.claim_result === 'both_wrong_next_card') {
        setFeedback({ result: 'wrong', year: null, guessedYear: `${activeCard.sequence_id}:${zone}` });
        setNotice('İkiniz de bilemediniz. Yeni kart açıldı.');
      } else if (data.claim_result === 'card_already_resolved') {
        setNotice('Bu kart rakip tarafından alındı.');
      } else if (data.claim_result === 'already_attempted') {
        setNotice('Bu kart için cevabın kilitlendi.');
      }
    } catch {
      if (mountedRef.current) setError('Hamle gönderilemedi. Güncel durum yeniden yükleniyor.');
      await refresh().catch(() => null);
    } finally {
      if (mountedRef.current) {
        setPending(false);
        setSelectedZone(null);
      }
    }
  }, [acceptLobbySnapshot, activeCard, canAttempt, lobbyId, refresh]);

  const winnerRef = lobby?.winner_participant_ref || null;
  const isWinner = Boolean(winnerRef && myPlayer?.participant_ref === winnerRef);
  useEffect(() => {
    if (lobby?.status !== 'finished' || !winnerRef || !lobbyId || appliedResultRef.current) return;
    appliedResultRef.current = true;
    const result = isWinner ? 'win' : 'loss';
    setScoreResult({ result, pending: true, message: 'Puan kaydediliyor...' });
    applyOnlineMatchToCurrentUser({ lobbyId, source: 'same_question_duel' })
      .then((response) => {
        if (mountedRef.current) setScoreResult(buildOnlineScorePopupState({ result, response }));
      })
      .catch(() => {
        if (!mountedRef.current) return;
        appliedResultRef.current = false;
        setScoreResult({ result, error: true, message: 'Puan kaydedilemedi. Tekrar dene.' });
      });
  }, [isWinner, lobby?.status, lobbyId, winnerRef]);

  const drag = {
    isDragging, touchDragPos, touchDragEnd,
    onDragStart: () => setIsDragging(true),
    onDragEnd: () => { setIsDragging(false); setTouchDragPos(null); },
    onTouchDragMove: (x, y) => { setIsDragging(true); setTouchDragPos({ x, y }); },
    onTouchDragEnd: (x, y) => {
      setIsDragging(false);
      setTouchDragPos(null);
      setTouchDragEnd({ x, y });
      if (touchDragTimerRef.current) window.clearTimeout(touchDragTimerRef.current);
      touchDragTimerRef.current = window.setTimeout(() => {
        touchDragTimerRef.current = null;
        if (mountedRef.current) setTouchDragEnd(null);
      }, 100);
    },
    onTouchDragCancel: () => { setIsDragging(false); setTouchDragPos(null); },
  };

  return { lobbyId, lobby, players, myIndex, myPlayer, opponent, activeCard, canAttempt, loading, error, pending, notice, feedback, selectedZone, setSelectedZone, submitPlacement, refresh, drag, isWinner, scoreResult, navigate };
}
