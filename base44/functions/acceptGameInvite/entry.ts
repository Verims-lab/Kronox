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
const LOBBY_LOCK_TTL_MS = 8 * 1000;
const LOBBY_LOCK_SETTLE_MS = 90;
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
const rowId = (row: any) => row?.id || row?._id || '';
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const AVATAR_ICON_IDS = new Set([
  'shield', 'helmet', 'sword', 'crown', 'trophy', 'hourglass', 'clock', 'timer',
  'calendar', 'portal', 'wand', 'scroll', 'crystal', 'planet', 'rocket', 'orbit',
  'telescope', 'book', 'compass', 'brain', 'landmark', 'lightning', 'flame',
  'moon', 'sun', 'star',
]);
const AVATAR_COLOR_IDS = new Set(['gold', 'cyan', 'violet', 'emerald', 'rose', 'blue']);

function stableOwnerKey(value: unknown) {
  const text = normalizeEmail(value);
  if (!text) return '';
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function randomRef(prefix: string) {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `${prefix}_${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
}

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
  // Reject embedded credentials (http://user:pass@host) — a classic SSRF/
  // open-redirect confusion vector — and non-default ports, which are
  // commonly used to probe internal-only services on nonstandard ports.
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== '443') return false;

  // Reject internal/private/loopback/link-local/metadata hosts so this
  // user-supplied URL can never be used to target internal network
  // services or cloud metadata endpoints (SSRF hardening). Note: this
  // server never fetches the URL itself — it is only stored/echoed for the
  // client's <img> tag — but the hostname is still hardened defense-in-depth.
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) return false;

  // Reject ANY raw IP-literal host (public or private), not only private
  // ranges. A trusted avatar photo host must always be a real domain name;
  // this also closes obfuscated-IP bypasses (decimal/octal/hex IPv4 forms
  // are normalized into dotted-decimal by the URL parser before we get
  // here, and IPv6 literals are rejected outright).
  const ipv4 = isIPv4Literal(hostname);
  if (ipv4) return false;
  if (hostname.includes(':')) return false;
  if (isPrivateOrReservedIPv6(hostname)) return false;
  // Require a real FQDN (at least one dot) with no fully-numeric labels.
  if (!hostname.includes('.') || /^[0-9.]+$/.test(hostname)) return false;

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

function safeUsername(value: unknown, seed: unknown) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text && /^[A-Za-z0-9_]{3,24}$/.test(text) && !text.includes('@')) return text;
  const suffix = parseInt(stableOwnerKey(seed).replace(/^u_/, '') || '0', 36) || 0;
  return `KronoxUser${1000 + (suffix % 90000)}`;
}

function publicLobby(lobby: any, myActorKey: string) {
  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  const hostActorKey = String(lobby?.host_actor_key_hash || players[0]?.actor_key_hash || '');
  return {
    id: String(lobby?.public_ref || ''),
    code: String(lobby?.code || ''),
    status: String(lobby?.status || 'waiting'),
    host_name: safeUsername(lobby?.host_name || players[0]?.name, lobby?.public_ref || lobby?.code),
    current_actor_is_host: myActorKey === hostActorKey,
    players: players.map((player: any) => ({
      participant_ref: String(player?.participant_ref || ''),
      username: safeUsername(player?.name, player?.participant_ref),
      name: safeUsername(player?.name, player?.participant_ref),
      ...pickPublicAvatarFields(player),
      ready: Boolean(player?.ready),
      cards: Array.isArray(player?.cards) ? player.cards : [],
      is_self: String(player?.actor_key_hash || '') === myActorKey,
      is_host: String(player?.actor_key_hash || '') === hostActorKey,
    })),
    state_revision: readRevision(lobby?.state_revision),
    category: lobby?.category || 'karisik',
    selected_category_ids: Array.isArray(lobby?.selected_category_ids) ? lobby.selected_category_ids : [],
    year_start: lobby?.year_start,
    year_end: lobby?.year_end,
    turn_duration: lobby?.turn_duration,
    win_card_count: lobby?.win_card_count,
    max_players: lobby?.max_players,
    current_player_index: lobby?.current_player_index ?? 0,
    current_question_id: lobby?.current_question_id || null,
    used_question_ids: Array.isArray(lobby?.used_question_ids) ? lobby.used_question_ids : [],
    online_question_deck: Array.isArray(lobby?.online_question_deck) ? lobby.online_question_deck : [],
    online_deck_meta: lobby?.online_deck_meta || null,
    winner: lobby?.winner || null,
    winner_participant_ref: lobby?.winner_participant_ref || null,
    last_activity_at: lobby?.last_activity_at || null,
    expires_at: lobby?.expires_at || null,
  };
}

function publicInvite(invite: any, lobby: any) {
  return {
    id: invite?.public_ref || null,
    invite_ref: invite?.public_ref || null,
    status: invite?.status || null,
    from_name: safeUsername(invite?.from_name, invite?.id),
    to_name: safeUsername(invite?.to_name, invite?.id),
    lobby_ref: lobby?.public_ref || null,
    lobby_code: lobby?.code || invite?.lobby_code || '',
    expires_at: invite?.expires_at || null,
    accepted_at: invite?.accepted_at || null,
  };
}

async function ensurePublicLobbyRef(base44: any, lobby: any) {
  if (!lobby || lobby.public_ref) return lobby;
  const updated = await base44.asServiceRole.entities.Lobby.update(lobby.id, { public_ref: randomRef('lobby') });
  return updated ? { ...lobby, ...updated } : lobby;
}

async function ensurePublicInviteRef(base44: any, invite: any) {
  if (!invite || invite.public_ref) return invite;
  const updated = await base44.asServiceRole.entities.GameInvite.update(invite.id, { public_ref: randomRef('invite') });
  return updated ? { ...invite, ...updated } : invite;
}

const readRevision = (value: unknown) => {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.trunc(revision) : 0;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function acquireInviteJoinLock(base44: any, lobby: any, newPlayer: any) {
  const entity = base44?.asServiceRole?.entities?.EconomyOperationLock;
  if (!entity?.filter || !entity?.create || !entity?.update) {
    return { ok: false, code: 'lobby_lock_unavailable', status: 503 };
  }

  const lockKey = `lobby:mutate:${rowId(lobby)}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const now = new Date();
    const rows = await entity.filter({ lock_key: lockKey }, 'acquired_at', 25).catch(() => []);
    const active = (rows || []).filter((row: any) => String(row?.status) === 'active' && readTime(row?.expires_at) > now.getTime());
    if (active.length) {
      await sleep(80 + attempt * 80);
      continue;
    }

    const lock = await entity.create({
      lock_key: lockKey,
      actor_key: String(newPlayer?.actor_key_hash || 'invite_join'),
      operation_scope: 'lobby_join',
      operation_id: randomRef('invite_join'),
      status: 'active',
      acquired_at: now.toISOString(),
      expires_at: new Date(now.getTime() + LOBBY_LOCK_TTL_MS).toISOString(),
      metadata: { backendOwned: true, source: 'game_invite' },
    }).catch(() => null);
    if (!lock) continue;

    await sleep(LOBBY_LOCK_SETTLE_MS);
    const contenders = await entity.filter({ lock_key: lockKey }, 'acquired_at', 25).catch(() => []);
    const winner = (contenders || [])
      .filter((row: any) => String(row?.status) === 'active' && readTime(row?.expires_at) > Date.now())
      .sort((a: any, b: any) => (readTime(a?.acquired_at) - readTime(b?.acquired_at)) || String(rowId(a)).localeCompare(String(rowId(b))))[0];
    if (rowId(winner) === rowId(lock)) return { ok: true, lock };
    await entity.update(rowId(lock), { status: 'released', released_at: new Date().toISOString() }).catch(() => null);
  }

  return { ok: false, code: 'lobby_operation_in_progress', status: 409 };
}

