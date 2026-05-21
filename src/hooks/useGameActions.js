/**
 * useGameActions — Oyun iş mantığı hook'u.
 * Android mimarisi önerileri: Domain/Use Case katmanı karşılığı.
 * Kart yerleştirme, tur geçme, soru atlama işlemleri burada.
 */
import { useCallback, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { addGameLog } from '@/components/game/GameDebugLog';
import { loadRecentHistory, appendToHistory } from '@/lib/questionHistory';
import { debugLog } from '@/lib/debugLog';

const summarizePlayers = (players = []) => players.map((player, index) => ({
  index,
  email: player?.email || null,
  name: player?.name || null,
  cardCount: Array.isArray(player?.cards) ? player.cards.length : 0,
}));

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
  const timeoutRefs = useRef(new Set());

  const scheduleTimeout = useCallback((fn, delay) => {
    const timeoutId = window.setTimeout(() => {
      timeoutRefs.current.delete(timeoutId);
      fn();
    }, delay);
    timeoutRefs.current.add(timeoutId);
    return timeoutId;
  }, []);

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => window.clearTimeout(timeoutId));
      timeoutRefs.current.clear();
    };
  }, []);

  const writeOnlineLobbyState = useCallback((updateData, context = {}) => {
    if (!lobbyId) return;

    const debugBase = {
      actorName: context.actorName || null,
      lobbyId,
      current_player_index_before: context.currentPlayerIndexBefore ?? null,
      next_current_player_index: updateData.current_player_index ?? null,
      current_question_id_before: context.currentQuestionIdBefore || null,
      next_current_question_id: updateData.current_question_id || null,
      statusWritten: updateData.status || 'in_game',
      winner: updateData.winner || null,
      winner_email: updateData.winner_email || null,
      playersSummary: summarizePlayers(updateData.players),
      updateFields: Object.keys(updateData),
    };

    addGameLog(`DB_WRITE service idx=${debugBase.next_current_player_index} status=${updateData.status || 'in_game'}`);
    debugLog('[useGameActions] online turn update start:', debugBase);

    const attemptUpdate = (retries = 0) => {
      base44.auth.me()
        .catch(() => null)
        .then((actor) => {
          const debugWithActor = {
            ...debugBase,
            actorEmail: actor?.email || null,
            actorName: debugBase.actorName || actor?.full_name || actor?.email || null,
          };

          debugLog('[useGameActions] online turn update payload:', debugWithActor);
          if (updateData.status === 'finished') {
            debugLog('[useGameActions] online game finish payload:', {
              actorEmail: debugWithActor.actorEmail,
              actorName: debugWithActor.actorName,
              winner: updateData.winner || null,
              winner_email: updateData.winner_email || null,
              lobbyId,
              statusWritten: updateData.status,
              playersCount: updateData.players?.length || 0,
              updatePayload: updateData,
            });
          }

          return base44.functions.invoke('updateLobbyGameState', {
            lobbyId,
            ...updateData,
            actorName: debugWithActor.actorName,
            previous_player_index: debugWithActor.current_player_index_before,
            previous_question_id: debugWithActor.current_question_id_before,
          });
        })
        .then((response) => {
          const updatedLobby = response?.data?.lobby;
          addGameLog('DB_WRITE OK service');
          debugLog('[useGameActions] online turn update success:', {
            lobbyId,
            responseDebug: response?.data?.debug || null,
          });
          if (updateData.status === 'finished') {
            debugLog('[useGameActions] online game finish update success:', {
              lobbyId,
              winner: updateData.winner || null,
              winner_email: updateData.winner_email || null,
              statusWritten: updateData.status,
            });
          }

          if (updatedLobby) {
            setLobbyData({ ...updatedLobby });
          }
        })
        .catch((err) => {
          addGameLog(`DB_WRITE ERR service attempt=${retries + 1} ${err.message}`);
          console.error('[useGameActions] online turn update failed:', {
            lobbyId,
            attempt: retries + 1,
            error: err,
            debug: debugBase,
          });
          if (updateData.status === 'finished') {
            console.error('[useGameActions] online game finish update failed:', {
              lobbyId,
              winner: updateData.winner || null,
              winner_email: updateData.winner_email || null,
              statusWritten: updateData.status,
              error: err,
            });
          }

          if (retries < 2) {
            scheduleTimeout(() => attemptUpdate(retries + 1), 1200);
          }
        });
    };

    attemptUpdate();
  }, [lobbyId, scheduleTimeout, setLobbyData]);

  /**
   * Smart question picker:
   * 1. Exclude current-session IDs (never repeat in same game).
   * 2. Exclude recent cross-game history (reduce inter-game repetition).
   * 3. If pool too small after step 2, relax history exclusion.
   * 4. Fisher-Yates shuffle for true randomness.
   * 5. Record chosen ID in persistent history.
   */
  /**
   * Smart question picker:
   * 1. Exclude current-session IDs (never repeat in same game). — hard rule
   * 2. Exclude questions whose year already exists on the active player's timeline. — prefer
   * 3. Exclude recent cross-game history. — prefer
   * Fallback: relax (3) first, then (2), never relax (1).
   */
  const pickQuestion = useCallback((usedIds, questions, usedTimelineYears = new Set()) => {
    // Step 1: hard — no session duplicates
    const sessionFiltered = questions.filter(q => !usedIds.has(q.id));
    if (sessionFiltered.length === 0) return null;

    // Step 2 + 3 combined: exclude duplicate timeline years AND recent history
    const recentHistory = new Set(loadRecentHistory());
    let pool = sessionFiltered.filter(q =>
      !usedTimelineYears.has(q.year) && !recentHistory.has(q.id)
    );

    // Fallback A: relax recent history, keep year-duplicate exclusion
    if (pool.length < 5) {
      pool = sessionFiltered.filter(q => !usedTimelineYears.has(q.year));
    }

    // Fallback B: relax year-duplicate exclusion too only when no safe year remains.
    if (pool.length === 0) {
      pool = sessionFiltered;
    }

    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const chosen = pool[0];
    if (chosen) appendToHistory([chosen.id]);

    addGameLog(`PICK id=${chosen?.id} year=${chosen?.year} pool=${pool.length} session_excluded=${usedIds.size} timeline_years=${usedTimelineYears.size}`);

    return chosen;
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
    scheduleTimeout(() => { isPlacingRef.current = false; }, 500);

    const snapshotPlayer = { ...players[currentPlayerIndex] };
    const snapshotPlayers = [...players];
    const snapshotIndex = currentPlayerIndex;
    const snapshotUsed = new Set([...usedQuestionIds]);

    const allSorted = [...snapshotPlayer.cards].sort((a, b) => a.year - b.year);
    const questionYear = currentQuestion.year;

    // Tüm kartların yılları (stacking yok, her kart ayrı)
    const cardYears = allSorted.map(c => c.year);

    // Doğruluk kontrolü — zone, timeline'daki kart sıralamasına göre
    let isCorrect = false;
    if (zone === 0) {
      isCorrect = cardYears.length === 0 || questionYear <= cardYears[0];
    } else if (zone === cardYears.length) {
      isCorrect = questionYear >= cardYears[cardYears.length - 1];
    } else {
      isCorrect = questionYear >= cardYears[zone - 1] && questionYear <= cardYears[zone];
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
    const nextPlayerCards = newPlayers[nextIndex]?.cards || [];
    const nextTimelineYears = new Set(nextPlayerCards.map(c => c.year));
    const nextQ = !hasWon ? pickQuestion(newUsed, questionPool, nextTimelineYears) : null;
    if (nextQ) newUsed.add(nextQ.id);

    // Tek atomik state güncellemesi
    setLobbyData(prev => ({
      ...prev,
      players: newPlayers,
      current_player_index: hasWon ? snapshotIndex : nextIndex,
      current_question_id: hasWon ? prev.current_question_id : (nextQ?.id || prev.current_question_id),
      used_question_ids: [...newUsed],
      ...(hasWon ? { status: 'finished', winner: newPlayers[snapshotIndex].name, winner_email: newPlayers[snapshotIndex].email || null } : {})
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
        current_player_index: hasWon ? snapshotIndex : nextIndex,
        current_question_id: hasWon ? (lobbyData?.current_question_id || currentQuestion.id) : (nextQ?.id || lobbyData?.current_question_id),
        ...(hasWon ? { winner: newPlayers[snapshotIndex].name, winner_email: newPlayers[snapshotIndex].email || null } : {})
      };
      writeOnlineLobbyState(updateData, {
        actorName: snapshotPlayer.name,
        currentPlayerIndexBefore: snapshotIndex,
        currentQuestionIdBefore: currentQuestion.id,
      });
    }

    if (hasWon) {
      setFeedback({ result: 'correct', year: questionYear, songTitle: currentQuestion.type === 'muzik' ? currentQuestion.question : null, guessedYear: null });
      setGameStarted(false);
      const finalSecs = overallSecondsRef.current;
      saveGameRecord(newPlayers[snapshotIndex].name, finalSecs, { category, yearStart, yearEnd });
      scheduleTimeout(() => {
        setFeedback(null);
        setWinner({ name: newPlayers[snapshotIndex].name, email: newPlayers[snapshotIndex].email || null, durationSeconds: finalSecs });
      }, 2200);
      return;
    }

    // For wrong: estimate guessed year from zone position
    let guessedYear = null;
    if (!isCorrect) {
      if (zone === 0 && cardYears.length > 0) guessedYear = cardYears[0] - 5;
      else if (zone === cardYears.length && cardYears.length > 0) guessedYear = cardYears[cardYears.length - 1] + 5;
      else if (zone > 0 && zone <= cardYears.length) guessedYear = Math.round((cardYears[zone - 1] + (cardYears[zone] ?? cardYears[zone - 1] + 10)) / 2);
    }

    setFeedback({ result: isCorrect ? 'correct' : 'wrong', year: questionYear, songTitle: currentQuestion.type === 'muzik' ? currentQuestion.question : null, guessedYear });
    setTimerKey(k => k + 1);
  }, [
    currentQuestion, players, currentPlayerIndex, usedQuestionIds,
    questionPool, winCardCount, lobbyId, isPlacingRef, overallSecondsRef,
    pickQuestion, saveGameRecord, scheduleTimeout,
    writeOnlineLobbyState,
    setLobbyData, setFeedback, setWinner, setSelectedZone, setTimerKey, setGameStarted
  ]);

  // Tur atlama (timer doldu)
  const advanceTurn = useCallback((winner) => {
    if (!lobbyData || players.length === 0 || winner) return;
    const currentIndex = lobbyData.current_player_index ?? 0;
    const nextIndex = (currentIndex + 1) % players.length;
    const currentUsed = new Set(lobbyData.used_question_ids || []);
    const nextPlayerCards = players[nextIndex]?.cards || [];
    const nextTimelineYears = new Set(nextPlayerCards.map(c => c.year));
    const nextQ = pickQuestion(currentUsed, questionPool, nextTimelineYears);
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
      writeOnlineLobbyState({
        players: players.map(p => ({
          email: p.email || `player_${p.name}`,
          name: p.name,
          ready: true,
          cards: p.cards || []
        })),
        current_player_index: nextIndex,
        current_question_id: nextQ?.id || lobbyData.current_question_id,
        used_question_ids: [...currentUsed],
        status: lobbyData.status || 'in_game',
      }, {
        actorName: players[currentIndex]?.name,
        currentPlayerIndexBefore: currentIndex,
        currentQuestionIdBefore: lobbyData.current_question_id,
      });
    }
  }, [lobbyData, players, pickQuestion, lobbyId, questionPool, writeOnlineLobbyState, setSelectedZone, setTimerKey, setLobbyData]);

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
