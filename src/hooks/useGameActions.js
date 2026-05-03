/**
 * useGameActions — Oyun iş mantığı hook'u.
 * Android mimarisi önerileri: Domain/Use Case katmanı karşılığı.
 * Kart yerleştirme, tur geçme, soru atlama işlemleri burada.
 */
import { useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { addGameLog } from '@/components/game/GameDebugLog';

export function useGameActions({
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
}) {
  // Fisher-Yates shuffle'dan sonra unused sorudan birini seç
  const pickQuestion = useCallback((usedIds, questions) => {
    const available = questions.filter(q => !usedIds.has(q.id));
    if (available.length === 0) return null;
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    return available[0];
  }, []);

  // Oyun kaydını veritabanına yaz (tek oyunculu, giriş yapmış)
  const saveGameRecord = useCallback(async (winnerName, durationSecs, { category, yearStart, yearEnd }) => {
    if (lobbyId) return;
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
  }, [lobbyId, winCardCount]);

  // Kart yerleştirme — tek giriş noktası
  const doPlacement = useCallback((zone, { category, yearStart, yearEnd }) => {
    if (zone === null || zone === undefined || !currentQuestion || !players[currentPlayerIndex]) return;
    if (isPlacingRef.current) return;
    isPlacingRef.current = true;
    setTimeout(() => { isPlacingRef.current = false; }, 500);

    const snapshotPlayer = { ...players[currentPlayerIndex] };
    const snapshotPlayers = [...players];
    const snapshotIndex = currentPlayerIndex;
    const snapshotUsed = new Set([...usedQuestionIds]);

    const allSorted = [...snapshotPlayer.cards].sort((a, b) => a.year - b.year);
    const questionYear = currentQuestion.year;

    // Unique yılları grupla (zone mantığı için)
    const groupedYears = [];
    for (const card of allSorted) {
      if (groupedYears[groupedYears.length - 1] !== card.year) groupedYears.push(card.year);
    }

    // Doğruluk kontrolü
    const sameYearExists = groupedYears.includes(questionYear);
    let isCorrect = false;
    if (sameYearExists) {
      const leftYear = zone > 0 ? groupedYears[zone - 1] : null;
      const rightYear = zone < groupedYears.length ? groupedYears[zone] : null;
      isCorrect = leftYear === questionYear || rightYear === questionYear;
    } else if (zone === 0) {
      isCorrect = groupedYears.length === 0 || questionYear <= groupedYears[0];
    } else if (zone === groupedYears.length) {
      isCorrect = questionYear >= groupedYears[groupedYears.length - 1];
    } else {
      isCorrect = questionYear >= groupedYears[zone - 1] && questionYear <= groupedYears[zone];
    }

    let newPlayers = snapshotPlayers;
    let newUsed = new Set([...snapshotUsed, currentQuestion.id]);

    if (isCorrect) {
      newPlayers = [...snapshotPlayers];
      newPlayers[snapshotIndex] = {
        ...snapshotPlayer,
        cards: [...snapshotPlayer.cards, {
          id: currentQuestion.id,
          year: questionYear,
          question: currentQuestion.question,
          type: currentQuestion.type,
          media_url: currentQuestion.media_url
        }]
      };
    }

    const hasWon = isCorrect && newPlayers[snapshotIndex].cards.length >= winCardCount;

    addGameLog(`PLACE correct=${isCorrect} zone=${zone} year=${questionYear} player=${snapshotPlayer.name} cards=${newPlayers[snapshotIndex]?.cards?.length} hasWon=${hasWon}`);

    const nextIndex = (snapshotIndex + 1) % snapshotPlayers.length;
    const nextQ = !hasWon ? pickQuestion(newUsed, questionPool) : null;
    if (nextQ) newUsed.add(nextQ.id);

    // Tek atomik state güncellemesi
    setLobbyData(prev => ({
      ...prev,
      players: newPlayers,
      current_player_index: hasWon ? snapshotIndex : nextIndex,
      current_question_id: hasWon ? prev.current_question_id : (nextQ?.id || prev.current_question_id),
      used_question_ids: [...newUsed],
      ...(hasWon ? { status: 'finished', winner: newPlayers[snapshotIndex].name } : {})
    }));

    setSelectedZone(null);

    // Online: veritabanına yaz
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
          : { current_player_index: nextIndex, ...(nextQ ? { current_question_id: nextQ.id } : {}) }
        )
      };
      addGameLog(`DB_WRITE players idx=${updateData.current_player_index} status=${updateData.status}`);
      const attemptUpdate = (retries = 0) => {
        base44.entities.Lobby.update(lobbyId, updateData)
          .then(() => addGameLog('DB_WRITE OK'))
          .catch((err) => {
            addGameLog(`DB_WRITE ERR attempt=${retries + 1} ${err.message}`);
            if (retries < 2) setTimeout(() => attemptUpdate(retries + 1), 1200);
          });
      };
      attemptUpdate();
    }

    if (hasWon) {
      setFeedback({ result: 'correct', year: questionYear, songTitle: currentQuestion.type === 'muzik' ? currentQuestion.question : null });
      setGameStarted(false);
      const finalSecs = overallSecondsRef.current;
      saveGameRecord(newPlayers[snapshotIndex].name, finalSecs, { category, yearStart, yearEnd });
      setTimeout(() => {
        setFeedback(null);
        setWinner({ name: newPlayers[snapshotIndex].name, durationSeconds: finalSecs });
      }, 1800);
      return;
    }

    setFeedback({ result: isCorrect ? 'correct' : 'wrong', year: questionYear, songTitle: currentQuestion.type === 'muzik' ? currentQuestion.question : null });
    setTimerKey(k => k + 1);
  }, [
    currentQuestion, players, currentPlayerIndex, usedQuestionIds,
    questionPool, winCardCount, lobbyId, isPlacingRef, overallSecondsRef,
    pickQuestion, saveGameRecord,
    setLobbyData, setFeedback, setWinner, setSelectedZone, setTimerKey, setGameStarted
  ]);

  // Tur atlama (timer doldu)
  const advanceTurn = useCallback((winner) => {
    if (!lobbyData || players.length === 0 || winner) return;
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
      base44.entities.Lobby.update(lobbyId, {
        current_player_index: nextIndex,
        ...(nextQ ? { current_question_id: nextQ.id, used_question_ids: [...currentUsed] } : {}),
      }).catch(err => console.error('[Game] advanceTurn DB failed:', err));
    }
  }, [lobbyData, players.length, pickQuestion, lobbyId, questionPool, setSelectedZone, setTimerKey, setLobbyData]);

  // Yüklenemeyen soruyu atla
  const skipCurrentQuestion = useCallback((currentQuestionId) => {
    const newUsed = new Set([...usedQuestionIds, currentQuestionId].filter(Boolean));
    const nextQ = pickQuestion(newUsed, questionPool);
    if (nextQ) {
      const finalUsed = new Set([...newUsed, nextQ.id]);
      setLobbyData(prev => ({
        ...prev,
        current_question_id: nextQ.id,
        used_question_ids: [...finalUsed]
      }));
    }
  }, [usedQuestionIds, pickQuestion, questionPool, setLobbyData]);

  return { pickQuestion, doPlacement, advanceTurn, skipCurrentQuestion, saveGameRecord };
}