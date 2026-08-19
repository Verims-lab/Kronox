import React from 'react';
import PreGameHourglass from '@/components/lobby/PreGameHourglass';
import useDirectOnlineGameHandoff from '@/hooks/useDirectOnlineGameHandoff';
import { SAME_QUESTION_DUEL_MODE } from '@/lib/onlineModeDisplay';
import { consumeRandomMatchmaking } from '@/lib/randomMatchmakingApi';

export default function DirectOnlineMatchScreen({ match, onGameReady, onBack }) {
  const isDuello = match?.queueMode === SAME_QUESTION_DUEL_MODE
    || match?.initialLobby?.game_mode === SAME_QUESTION_DUEL_MODE;
  const handoff = useDirectOnlineGameHandoff({
    active: Boolean(match?.lobbyRef),
    lobbyRef: match?.lobbyRef,
    initialLobby: match?.initialLobby,
    queueMode: match?.queueMode,
    onGameReady,
  });

  const handleBack = async () => {
    if (match?.queueMode) await consumeRandomMatchmaking(match.queueMode).catch(() => null);
    onBack?.();
  };

  return (
    <div
      data-direct-game-handoff="backend-authoritative"
      data-online-mode={isDuello ? SAME_QUESTION_DUEL_MODE : 'random_online'}
    >
      <PreGameHourglass
        testId={isDuello ? 'duello-match-found-screen' : 'online-match-found-screen'}
        title="Rakip bulundu"
        subtitle={handoff.phase === 'error' ? 'Lütfen tekrar dene.' : 'Oyun başlıyor'}
        phase={handoff.phase}
        errorMessage={handoff.errorMessage}
        onRetry={handoff.retry}
        onCancel={handoff.phase === 'error' ? handleBack : undefined}
      />
    </div>
  );
}
