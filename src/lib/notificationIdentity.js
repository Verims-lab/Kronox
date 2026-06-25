import { normalizeSafePublicUsernameInput } from '@/lib/guestProfile';

export const GENERIC_NOTIFICATION_FRIEND_LABEL = 'Bir arkadaşın';
export const GENERIC_NOTIFICATION_USER_LABEL = 'Bir kullanıcı';

export function getSafeNotificationActorName(candidates, fallback = GENERIC_NOTIFICATION_FRIEND_LABEL) {
  const values = Array.isArray(candidates) ? candidates : [candidates];
  for (const value of values) {
    const safe = normalizeSafePublicUsernameInput(value);
    if (safe) return safe;
  }
  return fallback;
}
