import { base44 } from '@/api/base44Client';
import { isLobbyStale, LOBBY_STALE_AFTER_MS } from '@/lib/inviteApi';

export { isLobbyStale, LOBBY_STALE_AFTER_MS };

export async function findLobbyByCode(code) {
  return base44.functions.invoke('findLobbyByCode', { code });
}

export async function startLobbyGame(lobbyId) {
  return base44.functions.invoke('startLobbyGame', { lobbyId });
}

export async function updateLobbyGameState(payload) {
  return base44.functions.invoke('updateLobbyGameState', payload);
}

export const lobbyGatewayContract = Object.freeze({
  authority: 'Lobby entity',
  startFunction: 'startLobbyGame',
  requiresAuthenticatedHost: true,
  cleanupJob: 'cancelStaleLobbies',
});
