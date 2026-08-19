import { base44 } from '@/api/base44Client';
import { getStoredGuestCredentials } from '@/lib/guestProfile';
import {
  normalizeOnlineMatchmakingMode,
  STANDARD_RANDOM_MODE,
} from '@/lib/onlineModeDisplay';

// Thin client wrapper around the Online Kapış / Duello matchmaking backend.
// Guest credentials are attached the same way lobbyGateway does; linked users
// are authenticated via the request itself.

function withActorProof(payload = {}) {
  const guest = getStoredGuestCredentials();
  return {
    ...payload,
    ...(guest?.guest_id && guest?.guest_token ? {
      guest_id: guest.guest_id,
      guest_token: guest.guest_token,
    } : {}),
  };
}

async function invoke(action, extra = {}) {
  const res = await base44.functions.invoke('randomMatchmaking', withActorProof({ action, ...extra }));
  const data = res?.data || res || {};
  if (data?.error) throw new Error('matchmaking_request_failed');
  return data;
}

export const joinRandomMatchmaking = (mode = STANDARD_RANDOM_MODE) => invoke('join', {
  mode: normalizeOnlineMatchmakingMode(mode),
});
export const pollRandomMatchmaking = (mode = STANDARD_RANDOM_MODE) => invoke('poll', {
  mode: normalizeOnlineMatchmakingMode(mode),
});
export const cancelRandomMatchmaking = (mode = STANDARD_RANDOM_MODE) => invoke('cancel', {
  mode: normalizeOnlineMatchmakingMode(mode),
});
export const consumeRandomMatchmaking = (mode = STANDARD_RANDOM_MODE) => invoke('consume', {
  mode: normalizeOnlineMatchmakingMode(mode),
});
