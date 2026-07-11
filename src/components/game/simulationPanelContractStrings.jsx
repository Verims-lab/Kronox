// Health source registry for backend functions/entities that live outside src.
// Vite raw imports are the evidence source; no hand-written contract mirrors.

import friendshipEntitySource from '../../../base44/entities/Friendship.jsonc?raw';
import friendRequestEntitySource from '../../../base44/entities/FriendRequest.jsonc?raw';
import friendRequestOperationLockEntitySource from '../../../base44/entities/FriendRequestOperationLock.jsonc?raw';
import gameInviteEntitySource from '../../../base44/entities/GameInvite.jsonc?raw';
import pushSubscriptionEntitySource from '../../../base44/entities/PushSubscription.jsonc?raw';
import playerPresenceEntitySource from '../../../base44/entities/PlayerPresence.jsonc?raw';
import userEntitySource from '../../../base44/entities/User.jsonc?raw';
import diamondTransactionEntitySource from '../../../base44/entities/DiamondTransaction.jsonc?raw';
import lobbyEntitySource from '../../../base44/entities/Lobby.jsonc?raw';
import onlineMatchResultEntitySource from '../../../base44/entities/OnlineMatchResult.jsonc?raw';
import categoryEntitySource from '../../../base44/entities/Category.jsonc?raw';

import sendFriendRequestFnSource from '../../../base44/functions/sendFriendRequest/entry.ts?raw';
import updatePlayerPresenceFnSource from '../../../base44/functions/updatePlayerPresence/entry.ts?raw';
import getOnlinePlayerSelectionFnSource from '../../../base44/functions/getOnlinePlayerSelection/entry.ts?raw';
import createGameInvitesForTargetsFnSource from '../../../base44/functions/createGameInvitesForTargets/entry.ts?raw';
import acceptGameInviteFnSource from '../../../base44/functions/acceptGameInvite/entry.ts?raw';
import sendGameInvitePushFnSource from '../../../base44/functions/sendGameInvitePush/entry.ts?raw';
import acceptFriendRequestFnSource from '../../../base44/functions/acceptFriendRequest/entry.ts?raw';
import removeFriendFnSource from '../../../base44/functions/removeFriend/entry.ts?raw';
import findLobbyByCodeFnSource from '../../../base44/functions/findLobbyByCode/entry.ts?raw';
import startLobbyGameFnSource from '../../../base44/functions/startLobbyGame/entry.ts?raw';
import getSoloLeaderboardFnSource from '../../../base44/functions/getSoloLeaderboard/entry.ts?raw';
import kronoxServiceWorkerSource from '../../../public/kronox-sw.js?raw';

export {
  friendshipEntitySource,
  friendRequestEntitySource,
  friendRequestOperationLockEntitySource,
  gameInviteEntitySource,
  pushSubscriptionEntitySource,
  playerPresenceEntitySource,
  userEntitySource,
  diamondTransactionEntitySource,
  lobbyEntitySource,
  onlineMatchResultEntitySource,
  sendFriendRequestFnSource,
  updatePlayerPresenceFnSource,
  getOnlinePlayerSelectionFnSource,
  createGameInvitesForTargetsFnSource,
  acceptGameInviteFnSource,
  sendGameInvitePushFnSource,
  acceptFriendRequestFnSource,
  removeFriendFnSource,
  findLobbyByCodeFnSource,
  startLobbyGameFnSource,
  getSoloLeaderboardFnSource,
  kronoxServiceWorkerSource,
};

// Compatibility names retained for existing Health imports. Their old
// standalone functions were consolidated into these active owners.
export const getFriendPresenceFnSource = getOnlinePlayerSelectionFnSource;
export const sendFriendRequestEmailFnSource = sendFriendRequestFnSource;
export const sendFriendRequestEmailFnSourceFull = sendFriendRequestFnSource;

export const categoryEntitySchema = JSON.parse(categoryEntitySource);