async function releaseInviteJoinLock(base44: any, lock: any) {
  if (!rowId(lock)) return;
  await base44.asServiceRole.entities.EconomyOperationLock.update(rowId(lock), {
    status: 'released',
    released_at: new Date().toISOString(),
  }).catch(() => null);
}

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
  actor_key_hash: String(player?.actor_key_hash || '') || stableOwnerKey(player?.email),
  participant_ref: String(player?.participant_ref || '') || randomRef('player'),
  player_type: player?.player_type || 'linked',
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
  const lockResult = await acquireInviteJoinLock(base44, lobby, newPlayer);
  if (!lockResult.ok) {
    return {
      lobby,
      joinedLobby: lobby,
      verifiedLobby: lobby,
      joined: false,
      code: lockResult.code,
      status: lockResult.status,
    };
  }

  const delays = [0, 120, 260];
  let latest = lobby;
  let updatedLobby = lobby;
  let retryApplied = false;

  try {
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
      const maxPlayers = Math.max(2, Math.min(4, Number(latest?.max_players) || 4));
      if (mergedPlayers.length > maxPlayers) {
        return {
          lobby: latest,
          joinedLobby: latest,
          verifiedLobby: latest,
          joined: false,
          retryApplied,
          code: 'lobby_full',
          status: 409,
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
  } finally {
    await releaseInviteJoinLock(base44, lockResult.lock);
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const inviteRef = String(body?.inviteRef || body?.inviteId || '').trim();
    const action = String(body?.action || 'accept').trim().toLowerCase();
    if (!inviteRef) {
      return Response.json({ error: 'inviteRef is required' }, { status: 400 });
    }
    if (!['accept', 'decline'].includes(action)) return Response.json({ error: 'Unsupported invite action' }, { status: 400 });

    const publicRows = await base44.asServiceRole.entities.GameInvite
      .filter({ public_ref: inviteRef }, '-updated_date', 2)
      .catch(() => []);
    let invite = publicRows?.[0] || await base44.asServiceRole.entities.GameInvite.get(inviteRef).catch(() => null);
    if (!invite) {
      return Response.json({ code: 'invite_not_found', error: 'Davet bulunamadı.' }, { status: 404 });
    }
    const inviteRowId = String(invite?.id || invite?._id || '').trim();

    const myEmail = String(user.email || '').trim().toLowerCase();
    const toEmail = String(invite.to_email || '').trim().toLowerCase();
    const currentUser = await findCurrentUserRow(base44, user, myEmail);

    if (toEmail !== myEmail) {
      return Response.json({ code: 'unauthorized', error: 'Bu davet sana ait değil' }, { status: 403 });
    }
    invite = await ensurePublicInviteRef(base44, invite);
    if (action === 'decline') {
      if (invite.status !== 'pending') {
        return Response.json({ code: `already_${invite.status}`, error: `Davet zaten ${invite.status}.` }, { status: 409 });
      }
      const declined = await base44.asServiceRole.entities.GameInvite.update(inviteRowId, {
        status: 'declined',
        declined_at: new Date().toISOString(),
      });
      return Response.json({ ok: true, success: true, invite: publicInvite({ ...invite, ...declined }, null) });
    }
    if (invite.status !== 'pending') {
      if (invite.status === 'accepted' && invite.lobby_id) {
        const acceptedLobby = await base44.asServiceRole.entities.Lobby.get(invite.lobby_id).catch(() => null);
        if (acceptedLobby) {
          let returnLobby = acceptedLobby;
          if (acceptedLobby.status === 'waiting') {
            const newPlayer = {
              actor_key_hash: stableOwnerKey(user.email),
              participant_ref: randomRef('player'),
              player_type: 'linked',
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
            if (!restored.joined) {
              const status = Number(restored.status) || 409;
              const code = restored.code || 'lobby_join_failed';
              const error = code === 'lobby_full'
                ? 'Lobi dolu.'
                : code === 'lobby_lock_unavailable'
                  ? 'Lobi şu anda güncellenemiyor. Lütfen tekrar dene.'
                  : 'Lobi güncelleniyor. Lütfen tekrar dene.';
              return Response.json({ code, error }, { status });
            }
            returnLobby = restored.verifiedLobby || restored.joinedLobby || restored.lobby || acceptedLobby;
          }
          const verifiedLobby = await ensurePublicLobbyRef(base44, returnLobby);
          const publicVerifiedLobby = publicLobby(verifiedLobby, stableOwnerKey(user.email));
          return Response.json({
            ok: true,
            success: true,
            alreadyAccepted: true,
            invite: publicInvite(invite, verifiedLobby),
            lobby: publicVerifiedLobby,
            joinedLobby: publicVerifiedLobby,
            verifiedLobby: publicVerifiedLobby,
            lobbyId: publicVerifiedLobby.id,
            lobbyCode: publicVerifiedLobby.code || invite.lobby_code || '',
          });
        }
        return Response.json({ code: 'lobby_not_found', error: 'Lobi artık mevcut değil.' }, { status: 404 });
      }
      return Response.json({ code: `already_${invite.status}`, error: `Davet zaten ${invite.status}.` }, { status: 409 });
    }
    const expiresAt = getInviteExpiry(invite);
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      await base44.asServiceRole.entities.GameInvite.update(inviteRowId, {
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
      await base44.asServiceRole.entities.GameInvite.update(inviteRowId, { status: 'expired' }).catch(() => {});
      return Response.json({ code: 'lobby_not_joinable', error: 'Bu davet artık geçerli değil — oyun başlamış olabilir.' }, { status: 409 });
    }

    // Codex130 — Stale waiting lobby guard. If a lobby has been sitting in
    // 'waiting' state for longer than LOBBY_STALE_AFTER_MS (10 min) without
    // anyone starting the game, the invite is no longer joinable. We mark
    // the invite expired and bail. The lobby itself is left as-is — the
    // host (or a later cleanup pass) can delete it; we only block join.
    const lobbyExpiresAt = getLobbyExpiry(lobby);
    if (Number.isFinite(lobbyExpiresAt) && lobbyExpiresAt <= Date.now()) {
      await base44.asServiceRole.entities.GameInvite.update(inviteRowId, {
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
      actor_key_hash: stableOwnerKey(user.email),
      participant_ref: randomRef('player'),
      player_type: 'linked',
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
        await base44.asServiceRole.entities.GameInvite.update(inviteRowId, { status: 'expired' }).catch(() => {});
        return Response.json({ code: 'lobby_not_joinable', error: 'Bu davet artık geçerli değil — oyun başlamış olabilir.' }, { status: 409 });
      }
      if (!mergeResult.joined) {
        const status = Number(mergeResult.status) || 409;
        const code = mergeResult.code || 'lobby_join_failed';
        const error = code === 'lobby_full'
          ? 'Lobi dolu.'
          : code === 'lobby_lock_unavailable'
            ? 'Lobi şu anda güncellenemiyor. Lütfen tekrar dene.'
            : 'Lobi güncelleniyor. Lütfen tekrar dene.';
        return Response.json({ code, error }, { status });
      }
    }

    const updatedInvite = await base44.asServiceRole.entities.GameInvite.update(inviteRowId, {
      status: 'accepted',
      accepted_at: nowIso,
      ...(normalizeKronoxUserId(invite?.to_kronox_user_id || currentUser?.kronox_user_id || user?.kronox_user_id) ? {
        to_kronox_user_id: normalizeKronoxUserId(invite?.to_kronox_user_id || currentUser?.kronox_user_id || user?.kronox_user_id),
      } : {}),
      to_name: acceptedPlayerName,
    });

    const joinedLobby = await ensurePublicLobbyRef(base44, verifiedLobby || updatedLobby || lobby);
    const publicJoinedLobby = publicLobby(joinedLobby, stableOwnerKey(user.email));

    return Response.json({
      ok: true,
      success: true,
      invite: publicInvite(updatedInvite, joinedLobby),
      lobby: publicJoinedLobby,
      joinedLobby: publicJoinedLobby,
      verifiedLobby: publicJoinedLobby,
      lobbyId: publicJoinedLobby.id,
      lobbyCode: publicJoinedLobby.code || invite.lobby_code || '',
    });
  } catch (error) {
    console.error('[acceptGameInvite] error:', error.message);
    return Response.json({ code: 'invite_accept_failed', error: 'Davet kabul edilemedi. Lütfen tekrar dene.' }, { status: 500 });
  }
});