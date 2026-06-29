import { base44 } from '@/api/base44Client';
import { getStoredGuestCredentials } from './guestProfile';

export const KRONOX_USER_ID_FIELD = 'kronox_user_id';
export const KRONOX_USER_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

export function normalizeKronoxUserId(value) {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_USER_ID_PATTERN.test(text) ? text : '';
}

export function getKronoxUserId(profile) {
  return normalizeKronoxUserId(profile?.[KRONOX_USER_ID_FIELD]);
}

function unwrapFunctionResponse(response) {
  if (response?.data?.data && typeof response.data.data === 'object') return response.data.data;
  if (response?.data && typeof response.data === 'object') return response.data;
  if (response && typeof response === 'object') return response;
  return {};
}

export async function ensureKronoxUserIdForCurrentActor() {
  const credentials = getStoredGuestCredentials();
  const response = await base44.functions.invoke('ensureKronoxUserId', {
    ...(credentials.guest_id && credentials.guest_token ? credentials : {}),
  });
  const data = unwrapFunctionResponse(response);
  if (data?.ok === false) {
    const error = new Error(data.code || data.error || 'kronox_user_id_ensure_failed');
    error.code = data.code || data.error || 'kronox_user_id_ensure_failed';
    throw error;
  }
  return data;
}
