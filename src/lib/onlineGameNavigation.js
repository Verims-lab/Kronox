export function buildOnlineGamePath(lobby) {
  const params = new URLSearchParams();
  params.set('online', '1');
  if (lobby?.id) params.set('lobbyId', lobby.id);
  if (lobby?.code) params.set('lobbyCode', lobby.code);
  return `/game?${params.toString()}`;
}

export function buildOnlineGameState(lobby, { currentUser, playerName } = {}) {
  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  const matchedPlayer = players.find((player) => player?.is_self)
    || players.find((player) => player?.name === playerName)
    || (currentUser ? players.find((player) => player?.is_host && lobby?.current_actor_is_host) : null);

  return {
    lobbyId: lobby?.id || null,
    lobbyCode: lobby?.code || null,
    online: true,
    initialPlayers: players,
    currentQuestionId: lobby?.current_question_id || null,
    category: lobby?.category || 'karisik',
    yearStart: lobby?.year_start ?? 0,
    yearEnd: lobby?.year_end ?? new Date().getFullYear(),
    turnDuration: lobby?.turn_duration ?? 60,
    winCardCount: lobby?.win_card_count ?? 10,
    onlineQuestionDeck: Array.isArray(lobby?.online_question_deck) ? lobby.online_question_deck : [],
    onlineDeckMeta: lobby?.online_deck_meta || null,
    myPlayerName: matchedPlayer?.name || playerName || null,
    myParticipantRef: matchedPlayer?.participant_ref || null,
  };
}

export function navigateToOnlineGame(navigate, lobby, options = {}) {
  if (!lobby?.id && !lobby?.code) return false;
  navigate(buildOnlineGamePath(lobby), {
    state: buildOnlineGameState(lobby, options),
  });
  return true;
}
