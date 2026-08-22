import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getLobbySnapshot, submitDuelloAnswer, syncDuelloRound } from '@/lib/dbGateway/lobbyGateway';
import { createAdaptivePoller } from '@/lib/adaptivePoller';
import { applyOnlineMatchToCurrentUser } from '@/lib/applyOnlineResult';
import { buildOnlineScorePopupState } from '@/lib/onlineScorePopup';
import {
  DUELLO_MATCH_STATE,
  deriveDuelloClock,
  duelloQuestionFingerprint,
  duelloRoundFeedbackForActor,
  duelloSnapshotNeedsSync,
  duelloTimelineFingerprint,
  isDuelloAnswerableState,
  readDuelloCorrectCount,
  readDuelloServerOffset,
} from '@/lib/duelloV2State';

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
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [locallyLockedSequence, setLocallyLockedSequence] = useState(null);
  const appliedResultRef = useRef(false);
  const feedbackKeyRef = useRef('');
  const mountedRef = useRef(true);
  const syncingRef = useRef(false);
  const touchDragTimerRef = useRef(null);

  const acceptLobbySnapshot = useCallback((fresh) => {
    if (!fresh || !mountedRef.current) return false;
    setServerOffsetMs(readDuelloServerOffset(fresh));
    setLobby((current) => {
      const freshRevision = Number(fresh?.state_revision) || 0;
      const currentRevision = Number(current?.state_revision) || 0;
      return !current || freshRevision >= currentRevision ? fresh : current;
    });
    return true;
  }, []);

  const refresh = useCallback(async () => {
    if (!lobbyId) return null;
    const response = await getLobbySnapshot({ lobbyId });
    let fresh = response?.data?.lobby || null;
    acceptLobbySnapshot(fresh);
    if (fresh && duelloSnapshotNeedsSync(fresh, Date.now(), readDuelloServerOffset(fresh)) && !syncingRef.current) {
      syncingRef.current = true;
      try {
        const syncResponse = await syncDuelloRound(lobbyId);
        fresh = syncResponse?.data?.lobby || fresh;
        acceptLobbySnapshot(fresh);
      } catch {
        // Either participant may advance an expired state. The lock makes a
        // concurrent sync harmless and the next snapshot reconciles it.
      } finally {
        syncingRef.current = false;
      }
    }
    if (fresh && mountedRef.current) setError('');
    return fresh;
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
    const timer = window.setInterval(() => setClockTick(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!lobbyId) {
      setError('Duello bilgisi bulunamadı.');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    refresh()
      .catch(() => { if (!cancelled) setError('Duello yüklenemedi. Lütfen tekrar dene.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    const poller = createAdaptivePoller({ task: refresh, minDelayMs: 450, maxDelayMs: 1500 });
    poller.start();
    return () => { cancelled = true; poller.stop(); };
  }, [lobbyId, refresh]);

  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  const myIndex = players.findIndex((player) => player?.is_self);
  const myPlayer = myIndex >= 0 ? players[myIndex] : null;
  const opponent = myIndex >= 0 ? players.find((_, index) => index !== myIndex) || null : null;
  const activeCard = lobby?.active_shared_card || lobby?.online_question_deck?.[0] || null;
  const sharedTimeline = Array.isArray(lobby?.duel_shared_timeline) ? lobby.duel_shared_timeline : [];
  const sequence = Number(lobby?.duel_question_index || activeCard?.sequence_id) || 0;
  const matchState = String(lobby?.duel_match_state || DUELLO_MATCH_STATE.MATCHING);
  const answerLocked = Boolean(lobby?.duel_answer_locked || locallyLockedSequence === sequence);
  const isRoundActive = isDuelloAnswerableState(matchState);
  const canAttempt = Boolean(
    myPlayer
    && activeCard
    && activeCard?.can_attempt !== false
    && isRoundActive
    && !answerLocked
    && !pending
    && lobby?.status !== 'finished',
  );
  const clock = deriveDuelloClock(lobby, clockTick, serverOffsetMs);
  const questionFingerprint = duelloQuestionFingerprint(lobby);
  const timelineFingerprint = duelloTimelineFingerprint(lobby);

  useEffect(() => {
    setSelectedZone(null);
    setFeedback(null);
    setNotice('');
    setLocallyLockedSequence(null);
    feedbackKeyRef.current = '';
  }, [sequence]);

  useEffect(() => {
    const nextFeedback = duelloRoundFeedbackForActor(lobby, myPlayer?.participant_ref);
    if (!nextFeedback || nextFeedback.key === feedbackKeyRef.current) return;
    feedbackKeyRef.current = nextFeedback.key;
    setFeedback(nextFeedback);
    setNotice(nextFeedback.unanswered ? 'SÜRE DOLDU' : (nextFeedback.result === 'correct' ? 'DOĞRU' : 'YANLIŞ'));
  }, [lobby, myPlayer?.participant_ref]);

  useEffect(() => {
    if (matchState === DUELLO_MATCH_STATE.WAITING_FOR_OPPONENT || (answerLocked && isRoundActive)) {
      setNotice(lobby?.duel_opponent_answered ? 'RAKİP CEVAPLADI' : 'RAKİBİN CEVABI BEKLENİYOR');
    }
  }, [answerLocked, isRoundActive, lobby?.duel_opponent_answered, matchState]);

  const submitPlacement = useCallback(async (zone) => {
    const placementZone = Math.trunc(Number(zone));
    if (!canAttempt || !lobbyId || !sequence || placementZone < 0 || placementZone > sharedTimeline.length) return;
    setLocallyLockedSequence(sequence);
    setPending(true);
    setNotice('CEVABIN KİLİTLENDİ');
    setError('');
    try {
      const response = await submitDuelloAnswer({
        lobbyId,
        sequence_id: sequence,
        placement_zone: placementZone,
        operation_key: `duello_v2:${lobbyId}:${sequence}`,
      });
      const data = response?.data || {};
      if (!data?.success || data?.error) throw new Error('Duello cevabı doğrulanamadı.');
      if (!mountedRef.current) return;
      acceptLobbySnapshot(data.lobby);
      if (data.answer_result === 'late') setNotice('SÜRE DOLDU');
      else if (data.answer_result === 'locked') setNotice('RAKİBİN CEVABI BEKLENİYOR');
    } catch {
      if (mountedRef.current) setError('Cevap gönderilemedi. Güncel maç durumu yükleniyor.');
      const fresh = await refresh().catch(() => null);
      if (!fresh?.duel_answer_locked && mountedRef.current) setLocallyLockedSequence(null);
    } finally {
      if (mountedRef.current) {
        setPending(false);
        setSelectedZone(null);
      }
    }
  }, [acceptLobbySnapshot, canAttempt, lobbyId, refresh, sequence, sharedTimeline.length]);

  const winnerRef = lobby?.winner_participant_ref || null;
  const isDraw = String(lobby?.duel_result_type || '') === 'draw';
  const isWinner = Boolean(!isDraw && winnerRef && myPlayer?.participant_ref === winnerRef);
  const earnedPoints = isWinner ? Math.max(0, Math.trunc(Number(lobby?.duel_points_awarded) || 0)) : 0;

  useEffect(() => {
    if (lobby?.status !== 'finished' || !lobbyId || appliedResultRef.current) return;
    if (!isDraw && !winnerRef) return;
    appliedResultRef.current = true;
    const result = isDraw ? 'draw' : (isWinner ? 'win' : 'loss');
    setScoreResult({ result, pending: true, message: 'Puan kaydediliyor...' });
    applyOnlineMatchToCurrentUser({ lobbyId, durationSeconds: null, source: 'same_question_duel_v2' })
      .then((response) => {
        if (mountedRef.current) setScoreResult(buildOnlineScorePopupState({ result, elapsedSeconds: null, response }));
      })
      .catch(() => {
        if (!mountedRef.current) return;
        appliedResultRef.current = false;
        setScoreResult({ result, error: true, message: 'Puan kaydedilemedi. Tekrar dene.' });
      });
  }, [isDraw, isWinner, lobby?.status, lobbyId, winnerRef]);

  const drag = {
    isDragging,
    touchDragPos,
    touchDragEnd,
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

  return {
    lobbyId, lobby, players, myIndex, myPlayer, opponent, activeCard, sharedTimeline,
    sequence, matchState, canAttempt, answerLocked, isRoundActive,
    isRoundResult: matchState === DUELLO_MATCH_STATE.ROUND_RESULT,
    isSuddenDeath: Boolean(lobby?.duel_sudden_death),
    loading, error, pending, notice, feedback, selectedZone, setSelectedZone,
    submitPlacement, refresh, drag, clock, questionFingerprint, timelineFingerprint,
    myCorrectCount: readDuelloCorrectCount(myPlayer),
    opponentCorrectCount: readDuelloCorrectCount(opponent),
    isWinner, isDraw, earnedPoints, scoreResult, navigate,
  };
}
