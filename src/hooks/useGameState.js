/**
 * useGameState — Oyun durumunu yöneten hook.
 * Android mimarisi önerileri: ViewModel / State Holder pattern karşılığı.
 * UI bileşenleri bu hook'u tüketir, iş mantığını doğrudan içermez.
 */
import { useState, useRef, useMemo, useCallback } from 'react';

export function useGameState({ playerNames, initialPlayers, currentQuestionIdFromState, lobbyId, isOnlineMode = false }) {
  const [lobbyData, setLobbyData] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [winner, setWinner] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [touchDragPos, setTouchDragPos] = useState(null);
  const [touchDragEnd, setTouchDragEnd] = useState(null);
  const [timerKey, setTimerKey] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [overallSeconds, setOverallSeconds] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [error, setError] = useState(null);
  const [isTimeUp, setIsTimeUp] = useState(false);

  const isPlacingRef = useRef(false);
  const overallSecondsRef = useRef(0);
  overallSecondsRef.current = overallSeconds;

  // Derived state — memoized to avoid re-renders
  const players = useMemo(() =>
    lobbyData?.players?.map(p => ({
      name: p.name,
      email: p.email,
      cards: p.cards || []
    })) || [],
    [lobbyData?.players]
  );

  const currentPlayerIndex = lobbyData?.current_player_index ?? 0;

  const usedQuestionIds = useMemo(
    () => new Set(lobbyData?.used_question_ids || []),
    [lobbyData?.used_question_ids]
  );

  const isOnline = Boolean(isOnlineMode || lobbyId);

  const resetGame = useCallback(() => {
    setOverallSeconds(0);
    setGameStarted(false);
    setLobbyData(null);
    setWinner(null);
    setFeedback(null);
    setSelectedZone(null);
    setError(null);
    setIsTimeUp(false);
  }, []);

  return {
    // State
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
    // Refs
    isPlacingRef,
    overallSecondsRef,
    // Derived
    players,
    currentPlayerIndex,
    usedQuestionIds,
    isOnline,
    // Actions
    resetGame,
  };
}
