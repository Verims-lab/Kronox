import { base44 } from '@/api/base44Client';
import { pickPublicAvatarFields } from '@/lib/avatarOptions';

export const ONLINE_PLAYER_SELECTION_GROUPS = Object.freeze({
  ONLINE_FRIEND: 'online_friend',
  ONLINE_NON_FRIEND: 'online_non_friend',
  OFFLINE_FRIEND: 'offline_friend',
});

export const ONLINE_PLAYER_SELECTION_ORDER = Object.freeze([
  ONLINE_PLAYER_SELECTION_GROUPS.ONLINE_FRIEND,
  ONLINE_PLAYER_SELECTION_GROUPS.ONLINE_NON_FRIEND,
  ONLINE_PLAYER_SELECTION_GROUPS.OFFLINE_FRIEND,
]);

const GROUP_RANK = Object.freeze(Object.fromEntries(
  ONLINE_PLAYER_SELECTION_ORDER.map((group, index) => [group, index]),
));

const SAFE_USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;
const TARGET_REF_PATTERN = /^u_[a-z0-9]{3,32}$/;

export function normalizeInviteTargetRef(value) {
  const ref = String(value || '').trim();
  return TARGET_REF_PATTERN.test(ref) ? ref : '';
}

export function isSafeOnlineSelectionUsername(value) {
  const username = String(value || '').trim();
  return Boolean(
    username
      && SAFE_USERNAME_PATTERN.test(username)
      && !username.includes('@')
      && !/^(apple|google|firebase|auth0|base44|provider|uid|owner)(?:[\w:-].*)?$/i.test(username)
      && !/^(guest|player|owner|user_key|player_key|g|u)_[A-Za-z0-9_-]{4,}$/i.test(username)
  );
}

function makeFallbackUsername(seed) {
  const text = String(seed || '').trim();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `KronoxUser${1000 + ((hash >>> 0) % 90000)}`;
}

export function getOnlinePlayerSelectionGroup(row) {
  const relation = row?.relation === 'friend' ? 'friend' : 'not_friend';
  const online = Boolean(row?.online || row?.status === 'online');
  if (relation === 'friend' && online) return ONLINE_PLAYER_SELECTION_GROUPS.ONLINE_FRIEND;
  if (relation === 'friend') return ONLINE_PLAYER_SELECTION_GROUPS.OFFLINE_FRIEND;
  return online ? ONLINE_PLAYER_SELECTION_GROUPS.ONLINE_NON_FRIEND : '';
}

export function getOnlinePlayerSelectionStatusLabel(row) {
  return row?.online || row?.status === 'online' ? 'Çevrimiçi' : 'Çevrim dışı';
}

export function getOnlinePlayerSelectionBadgeLabel(row) {
  return row?.relation === 'friend' ? 'Arkadaş' : 'Oyuncu';
}

export function normalizeOnlinePlayerSelectionRow(row) {
  const targetRef = normalizeInviteTargetRef(row?.target_ref || row?.targetRef || row?.presence_key);
  const group = getOnlinePlayerSelectionGroup(row);
  if (!targetRef || !group) return null;

  const username = isSafeOnlineSelectionUsername(row?.username)
    ? String(row.username).trim()
    : makeFallbackUsername(targetRef);

  return {
    id: targetRef,
    target_ref: targetRef,
    username,
    display_name: username,
    relation: row?.relation === 'friend' ? 'friend' : 'not_friend',
    online: group !== ONLINE_PLAYER_SELECTION_GROUPS.OFFLINE_FRIEND,
    status: group === ONLINE_PLAYER_SELECTION_GROUPS.OFFLINE_FRIEND ? 'offline' : 'online',
    group,
    status_label: getOnlinePlayerSelectionStatusLabel({ status: group === ONLINE_PLAYER_SELECTION_GROUPS.OFFLINE_FRIEND ? 'offline' : 'online' }),
    badge_label: getOnlinePlayerSelectionBadgeLabel(row),
    last_seen_at: row?.last_seen_at || null,
    ...pickPublicAvatarFields(row),
  };
}

export function sortOnlinePlayerSelectionRows(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const groupDelta = (GROUP_RANK[a.group] ?? 99) - (GROUP_RANK[b.group] ?? 99);
    if (groupDelta !== 0) return groupDelta;
    return String(a.username || '').localeCompare(String(b.username || ''), 'tr');
  });
}

export function normalizeOnlinePlayerSelectionRows(rows) {
  const seen = new Set();
  const normalized = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const item = normalizeOnlinePlayerSelectionRow(row);
    if (!item || seen.has(item.target_ref)) continue;
    seen.add(item.target_ref);
    normalized.push(item);
  }
  return sortOnlinePlayerSelectionRows(normalized);
}

export async function loadOnlinePlayerSelection({ limit = 200 } = {}) {
  const response = await base44.functions.invoke('getOnlinePlayerSelection', { limit });
  const rows = Array.isArray(response?.data?.players) ? response.data.players : [];
  return normalizeOnlinePlayerSelectionRows(rows);
}
