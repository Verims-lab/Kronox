export {
  GAME_INVITE_TTL_MS,
  createGameInvites,
  filterActiveIncomingGameInvites,
  getGameInviteActiveFilterReason,
  getGameInviteExpiresAt,
  getInviteRemainingMs,
  isActiveIncomingGameInvite,
  isGameInviteExpired,
  loadIncomingInviteSnapshot,
  loadIncomingInvites,
  loadOutgoingInvitesForLobby,
  mergeActiveIncomingGameInvites,
  openGameInvite,
  rejectGameInvite,
} from '@/lib/inviteApi';

export const inviteGatewayContract = Object.freeze({
  actionableSource: 'GameInvite rows',
  visualDismissalMutatesInvite: false,
  ttlMs: 10 * 60 * 1000,
  cleanupJob: 'expireOldGameInvites',
});
