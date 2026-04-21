import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';

import PlayerIndicator from '@/components/game/PlayerIndicator';
import Timeline from '@/components/game/Timeline';
import QuestionCard from '@/components/game/QuestionCard';
import FeedbackOverlay from '@/components/game/FeedbackOverlay';
import GameOver from '@/components/game/GameOver';

export default function Game() {
  const location = useLocation();
  const navigate = useNavigate();
  const playerNames = location.state?.playerNames;

  const [players, setPlayers] = useState([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [usedQuestionIds, setUsedQuestionIds] = useState(new Set());
  const [selectedZone, setSelectedZone] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [winner, setWinner] = useState(null);
  const [gameReady, setGameReady] = useState(false);

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
    if (!playerNames || allQuestions.length === 0 || gameReady) return;

    const used = new Set();
    const newPlayers = playerNames.map((name) => {
      const cards = [];
      for (let j = 0; j < 2; j++) {
        const q = pickQuestion(used, allQuestions);
        if (q) {
          cards.push({ id: q.id, year: q.year, question: q.question });
          used.add(q.id);
        }
      }
      return { name, cards };
    });

    setPlayers(newPlayers);
    setUsedQuestionIds(used);

    // Pick first question
    const firstQ = pickQuestion(used, allQuestions);
    if (firstQ) {
      setCurrentQuestion(firstQ);
      used.add(firstQ.id);
      setUsedQuestionIds(new Set(used));
    }

    setGameReady(true);
  }, [playerNames, allQuestions, pickQuestion, gameReady]);

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
        cards: [...player.cards, { id: currentQuestion.id, year: questionYear, question: currentQuestion.question }]
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

  const handleFeedbackDone = () => {
    setFeedback(null);

    // Move to next player
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    setCurrentPlayerIndex(nextIndex);

    // Pick next question
    const nextQ = pickQuestion(usedQuestionIds, allQuestions);
    if (nextQ) {
      setCurrentQuestion(nextQ);
      setUsedQuestionIds(prev => new Set([...prev, nextQ.id]));
    }
  };

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

      {/* Header */}
      <div className="pt-4 pb-2 px-4 space-y-3">
        <h1 className="font-cinzel text-xl text-primary text-center tracking-widest">KRONOS</h1>
        <PlayerIndicator players={players} currentPlayerIndex={currentPlayerIndex} />
      </div>

      {/* Current player's timeline */}
      <div className="flex-1 flex flex-col justify-between px-2 pb-4">
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
            <QuestionCard question={currentQuestion.question} />
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