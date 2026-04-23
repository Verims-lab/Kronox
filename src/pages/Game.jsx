import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Loader2, Check, ArrowLeft, Settings, X, MessageCircle, FlaskConical } from 'lucide-react';

import PlayerIndicator from '@/components/game/PlayerIndicator';
import Timeline from '@/components/game/Timeline';
import QuestionCard from '@/components/game/QuestionCard';
import FeedbackOverlay from '@/components/game/FeedbackOverlay';
import GameOver from '@/components/game/GameOver';
import SettingsModal from '@/components/game/SettingsModal';
import TurnTimer from '@/components/game/TurnTimer';
import LobbyChat from '@/components/lobby/LobbyChat';
import SimulationPanel from '@/components/game/SimulationPanel';


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
  const [showSim, setShowSim] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [lobbyData, setLobbyData] = useState(null);
  const [error, setError] = useState(null);
  const isMyTurnRef = React.useRef(true);
  const unsubRef = React.useRef(null);
  // Pending write: kendi yazdığımız DB güncellemesini subscription ezmesin
  const pendingWriteRef = React.useRef(false);
  const pendingWriteTimerRef = React.useRef(null);

  const { data: allQuestions, isLoading, isError } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('-created_date', 200),
    initialData: [],
    retry: 2,
    retryDelay: 1500,
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

  // Safely update lobbyData — subscription'dan gelen event kendi optimistic update'imizi ezmesin
  const applySubscriptionEvent = useCallback((eventData) => {
    if (pendingWriteRef.current) {
      console.log('[Game] Subscription event SKIPPED (pending write in progress)');
      return;
    }
    console.log('[Game] Applying subscription event:', {
      players: eventData.players?.length,
      current_player_index: eventData.current_player_index,
    });
    setLobbyData(eventData);
  }, []);

  // Online: lobby'yi dinle — questions'tan bağımsız fetch et
  useEffect(() => {
    if (!lobbyId) return;
    
    console.log('[Game] Online mode - setup with lobbyId:', lobbyId);
    
    // İlk yükleme — initialPlayers ile başla
    if (initialPlayers && initialPlayers.length > 0) {
      console.log('[Game] Initializing with local state:', { 
        players: initialPlayers.length, 
        first_player_card_count: initialPlayers[0].cards?.length || 0
      });
      const newLobbyData = {
        players: initialPlayers,
        current_player_index: 0,
        current_question_id: currentQuestionIdFromState,
        used_question_ids: [currentQuestionIdFromState, ...initialPlayers.flatMap(p => p.cards?.map(c => c.id) || [])].filter(Boolean)
      };
      setLobbyData(newLobbyData);
    } else {
      // Oyuncu 2+: DB'den fetch et (questions'tan bağımsız)
      console.log('[Game] No initialPlayers from navigate, fetching from DB...');
      base44.entities.Lobby.get(lobbyId)
        .then(data => {
          console.log('[Game] Fetched lobby from DB:', { 
            players: data.players?.length, 
            current_question_id: data.current_question_id
          });
          setLobbyData(data);
        })
        .catch(err => console.error('[Game] Lobby load error:', err));
    }
    
    // Subscribe for updates
    if (unsubRef.current) unsubRef.current();
    
    const unsub = base44.entities.Lobby.subscribe((event) => {
      if (event.id !== lobbyId) return;
      if (event.type === 'delete') {
        setLobbyData(null);
        setError('Lobi kapatıldı.');
        return;
      }
      console.log('[Game] Subscription event received:', { 
        current_player_index: event.data.current_player_index,
        status: event.data.status,
        winner: event.data.winner,
        pendingWrite: pendingWriteRef.current,
      });
      // Oyun bittiyse herkese winner ekranını göster
      if (event.data.status === 'finished' && event.data.winner) {
        setWinner(event.data.winner);
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

  // Initialize game — sadece offline modda (no lobbyId)
  useEffect(() => {
    if (lobbyId || !playerNames || players.length > 0) return;
    
    if (allQuestions.length === 0) return;
    
    try {
      const filteredQuestions = allQuestions
        .filter(q => q.type === 'metin')
        .filter(q => q.year >= yearStart && q.year <= yearEnd)
        .filter(q => category === 'karisik' || q.category === category);

      if (filteredQuestions.length === 0) {
        setError('Soru bulunamadı');
        return;
      }

      const used = new Set();
      const newPlayers = playerNames.map((name) => {
        const cards = [];
        for (let j = 0; j < 2; j++) {
          const q = pickQuestion(used, filteredQuestions);
          if (q) {
            cards.push({ id: q.id, year: q.year, question: q.question, type: q.type, media_url: q.media_url });
            used.add(q.id);
          }
        }
        return { name, email: `player_${name}`, cards };
      });

      const firstQ = pickQuestion(used, filteredQuestions);
      if (!firstQ) {
        setError('Soru bulunamadı');
        return;
      }
      used.add(firstQ.id);

      // Set lobbyData manually for offline mode
      setLobbyData({
        players: newPlayers,
        current_player_index: 0,
        current_question_id: firstQ.id,
        used_question_ids: [...used]
      });
    } catch (err) {
      setError('Oyun başlatılırken hata: ' + (err?.message || 'Bilinmeyen hata'));
    }
  }, [playerNames, allQuestions, category, pickQuestion, lobbyId]);

  const handleSelectZone = (index) => {
    setSelectedZone(index);
  };

  const handleConfirmPlacement = () => {
    if (selectedZone === null || !currentQuestion || !currentPlayer) return;

    // SNAPSHOT: capture current player at time of click
    const snapshotPlayer = { ...currentPlayer };
    const sortedCards = [...snapshotPlayer.cards].sort((a, b) => a.year - b.year);
    const questionYear = currentQuestion.year;

    console.log('[Game] handleConfirmPlacement:', {
      player: snapshotPlayer.name,
      selectedZone,
      questionYear,
      playerCardsBefore: snapshotPlayer.cards.length,
      isMyTurn
    });

    // Check if placement is correct
    let isCorrect = false;
    if (selectedZone === 0) {
      isCorrect = sortedCards.length === 0 || questionYear <= sortedCards[0].year;
    } else if (selectedZone === sortedCards.length) {
      isCorrect = questionYear >= sortedCards[sortedCards.length - 1].year;
    } else {
      isCorrect = questionYear >= sortedCards[selectedZone - 1].year && questionYear <= sortedCards[selectedZone].year;
    }

    console.log('[Game] isCorrect check:', {
      isCorrect,
      sortedCardLength: sortedCards.length,
      selectedZone,
      questionYear
    });

    if (isCorrect) {
      // Add card to player's timeline
      const newPlayers = [...players];
      
      console.log('[Game] Before card add:', {
        currentPlayerIndex,
        playerName: snapshotPlayer.name,
        cardsBefore: snapshotPlayer.cards.length,
        allPlayersCards: newPlayers.map(p => ({ name: p.name, cards: p.cards.length }))
      });
      
      newPlayers[currentPlayerIndex] = {
        ...snapshotPlayer,
        cards: [...snapshotPlayer.cards, { id: currentQuestion.id, year: questionYear, question: currentQuestion.question, type: currentQuestion.type, media_url: currentQuestion.media_url }]
      };

      console.log('[Game] After card add:', {
        currentPlayerIndex,
        playerName: newPlayers[currentPlayerIndex].name,
        cardsAfter: newPlayers[currentPlayerIndex].cards.length,
        allPlayersCards: newPlayers.map(p => ({ name: p.name, cards: p.cards.length }))
      });

      // Soruyu kullanılan sorular listesine ekle
      const newUsed = new Set([...usedQuestionIds, currentQuestion.id]);

      // Check win condition BEFORE updating
      const hasWon = newPlayers[currentPlayerIndex].cards.length >= winCardCount;

      // OPTIMISTIC UPDATE FIRST—state immediately reflects the card
      setLobbyData(prev => ({
        ...prev,
        players: newPlayers,
        used_question_ids: [...newUsed]
      }));

      // Online modda DB'ye ATOMIC write
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
          ...(hasWon ? { winner: newPlayers[currentPlayerIndex].name } : {})
        };

        // Pending write: subscription bu sürede bizi ezmesin
        pendingWriteRef.current = true;
        clearTimeout(pendingWriteTimerRef.current);
        
        const attemptUpdate = (retries = 0) => {
          base44.entities.Lobby.update(lobbyId, updateData)
            .then(() => {
              console.log('[Game] Card placement DB update SUCCESS');
              // 2sn sonra kilidi kaldır — subscription'ın gelmesi için yeterli süre
              pendingWriteTimerRef.current = setTimeout(() => {
                pendingWriteRef.current = false;
              }, 2000);
            })
            .catch((err) => {
              console.error(`[Game] Card placement DB update failed (attempt ${retries + 1}):`, err);
              if (retries < 2) {
                setTimeout(() => attemptUpdate(retries + 1), 1200);
              } else {
                pendingWriteRef.current = false;
              }
            });
        };
        attemptUpdate();
      }

      if (hasWon) {
        setFeedback({ result: 'correct', year: questionYear });
        setTimeout(() => {
          setFeedback(null);
          setWinner(newPlayers[currentPlayerIndex].name);
        }, 1800);
        return;
      }
    }

    console.log('[Game] Setting feedback:', { result: isCorrect ? 'correct' : 'wrong', year: questionYear });
    setFeedback({ result: isCorrect ? 'correct' : 'wrong', year: questionYear });
    setSelectedZone(null);
  };

  const advanceTurn = useCallback(() => {
    // Guard: don't advance if no players yet
    if (!lobbyData || players.length === 0) {
      console.log('[Game] advanceTurn: Missing data', { hasLobbyData: !!lobbyData, playersCount: players.length });
      return;
    }

    console.log('[Game] advanceTurn starting:', { 
      currentIndex: lobbyData.current_player_index, 
      totalPlayers: players.length,
      nextIndexWillBe: (lobbyData.current_player_index + 1) % players.length
    });

    // IMPORTANT: Use CURRENT lobbyData.current_player_index, not stale closure var
    const currentIndex = lobbyData.current_player_index ?? 0;
    const nextIndex = (currentIndex + 1) % players.length;

    console.log('[Game] advanceTurn calculating turn:', {
    currentIndex,
    nextIndex,
    playersCount: players.length
    });

    setSelectedZone(null);
    setTimerKey(k => k + 1);

    const nextQ = pickQuestion(usedQuestionIds, questionPool);
    const newUsed = nextQ ? new Set([...usedQuestionIds, nextQ.id]) : usedQuestionIds;

    console.log('[Game] advanceTurn picked next question:', {
    nextQId: nextQ?.id,
    nextQYear: nextQ?.year,
    usedCount: newUsed.size
    });

    // Optimistic update—her durumda state'i güncelle
    setLobbyData(prev => ({
    ...prev,
    current_player_index: nextIndex,
    current_question_id: nextQ?.id || prev.current_question_id,
    used_question_ids: [...newUsed]
    }));

    // Online: DB'ye de senkronize et
    if (lobbyId) {
      const updateData = {
        current_player_index: nextIndex,
        ...(nextQ ? { current_question_id: nextQ.id, used_question_ids: [...newUsed] } : {}),
      };

      // Pending write kilidi
      pendingWriteRef.current = true;
      clearTimeout(pendingWriteTimerRef.current);

      const attemptUpdate = (retries = 0) => {
        base44.entities.Lobby.update(lobbyId, updateData)
          .then(() => {
            console.log('[Game] advanceTurn DB update SUCCESS, nextIndex:', nextIndex);
            pendingWriteTimerRef.current = setTimeout(() => {
              pendingWriteRef.current = false;
            }, 2000);
          })
          .catch((err) => {
            console.error(`[Game] advanceTurn DB update failed (attempt ${retries + 1}):`, err);
            if (retries < 2) {
              setTimeout(() => attemptUpdate(retries + 1), 1000);
            } else {
              pendingWriteRef.current = false;
            }
          });
      };
      attemptUpdate();
    }
  }, [lobbyData, players.length, usedQuestionIds, pickQuestion, lobbyId, questionPool]);

  const handleFeedbackDone = useCallback(() => {
    console.log('[Game] handleFeedbackDone called, isMyTurn:', isMyTurnRef.current);
    setFeedback(null);
    advanceTurn();
  }, [advanceTurn]);

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

  const handleRestart = () => {
    navigate('/');
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
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="font-inter text-sm text-muted-foreground">Sorular yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4">
          <p className="font-inter text-muted-foreground">Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.</p>
          <Button onClick={() => navigate('/')} variant="outline">Geri Dön</Button>
        </div>
      </div>
    );
  }

  if (allQuestions.length < 10) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4">
          <p className="font-inter text-foreground">
            Oyun için en az 10 soru gerekli. Şu anda <span className="text-primary font-bold">{allQuestions.length}</span> soru var.
          </p>
          <Button onClick={() => navigate('/')} variant="outline">Geri Dön</Button>
        </div>
      </div>
    );
  }

  const currentPlayer = players.length > 0 ? players[currentPlayerIndex] : null;

  // Online modda sadece sırası gelen oyuncu seçim yapabilir
  const isMyTurn = !isOnline || (myPlayerName && currentPlayer?.name === myPlayerName);
  isMyTurnRef.current = isMyTurn;
  
  console.log('[Game] isMyTurn check:', {
    isOnline,
    myPlayerName,
    currentPlayerName: currentPlayer?.name,
    isMyTurn,
    currentPlayerIndex
  });

  // Online modda lobbyData'dan, offline modda playerNames'den
  const isGameReady = lobbyId
    ? players.length > 0 && lobbyData?.current_question_id
    : playerNames && playerNames.length > 0 && players.length > 0 && currentQuestion;
  
  if (!isGameReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4">
          <p className="font-inter text-foreground">
            Oyun başlatılıyor...
          </p>
          <Button onClick={() => navigate('/')} variant="outline">Geri Dön</Button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background flex flex-col items-center">


      {/* Winner overlay */}
      {winner && <GameOver winner={winner} onRestart={handleRestart} />}

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

      {/* Simulation panel (admin/dev only) */}
      <AnimatePresence>
      {showSim && <SimulationPanel onClose={() => setShowSim(false)} />}
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
        {/* Header — compact in landscape */}
        <div
          className="pb-1 px-4 space-y-2 landscape:space-y-1 landscape:pb-1"
          style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
        >
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="font-cinzel text-xl text-primary tracking-widest">KRONOS</h1>
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
                onClick={() => setShowSim(s => !s)}
                className="text-muted-foreground hover:text-foreground"
                title="Simülasyon Testleri"
              >
                <FlaskConical className="w-5 h-5" />
              </Button>
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
          <PlayerIndicator players={players} currentPlayerIndex={currentPlayerIndex} myPlayerName={myPlayerName} />
        </div>

        {/* Landscape + desktop: side-by-side. Portrait mobile: stacked */}
        <div
          className="flex-1 flex flex-col landscape:flex-row md:flex-row items-start gap-3 px-2 md:px-4 landscape:px-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          {/* Timeline area — iki bölüm: sıradaki oyuncu + benim kartlarım */}
          <div className="flex-1 space-y-3 landscape:mt-2 md:mt-4 min-w-0">

            {/* SIRADAKI OYUNCUNUN KARTlARI (büyük/aktif görünüm) */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <p className="text-xs font-inter text-primary font-semibold">
                  {currentPlayer?.name} — oynuyor
                </p>
                <span className="text-xs font-inter text-muted-foreground">
                  ({currentPlayer?.cards?.length || 0} kart)
                </span>
              </div>
              <div className="rounded-xl border-2 border-primary/50 bg-primary/5 p-2 overflow-x-auto">
                {currentPlayer && (
                  <Timeline
                    cards={currentPlayer.cards}
                    selectedZone={isMyTurn ? selectedZone : null}
                    onSelectZone={isMyTurn ? handleSelectZone : undefined}
                  />
                )}
              </div>
            </div>

            {/* BENİM KARTlARIM — sadece online modda ve ben sıradaki değilsem göster */}
            {isOnline && myPlayerName && currentPlayer?.name !== myPlayerName && myPlayer && (
               <div className="space-y-1">
                 <p className="text-xs font-inter text-muted-foreground">
                   Senin kartların ({myPlayer.cards.length})
                 </p>
                 <div className="rounded-xl border border-border/40 bg-secondary/10 p-2 overflow-x-auto opacity-80">
                   <Timeline
                     cards={myPlayer.cards}
                     selectedZone={null}
                     onSelectZone={undefined}
                   />
                 </div>
               </div>
             )}

          </div>

          {/* Question card + confirm button */}
          <div className="space-y-2 landscape:w-56 landscape:mt-2 landscape:flex-shrink-0 md:w-72 md:mt-4 md:flex-shrink-0 w-full">
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