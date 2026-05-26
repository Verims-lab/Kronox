export function buildOnlineGamePath(lobby) {
  const params = new URLSearchParams();
  params.set('online', '1');
  if (lobby?.id) params.set('lobbyId', lobby.id);
  if (lobby?.code) params.set('lobbyCode', lobby.code);
  return `/game?${params.toString()}`;
}

export function buildOnlineGameState(lobby, { currentUser, playerName } = {}) {
  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  const email = currentUser?.email || null;
  const matchedPlayer = email
    ? players.find((player) => player?.email === email)
    : players.find((player) => player?.name === playerName);

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
    myPlayerName: matchedPlayer?.name || playerName || null,
  };
}

export function navigateToOnlineGame(navigate, lobby, options = {}) {
  if (!lobby?.id && !lobby?.code) return false;
  navigate(buildOnlineGamePath(lobby), {
    state: buildOnlineGameState(lobby, options),
  });
  return true;
}
