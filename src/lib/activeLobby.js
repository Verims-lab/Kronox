// Codex131 — Active lobby discovery.
//
// Finds the user's currently active pending lobby so they can leave the
// /lobby screen, navigate elsewhere, and return without losing state.
//
// Rules:
//   • status === 'waiting'
//   • user is host OR appears in lobby.players (by email)
//   • not stale (10-minute LOBBY_STALE_AFTER_MS guard)
//
// Returns the freshest matching lobby or null. Never throws — failures
// surface as null so the UI can fall back silently.

import { base44 } from '@/api/base44Client';
import { isLobbyStale } from '@/lib/inviteApi';
import { normalizeEmail } from '@/lib/friendsApi';

const isUserMember = (lobby, email) => {
  if (!lobby || !email) return false;
  if (String(lobby.host_email || '').toLowerCase() === email) return true;
  const players = Array.isArray(lobby.players) ? lobby.players : [];
  return players.some((p) => String(p?.email || '').toLowerCase() === email);
};

/**
 * Find the user's active pending lobby. Pulls a small recent batch of
 * waiting lobbies and picks the one the user belongs to.
 */
export async function loadActiveLobbyForUser(user) {
  const email = normalizeEmail(user?.email);
  if (!email) return null;
  try {
    // Hosted lobbies — fast path.
    const hosted = await base44.entities.Lobby.filter(
      { host_email: email, status: 'waiting' },
      '-updated_date',
      5,
    ).catch(() => []);
    const freshHosted = (hosted || []).find((l) => !isLobbyStale(l));
    if (freshHosted) return freshHosted;

    // Member lobbies — RLS only returns lobbies the user already belongs to.
    const waitingAll = await base44.entities.Lobby.filter(
      { status: 'waiting' },
      '-updated_date',
      20,
    ).catch(() => []);
    const memberFresh = (waitingAll || [])
      .filter((l) => isUserMember(l, email))
      .find((l) => !isLobbyStale(l));
    return memberFresh || null;
  } catch {
    return null;
  }
}