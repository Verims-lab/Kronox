import { base44 } from '@/api/base44Client';

export const PRESENCE_ONLINE_TTL_MS = 75 * 1000;
export const PRESENCE_HEARTBEAT_MS = 25 * 1000;
export const PRESENCE_REFRESH_MS = 12 * 1000;
export const PRESENCE_STATUS = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown',
});

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function getPresenceLookupKeyForEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return '';
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function readTimestampMs(value) {
  if (!value) return NaN;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : NaN;
}

export function isPresenceOnline(presence, nowMs = Date.now()) {
  if (!presence || presence.status !== PRESENCE_STATUS.ONLINE) return false;
  const expiresAt = readTimestampMs(presence.presence_expires_at || presence.expires_at);
  if (Number.isFinite(expiresAt)) return expiresAt > nowMs;
  const lastSeenAt = readTimestampMs(presence.last_heartbeat_at || presence.last_seen_at);
  return Number.isFinite(lastSeenAt) && lastSeenAt + PRESENCE_ONLINE_TTL_MS > nowMs;
}

export function getFriendDisplayPresence(friend, presenceByKey = {}, nowMs = Date.now()) {
  const presenceKey = friend?.presence_key || getPresenceLookupKeyForEmail(friend?.friend_email);
  const presence = presenceKey ? presenceByKey[presenceKey] : null;
  const online = isPresenceOnline(presence, nowMs);
  return {
    presenceKey,
    online,
    status: online ? PRESENCE_STATUS.ONLINE : PRESENCE_STATUS.OFFLINE,
    label: online ? 'Çevrimiçi' : 'Çevrim dışı',
    lastSeenAt: presence?.last_heartbeat_at || presence?.last_seen_at || null,
  };
}

export async function loadFriendPresence(friends) {
  const friendEmails = Array.from(new Set(
    (Array.isArray(friends) ? friends : [])
      .map((friend) => normalizeEmail(friend?.friend_email))
      .filter(Boolean),
  ));
  if (!friendEmails.length) return {};

  const response = await base44.functions.invoke('getFriendPresence', {
    friend_emails: friendEmails,
  });
  const rows = Array.isArray(response?.data?.presence) ? response.data.presence : [];
  return Object.fromEntries(
    rows
      .filter((row) => row?.presence_key)
      .map((row) => [row.presence_key, row]),
  );
}

export async function sendPresenceHeartbeat({
  sessionId,
  status = PRESENCE_STATUS.ONLINE,
  guestCredentials = null,
} = {}) {
  const normalizedStatus = status === PRESENCE_STATUS.OFFLINE
    ? PRESENCE_STATUS.OFFLINE
    : PRESENCE_STATUS.ONLINE;
  const payload = {
    session_id: sessionId,
    status: normalizedStatus,
  };
  if (guestCredentials?.guest_id && guestCredentials?.guest_token) {
    payload.player_type = 'guest';
    payload.guest_id = guestCredentials.guest_id;
    payload.guest_token = guestCredentials.guest_token;
  }
  const response = await base44.functions.invoke('updatePlayerPresence', payload);
  return response?.data || null;
}
