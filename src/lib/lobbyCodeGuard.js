import { base44 } from '@/api/base44Client';
import { generateCode, normalizeCode } from './lobbyUtils';

// GFable 5 — Lobby.code logical unique guard.
// Base44 has no repo-level unique index support, so lobby code uniqueness is
// enforced at code level with query-before-create: before creating a Lobby,
// the candidate code is checked server-side through the lookup-only mode of
// findLobbyByCode (no playerName → no join side effect, service-role read
// bypasses Lobby RLS). On lookup failure we proceed best-effort — the 32^6
// (~1B) keyspace makes an unchecked collision negligible, and stale lobbies
// expire after 10 minutes.
export const LOBBY_CODE_MAX_ATTEMPTS = 5;

export async function isLobbyCodeTaken(code) {
  try {
    const res = await base44.functions.invoke('findLobbyByCode', { code: normalizeCode(code) });
    return res?.data?.found === true;
  } catch {
    // Best-effort guard: lookup unavailable (e.g. guest host) → accept code.
    return false;
  }
}

export async function generateUniqueLobbyCode() {
  let code = normalizeCode(generateCode());
  for (let attempt = 0; attempt < LOBBY_CODE_MAX_ATTEMPTS; attempt += 1) {
    const taken = await isLobbyCodeTaken(code);
    if (!taken) return code;
    code = normalizeCode(generateCode());
  }
  return code;
}