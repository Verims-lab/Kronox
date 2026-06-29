/**
 * findLobbyByCode / joinLobbyByCode
 * 
 * Lobby RLS blocks non-members from reading OR updating lobbies.
 * This function uses service-role to:
 * 1. Look up lobby by code
 * 2. Validate status === "waiting"
 * 3. Append the joining player atomically
 * 4. Return the full updated lobby to the client
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const normalizeCode = (code) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^\w]/g, '');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const AVATAR_ICON_IDS = new Set([
  'shield', 'helmet', 'sword', 'crown', 'trophy', 'hourglass', 'clock', 'timer',
  'calendar', 'portal', 'wand', 'scroll', 'crystal', 'planet', 'rocket', 'orbit',
  'telescope', 'book', 'compass', 'brain', 'landmark', 'lightning', 'flame',
  'moon', 'sun', 'star',
]);
const AVATAR_COLOR_IDS = new Set(['gold', 'cyan', 'violet', 'emerald', 'rose', 'blue']);

const normalizeKronoxUserId = (value) => {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
};

function normalizeAvatarColorId(value) {
  const text = String(value || '').trim();
  return AVATAR_COLOR_IDS.has(text) ? text : 'gold';
}

function isSafeAvatarPhotoUrl(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 2048) return false;
  try {
    return new URL(text).protocol === 'https:';
  } catch {
    return false;
  }
}

function readSafeAvatarPhotoUrl(row = {}) {
  const candidates = [
    row?.avatar_url,
    row?.avatarUrl,
    row?.avatar_image_url,
    row?.avatarImageUrl,
    row?.profile_avatar_url,
    row?.profileAvatarUrl,
  ];
  for (const value of candidates) {
    if (isSafeAvatarPhotoUrl(value)) return String(value).trim();
  }
  return '';
}

function pickPublicAvatarFields(row = {}) {
  const type = String(row?.avatar_type || '').trim();
  const iconId = String(row?.avatar_icon_id || '').trim();
  const colorId = normalizeAvatarColorId(row?.avatar_color_id);
  const avatarUrl = readSafeAvatarPhotoUrl(row);

  if ((type === 'photo' || !type) && avatarUrl) {
    return { avatar_type: 'photo', avatar_icon_id: '', avatar_color_id: colorId, avatar_url: avatarUrl };
  }
  if ((type === 'icon' || !type) && AVATAR_ICON_IDS.has(iconId)) {
    return { avatar_type: 'icon', avatar_icon_id: iconId, avatar_color_id: colorId, avatar_url: '' };
  }
  return { avatar_type: '', avatar_icon_id: '', avatar_color_id: colorId, avatar_url: '' };
}

const readRevision = (value) => {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.trunc(revision) : 0;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getPlayerIdentityKey = (player) => {
  const kronoxUserId = normalizeKronoxUserId(player?.kronox_user_id);
  if (kronoxUserId) return `kronox:${kronoxUserId}`;
  const email = normalizeEmail(player?.email);
  if (email) return `email:${email}`;
  const name = String(player?.name || '').trim().toLowerCase();
  return name ? `name:${name}` : '';
};

const normalizeLobbyPlayer = (player) => ({
  ...player,
  kronox_user_id: normalizeKronoxUserId(player?.kronox_user_id),
  email: player?.email || '',
  name: String(player?.name || '').trim() || 'Oyuncu',
  ready: player?.ready ?? true,
  cards: Array.isArray(player?.cards) ? player.cards : [],
});

const mergePlayersByIdentity = (players = [], additions = []) => {
  const seen = new Set();
  const merged = [];
  [...(Array.isArray(players) ? players : []), ...(Array.isArray(additions) ? additions : [])]
    .map(normalizeLobbyPlayer)
    .forEach((player) => {
      const key = getPlayerIdentityKey(player);
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(player);
    });
  return merged;
};

const hasPlayer = (players = [], player) => {
  const key = getPlayerIdentityKey(player);
  return Boolean(key && players.some((candidate) => getPlayerIdentityKey(candidate) === key));
};

const appendPlayerWithMergeRetry = async (base44, lobby, newPlayer) => {
  const delays = [0, 120, 260];
  let latest = lobby;
  let updatedLobby = lobby;
  let retryApplied = false;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await sleep(delays[attempt]);
    latest = attempt === 0 ? latest : await base44.asServiceRole.entities.Lobby.get(lobby.id);
    if (!latest || latest.status !== 'waiting') {
      return { lobby: latest || updatedLobby || lobby, joined: false, retryApplied, statusChanged: true };
    }

    const currentPlayers = Array.isArray(latest.players) ? latest.players : [];
    const mergedPlayers = mergePlayersByIdentity(currentPlayers, [newPlayer]);
    if (hasPlayer(currentPlayers, newPlayer) && mergedPlayers.length === currentPlayers.length) {
      return { lobby: latest, joined: true, retryApplied, alreadyIn: true };
    }

    retryApplied = attempt > 0 || retryApplied;
    updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
      players: mergedPlayers,
      last_activity_at: new Date().toISOString(),
      state_revision: readRevision(latest.state_revision) + 1,
    });

    const verified = await base44.asServiceRole.entities.Lobby.get(lobby.id);
    const verifiedPlayers = Array.isArray(verified?.players) ? verified.players : [];
    if (hasPlayer(verifiedPlayers, newPlayer)) {
      return { lobby: verified || updatedLobby, joined: true, retryApplied };
    }
  }

  return { lobby: updatedLobby || latest || lobby, joined: hasPlayer(updatedLobby?.players || [], newPlayer), retryApplied: true };
};

const readTime = (value) => {
  if (value == null) return NaN;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : NaN;
  }
  const str = String(value).trim();
  if (!str) return NaN;
  const hasZone = /Z$/i.test(str) || /[+-]\d{2}:?\d{2}$/.test(str);
  const t = new Date(hasZone ? str : `${str}Z`).getTime();
  return Number.isFinite(t) ? t : NaN;
};

const getLobbyTouchedAt = (lobby) => readTime(
  lobby?.last_activity_at ||
  lobby?.lastActivityAt ||
  lobby?.updated_at ||
  lobby?.updated_date ||
  lobby?.created_at ||
  lobby?.created_date,
);

const getLobbyExpiry = (lobby, staleAfterMs) => {
  const explicit = readTime(lobby?.expires_at || lobby?.expiresAt);
  const touched = getLobbyTouchedAt(lobby);
  const derived = Number.isFinite(touched) ? touched + staleAfterMs : NaN;
  if (Number.isFinite(explicit) && Number.isFinite(derived)) return Math.max(explicit, derived);
  return Number.isFinite(explicit) ? explicit : derived;
};

const findCurrentUserRow = async (base44, user, email) => {
  const rows = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || user || null;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    const body = await req.json();
    const rawCode = body.code || '';
    const normalizedCode = normalizeCode(rawCode);
    const playerName = (body.playerName || '').trim();
    const myEmail = normalizeEmail(user.email);
    const currentUser = await findCurrentUserRow(base44, user, myEmail);
    const myKronoxUserId = normalizeKronoxUserId(currentUser?.kronox_user_id || user?.kronox_user_id);

    if (!normalizedCode) {
      return Response.json({ error: 'Lobi kodu boş olamaz.' }, { status: 400 });
    }

    // Service-role bypass — user is not yet a lobby member, RLS would block direct reads
    const lobbies = await base44.asServiceRole.entities.Lobby.filter({ code: normalizedCode });


    if (!lobbies || lobbies.length === 0) {
      return Response.json({
        found: false,
        error: 'Lobi bulunamadı. Kod hatalı olabilir.',
        debug: { rawCode, normalizedCode, queryResultCount: 0 }
      });
    }

    const lobby = lobbies[0];

    if (lobby.status !== 'waiting') {
      return Response.json({
        found: true,
        joinable: false,
        error: 'Bu lobi artık katılıma kapalı.',
        debug: { rawCode, normalizedCode, queryResultCount: lobbies.length, matchedStatus: lobby.status, matchedId: lobby.id }
      });
    }

    // Codex130 — Stale waiting lobby guard. A lobby that has been idle in
    // 'waiting' state for longer than 10 minutes is no longer joinable.
    // This blocks code-based joins on lobbies the host abandoned.
    const LOBBY_STALE_AFTER_MS = 10 * 60 * 1000;
    const lobbyExpiresAt = getLobbyExpiry(lobby, LOBBY_STALE_AFTER_MS);
    if (Number.isFinite(lobbyExpiresAt) && lobbyExpiresAt <= Date.now()) {
      return Response.json({
        found: true,
        joinable: false,
        error: 'Lobi süresi doldu. Yeni bir meydan okuma başlatabilirsin.',
        debug: {
          rawCode, normalizedCode, queryResultCount: lobbies.length,
          matchedStatus: lobby.status, matchedId: lobby.id,
          stale: true, lobbyExpiresAt,
        },
      });
    }

    // If no playerName provided, this is a lookup-only call — return lobby info without joining
    if (!playerName) {
      return Response.json({
        found: true,
        joinable: true,
        joined: false,
        lobby: {
          id: lobby.id,
          code: lobby.code,
          status: lobby.status,
          host_name: lobby.host_name,
          player_count: lobby.players?.length ?? 0,
        },
        debug: { rawCode, normalizedCode, queryResultCount: lobbies.length, matchedStatus: lobby.status, matchedId: lobby.id }
      });
    }

    // --- Perform the join via service role with merge/retry protection ---
    const currentPlayers = lobby.players || [];
    const alreadyIn = currentPlayers.some(p => (
      (myKronoxUserId && normalizeKronoxUserId(p?.kronox_user_id) === myKronoxUserId) ||
      normalizeEmail(p.email) === myEmail
    ));

    if (!alreadyIn) {
      const newPlayer = {
        kronox_user_id: myKronoxUserId,
        email: user.email,
        name: playerName,
        ...pickPublicAvatarFields(currentUser),
        ready: true,
        cards: [],
      };

      const mergeResult = await appendPlayerWithMergeRetry(base44, lobby, newPlayer);
      const mergedLobby = mergeResult.lobby || lobby;
      if (mergeResult.statusChanged) {
        return Response.json({
          found: true,
          joinable: false,
          joined: false,
          error: 'Bu lobi artık katılıma kapalı.',
          debug: {
            rawCode,
            normalizedCode,
            queryResultCount: lobbies.length,
            matchedStatus: lobby.status,
            latestStatus: mergedLobby?.status || null,
            matchedId: lobby.id,
          }
        });
      }

      return Response.json({
        found: true,
        joinable: true,
        joined: Boolean(mergeResult.joined),
        lobby: mergedLobby,
        debug: {
          rawCode,
          normalizedCode,
          queryResultCount: lobbies.length,
          matchedStatus: lobby.status,
          matchedId: lobby.id,
          existingPlayersCount: currentPlayers.length,
          playerCount: mergedLobby?.players?.length || 0,
          retryApplied: Boolean(mergeResult.retryApplied),
        }
      });
    } else {
      // Already a member — return current lobby state
      return Response.json({
        found: true,
        joinable: true,
        joined: true,
        lobby: lobby,
        debug: { rawCode, normalizedCode, queryResultCount: lobbies.length, matchedStatus: lobby.status, matchedId: lobby.id, alreadyIn: true }
      });
    }

  } catch (error) {
    console.error('[findLobbyByCode] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
