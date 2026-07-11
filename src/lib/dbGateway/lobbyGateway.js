import { base44 } from '@/api/base44Client';
import { isLobbyStale, LOBBY_STALE_AFTER_MS } from '@/lib/inviteApi';
import { getStoredGuestCredentials } from '@/lib/guestProfile';

export { isLobbyStale, LOBBY_STALE_AFTER_MS };

function withActorProof(payload = {}) {
  const guest = getStoredGuestCredentials();
  return {
    ...payload,
    ...(guest?.guest_id && guest?.guest_token ? {
      player_type: 'guest',
      guest_id: guest.guest_id,
      guest_token: guest.guest_token,
    } : {}),
  };
}

async function invokeLobbyMutation(action, payload = {}) {
  return base44.functions.invoke('findLobbyByCode', withActorProof({ action, ...payload }));
}

export async function findLobbyByCode(code) {
  return invokeLobbyMutation('lookup', { code });
}

export async function createLobby(payload) {
  return invokeLobbyMutation('create', payload);
}

export async function joinLobbyByCode(code, playerName) {
  return invokeLobbyMutation('join', { code, playerName });
}

export async function getLobbySnapshot({ lobbyId, code } = {}) {
  return invokeLobbyMutation('get', { lobbyId, code });
}

export async function findActiveLobby() {
  return invokeLobbyMutation('find_active');
}

export async function leaveLobby(lobbyId) {
  return invokeLobbyMutation('leave', { lobbyId });
}

export async function startLobbyGame(lobbyId, expectedRevision = null) {
  return base44.functions.invoke('startLobbyGame', withActorProof({
    lobbyId,
    ...(expectedRevision === null ? {} : { expected_state_revision: expectedRevision }),
  }));
}

export async function updateLobbyGameState(payload) {
  return base44.functions.invoke('updateLobbyGameState', withActorProof(payload));
}

export async function commitOnlineMatchResult(payload) {
  return updateLobbyGameState({ action: 'commit_result', ...payload });
}

export const lobbyGatewayContract = Object.freeze({
  authority: 'backend-owned Lobby functions',
  actorProof: 'authenticated user or token-proven GuestProfile',
  publicSnapshot: 'personalized privacy-safe lobby DTO',
  startFunction: 'startLobbyGame',
  resultFunction: 'updateLobbyGameState:commit_result',
  requiresAuthenticatedHost: false,
  cleanupJob: 'cancelStaleLobbies',
});
