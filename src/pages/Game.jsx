import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Loader2, Check, Settings, X, MessageCircle } from 'lucide-react';

import AppHeader from '@/components/layout/AppHeader';
import { playerBorderColors, playerBgColors, playerTextColors } from '@/components/game/playerColors';
import PlayerIndicator from '@/components/game/PlayerIndicator';
import GameDebugLog, { addGameLog } from '@/components/game/GameDebugLog';
import Timeline from '@/components/game/Timeline';
import QuestionCard from '@/components/game/QuestionCard';
import FeedbackOverlay from '@/components/game/FeedbackOverlay';
import GameOver from '@/components/game/GameOver';
import SettingsModal from '@/components/game/SettingsModal';
import TurnTimer from '@/components/game/TurnTimer';
import LobbyChat from '@/components/lobby/LobbyChat';
import GameOverTimer from '@/components/game/GameOverTimer';


export default function Game() {
  const location = useLocation();
  const navigate = useNavigate();
  const playerNames = location.state?.playerNames;
  const initialPlayers = location.state?.initialPlayers;
  const category = location.state?.category || 'karisik';
  const yearStart = location.state?.yearStart ?? 0;
  const yearEnd = location.state?.yearEnd ?? new Date().getFullYear();
  const turnDuration = location.state?.turnDuration ?? 60;
  const winCardCount = location.state?.winCardCount ?? 10;
  const lobbyId = location.state?.lobbyId ?? null;
  const myPlayerName = location.state?.myPlayerName ?? null;
  const currentQuestionIdFromState = location.state?.currentQuestionId ?? null;

  const [selectedZone, setSelectedZone] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [winner, setWinner] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [lobbyData, setLobbyData] = useState(null);
  const [error, setError] = useState(null);
  const [overallSeconds, setOverallSeconds] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const overallSecondsRef = useRef(0);
  const isMyTurnRef = React.useRef(true);
  const unsubRef = React.useRef(null);
  const winTimerRef = React.useRef(null);
  overallSecondsRef.current = overallSeconds;

  // Cleanup tüm timer ve subscription'lar component unmount'ta
  useEffect(() => {
    return () => {
      clearTimeout(winTimerRef.current);
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  const { data: allQuestions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['questions'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getQuestions', {});
      return res.data?.questions || [];
    },
    retry: 3,
    retryDelay: 2000,
    gcTime: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });



  // Derive all state from lobbyData
  const players = useMemo(() => 
    lobbyData?.players?.map(p => ({
      name: p.name,
      email: p.email,
      cards: p.cards || []
    })) || [],
  [lobbyData?.players]);

  const currentPlayerIndex = lobbyData?.current_player_index ?? 0;
  const usedQuestionIds = useMemo(() => new Set(lobbyData?.used_question_ids || []), [lobbyData?.used_question_ids]);
  
  const currentQuestion = useMemo(() => {
    if (!lobbyData?.current_question_id || allQuestions.length === 0) return null;
    return allQuestions.find(q => q.id === lobbyData.current_question_id);
  }, [lobbyData?.current_question_id, allQuestions]);

  // Memoize question pool
  const questionPool = useMemo(() => {
    return allQuestions
      .filter(q => q.type === 'metin')
      .filter(q => q.year >= yearStart && q.year <= yearEnd)
      .filter(q => category === 'karisik' || q.category === category);
  }, [allQuestions, yearStart, yearEnd, category]);

  // Memoize my player for online mode
  const isOnline = !!lobbyId;
  const myPlayer = useMemo(() => {
    if (!isOnline || !myPlayerName) return null;
    return players.find(p => p.name === myPlayerName);
  }, [players, myPlayerName, isOnline]);

  // Redirect if no player names
  useEffect(() => {
    if (!playerNames) {
      navigate('/');
    }
  }, [playerNames, navigate]);

  // Online modda subscription her zaman uygulanır (diğer oyuncuların güncellemelerini almak için)
  // Offline modda (lobbyId yok) subscription yoktur zaten
  const applySubscriptionEvent = useCallback((eventData) => {
    setLobbyData(eventData);
  }, []);

  // Online: lobby'yi dinle — questions'tan bağımsız fetch et
  useEffect(() => {
    if (!lobbyId) return;
    
    // İlk yükleme — initialPlayers ile başla
    if (initialPlayers && initialPlayers.length > 0) {
      const newLobbyData = {
        players: initialPlayers,
        current_player_index: 0,
        current_question_id: currentQuestionIdFromState,
        used_question_ids: [currentQuestionIdFromState, ...initialPlayers.flatMap(p => p.cards?.map(c => c.id) || [])].filter(Boolean)
      };
      setLobbyData(newLobbyData);
    } else {
      base44.entities.Lobby.get(lobbyId)
        .then(data => setLobbyData(data))
        .catch(err => setError('Lobi yüklenemedi: ' + err.message));
    }
    
    // Subscribe for updates
    if (unsubRef.current) unsubRef.current();
    
    const unsub = base44.entities.Lobby.subscribe((event) => {
      if (event.id !== lobbyId) return;
      addGameLog(`SUB event=${event.type} idx=${event.data?.current_player_index} status=${event.data?.status}`);
      if (event.type === 'delete') {
        setLobbyData(null);
        setError('Lobi kapatıldı.');
        return;
      }
      if (event.data.status === 'finished' && event.data.winner) {
        setWinner({ name: event.data.winner });
      }
      applySubscriptionEvent(event.data);
    });
    unsubRef.current = unsub;
    
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [lobbyId, initialPlayers, applySubscriptionEvent]);

  // Pick a random unused question — shuffle to avoid bias
  const pickQuestion = useCallback((usedIds, questions) => {
    const available = questions.filter(q => !usedIds.has(q.id));
    if (available.length === 0) return null;
    // Fisher-Yates shuffle to ensure true randomness
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    return available[0];
  }, []);

  // Oyun hazır olunca overall timer'ı başlat (sadece offline tek oyunculu mod)
  useEffect(() => {
    if (!lobbyId && players.length > 0 && currentQuestion != null && !gameStarted) {
      setGameStarted(true);
    }
  }, [lobbyId, players.length, currentQuestion, gameStarted]);

  // Kazanınca kaydet (sadece offline, giriş yapmış kullanıcı, tek oyuncu)
  const saveGameRecord = useCallback(async (winnerName, durationSecs) => {
    if (lobbyId) return; // online mod
    if (!playerNames || playerNames.length !== 1) return; // sadece tek oyuncu
    try {
      const user = await base44.auth.me();
      if (!user) return;
      await base44.entities.GameRecord.create({
        user_email: user.email,
        player_name: winnerName,
        duration_seconds: durationSecs,
        cards_won: winCardCount,
        win_card_count: winCardCount,
        category,
        year_start: yearStart,
        year_end: yearEnd,
      });
    } catch (e) {
      console.error('GameRecord save failed:', e);
    }
  }, [lobbyId, playerNames, winCardCount, category, yearStart, yearEnd]);

  // Initialize game — sadece offline modda (no lobbyId)
  const lobbyDataRef = useRef(null);
  useEffect(() => { lobbyDataRef.current = lobbyData; }, [lobbyData]);

  useEffect(() => {
    if (lobbyId || !playerNames) return;
    if (isLoading || allQuestions.length === 0) return;
    // lobbyData ref ile kontrol et — stale closure'dan kaçın
    if (lobbyDataRef.current !== null) return;
    
    const filteredQuestions = allQuestions
      .filter(q => q.type === 'metin')
      .filter(q => q.year >= yearStart && q.year <= yearEnd)
      .filter(q => category === 'karisik' || q.category === category);

    if (filteredQuestions.length < 3) {
      setError(`Yeterli soru yok. Seçilen kategori ve yıl aralığında ${filteredQuestions.length} soru var.`);
      return;
    }

    // Fisher-Yates shuffle
    const shuffled = [...filteredQuestions];
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
    if (!firstQ) {
      setError('İlk soru için yeterli soru yok');
      return;
    }
    used.add(firstQ.id);

    setLobbyData({
      players: newPlayers,
      current_player_index: 0,
      current_question_id: firstQ.id,
      used_question_ids: [...used]
    });
  }, [playerNames, allQuestions, isLoading, category, yearStart, yearEnd, lobbyId]);

  const handleSelectZone = (index) => {
    setSelectedZone(index);
  };

  const handleConfirmPlacement = () => {
    if (selectedZone === null || !currentQuestion || !currentPlayer) return;

    const snapshotPlayer = { ...currentPlayer };
    const snapshotPlayers = [...players];
    const snapshotIndex = currentPlayerIndex;
    const snapshotUsed = new Set([...usedQuestionIds]);
    const sortedCards = [...snapshotPlayer.cards].sort((a, b) => a.year - b.year);
    const questionYear = currentQuestion.year;

    // Check if placement is correct
    let isCorrect = false;
    if (selectedZone === 0) {
      isCorrect = sortedCards.length === 0 || questionYear <= sortedCards[0].year;
    } else if (selectedZone === sortedCards.length) {
      isCorrect = questionYear >= sortedCards[sortedCards.length - 1].year;
    } else {
      isCorrect = questionYear >= sortedCards[selectedZone - 1].year && questionYear <= sortedCards[selectedZone].year;
    }

    let newPlayers = snapshotPlayers;
    let newUsed = snapshotUsed;

    if (isCorrect) {
      newPlayers = [...snapshotPlayers];
      newPlayers[snapshotIndex] = {
        ...snapshotPlayer,
        cards: [...snapshotPlayer.cards, { id: currentQuestion.id, year: questionYear, question: currentQuestion.question, type: currentQuestion.type, media_url: currentQuestion.media_url }]
      };
      newUsed = new Set([...snapshotUsed, currentQuestion.id]);
    }

    const hasWon = isCorrect && newPlayers[snapshotIndex].cards.length >= winCardCount;

    addGameLog(`PLACE correct=${isCorrect} zone=${selectedZone} year=${questionYear} player=${snapshotPlayer.name} cards=${newPlayers[snapshotIndex]?.cards?.length} hasWon=${hasWon}`);

    // Compute next turn values immediately
    const nextIndex = (snapshotIndex + 1) % snapshotPlayers.length;
    const nextQ = !hasWon ? pickQuestion(newUsed, questionPool) : null;
    if (nextQ) newUsed.add(nextQ.id);

    // SINGLE optimistic update — includes card change + turn advance
    setLobbyData(prev => ({
      ...prev,
      players: newPlayers,
      current_player_index: hasWon ? snapshotIndex : nextIndex,
      current_question_id: hasWon ? prev.current_question_id : (nextQ?.id || prev.current_question_id),
      used_question_ids: [...newUsed],
      ...(hasWon ? { status: 'finished', winner: newPlayers[snapshotIndex].name } : {})
    }));

    setSelectedZone(null);

    // Online: single atomic DB write with everything
    if (lobbyId) {
      const lobbyPlayers = newPlayers.map(p => ({
        email: p.email || `player_${p.name}`,
        name: p.name,
        ready: true,
        cards: p.cards
      }));

      const updateData = {
        players: lobbyPlayers,
        used_question_ids: [...newUsed],
        status: hasWon ? 'finished' : 'in_game',
        ...(hasWon
          ? { winner: newPlayers[snapshotIndex].name }
          : {
              current_player_index: nextIndex,
              ...(nextQ ? { current_question_id: nextQ.id } : {})
            }
        )
      };

      addGameLog(`DB_WRITE players idx=${updateData.current_player_index} status=${updateData.status} nextQ=${updateData.current_question_id}`);
      const attemptUpdate = (retries = 0) => {
        base44.entities.Lobby.update(lobbyId, updateData)
          .then(() => addGameLog(`DB_WRITE OK`))
          .catch((err) => {
            addGameLog(`DB_WRITE ERR attempt=${retries+1} ${err.message}`);
            if (retries < 2) setTimeout(() => attemptUpdate(retries + 1), 1200);
          });
      };
      attemptUpdate();
    }

    if (hasWon) {
      setFeedback({ result: 'correct', year: questionYear });
      setGameStarted(false); // overall timer'ı durdur
      const finalSecs = overallSecondsRef.current;
      saveGameRecord(newPlayers[snapshotIndex].name, finalSecs);
      winTimerRef.current = setTimeout(() => {
        setFeedback(null);
        setWinner({ name: newPlayers[snapshotIndex].name, durationSeconds: finalSecs });
      }, 1800);
      return;
    }

    setFeedback({ result: isCorrect ? 'correct' : 'wrong', year: questionYear });
    setTimerKey(k => k + 1);
  };

  const advanceTurn = useCallback(() => {
    // Sadece timer dolduğunda (tur atla) kullanılır — turn advance zaten handleConfirmPlacement'ta yapıldı
    if (!lobbyData || players.length === 0) return;

    const currentIndex = lobbyData.current_player_index ?? 0;
    const nextIndex = (currentIndex + 1) % players.length;

    const currentUsed = new Set(lobbyData.used_question_ids || []);
    const nextQ = pickQuestion(currentUsed, questionPool);
    if (nextQ) currentUsed.add(nextQ.id);

    setSelectedZone(null);
    setTimerKey(k => k + 1);

    setLobbyData(prev => ({
      ...prev,
      current_player_index: nextIndex,
      current_question_id: nextQ?.id || prev.current_question_id,
      used_question_ids: [...currentUsed]
    }));

    if (lobbyId) {
      const updateData = {
        current_player_index: nextIndex,
        ...(nextQ ? { current_question_id: nextQ.id, used_question_ids: [...currentUsed] } : {}),
      };
      base44.entities.Lobby.update(lobbyId, updateData)
        .catch(err => console.error('[Game] advanceTurn DB update failed:', err));
    }
  }, [lobbyData, players.length, pickQuestion, lobbyId, questionPool]);

  const handleFeedbackDone = useCallback(() => {
    setFeedback(null);
    // Turn was already advanced inside handleConfirmPlacement — nothing more to do here
  }, []);

  const handleImageError = useCallback(() => {
    // Görseli yüklenemeyen soruyu atla, yeni soru çek
    const newUsed = new Set([...usedQuestionIds, currentQuestion?.id].filter(Boolean));
    const nextQ = pickQuestion(newUsed, questionPool);
    if (nextQ) {
      const finalUsed = new Set([...newUsed, nextQ.id]);
      setLobbyData(prev => ({
        ...prev,
        current_question_id: nextQ.id,
        used_question_ids: [...finalUsed]
      }));
    }
  }, [usedQuestionIds, currentQuestion, pickQuestion, questionPool]);

  const handleTimeUp = useCallback(() => {
    if (feedback !== null || winner) return;
    advanceTurn();
  }, [feedback, winner, advanceTurn]);

  // Reset timer when current player changes (from subscription or local update)
  useEffect(() => {
    setTimerKey(k => k + 1);
  }, [currentPlayerIndex]);

  // Tarayıcı kapatma/yenileme uyarısı
  useEffect(() => {
    if (winner) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [winner]);

  // Geri tuşu / popstate yakalama
  useEffect(() => {
    if (winner) return;
    // Mevcut state'i history'e ekle (geri tuşunu yakalamak için)
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      if (window.confirm('Oyundan çıkmak istediğine emin misin? Oyun kaybolacak.')) {
        navigate('/');
      } else {
        // Kullanıcı vazgeçti, history'yi geri koy
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [winner, navigate]);

  const handleRestart = () => {
    setOverallSeconds(0);
    setGameStarted(false);
    navigate('/');
  };

  const handleBackAttempt = () => {
    if (winner) { navigate('/'); return; }
    if (window.confirm('Oyundan çıkmak istediğine emin misin? Oyun kaybolacak.')) {
      navigate('/');
    }
  };

  if (!playerNames) return null;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4">
          <p className="font-inter text-destructive">
            Hata: {error}
          </p>
          <Button onClick={() => navigate('/')} variant="outline">Geri Dön</Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 px-6">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="font-inter text-sm text-muted-foreground">Sorular yükleniyor...</p>
          <p className="font-inter text-xs text-muted-foreground/60">İlk yüklemede biraz sürebilir...</p>
          <Button onClick={() => navigate('/')} variant="outline" size="sm" className="mt-2">Geri Dön</Button>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4">
          <p className="font-inter text-muted-foreground">Sorular yüklenemedi. Lütfen tekrar dene.</p>
          <Button onClick={() => refetch()} className="w-full">Tekrar Dene</Button>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">Geri Dön</Button>
        </div>
      </div>
    );
  }

  const currentPlayer = players.length > 0 ? players[currentPlayerIndex] : null;

  // Online modda sadece sırası gelen oyuncu seçim yapabilir
  const isMyTurn = !isOnline || (myPlayerName && currentPlayer?.name === myPlayerName);
  isMyTurnRef.current = isMyTurn;

  // Check available questions based on filters (offline mode only)
  const availableQuestions = allQuestions
    .filter(q => q.year >= yearStart && q.year <= yearEnd);
  
  if (!lobbyId && allQuestions.length > 0 && availableQuestions.length < 10) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4">
          <p className="font-inter text-foreground">
            Oyun için en az 10 soru gerekli. Seçilen kategori ve yıl aralığında <span className="text-primary font-bold">{availableQuestions.length}</span> soru var.
          </p>
          <Button onClick={() => navigate('/')} variant="outline">Geri Dön</Button>
        </div>
      </div>
    );
  }

  // Online modda lobbyData'dan, offline modda playerNames'den
  const isGameReady = lobbyId
    ? players.length > 0 && lobbyData?.current_question_id && allQuestions.length > 0
    : players.length > 0 && currentQuestion != null;
  
  if (!isGameReady) {
    return (
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
  }


  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <AppHeader onBack={handleBackAttempt} />
      <GameDebugLog />
      {/* Overall süre — sadece offline tek oyunculu mod */}
      {!lobbyId && (
        <GameOverTimer
          active={gameStarted && !winner}
          onTick={(s) => setOverallSeconds(s)}
        />
      )}


      {/* Winner overlay */}
      {winner && (
        <GameOver
          winner={winner.name}
          durationSeconds={winner.durationSeconds}
          winCardCount={winCardCount}
          onRestart={handleRestart}
          isSinglePlayer={!lobbyId && playerNames?.length === 1}
        />
      )}

      {/* Feedback overlay */}
      <AnimatePresence>
        {feedback && (
          <FeedbackOverlay
            result={feedback.result}
            year={feedback.year}
            onDone={handleFeedbackDone}
          />
        )}
      </AnimatePresence>

      {/* Settings modal */}
      <AnimatePresence>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </AnimatePresence>

      {/* Chat panel — only in online mode */}
      <AnimatePresence>
      {showChat && isOnline && (
        <motion.div
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'tween', duration: 0.2 }}
          className="fixed right-0 top-0 bottom-0 z-40 w-72 flex flex-col bg-card border-l border-border shadow-2xl"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-cinzel text-sm text-primary tracking-wider">SOHBET</span>
            <button onClick={() => setShowChat(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-3">
            <LobbyChat lobbyId={lobbyId} playerName={myPlayerName || 'Oyuncu'} compact={false} />
          </div>
        </motion.div>
      )}
      </AnimatePresence>



      {/* Inner container — max width on desktop */}
      <div className="w-full max-w-2xl md:max-w-4xl flex flex-col flex-1">
        {/* Header */}
        <div
          className="pb-1 px-4 space-y-2 landscape:space-y-0.5 landscape:pb-0.5"
          style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))' }}
        >
          <div className="flex items-center justify-between">
            <div className="w-9" />
            <div className="flex items-center gap-2">
              <TurnTimer key={timerKey} active={!feedback && !winner && isGameReady} onTimeUp={isMyTurn ? handleTimeUp : undefined} duration={turnDuration} />
            </div>
            <div className="flex gap-1">
              {isOnline && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowChat(c => !c)}
                  className={`hover:text-foreground ${showChat ? 'text-primary' : 'text-muted-foreground'}`}
                  title="Sohbet"
                >
                  <MessageCircle className="w-5 h-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>
          {/* Portrait: PlayerIndicator normal, Landscape: gizle (sağ panelde gösterilecek) */}
          <div className="landscape:hidden">
            <PlayerIndicator players={players} currentPlayerIndex={currentPlayerIndex} myPlayerName={myPlayerName} />
          </div>
        </div>

        {/* Ana oyun alanı — Landscape: yatay 3 kolon, Portrait: dikey */}
        <div
          className="flex-1 flex flex-col landscape:flex-row items-stretch gap-2 px-2 landscape:px-2 md:px-4 overflow-hidden"
          style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
          {/* Landscape sol kolon: PlayerIndicator + Soru kartı + Buton */}
          <div className="hidden landscape:flex landscape:flex-col landscape:w-52 landscape:flex-shrink-0 landscape:gap-2 landscape:py-1 landscape:overflow-y-auto">
            <PlayerIndicator players={players} currentPlayerIndex={currentPlayerIndex} myPlayerName={myPlayerName} />
            {currentQuestion && (
              <QuestionCard question={currentQuestion} onImageError={handleImageError} landscape />
            )}
            {isOnline && !isMyTurn ? (
              <div className="w-full h-9 flex items-center justify-center rounded-xl border border-border/40 bg-secondary/20">
                <p className="font-inter text-xs text-muted-foreground text-center">
                  <span className="text-primary font-semibold">{currentPlayer?.name}</span> oynuyor…
                </p>
              </div>
            ) : (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleConfirmPlacement}
                  disabled={selectedZone === null || !!feedback}
                  className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-cinzel tracking-wider gap-2 disabled:opacity-30 text-sm"
                >
                  <Check className="w-4 h-4" />
                  YERLEŞTIR
                </Button>
              </motion.div>
            )}
          </div>

          {/* Timeline alanı */}
          <div className="flex-1 flex flex-col gap-2 landscape:gap-1 landscape:py-1 min-w-0 md:mt-4">

            {/* Sıradaki oyuncunun kartları */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${playerTextColors[currentPlayerIndex % playerTextColors.length].replace('text-', 'bg-')}`} />
                <p className={`text-xs font-inter font-semibold ${playerTextColors[currentPlayerIndex % playerTextColors.length]}`}>
                  {currentPlayer?.name} — oynuyor
                </p>
                <span className="text-xs font-inter text-muted-foreground">
                  ({currentPlayer?.cards?.length || 0} kart)
                </span>
              </div>
              <div className={`rounded-xl border-2 p-1 overflow-x-auto transition-all duration-500 ${playerBorderColors[currentPlayerIndex % playerBorderColors.length]} ${playerBgColors[currentPlayerIndex % playerBgColors.length]}`}>
                {currentPlayer && (
                  <Timeline
                    cards={currentPlayer.cards}
                    selectedZone={isMyTurn ? selectedZone : null}
                    onSelectZone={isMyTurn ? handleSelectZone : undefined}
                  />
                )}
              </div>
            </div>

            {/* Benim kartlarım — sadece online modda ve ben sıradaki değilsem */}
            {isOnline && myPlayerName && currentPlayer?.name !== myPlayerName && myPlayer && (
              <div className="space-y-1">
                <p className="text-xs font-inter text-muted-foreground">
                  Senin kartların ({myPlayer.cards.length})
                </p>
                <div className="rounded-xl border border-border/40 bg-secondary/10 p-1 overflow-x-auto opacity-80">
                  <Timeline
                    cards={myPlayer.cards}
                    selectedZone={null}
                    onSelectZone={undefined}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Portrait sağ kolon: Soru kartı + Buton — landscape'de gizli */}
          <div className="landscape:hidden space-y-2 md:w-72 md:mt-4 md:flex-shrink-0 w-full overflow-hidden">
            {currentQuestion && (
              <QuestionCard question={currentQuestion} onImageError={handleImageError} />
            )}
            {isOnline && !isMyTurn ? (
              <div className="w-full h-10 flex items-center justify-center rounded-xl border border-border/40 bg-secondary/20">
                <p className="font-inter text-sm text-muted-foreground">
                  <span className="text-primary font-semibold">{currentPlayer?.name}</span> oynuyor…
                </p>
              </div>
            ) : (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleConfirmPlacement}
                  disabled={selectedZone === null || !!feedback}
                  size="lg"
                  className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-cinzel tracking-wider gap-2 disabled:opacity-30"
                >
                  <Check className="w-5 h-5" />
                  YERLEŞTIR
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}