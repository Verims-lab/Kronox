import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Loader2, Check, ArrowLeft, Settings } from 'lucide-react';

import PlayerIndicator from '@/components/game/PlayerIndicator';
import Timeline from '@/components/game/Timeline';
import QuestionCard from '@/components/game/QuestionCard';
import FeedbackOverlay from '@/components/game/FeedbackOverlay';
import GameOver from '@/components/game/GameOver';
import SettingsModal from '@/components/game/SettingsModal';
import TurnTimer from '@/components/game/TurnTimer';

export default function Game() {
  const location = useLocation();
  const navigate = useNavigate();
  const playerNames = location.state?.playerNames;
  const category = location.state?.category || 'karisik';
  const yearStart = location.state?.yearStart ?? 0;
  const yearEnd = location.state?.yearEnd ?? new Date().getFullYear();
  const turnDuration = location.state?.turnDuration ?? 60;
  const winCardCount = location.state?.winCardCount ?? 10;
  const lobbyId = location.state?.lobbyId ?? null;
  const myPlayerName = location.state?.myPlayerName ?? null;

  const [players, setPlayers] = useState([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [usedQuestionIds, setUsedQuestionIds] = useState(new Set());
  const [selectedZone, setSelectedZone] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [winner, setWinner] = useState(null);
  const [gameReady, setGameReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [lobbyData, setLobbyData] = useState(null);
  const isMyTurnRef = React.useRef(true);

  const { data: allQuestions, isLoading } = useQuery({
    queryKey: ['questions'],
    queryFn: () => base44.entities.Question.list('-created_date', 200),
    initialData: [],
  });

  // Redirect if no player names
  useEffect(() => {
    if (!playerNames) {
      navigate('/');
    }
  }, [playerNames, navigate]);

  // Online: lobby'yi dinle — currentPlayerIndex ve currentQuestion senkronize et
  useEffect(() => {
    if (!lobbyId || allQuestions.length === 0) return;
    const unsub = base44.entities.Lobby.subscribe((event) => {
      if (event.id !== lobbyId) return;
      if (event.type === 'delete') return;
      const data = event.data;
      setLobbyData(data);
      if (typeof data.current_player_index === 'number') {
        setCurrentPlayerIndex(data.current_player_index);
      }
      // Soruyu lobby'den senkronize et
      if (data.current_question_id) {
        const q = allQuestions.find(q => q.id === data.current_question_id);
        if (q) setCurrentQuestion(q);
      }
      if (data.used_question_ids) {
        setUsedQuestionIds(new Set(data.used_question_ids));
      }
    });
    // İlk yükleme
    base44.entities.Lobby.filter({ id: lobbyId }).then(res => {
      if (res?.[0]) {
        const data = res[0];
        setLobbyData(data);
        if (typeof data.current_player_index === 'number') {
          setCurrentPlayerIndex(data.current_player_index);
        }
        if (data.current_question_id) {
          const q = allQuestions.find(q => q.id === data.current_question_id);
          if (q) setCurrentQuestion(q);
        }
        if (data.used_question_ids) {
          setUsedQuestionIds(new Set(data.used_question_ids));
        }
      }
    }).catch(() => {});
    return () => unsub();
  }, [lobbyId, allQuestions]);

  // Pick a random unused question
  const pickQuestion = useCallback((usedIds, questions) => {
    const available = questions.filter(q => !usedIds.has(q.id));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }, []);

  // Initialize game
  useEffect(() => {
    const filteredQuestions = allQuestions
      .filter(q => q.type === 'metin')
      .filter(q => q.year >= yearStart && q.year <= yearEnd)
      .filter(q => category === 'karisik' || q.category === category);

    if (!playerNames || filteredQuestions.length === 0 || gameReady) return;

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
      return { name, cards };
    });

    setPlayers(newPlayers);
    setUsedQuestionIds(used);

    // Pick first question
    const firstQ = pickQuestion(used, filteredQuestions);
    if (firstQ) {
      setCurrentQuestion(firstQ);
      used.add(firstQ.id);
      setUsedQuestionIds(new Set(used));
    }

    setGameReady(true);

    // Online modda ilk soruyu lobby'ye yaz (sadece host / ilk player)
    if (lobbyId && firstQ) {
      const usedArr = [...used];
      base44.entities.Lobby.update(lobbyId, {
        current_question_id: firstQ.id,
        used_question_ids: usedArr,
      }).catch(() => {});
    }
  }, [playerNames, allQuestions, category, pickQuestion, gameReady, lobbyId]);

  const handleSelectZone = (index) => {
    setSelectedZone(index);
  };

  const handleConfirmPlacement = () => {
    if (selectedZone === null || !currentQuestion || !currentPlayer) return;

    const sortedCards = [...currentPlayer.cards].sort((a, b) => a.year - b.year);
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

    if (isCorrect) {
      // Add card to player's timeline
      const newPlayers = [...players];
      newPlayers[currentPlayerIndex] = {
        ...currentPlayer,
        cards: [...currentPlayer.cards, { id: currentQuestion.id, year: questionYear, question: currentQuestion.question, type: currentQuestion.type, media_url: currentQuestion.media_url }]
      };
      setPlayers(newPlayers);

      // Check win condition
      if (newPlayers[currentPlayerIndex].cards.length >= winCardCount) {
        setFeedback({ result: 'correct', year: questionYear });
        setTimeout(() => {
          setFeedback(null);
          setWinner(currentPlayer.name);
        }, 1800);
        return;
      }
    }

    setFeedback({ result: isCorrect ? 'correct' : 'wrong', year: questionYear });
    setSelectedZone(null);
  };

  const advanceTurn = useCallback(() => {
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    setCurrentPlayerIndex(nextIndex);
    setSelectedZone(null);
    setTimerKey(k => k + 1);

    const pool = allQuestions
      .filter(q => q.type === 'metin')
      .filter(q => q.year >= yearStart && q.year <= yearEnd)
      .filter(q => category === 'karisik' || q.category === category);
    const nextQ = pickQuestion(usedQuestionIds, pool);
    const newUsed = nextQ ? new Set([...usedQuestionIds, nextQ.id]) : usedQuestionIds;

    if (nextQ) {
      setCurrentQuestion(nextQ);
      setUsedQuestionIds(newUsed);
    }

    // Online modda sırayı ve soruyu lobby'ye yaz (sadece aktif oyuncu yapar)
    if (lobbyId && isMyTurnRef.current) {
      base44.entities.Lobby.update(lobbyId, {
        current_player_index: nextIndex,
        ...(nextQ ? { current_question_id: nextQ.id, used_question_ids: [...newUsed] } : {}),
      }).catch(() => {});
    } else if (!lobbyId) {
      // offline — zaten local state güncellendi
    }
  }, [currentPlayerIndex, players.length, category, allQuestions, usedQuestionIds, pickQuestion, lobbyId]);

  const handleFeedbackDone = () => {
    setFeedback(null);
    advanceTurn();
  };

  const handleImageError = useCallback(() => {
    // Görseli yüklenemeyen soruyu atla, yeni soru çek
    const pool = allQuestions
      .filter(q => q.type === 'metin')
      .filter(q => q.year >= yearStart && q.year <= yearEnd)
      .filter(q => category === 'karisik' || q.category === category);
    const newUsed = new Set([...usedQuestionIds, currentQuestion?.id].filter(Boolean));
    const nextQ = pickQuestion(newUsed, pool);
    if (nextQ) {
      setCurrentQuestion(nextQ);
      setUsedQuestionIds(new Set([...newUsed, nextQ.id]));
    }
  }, [allQuestions, yearStart, yearEnd, category, usedQuestionIds, currentQuestion, pickQuestion]);

  const handleTimeUp = useCallback(() => {
    if (feedback !== null || winner) return;
    advanceTurn();
  }, [feedback, winner, advanceTurn]);

  const handleRestart = () => {
    navigate('/');
  };

  if (!playerNames) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
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

  const currentPlayer = players[currentPlayerIndex];

  // Online modda sadece sırası gelen oyuncu seçim yapabilir
  const isOnline = !!lobbyId;
  const isMyTurn = !isOnline || (myPlayerName && currentPlayer?.name === myPlayerName);
  isMyTurnRef.current = isMyTurn;


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
              <TurnTimer key={timerKey} active={!feedback && !winner && gameReady} onTimeUp={handleTimeUp} duration={turnDuration} />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="w-5 h-5" />
            </Button>
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
            {isOnline && myPlayerName && currentPlayer?.name !== myPlayerName && (() => {
              const myPlayer = players.find(p => p.name === myPlayerName);
              if (!myPlayer) return null;
              return (
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
              );
            })()}

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