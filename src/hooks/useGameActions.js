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
import { getLobbyStateRevision } from '@/lib/lobbyState';
import { summarizePlayers } from '@/lib/lobbyUtils';
import {
  getNextPlayerIndex,
  getQuestionSelectionPool,
  getTimelineYears,
  hasPlayerWon,
  isCorrectPlacement,
  selectNextQuestion,
} from '@/lib/gameRules';

const isStaleWriteError = (err) =>
  err?.code === 'stale_write' || /stale|guncel/i.test(err?.message || '');

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
  orderedQuestionPicker = null,
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

    const expectedRevision = context.stateRevisionBefore ?? 0;
    const debugBase = {
      action: updateData.action || 'advance_turn',
      actorName: context.actorName || null,
      lobbyId,
      expected_state_revision: expectedRevision,
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

    addGameLog(`DB_WRITE service action=${debugBase.action} idx=${debugBase.next_current_player_index} status=${updateData.status || 'in_game'}`);
    debugLog('[useGameActions] online turn update start:', debugBase);

    const recoverLatestLobbyState = () => {
      isPlacingRef.current = false;
      return base44.entities.Lobby.get(lobbyId)
        .then((freshLobby) => {
          if (freshLobby) {
            setLobbyData({ ...freshLobby });
            addGameLog('DB_WRITE recovery fetched latest lobby');
            debugLog('[useGameActions] recovered latest lobby after rejected update:', {
              lobbyId,
              status: freshLobby.status,
              state_revision: freshLobby.state_revision ?? 0,
              current_player_index: freshLobby.current_player_index,
              current_question_id: freshLobby.current_question_id || null,
            });
          }
        })
        .catch((refreshErr) => {
          addGameLog(`DB_WRITE recovery failed ${refreshErr.message}`);
          console.error('[useGameActions] online recovery fetch failed:', {
            lobbyId,
            error: refreshErr,
          });
        });
    };

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
            expected_state_revision: expectedRevision,
            actorName: debugWithActor.actorName,
            previous_player_index: debugWithActor.current_player_index_before,
            previous_question_id: debugWithActor.current_question_id_before,
          });
        })
        .then((response) => {
          if (!response?.data?.success || response?.data?.error) {
            const serviceError = new Error(response?.data?.error || 'Online oyun durumu reddedildi.');
            serviceError.code = response?.data?.code || null;
            serviceError.debug = response?.data?.debug || null;
            throw serviceError;
          }
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
          const staleWrite = isStaleWriteError(err);
          addGameLog(`DB_WRITE ERR service attempt=${retries + 1} ${err.message}`);
          console.error('[useGameActions] online turn update failed:', {
            lobbyId,
            attempt: retries + 1,
            staleWrite,
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

          if (staleWrite) {
            addGameLog('DB_WRITE stale; fetching latest lobby');
            recoverLatestLobbyState();
            return;
          }

          if (retries < 2) {
            scheduleTimeout(() => attemptUpdate(retries + 1), 1200);
          } else {
            recoverLatestLobbyState();
          }
        });
    };

    attemptUpdate();
  }, [lobbyId, isPlacingRef, scheduleTimeout, setLobbyData]);

  /**
   * Smart question picker:
   * 1. Exclude current-session IDs (never repeat in same game). — hard rule
   * 2. Exclude questions whose year already exists on the active player's timeline. — prefer
   * 3. Exclude recent cross-game history. — prefer
   * Fallback: relax (3) first, then (2), never relax (1).
   */
  const pickQuestion = useCallback((usedIds, questions, usedTimelineYears = new Set()) => {
    if (typeof orderedQuestionPicker === 'function') {
      const chosen = orderedQuestionPicker(usedIds, questions, usedTimelineYears);
      addGameLog(`PICK_ORDERED id=${chosen?.id} year=${chosen?.year} session_excluded=${usedIds.size} timeline_years=${usedTimelineYears.size}`);
      return chosen;
    }

    const recentHistory = new Set(loadRecentHistory());
    const pool = getQuestionSelectionPool(questions, usedIds, usedTimelineYears, {
      recentQuestionIds: recentHistory,
    });
    const chosen = selectNextQuestion(questions, usedIds, usedTimelineYears, {
      recentQuestionIds: recentHistory,
    });
    if (chosen) appendToHistory([chosen.id]);

    addGameLog(`PICK id=${chosen?.id} year=${chosen?.year} pool=${pool.length} session_excluded=${usedIds.size} timeline_years=${usedTimelineYears.size}`);

    return chosen;
  }, [orderedQuestionPicker]);

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

    const stateRevisionBefore = getLobbyStateRevision(lobbyData);
    const snapshotPlayer = { ...players[currentPlayerIndex] };
    const snapshotPlayers = [...players];
    const snapshotIndex = currentPlayerIndex;
    const snapshotUsed = new Set([...usedQuestionIds]);

    const questionYear = currentQuestion.year;

    const isCorrect = isCorrectPlacement(snapshotPlayer.cards, questionYear, zone);

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

    const hasWon = isCorrect && hasPlayerWon(newPlayers[snapshotIndex], winCardCount);

    addGameLog(`PLACE correct=${isCorrect} zone=${zone} year=${questionYear} player=${snapshotPlayer.name} cards=${newPlayers[snapshotIndex]?.cards?.length} hasWon=${hasWon}`);

    const nextIndex = getNextPlayerIndex(snapshotIndex, snapshotPlayers.length);
    const nextPlayerCards = newPlayers[nextIndex]?.cards || [];
    const nextTimelineYears = getTimelineYears(nextPlayerCards);
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
        action: 'place_card',
        players: lobbyPlayers,
        used_question_ids: [...newUsed],
        status: hasWon ? 'finished' : 'in_game',
        current_player_index: hasWon ? snapshotIndex : nextIndex,
        current_question_id: hasWon ? (lobbyData?.current_question_id || currentQuestion.id) : (nextQ?.id || lobbyData?.current_question_id),
        ...(hasWon ? { winner: newPlayers[snapshotIndex].name, winner_email: newPlayers[snapshotIndex].email || null } : {})
      };
      writeOnlineLobbyState(updateData, {
        actorName: snapshotPlayer.name,
        stateRevisionBefore,
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
      const cardYears = [...snapshotPlayer.cards].sort((a, b) => a.year - b.year).map(c => c.year);
      if (zone === 0 && cardYears.length > 0) guessedYear = cardYears[0] - 5;
      else if (zone === cardYears.length && cardYears.length > 0) guessedYear = cardYears[cardYears.length - 1] + 5;
      else if (zone > 0 && zone <= cardYears.length) guessedYear = Math.round((cardYears[zone - 1] + (cardYears[zone] ?? cardYears[zone - 1] + 10)) / 2);
    }

    setFeedback({ result: isCorrect ? 'correct' : 'wrong', year: questionYear, songTitle: currentQuestion.type === 'muzik' ? currentQuestion.question : null, guessedYear });
    setTimerKey(k => k + 1);
  }, [
    currentQuestion, players, currentPlayerIndex, usedQuestionIds,
    questionPool, winCardCount, lobbyId, lobbyData, isPlacingRef, overallSecondsRef,
    pickQuestion, saveGameRecord, scheduleTimeout,
    writeOnlineLobbyState,
    setLobbyData, setFeedback, setWinner, setSelectedZone, setTimerKey, setGameStarted
  ]);

  // Tur atlama (timer doldu)
  const advanceTurn = useCallback((winner) => {
    if (!lobbyData || players.length === 0 || winner) return;
    const currentIndex = lobbyData.current_player_index ?? 0;
    const nextIndex = getNextPlayerIndex(currentIndex, players.length);
    const currentUsed = new Set(lobbyData.used_question_ids || []);
    const nextPlayerCards = players[nextIndex]?.cards || [];
    const nextTimelineYears = getTimelineYears(nextPlayerCards);
    const nextQ = pickQuestion(currentUsed, questionPool, nextTimelineYears);
    if (nextQ) currentUsed.add(nextQ.id);
    const stateRevisionBefore = getLobbyStateRevision(lobbyData);

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
        action: 'advance_turn',
        players: players.map(p => ({
          email: p.email || `player_${p.name}`,
          name: p.name,
          ready: true,
          cards: p.cards || []
        })),
        current_player_index: nextIndex,
        current_question_id: nextQ?.id || lobbyData.current_question_id,
        used_question_ids: [...currentUsed],
        status: 'in_game',
      }, {
        actorName: players[currentIndex]?.name,
        stateRevisionBefore,
        currentPlayerIndexBefore: currentIndex,
        currentQuestionIdBefore: lobbyData.current_question_id,
      });
    }
  }, [lobbyData, players, pickQuestion, lobbyId, questionPool, writeOnlineLobbyState, setSelectedZone, setTimerKey, setLobbyData]);

  // Yüklenemeyen soruyu atla
  const skipCurrentQuestion = useCallback((currentQuestionId) => {
    const newUsed = new Set([...usedQuestionIds, currentQuestionId].filter(Boolean));
    const nextQ = pickQuestion(newUsed, questionPool);
    if (!nextQ) return;

    const finalUsed = new Set([...newUsed, nextQ.id]);
    const finalUsedIds = [...finalUsed];
    const stateRevisionBefore = getLobbyStateRevision(lobbyData);
    const currentIndex = lobbyData?.current_player_index ?? currentPlayerIndex ?? 0;

    setLobbyData(prev => ({
      ...prev,
      current_question_id: nextQ.id,
      used_question_ids: finalUsedIds
    }));

    if (lobbyId) {
      writeOnlineLobbyState({
        action: 'skip_question',
        players: players.map(p => ({
          email: p.email || `player_${p.name}`,
          name: p.name,
          ready: true,
          cards: p.cards || []
        })),
        current_player_index: currentIndex,
        current_question_id: nextQ.id,
        used_question_ids: finalUsedIds,
        status: 'in_game',
      }, {
        actorName: players[currentIndex]?.name,
        stateRevisionBefore,
        currentPlayerIndexBefore: currentIndex,
        currentQuestionIdBefore: currentQuestionId,
      });
    }
  }, [usedQuestionIds, pickQuestion, questionPool, setLobbyData, lobbyData, currentPlayerIndex, lobbyId, players, writeOnlineLobbyState]);

  return { pickQuestion, doPlacement, advanceTurn, skipCurrentQuestion, saveGameRecord };
}
