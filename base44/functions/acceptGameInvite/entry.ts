/**
 * acceptGameInvite
 *
 * Recipient-only accept. Adds the recipient to Lobby.players via service role
 * (RLS forbids the client from updating a Lobby they are not yet a member of)
 * and marks the GameInvite as accepted.
 *
 * Mirrors the safe append pattern already used in findLobbyByCode.js so
 * multiplayer authority assumptions stay intact.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

// Codex130 — Game invite + lobby staleness TTL: 10 minutes.
const GAME_INVITE_TTL_MS = 10 * 60 * 1000;
const LOBBY_STALE_AFTER_MS = 10 * 60 * 1000;
// Codex139 — Naive ISO timestamp guard.
// Base44 server `created_date` / `expires_at` are sometimes serialized
// WITHOUT a timezone suffix (e.g. "2026-05-31T14:33:11.992000"). `new Date()`
// then treats it as LOCAL time, breaking the 10-min TTL math on any non-UTC
// host (Europe/Istanbul is UTC+3 → a fresh invite parses ~3h in the past
// and is instantly flagged as expired).
//
// Server timestamps are always UTC, so `parseInviteTimestamp` appends `Z`
// to naive ISO strings before parsing. `readTime` is kept as a numeric
// wrapper used by the existing TTL math + stale-lobby guard call sites.
function parseInviteTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const str = String(value).trim();
  if (!str) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(str);
  const normalized = hasZone ? str : `${str}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
const readTime = (value: unknown) => {
  const d = parseInviteTimestamp(value);
  return d ? d.getTime() : NaN;
};
const getInviteExpiry = (invite: any) => {
  // Codex139 — expires_at is parsed through the safe parser so naive ISO
  // strings (no zone) are treated as UTC, not local time.
  const explicitDate = parseInviteTimestamp(invite?.expires_at || invite?.expiresAt);
  if (explicitDate) return explicitDate.getTime();
  const created = readTime(invite?.created_at || invite?.createdAt || invite?.created_date || invite?.createdDate);
  return Number.isFinite(created) ? created + GAME_INVITE_TTL_MS : NaN;
};
const getLobbyTouchedAt = (lobby: any) => readTime(
  lobby?.last_activity_at ||
  lobby?.lastActivityAt ||
  lobby?.updated_at ||
  lobby?.updated_date ||
  lobby?.created_at ||
  lobby?.created_date,
);
const getLobbyExpiry = (lobby: any) => {
  const explicit = readTime(lobby?.expires_at || lobby?.expiresAt);
  const touched = getLobbyTouchedAt(lobby);
  const derived = Number.isFinite(touched) ? touched + LOBBY_STALE_AFTER_MS : NaN;
  if (Number.isFinite(explicit) && Number.isFinite(derived)) return Math.max(explicit, derived);
  return Number.isFinite(explicit) ? explicit : derived;
};

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const AVATAR_ICON_IDS = new Set([
  'shield', 'helmet', 'sword', 'crown', 'trophy', 'hourglass', 'clock', 'timer',
  'calendar', 'portal', 'wand', 'scroll', 'crystal', 'planet', 'rocket', 'orbit',
  'telescope', 'book', 'compass', 'brain', 'landmark', 'lightning', 'flame',
  'moon', 'sun', 'star',
]);
const AVATAR_COLOR_IDS = new Set(['gold', 'cyan', 'violet', 'emerald', 'rose', 'blue']);

function normalizeKronoxUserId(value: unknown) {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
}

function normalizeAvatarColorId(value: unknown) {
  const text = String(value || '').trim();
  return AVATAR_COLOR_IDS.has(text) ? text : 'gold';
}

function isIPv4Literal(host: string) {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const octets = match.slice(1, 5).map((part) => Number(part));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return octets;
}

function isPrivateOrReservedIPv4(octets: number[]) {
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0 && octets[2] === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && octets[2] === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && octets[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && octets[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast (224-239) + reserved (240-255)
  return false;
}

function isPrivateOrReservedIPv6(host: string) {
  const text = host.toLowerCase();
  if (text === '::1' || text === '::') return true; // loopback / unspecified
  if (text.startsWith('fe80:') || text.startsWith('fe8') || text.startsWith('fe9') || text.startsWith('fea') || text.startsWith('feb')) return true; // link-local
  if (text.startsWith('fc') || text.startsWith('fd')) return true; // unique local (ULA)
  const mapped = text.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) {
    const octets = isIPv4Literal(mapped[1]);
    if (octets && isPrivateOrReservedIPv4(octets)) return true;
  }
  return false;
}

function isSafeAvatarPhotoUrl(value: unknown) {
  const text = String(value || '').trim();
  if (!text || text.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;

  // Reject internal/private/loopback/link-local/metadata hosts so this
  // user-supplied URL can never be used to target internal network
  // services or cloud metadata endpoints (SSRF hardening).
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) return false;
  // Reject purely numeric hosts (decimal/octal IP obfuscation tricks).
  if (/^[0-9.]+$/.test(hostname) && !hostname.includes('.')) return false;

  const ipv4 = isIPv4Literal(hostname);
  if (ipv4) {
    if (isPrivateOrReservedIPv4(ipv4)) return false;
  } else if (hostname.includes(':')) {
    if (isPrivateOrReservedIPv6(hostname)) return false;
  }

  return true;
}

function readSafeAvatarPhotoUrl(row: any = {}) {
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

function pickPublicAvatarFields(row: any = {}) {
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

const readRevision = (value: unknown) => {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.trunc(revision) : 0;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getPlayerIdentityKey = (player: any) => {
  const kronoxUserId = normalizeKronoxUserId(player?.kronox_user_id);
  if (kronoxUserId) return `kronox:${kronoxUserId}`;
  const email = normalizeEmail(player?.email);
  if (email) return `email:${email}`;
  const name = String(player?.name || '').trim().toLowerCase();
  return name ? `name:${name}` : '';
};

const normalizeLobbyPlayer = (player: any) => ({
  ...player,
  kronox_user_id: normalizeKronoxUserId(player?.kronox_user_id),
  email: player?.email || '',
  name: String(player?.name || '').trim() || 'Oyuncu',
  ready: player?.ready ?? true,
  cards: Array.isArray(player?.cards) ? player.cards : [],
});

const mergePlayersByIdentity = (players: any[] = [], additions: any[] = []) => {
  const seen = new Set<string>();
  const merged: any[] = [];
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

const hasPlayer = (players: any[] = [], player: any) => {
  const key = getPlayerIdentityKey(player);
  return Boolean(key && players.some((candidate) => getPlayerIdentityKey(candidate) === key));
};

const getInvitePlayerName = (user: any, invite: any) =>
  String(
    user?.full_name ||
    invite?.to_name ||
    (user?.email || invite?.to_email || '').split('@')[0] ||
    'Oyuncu',
  ).trim().slice(0, 15) || 'Oyuncu';

async function findCurrentUserRow(base44: any, user: any, email: string) {
  const rows = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1).catch(() => []);
  return rows?.[0] || user || null;
}

const appendPlayerWithMergeRetry = async (base44: any, lobby: any, newPlayer: any) => {
  const delays = [0, 120, 260];
  let latest = lobby;
  let updatedLobby = lobby;
  let retryApplied = false;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await sleep(delays[attempt]);
    latest = attempt === 0 ? latest : await base44.asServiceRole.entities.Lobby.get(lobby.id);
    if (!latest || latest.status !== 'waiting') {
      const verifiedLobby = latest || updatedLobby || lobby;
      return {
        lobby: verifiedLobby,
        joinedLobby: verifiedLobby,
        verifiedLobby,
        joined: false,
        retryApplied,
        statusChanged: true,
      };
    }

    const currentPlayers = Array.isArray(latest.players) ? latest.players : [];
    const mergedPlayers = mergePlayersByIdentity(currentPlayers, [newPlayer]);
    if (hasPlayer(currentPlayers, newPlayer) && mergedPlayers.length === currentPlayers.length) {
      const verifiedLobby = latest;
      return {
        lobby: verifiedLobby,
        joinedLobby: verifiedLobby,
        verifiedLobby,
        joined: true,
        retryApplied,
        alreadyIn: true,
      };
    }

    retryApplied = attempt > 0 || retryApplied;
    updatedLobby = await base44.asServiceRole.entities.Lobby.update(lobby.id, {
      players: mergedPlayers,
      last_activity_at: new Date().toISOString(),
      state_revision: readRevision(latest.state_revision) + 1,
    });

    const verifiedLobby = await base44.asServiceRole.entities.Lobby.get(lobby.id);
    const verifiedPlayers = Array.isArray(verifiedLobby?.players) ? verifiedLobby.players : [];
    if (hasPlayer(verifiedPlayers, newPlayer)) {
      const joinedLobby = verifiedLobby || updatedLobby;
      return { lobby: joinedLobby, joinedLobby, verifiedLobby: joinedLobby, joined: true, retryApplied };
    }
  }

  const verifiedLobby = updatedLobby || latest || lobby;
  return {
    lobby: verifiedLobby,
    joinedLobby: verifiedLobby,
    verifiedLobby,
    joined: hasPlayer(verifiedLobby?.players || [], newPlayer),
    retryApplied: true,
  };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const inviteId = String(body?.inviteId || '').trim();
    if (!inviteId) {
      return Response.json({ error: 'inviteId is required' }, { status: 400 });
    }

    const invite = await base44.asServiceRole.entities.GameInvite.get(inviteId);
    if (!invite) {
      return Response.json({ code: 'invite_not_found', error: 'Davet bulunamadı.' }, { status: 404 });
    }

    const myEmail = String(user.email || '').trim().toLowerCase();
    const toEmail = String(invite.to_email || '').trim().toLowerCase();
    const currentUser = await findCurrentUserRow(base44, user, myEmail);

    if (toEmail !== myEmail) {
      return Response.json({ code: 'unauthorized', error: 'Bu davet sana ait değil' }, { status: 403 });
    }
    if (invite.status !== 'pending') {
      if (invite.status === 'accepted' && invite.lobby_id) {
        const acceptedLobby = await base44.asServiceRole.entities.Lobby.get(invite.lobby_id).catch(() => null);
        if (acceptedLobby) {
          let returnLobby = acceptedLobby;
          if (acceptedLobby.status === 'waiting') {
            const newPlayer = {
              kronox_user_id: normalizeKronoxUserId(invite?.to_kronox_user_id || currentUser?.kronox_user_id || user?.kronox_user_id),
              email: user.email,
              name: getInvitePlayerName(user, invite),
              ...pickPublicAvatarFields(currentUser),
              ready: true,
              cards: [],
            };
            const restored = await appendPlayerWithMergeRetry(base44, acceptedLobby, {
              ...newPlayer,
            });
            returnLobby = restored.verifiedLobby || restored.joinedLobby || restored.lobby || acceptedLobby;
          }
          const verifiedLobby = returnLobby;
          return Response.json({
            ok: true,
            success: true,
            alreadyAccepted: true,
            invite,
            lobby: verifiedLobby,
            joinedLobby: verifiedLobby,
            verifiedLobby,
            lobbyId: verifiedLobby.id,
            lobbyCode: verifiedLobby.code || invite.lobby_code || '',
          });
        }
        return Response.json({ code: 'lobby_not_found', error: 'Lobi artık mevcut değil.' }, { status: 404 });
      }
      return Response.json({ code: `already_${invite.status}`, error: `Davet zaten ${invite.status}.` }, { status: 409 });
    }
    const expiresAt = getInviteExpiry(invite);
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      await base44.asServiceRole.entities.GameInvite.update(inviteId, {
        status: 'expired',
        expired_at: new Date().toISOString(),
      }).catch(() => {});
      return Response.json({ code: 'invite_expired', error: 'Davetin süresi doldu.' }, { status: 409 });
    }

    if (!invite.lobby_id) {
      return Response.json({ code: 'lobby_not_found', error: 'Lobi artık mevcut değil.' }, { status: 404 });
    }

    const lobby = await base44.asServiceRole.entities.Lobby.get(invite.lobby_id);
    if (!lobby) {
      return Response.json({ code: 'lobby_not_found', error: 'Lobi artık mevcut değil.' }, { status: 404 });
    }
    if (lobby.status !== 'waiting') {
      // Mark expired so the recipient stops seeing it.
      await base44.asServiceRole.entities.GameInvite.update(inviteId, { status: 'expired' }).catch(() => {});
      return Response.json({ code: 'lobby_not_joinable', error: 'Bu davet artık geçerli değil — oyun başlamış olabilir.' }, { status: 409 });
    }

    // Codex130 — Stale waiting lobby guard. If a lobby has been sitting in
    // 'waiting' state for longer than LOBBY_STALE_AFTER_MS (10 min) without
    // anyone starting the game, the invite is no longer joinable. We mark
    // the invite expired and bail. The lobby itself is left as-is — the
    // host (or a later cleanup pass) can delete it; we only block join.
    const lobbyExpiresAt = getLobbyExpiry(lobby);
    if (Number.isFinite(lobbyExpiresAt) && lobbyExpiresAt <= Date.now()) {
      await base44.asServiceRole.entities.GameInvite.update(inviteId, {
        status: 'expired',
        expired_at: new Date().toISOString(),
      }).catch(() => {});
      return Response.json({
        code: 'lobby_expired',
        error: 'Lobi süresi doldu. Yeni bir meydan okuma başlatabilirsin.',
      }, { status: 409 });
    }

    // Merge/retry append (same pattern as findLobbyByCode).
    const currentPlayers = Array.isArray(lobby.players) ? lobby.players : [];
    const alreadyIn = currentPlayers.some((p) => normalizeEmail(p?.email) === myEmail);

    let updatedLobby = lobby;
    let verifiedLobby = lobby;
    const nowIso = new Date().toISOString();
    const acceptedPlayerName = getInvitePlayerName(user, invite);
    const newPlayer = {
      kronox_user_id: normalizeKronoxUserId(invite?.to_kronox_user_id || currentUser?.kronox_user_id || user?.kronox_user_id),
      email: user.email,
      name: acceptedPlayerName,
      ...pickPublicAvatarFields(currentUser),
      ready: true,
      cards: [],
    };
    if (!alreadyIn) {
      const mergeResult = await appendPlayerWithMergeRetry(base44, lobby, newPlayer);
      verifiedLobby = mergeResult.verifiedLobby || mergeResult.joinedLobby || mergeResult.lobby || updatedLobby;
      updatedLobby = verifiedLobby || updatedLobby;
      if (mergeResult.statusChanged) {
        await base44.asServiceRole.entities.GameInvite.update(inviteId, { status: 'expired' }).catch(() => {});
        return Response.json({ code: 'lobby_not_joinable', error: 'Bu davet artık geçerli değil — oyun başlamış olabilir.' }, { status: 409 });
      }
    }

    const updatedInvite = await base44.asServiceRole.entities.GameInvite.update(inviteId, {
      status: 'accepted',
      accepted_at: nowIso,
      ...(normalizeKronoxUserId(invite?.to_kronox_user_id || currentUser?.kronox_user_id || user?.kronox_user_id) ? {
        to_kronox_user_id: normalizeKronoxUserId(invite?.to_kronox_user_id || currentUser?.kronox_user_id || user?.kronox_user_id),
      } : {}),
      to_name: acceptedPlayerName,
    });

    const joinedLobby = verifiedLobby || updatedLobby || lobby;

    return Response.json({
      ok: true,
      success: true,
      invite: updatedInvite,
      lobby: joinedLobby,
      joinedLobby,
      verifiedLobby: joinedLobby,
      lobbyId: joinedLobby?.id || lobby.id,
      lobbyCode: joinedLobby?.code || lobby.code || invite.lobby_code || '',
      debug: {
        inviteId,
        lobbyId: lobby.id,
        lobbyExpiresAt: Number.isFinite(lobbyExpiresAt) ? new Date(lobbyExpiresAt).toISOString() : null,
        alreadyIn,
        playerCount: joinedLobby?.players?.length || 0,
      },
    });
  } catch (error) {
    console.error('[acceptGameInvite] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});