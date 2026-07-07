import { pickPublicAvatarFields } from './avatarOptions';

export function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '');
}

export function summarizePlayers(players = []) {
  return players.map((p, index) => ({
    index,
    email: p?.email || null,
    name: p?.name || null,
    cardCount: Array.isArray(p?.cards) ? p.cards.length : 0,
  }));
}

function normalizeKronoxUserId(value) {
  const text = String(value || '').trim().toUpperCase();
  return /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(text) ? text : '';
}

function makeStableHash(value) {
  const normalized = String(value || '').trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getGuestLobbyEmail(profile, playerName = '') {
  const seed = profile?.guest_id || profile?.kronox_user_id || profile?.username || playerName || 'guest';
  return `guest_${makeStableHash(seed)}@kronox.local`;
}

export function removePlayerByIdentity(players = [], { email, name } = {}) {
  if (email) return players.filter(player => player?.email !== email);
  return players.filter(player => player?.name !== name);
}

export function validatePlayerName(name) {
  const trimmed = name.trim();
  if (trimmed.length < 3) return 'Lütfen en az 3 karakter girişi yapınız';
  if (trimmed.length > 15) return 'Lütfen en fazla 15 karakter girişi yapınız';
  if (!/^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ]+$/.test(trimmed)) return 'Lütfen yalnızca harf ve rakam girişi yapınız';
  return '';
}

export function buildPlayerPayload(user, playerName) {
  const trimmedName = playerName.trim();
  const isGuestProfile = Boolean(user?.guest_id && !user?.email);
  const player = user
    ? {
      ...user,
      email: user.email || getGuestLobbyEmail(user, trimmedName),
      full_name: user.full_name || user.display_name || user.username || trimmedName,
    }
    : { email: `guest_${makeStableHash(`${trimmedName}:${Date.now()}`)}@kronox.local`, full_name: trimmedName };
  const kronoxUserId = normalizeKronoxUserId(player.kronox_user_id);
  return {
    identity: player,
    player: {
      ...(kronoxUserId ? { kronox_user_id: kronoxUserId } : {}),
      email: player.email,
      name: trimmedName || player.username || player.full_name || 'Oyuncu',
      ...(isGuestProfile ? { player_type: 'guest' } : {}),
      ...pickPublicAvatarFields(player),
      ready: true,
      cards: [],
    },
  };
}

/**
 * Derive a clean display name for the authenticated user without forcing them
 * through the manual validatePlayerName regex (which forbids spaces & long names).
 * Used by the new invite/create-lobby flow where the user no longer types a name.
 */
export function deriveDisplayName(user) {
  const raw = (user?.username || '').trim();
  if (raw) {
    // Trim to 15 chars to stay within existing UI assumptions.
    return raw.length > 15 ? raw.slice(0, 15) : raw;
  }
  return 'Oyuncu';
}

export function isHost(lobby, user) {
  return Boolean(lobby && user?.email && lobby.host_email === user.email);
}

export function isGuestHost(lobby, user, playerName) {
  if (!lobby || user?.email) return false;
  const guestEmail = user?.guest_id ? getGuestLobbyEmail(user, playerName) : '';
  const guestName = String(user?.username || user?.display_name || playerName || '').trim();
  return Boolean(
    (guestEmail && lobby.host_email === guestEmail) ||
    (guestName && lobby.players?.[0]?.name === guestName),
  );
}

export function canJoinLobby(lobby) {
  return Boolean(lobby && lobby.status === 'waiting');
}

export function canStartLobby(lobby, user, playerName) {
  return (isHost(lobby, user) || isGuestHost(lobby, user, playerName)) && lobby?.players?.length >= 2;
}

export function buildLobbyStartPayload({
  firstQuestionId,
  playersWithCards,
  usedQuestionIds,
  onlineQuestionDeck = [],
  onlineDeckMeta = null,
}) {
  return {
    status: 'starting',
    current_question_id: firstQuestionId,
    used_question_ids: [...usedQuestionIds],
    online_question_deck: Array.isArray(onlineQuestionDeck) ? onlineQuestionDeck : [],
    online_deck_meta: onlineDeckMeta,
    current_player_index: 0,
    players: playersWithCards,
  };
}
