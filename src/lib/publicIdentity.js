import { normalizeSafePublicUsernameInput, resolveSafePublicUsername } from '@/lib/guestProfile';

export function getSafePublicUsernameLabel(candidates, fallbackSeed = '') {
  const values = Array.isArray(candidates) ? candidates : [candidates];
  for (const value of values) {
    const safe = normalizeSafePublicUsernameInput(value);
    if (safe) return safe;
  }
  return resolveSafePublicUsername('', fallbackSeed);
}

export function getSafeFriendDisplayName(friend) {
  if (!friend || typeof friend !== 'object') return getSafePublicUsernameLabel('', '');
  return getSafePublicUsernameLabel(
    [
      friend.friend_username,
      friend.public_username,
      friend.username,
      friend.friend_name,
    ],
    friend.friend_email || friend.id || friend.request_id || '',
  );
}

export function getSafeRequestTargetName(request) {
  if (!request || typeof request !== 'object') return getSafePublicUsernameLabel('', '');
  return getSafePublicUsernameLabel(
    [
      request.to_username,
      request.to_name,
      request.username,
    ],
    request.to_email || request.id || '',
  );
}
