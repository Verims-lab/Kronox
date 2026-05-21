/**
 * Game page — UI katmanı.
 * Android mimarisi önerileri:
 * - UI sadece state'i gösterir, iş mantığını hook'lara delege eder.
 * - useGameState  → ViewModel/State Holder
 * - useGameActions → Domain/Use Case layer
 * - useLobbySync  → Repository/Data source layer
 */
import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Loader2, WifiOff } from 'lucide-react';
import { useOfflineQuestions } from '@/hooks/useOfflineQuestions';
import { loadRecentHistory, appendToHistory } from '@/lib/questionHistory';
import { debugLog } from '@/lib/debugLog';

import { useGameState } from '@/hooks/useGameState';
import { useGameActions } from '@/hooks/useGameActions';
import { useLobbySync } from '@/hooks/useLobbySync';

import GameDebugLog from '@/components/game/GameDebugLog';
import FeedbackOverlay from '@/components/game/FeedbackOverlay';
import GameOver from '@/components/game/GameOver';
import SettingsModal from '@/components/game/SettingsModal';
import GameOverTimer from '@/components/game/GameOverTimer';
import GameLayout from '@/components/game/GameLayout';

export default function Game() {
  const location = useLocation();
  const navigate = useNavigate();

  // Route state
  const routeState = useMemo(() => location.state || {}, [location.state]);
  const lobbyId = routeState.lobbyId ?? null;
  const isOnlineFromState = routeState.online === true || !!lobbyId;
  // For non-host online join, playerNames may not be in state — useLobbySync will fetch them
  const playerNames = routeState.playerNames ?? (isOnlineFromState ? [] : null);
  const initialPlayers = routeState.initialPlayers ?? [];
  const routeCategory = routeState.category || 'karisik';
  const routeYearStart = routeState.yearStart ?? 0;
  const routeYearEnd = routeState.yearEnd ?? new Date().getFullYear();
  const routeTurnDuration = routeState.turnDuration ?? 60;
  const routeWinCardCount = routeState.winCardCount ?? 10;
  const routeMyPlayerName = routeState.myPlayerName ?? null;
  const currentQuestionIdFromState = routeState.currentQuestionId ?? null;
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    debugLog('[Game] mount:', {
      routeState,
      lobbyId,
      onlineMode: isOnlineFromState,
    });
  }, [routeState, lobbyId, isOnlineFromState]);

  // ─── State (ViewModel layer) ───────────────────────────────────────
  const {
    lobbyData, setLobbyData,
    feedback, setFeedback,
    winner, setWinner,
    selectedZone, setSelectedZone,
    isDragging, setIsDragging,
    touchDragPos, setTouchDragPos,
    touchDragEnd, setTouchDragEnd,
    timerKey, setTimerKey,
    showSettings, setShowSettings,
    overallSeconds, setOverallSeconds,
    gameStarted, setGameStarted,
    error, setError,
    isTimeUp, setIsTimeUp,
    isPlacingRef,
    overallSecondsRef,
    players,
    currentPlayerIndex,
    usedQuestionIds,
    isOnline,
    resetGame,
  } = useGameState({ playerNames, initialPlayers, currentQuestionIdFromState, lobbyId });

  const winTimerRef = useRef(null);

  useEffect(() => {
    if (!isOnlineFromState) return;
    base44.auth.me()
      .then(u => setCurrentUser(u || null))
      .catch(() => setCurrentUser(null));
  }, [isOnlineFromState]);

  // ─── Data fetching — offline-first (Repository layer) ───────────
  const { questions: allQuestions, isLoading, isError, isFromCache, retry: refetch } = useOfflineQuestions();

  // ─── Lobby sync (Repository layer) ───────────────────────────────
  useLobbySync({ lobbyId, initialPlayers, currentQuestionIdFromState, setLobbyData, setWinner, setError });

  // ─── Derived state ────────────────────────────────────────────────
  const currentQuestion = useMemo(() => {
    if (!lobbyData?.current_question_id || allQuestions.length === 0) return null;
    return allQuestions.find(q => q.id === lobbyData.current_question_id);
  }, [lobbyData?.current_question_id, allQuestions]);

  const category = lobbyId ? (lobbyData?.category || routeCategory) : routeCategory;
  const yearStart = lobbyId ? (lobbyData?.year_start ?? routeYearStart) : routeYearStart;
  const yearEnd = lobbyId ? (lobbyData?.year_end ?? routeYearEnd) : routeYearEnd;
  const turnDuration = lobbyId ? (lobbyData?.turn_duration ?? routeTurnDuration) : routeTurnDuration;
  const winCardCount = lobbyId ? (lobbyData?.win_card_count ?? routeWinCardCount) : routeWinCardCount;

  const questionPool = useMemo(() => {
    return allQuestions
      .filter(q => category === 'muzik' ? q.type === 'muzik' : q.type === 'metin')
      .filter(q => q.year >= yearStart && q.year <= yearEnd)
      .filter(q => category === 'karisik' || q.category === category)
      .filter(q => q.type !== 'muzik' || (q.media_url && q.media_url.length > 0));
  }, [allQuestions, yearStart, yearEnd, category]);

  const myPlayerName = useMemo(() => {
    if (!isOnline) return routeMyPlayerName;
    if (routeMyPlayerName) return routeMyPlayerName;
    const email = currentUser?.email;
    if (!email) return null;
    return players.find(p => p.email === email)?.name || null;
  }, [players, routeMyPlayerName, currentUser?.email, isOnline]);

  const myPlayer = useMemo(() => {
    if (!isOnline || !myPlayerName) return null;
    return players.find(p => p.name === myPlayerName);
  }, [players, myPlayerName, isOnline]);
  const localPlayerEmail = isOnline ? (myPlayer?.email || currentUser?.email || null) : null;

  const currentPlayer = players.length > 0 ? players[currentPlayerIndex] : null;
  const isMyTurn = !isOnline || (myPlayerName && currentPlayer?.name === myPlayerName);
  const renderedTurnMessageText = currentQuestion && isMyTurn && !winner
    ? 'KARTI ZAMAN ÇİZGİSİNE YERLEŞTİR!'
    : currentQuestion && !isMyTurn
      ? `${currentPlayer?.name || 'Oyuncu'} düşünüyor…`
      : '';

  useEffect(() => {
    if (!isOnline) return;

    debugLog('[Game] online turn derived state:', {
      lobbyId,
      lobbyDataPlayersLength: lobbyData?.players?.length || 0,
      renderedPlayersCount: players.length,
      computedCurrentPlayerIndex: currentPlayerIndex,
      computedCurrentPlayerName: currentPlayer?.name || null,
      computedCurrentPlayerEmail: currentPlayer?.email || null,
      computedIsMyTurn: Boolean(isMyTurn),
      myPlayerName,
      currentQuestionId: lobbyData?.current_question_id || null,
      playerSummary: players.map(p => ({
        name: p.name,
        email: p.email,
        cardCount: p.cards?.length || 0,
      })),
      renderedTurnMessageText,
    });
  }, [
    isOnline,
    lobbyId,
    currentPlayerIndex,
    currentPlayer?.name,
    currentPlayer?.email,
    isMyTurn,
    myPlayerName,
    lobbyData?.current_question_id,
    players,
    renderedTurnMessageText,
  ]);

  useEffect(() => {
    if (!isOnline || !winner) return;

    const winnerEmail = winner.email || winner.winner_email || lobbyData?.winner_email || null;
    const winnerName = winner.name || lobbyData?.winner || null;
    const isWinnerByEmail = Boolean(winnerEmail && localPlayerEmail && winnerEmail === localPlayerEmail);
    const isWinnerByName = Boolean(winnerName && myPlayerName && winnerName === myPlayerName);

    debugLog('[Game] online GameOver perspective:', {
      playerName: myPlayerName,
      playerEmail: localPlayerEmail,
      eventStatus: lobbyData?.status || null,
      eventWinner: winnerName,
      eventWinnerEmail: winnerEmail,
      eventLobbyId: lobbyId,
      setWinnerCalled: true,
      currentScreenState: 'game-over',
      renderedGameOver: true,
      isLocalWinner: isWinnerByEmail || (!winnerEmail && isWinnerByName),
      renderedTurnMessageText,
    });
  }, [
    isOnline,
    winner,
    lobbyData?.status,
    lobbyData?.winner,
    lobbyData?.winner_email,
    lobbyId,
    localPlayerEmail,
    myPlayerName,
    renderedTurnMessageText,
  ]);

  // ─── Actions (Domain/Use Case layer) ─────────────────────────────
  const { doPlacement, advanceTurn, skipCurrentQuestion } = useGameActions({
    lobbyData,
    players,
    currentPlayerIndex,
    usedQuestionIds,
    currentQuestion,
    questionPool,
    winCardCount,
    lobbyId,
    isPlacingRef,
    overallSecondsRef,
    setLobbyData,
    setFeedback,
    setWinner,
    setSelectedZone,
    setTimerKey,
    setGameStarted,
  });

  // ─── Effects ──────────────────────────────────────────────────────

  // Redirect if no player names and not an online game (online games fetch via useLobbySync)
  useEffect(() => {
    if (!playerNames && !lobbyId) navigate('/');
  }, [playerNames, lobbyId, navigate]);

  // Offline: oyun başlatma — lobby yoksa questions gelince init et
  const lobbyDataRef = useRef(null);
  useEffect(() => { lobbyDataRef.current = lobbyData; }, [lobbyData]);

  useEffect(() => {
    if (lobbyId || !playerNames) return;
    if (isLoading || allQuestions.length === 0) return;
    if (lobbyDataRef.current !== null) return;

    if (questionPool.length < 3) {
      setError(`Yeterli soru yok. ${questionPool.length} soru var.`);
      return;
    }

    // Exclude recently used cross-game questions for better variety
    const recentHistory = new Set(loadRecentHistory());
    let seedPool = questionPool.filter(q => !recentHistory.has(q.id));
    // Smart fallback: if not enough fresh questions, use full pool
    if (seedPool.length < playerNames.length * 2 + 5) {
      seedPool = [...questionPool];
    }

    // Fisher-Yates shuffle
    const shuffled = [...seedPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let cursor = 0;
    const used = new Set();
    const newPlayers = playerNames.map((name) => {
      const cards = [];
      for (let j = 0; j < 2; j++) {
        if (cursor < shuffled.length) {
          const q = shuffled[cursor++];
          cards.push({ id: q.id, year: q.year, question: q.question, type: q.type, media_url: q.media_url });
          used.add(q.id);
        }
      }
      return { name, email: `player_${name}`, cards };
    });

    const firstQ = shuffled[cursor];
    if (!firstQ) { setError('İlk soru için yeterli soru yok'); return; }
    used.add(firstQ.id);

    // Record seed questions in persistent history
    appendToHistory([...used]);

    setLobbyData({
      players: newPlayers,
      current_player_index: 0,
      current_question_id: firstQ.id,
      used_question_ids: [...used]
    });
  }, [playerNames, questionPool, isLoading, lobbyId, setLobbyData, setError]);

  // Overall timer başlatma
  useEffect(() => {
    if (!lobbyId && players.length > 0 && currentQuestion != null && !gameStarted) {
      setGameStarted(true);
    }
  }, [lobbyId, players.length, currentQuestion, gameStarted, setGameStarted]);

  // Timer reset on player turn change
  useEffect(() => {
    setTimerKey(k => k + 1);
    setIsTimeUp(false);
  }, [currentPlayerIndex, setTimerKey, setIsTimeUp]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { clearTimeout(winTimerRef.current); };
  }, []);

  // Browser close uyarısı
  useEffect(() => {
    if (winner) return;
    const handleBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [winner]);

  // Geri tuşu yakalama
  useEffect(() => {
    if (winner) return;
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      if (window.confirm('Oyundan çıkmak istediğine emin misin?')) {
        navigate('/');
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [winner, navigate]);

  // ─── Handlers (UI event → action delegation) ─────────────────────
  const handleDropOnZone = useCallback((zoneIndex) => doPlacement(zoneIndex, { category, yearStart, yearEnd }), [doPlacement, category, yearStart, yearEnd]);
  const handleConfirmPlacement = useCallback(() => { if (selectedZone !== null) doPlacement(selectedZone, { category, yearStart, yearEnd }); }, [doPlacement, selectedZone, category, yearStart, yearEnd]);
  const handleTimeUp = useCallback(() => {
    if (feedback !== null || winner) return;
    if (!isMyTurn) return;
    setIsTimeUp(true);
    advanceTurn(winner);
  }, [feedback, winner, isMyTurn, advanceTurn, setIsTimeUp]);
  const handleFeedbackDone = useCallback(() => { setFeedback(null); setIsTimeUp(false); }, [setFeedback, setIsTimeUp]);
  const handleImageError = useCallback(() => skipCurrentQuestion(currentQuestion?.id), [currentQuestion?.id, skipCurrentQuestion]);
  const handleAudioError = useCallback(() => skipCurrentQuestion(currentQuestion?.id), [currentQuestion?.id, skipCurrentQuestion]);
  const handleRestart = () => { resetGame(); navigate('/'); };

  const gameOverView = winner ? (
    <>
      <GameDebugLog />
      <GameOver
        winner={winner.name}
        winnerEmail={winner.email || winner.winner_email || lobbyData?.winner_email || null}
        durationSeconds={winner.durationSeconds}
        winCardCount={winCardCount}
        onRestart={handleRestart}
        isSinglePlayer={!lobbyId && playerNames?.length === 1}
        isOnline={Boolean(lobbyId)}
        localPlayerName={myPlayer?.name || myPlayerName}
        localPlayerEmail={localPlayerEmail}
      />
    </>
  ) : null;

  // ─── Render guards ────────────────────────────────────────────────
  // For online games, playerNames may be empty array (non-host joined with just lobbyId)
  if (!playerNames && !lobbyId) return null;

  if (winner) return gameOverView;

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <p className="font-inter text-destructive">Hata: {error}</p>
        <Button onClick={() => navigate('/')} variant="outline">Geri Dön</Button>
      </div>
    </div>
  );

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 px-6">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        <p className="font-inter text-sm text-muted-foreground">Sorular yükleniyor...</p>
        <p className="font-inter text-xs text-muted-foreground/60">İlk yüklemede biraz sürebilir...</p>
        <Button onClick={() => navigate('/')} variant="outline" size="sm">Geri Dön</Button>
      </div>
    </div>
  );

  if (isError) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <WifiOff className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="font-inter text-foreground font-semibold">İnternet bağlantısı yok</p>
        <p className="font-inter text-sm text-muted-foreground">Sorular yüklenemedi ve önbellek bulunamadı.</p>
        <Button onClick={() => refetch()} className="w-full">Tekrar Dene</Button>
        <Button onClick={() => navigate('/')} variant="outline" className="w-full">Geri Dön</Button>
      </div>
    </div>
  );

  const availableQuestions = allQuestions.filter(q => q.year >= yearStart && q.year <= yearEnd);
  if (!lobbyId && allQuestions.length > 0 && availableQuestions.length < 10) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <p className="font-inter text-foreground">
          Oyun için en az 10 soru gerekli. Seçilen aralıkta <span className="text-primary font-bold">{availableQuestions.length}</span> soru var.
        </p>
        <Button onClick={() => navigate('/')} variant="outline">Geri Dön</Button>
      </div>
    </div>
  );

  const isGameReady = lobbyId
    ? players.length > 0 && lobbyData?.current_question_id && allQuestions.length > 0
    : players.length > 0 && currentQuestion != null;

  if (!isGameReady) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        <p className="font-inter text-foreground">
          {allQuestions.length === 0 ? 'Sorular yükleniyor...' : 'Oyun başlatılıyor...'}
        </p>
        <Button onClick={() => navigate('/')} variant="outline">Geri Dön</Button>
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <>
      <GameDebugLog />
      {!lobbyId && (
        <GameOverTimer active={gameStarted && !winner} onTick={(s) => setOverallSeconds(s)} />
      )}

      <AnimatePresence>
        {feedback && (
          <FeedbackOverlay result={feedback.result} year={feedback.year} songTitle={feedback.songTitle} guessedYear={feedback.guessedYear} onDone={handleFeedbackDone} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </AnimatePresence>

      {/* Offline cache banner */}
      {isFromCache && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-1 text-xs font-inter"
          style={{ background: 'rgba(245,158,11,0.15)', borderBottom: '1px solid rgba(245,158,11,0.3)', paddingTop: 'calc(0.25rem + env(safe-area-inset-top))' }}>
          <WifiOff className="w-3 h-3 text-yellow-400" />
          <span className="text-yellow-300">Önbellekten oynuyor</span>
        </div>
      )}

      <GameLayout
        players={players}
        currentPlayerIndex={currentPlayerIndex}
        currentPlayer={currentPlayer}
        currentQuestion={currentQuestion}
        winCardCount={winCardCount}
        selectedZone={selectedZone}
        isDragging={isDragging}
        touchDragPos={touchDragPos}
        touchDragEnd={touchDragEnd}
        isMyTurn={isMyTurn}
        isOnline={isOnline}
        feedback={feedback}
        winner={winner}
        turnDuration={turnDuration}
        timerKey={timerKey}
        onSelectZone={setSelectedZone}
        onDropOnZone={handleDropOnZone}
        onConfirmPlacement={handleConfirmPlacement}
        onImageError={handleImageError}
        onAudioError={handleAudioError}
        onDragStart={() => { setIsDragging(true); }}
        onDragEnd={() => { setIsDragging(false); setTouchDragPos(null); }}
        onTouchDragMove={(x, y) => { setIsDragging(true); setTouchDragPos({ x, y }); }}
        onTouchDragEnd={(x, y) => { setIsDragging(false); setTouchDragPos(null); setTouchDragEnd({ x, y }); setTimeout(() => setTouchDragEnd(null), 100); }}
        onTimeUp={handleTimeUp}
        isTimeUp={isTimeUp}
      />
    </>
  );
}
