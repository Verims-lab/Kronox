import React, { useState, useEffect, useCallback } from 'react';
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

  // Pick a random unused question
  const pickQuestion = useCallback((usedIds, questions) => {
    const available = questions.filter(q => !usedIds.has(q.id));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }, []);

  // Initialize game
  useEffect(() => {
    const filteredQuestions = allQuestions
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
  }, [playerNames, allQuestions, category, pickQuestion, gameReady]);

  const handleSelectZone = (index) => {
    setSelectedZone(index);
  };

  const handleConfirmPlacement = () => {
    if (selectedZone === null || !currentQuestion) return;

    const player = players[currentPlayerIndex];
    const sortedCards = [...player.cards].sort((a, b) => a.year - b.year);
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
        ...player,
        cards: [...player.cards, { id: currentQuestion.id, year: questionYear, question: currentQuestion.question, type: currentQuestion.type, media_url: currentQuestion.media_url }]
      };
      setPlayers(newPlayers);

      // Check win condition
      if (newPlayers[currentPlayerIndex].cards.length >= 10) {
        setFeedback({ result: 'correct', year: questionYear });
        setTimeout(() => {
          setFeedback(null);
          setWinner(player.name);
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
      .filter(q => q.year >= yearStart && q.year <= yearEnd)
      .filter(q => category === 'karisik' || q.category === category);
    const nextQ = pickQuestion(usedQuestionIds, pool);
    if (nextQ) {
      setCurrentQuestion(nextQ);
      setUsedQuestionIds(prev => new Set([...prev, nextQ.id]));
    }
  }, [currentPlayerIndex, players.length, category, allQuestions, usedQuestionIds, pickQuestion]);

  const handleFeedbackDone = () => {
    setFeedback(null);
    advanceTurn();
  };

  const handleTimeUp = useCallback(() => {
    if (feedback || winner) return;
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
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

      {/* Header */}
      <div
        className="pb-2 px-4 space-y-3"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
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
            <TurnTimer key={timerKey} active={!feedback && !winner && gameReady} onTimeUp={handleTimeUp} />
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
        <PlayerIndicator players={players} currentPlayerIndex={currentPlayerIndex} />
      </div>

      {/* Current player's timeline */}
      <div className="flex-1 flex flex-col justify-between px-2" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="space-y-2">
          <p className="text-center text-xs font-inter text-muted-foreground">
            <span className="text-primary font-semibold">{currentPlayer?.name}</span> — Kartını doğru yere yerleştir
          </p>
          
          {currentPlayer && (
            <div className="overflow-x-auto">
              <Timeline
                cards={currentPlayer.cards}
                selectedZone={selectedZone}
                onSelectZone={handleSelectZone}
              />
            </div>
          )}
        </div>

        {/* Question card + confirm button */}
        <div className="space-y-4 mt-4">
          {currentQuestion && (
            <QuestionCard question={currentQuestion} />
          )}

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              onClick={handleConfirmPlacement}
              disabled={selectedZone === null || !!feedback}
              size="lg"
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-cinzel tracking-wider gap-2 disabled:opacity-30"
            >
              <Check className="w-5 h-5" />
              YERLEŞTIR
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}