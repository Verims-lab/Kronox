import { base44 } from '@/api/base44Client';
import { getStoredGuestCredentials } from '@/lib/guestProfile';

// Codex591 — Thin client wrapper around the randomMatchmaking backend
// function (RASTGELE EŞLEŞ). Guest credentials are attached the same way
// lobbyGateway does; linked users are authenticated via the request itself.

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
  if (data?.error) throw new Error(data.error);
  return data;
}

export const joinRandomMatchmaking = () => invoke('join');
export const pollRandomMatchmaking = () => invoke('poll');
export const cancelRandomMatchmaking = () => invoke('cancel');