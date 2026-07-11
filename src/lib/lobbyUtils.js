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
    participantRef: p?.participant_ref || null,
    name: p?.name || null,
    cardCount: Array.isArray(p?.cards) ? p.cards.length : 0,
  }));
}

function normalizeKronoxUserId(value) {
  const text = String(value || '').trim().toUpperCase();
  return /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(text) ? text : '';
}

export function removePlayerByIdentity(players = [], { participantRef, name } = {}) {
  if (participantRef) return players.filter(player => player?.participant_ref !== participantRef);
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
  const player = user || { full_name: trimmedName };
  const kronoxUserId = normalizeKronoxUserId(player.kronox_user_id);
  return {
    identity: player,
    player: {
      ...(kronoxUserId ? { kronox_user_id: kronoxUserId } : {}),
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
  return Boolean(lobby && user && lobby?.current_actor_is_host === true);
}

export function isGuestHost(lobby, user) {
  return Boolean(lobby && user && lobby?.current_actor_is_host === true);
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
