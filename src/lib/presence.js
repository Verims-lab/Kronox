import { base44 } from '@/api/base44Client';
import { pickPublicAvatarFields } from '@/lib/avatarOptions';
import { loadSocialSnapshot } from '@/lib/onlinePlayerSelection';

export const PRESENCE_ONLINE_TTL_MS = 75 * 1000;
export const PRESENCE_HEARTBEAT_MS = 25 * 1000;
export const PRESENCE_REFRESH_MS = 12 * 1000;
export const PRESENCE_STATUS = Object.freeze({
  ONLINE: 'online',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown',
});

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
  const presenceKey = friend?.presence_ref || friend?.presence_key || friend?.target_ref || '';
  const presence = presenceKey ? presenceByKey[presenceKey] : null;
  const online = isPresenceOnline(presence, nowMs);
  return {
    presenceKey,
    online,
    status: online ? PRESENCE_STATUS.ONLINE : PRESENCE_STATUS.OFFLINE,
    label: online ? 'Çevrimiçi' : 'Çevrim dışı',
    lastSeenAt: presence?.last_heartbeat_at || presence?.last_seen_at || null,
    ...pickPublicAvatarFields(presence?.avatar_type ? presence : friend),
  };
}

export async function loadFriendPresence(friends) {
  const targetRefs = Array.from(new Set(
    (Array.isArray(friends) ? friends : [])
      .map((friend) => String(friend?.target_ref || friend?.presence_ref || '').trim())
      .filter(Boolean),
  ));
  if (!targetRefs.length) return {};

  const snapshot = await loadSocialSnapshot();
  const rows = Array.isArray(snapshot?.friends) ? snapshot.friends : [];
  const requestedRefs = new Set(targetRefs);
  return Object.fromEntries(
    rows
      .filter((row) => row?.presence_ref && requestedRefs.has(row.presence_ref))
      .map((row) => [row.presence_ref, {
        presence_ref: row.presence_ref,
        status: row.status,
        last_seen_at: row.last_seen_at || null,
        ...pickPublicAvatarFields(row),
      }]),
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
