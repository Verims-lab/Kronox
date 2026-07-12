import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const LOBBY_STALE_AFTER_MS = 10 * 60 * 1000;
const LOBBY_LOCK_TTL_MS = 8 * 1000;
const LOBBY_LOCK_SETTLE_MS = 90;
const KRONOX_ID_PATTERN = /^KX-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const AVATAR_ICON_IDS = new Set([
  'shield', 'helmet', 'sword', 'crown', 'trophy', 'hourglass', 'clock', 'timer',
  'calendar', 'portal', 'wand', 'scroll', 'crystal', 'planet', 'rocket', 'orbit',
  'telescope', 'book', 'compass', 'brain', 'landmark', 'lightning', 'flame',
  'moon', 'sun', 'star',
]);
const AVATAR_COLOR_IDS = new Set(['gold', 'cyan', 'violet', 'emerald', 'rose', 'blue']);

const json = (body: unknown, status = 200) => Response.json(body, { status });
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeCode = (value: unknown) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/\s+/g, '')
  .replace(/[^A-Z0-9]/g, '')
  .slice(0, 6);
const rowId = (row: any) => row?.id || row?._id || '';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readRevision(value: unknown) {
  const revision = Number(value);
  return Number.isFinite(revision) && revision >= 0 ? Math.trunc(revision) : 0;
}

function normalizeKronoxUserId(value: unknown) {
  const text = String(value || '').trim().toUpperCase();
  return KRONOX_ID_PATTERN.test(text) ? text : '';
}

function stableOwnerKey(prefix: 'u' | 'g', value: unknown) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}

function randomRef(prefix: string) {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  const token = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${prefix}_${token}`;
}

function safeCredentialText(value: unknown, maxLength = 220) {
  const text = String(value || '').trim();
  return text && text.length <= maxLength && /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hashGuestToken(guestId: string, guestToken: string) {
  const data = new TextEncoder().encode(`kronox_guest_v1:${guestId}:${guestToken}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest));
}

function fallbackUsername(seed: unknown) {
  const suffix = stableOwnerKey('u', seed).replace(/^u_/, '');
  const numeric = parseInt(suffix || '0', 36) || 0;
  return `KronoxUser${1000 + (numeric % 90000)}`;
}

function safeUsername(value: unknown, seed: unknown) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text && /^[A-Za-z0-9_]{3,24}$/.test(text) && !text.includes('@') &&
    !/^(guest|player|owner|user_key|player_key|g|u)_[A-Za-z0-9_-]{4,}$/i.test(text)
    ? text
    : fallbackUsername(seed);
}

function isSafeAvatarUrl(value: unknown) {
  const text = String(value || '').trim();
  if (!text || text.length > 2048) return false;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.hostname.endsWith('.local');
  } catch {
    return false;
  }
}

function publicAvatar(row: any = {}) {
  const type = String(row?.avatar_type || '').trim();
  const iconId = String(row?.avatar_icon_id || '').trim();
  const colorId = AVATAR_COLOR_IDS.has(String(row?.avatar_color_id || ''))
    ? String(row.avatar_color_id)
    : 'gold';
  const avatarUrl = isSafeAvatarUrl(row?.avatar_url) ? String(row.avatar_url).trim() : '';
  if ((type === 'photo' || !type) && avatarUrl) {
    return { avatar_type: 'photo', avatar_icon_id: '', avatar_color_id: colorId, avatar_url: avatarUrl };
  }
  if ((type === 'icon' || !type) && AVATAR_ICON_IDS.has(iconId)) {
    return { avatar_type: 'icon', avatar_icon_id: iconId, avatar_color_id: colorId, avatar_url: '' };
  }
  return { avatar_type: '', avatar_icon_id: '', avatar_color_id: colorId, avatar_url: '' };
}

async function resolveActor(base44: any, body: any) {
  const authUser = await base44.auth.me().catch(() => null);
  const email = normalizeEmail(authUser?.email);
  if (email) {
    const rows = await base44.asServiceRole.entities.User.filter({ email }, '-updated_date', 1).catch(() => []);
    const profile = rows?.[0] || authUser;
    return {
      ok: true,
      actor: {
        playerType: 'linked',
        actorKeyHash: stableOwnerKey('u', email),
        email,
        kronoxUserId: normalizeKronoxUserId(profile?.kronox_user_id),
        username: safeUsername(profile?.username || profile?.public_username || profile?.display_name, email),
        avatar: publicAvatar(profile),
      },
    };
  }

  const guestId = safeCredentialText(body?.guest_id, 80);
  const guestToken = safeCredentialText(body?.guest_token, 220);
  if (!guestId.startsWith('guest_') || !guestToken) {
    return { ok: false, response: json({ ok: false, code: 'unauthenticated', error: 'Oyuncu oturumu doğrulanamadı.' }, 401) };
  }
  const rows = await base44.asServiceRole.entities.GuestProfile.filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
  const profile = rows?.[0] || null;
  const expectedHash = String(profile?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!profile || !expectedHash || expectedHash !== providedHash || String(profile?.status || '') === 'linked') {
    return { ok: false, response: json({ ok: false, code: 'invalid_guest_token', error: 'Misafir oturumu doğrulanamadı.' }, 401) };
  }
  return {
    ok: true,
    actor: {
      playerType: 'guest',
      actorKeyHash: stableOwnerKey('g', guestId),
      email: '',
      kronoxUserId: normalizeKronoxUserId(profile?.kronox_user_id),
      username: safeUsername(profile?.username || profile?.display_name, guestId),
      avatar: publicAvatar(profile),
    },
  };
}

function playerIdentityKey(player: any) {
  const actorKey = String(player?.actor_key_hash || '').trim();
  if (actorKey) return `actor:${actorKey}`;
  const kronoxId = normalizeKronoxUserId(player?.kronox_user_id);
  if (kronoxId) return `kronox:${kronoxId}`;
  const email = normalizeEmail(player?.email);
  return email ? `email:${email}` : '';
}

function actorMatchesPlayer(actor: any, player: any) {
  if (!actor || !player) return false;
  if (actor.actorKeyHash && actor.actorKeyHash === String(player?.actor_key_hash || '')) return true;
  if (actor.kronoxUserId && actor.kronoxUserId === normalizeKronoxUserId(player?.kronox_user_id)) return true;
  return Boolean(actor.email && actor.email === normalizeEmail(player?.email));
}

function actorIsHost(actor: any, lobby: any) {
  if (actor?.actorKeyHash && actor.actorKeyHash === String(lobby?.host_actor_key_hash || '')) return true;
  if (actor?.kronoxUserId && actor.kronoxUserId === normalizeKronoxUserId(lobby?.host_kronox_user_id)) return true;
  return Boolean(actor?.email && actor.email === normalizeEmail(lobby?.host_email));
}

function internalPlayer(actor: any, existing: any = {}) {
  return {
    ...existing,
    actor_key_hash: actor.actorKeyHash,
    participant_ref: String(existing?.participant_ref || '') || randomRef('player'),
    player_type: actor.playerType,
    email: actor.email,
    kronox_user_id: actor.kronoxUserId,
    name: actor.username,
    ...actor.avatar,
    ready: existing?.ready ?? true,
    cards: Array.isArray(existing?.cards) ? existing.cards : [],
  };
}

function mergePlayers(players: any[] = [], additions: any[] = []) {
  const merged: any[] = [];
  const seen = new Set<string>();
  for (const player of [...players, ...additions]) {
    const key = playerIdentityKey(player);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({
      ...player,
      participant_ref: String(player?.participant_ref || '') || randomRef('player'),
      name: safeUsername(player?.name, key),
      ready: player?.ready ?? true,
      cards: Array.isArray(player?.cards) ? player.cards : [],
      ...publicAvatar(player),
    });
  }
  return merged;
}

function publicPlayer(player: any, actor: any, hostActorKey: string, { includeCards = true } = {}) {
  const output: Record<string, unknown> = {
    participant_ref: String(player?.participant_ref || ''),
    username: safeUsername(player?.name, player?.participant_ref),
    name: safeUsername(player?.name, player?.participant_ref),
    ...publicAvatar(player),
    ready: Boolean(player?.ready),
    is_self: actorMatchesPlayer(actor, player),
    is_host: Boolean(hostActorKey && hostActorKey === String(player?.actor_key_hash || '')),
  };
  if (includeCards) output.cards = Array.isArray(player?.cards) ? player.cards : [];
  return output;
}

function normalizeSnapshotScope(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'waiting_room' ? 'waiting_room' : 'game';
}

function publicLobby(lobby: any, actor: any, { summaryOnly = false, snapshotScope = 'game' } = {}) {
  const players = Array.isArray(lobby?.players) ? lobby.players : [];
  const hostActorKey = String(lobby?.host_actor_key_hash || players[0]?.actor_key_hash || '');
  const scope = normalizeSnapshotScope(snapshotScope);
  const base = {
    id: String(lobby?.public_ref || ''),
    code: String(lobby?.code || ''),
    status: String(lobby?.status || 'waiting'),
    host_name: safeUsername(lobby?.host_name || players[0]?.name, lobby?.public_ref || lobby?.code),
    player_count: players.length,
    max_players: Math.max(2, Math.min(4, Number(lobby?.max_players) || 4)),
    current_actor_is_host: actor ? actorIsHost(actor, lobby) : false,
    state_revision: readRevision(lobby?.state_revision),
    last_activity_at: lobby?.last_activity_at || null,
    expires_at: lobby?.expires_at || null,
  };
  if (summaryOnly) return base;
  const rosterProjection = {
    ...base,
    snapshot_scope: scope,
    players: players.map((player) => publicPlayer(player, actor, hostActorKey, { includeCards: scope === 'game' })),
    category: lobby?.category || 'karisik',
    selected_category_ids: Array.isArray(lobby?.selected_category_ids) ? lobby.selected_category_ids : [],
    year_start: Number(lobby?.year_start) || 1900,
    year_end: Number(lobby?.year_end) || new Date().getUTCFullYear(),
    turn_duration: Number(lobby?.turn_duration) || 60,
    win_card_count: Number(lobby?.win_card_count) || 10,
    started_at: lobby?.started_at || null,
    completed_at: lobby?.completed_at || null,
  };
  if (scope === 'waiting_room') return rosterProjection;
  return {
    ...rosterProjection,
    current_player_index: Number(lobby?.current_player_index) || 0,
    current_question_id: lobby?.current_question_id || null,
    used_question_ids: Array.isArray(lobby?.used_question_ids) ? lobby.used_question_ids : [],
    online_question_deck: Array.isArray(lobby?.online_question_deck) ? lobby.online_question_deck : [],
    online_deck_meta: lobby?.online_deck_meta || null,
    winner: lobby?.winner ? safeUsername(lobby.winner, lobby?.winner_participant_ref) : null,
    winner_participant_ref: lobby?.winner_participant_ref || null,
  };
}

function readTime(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return NaN;
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`;
  return Date.parse(normalized);
}

function lobbyIsStale(lobby: any) {
  const explicit = readTime(lobby?.expires_at);
  const touched = readTime(lobby?.last_activity_at || lobby?.updated_date || lobby?.created_date || lobby?.created_at);
  const expiry = Number.isFinite(explicit) ? explicit : touched + LOBBY_STALE_AFTER_MS;
  return Number.isFinite(expiry) && expiry <= Date.now();
}

async function ensureLobbyPublicRef(base44: any, lobby: any) {
  if (!lobby || lobby.public_ref) return lobby;
  const updated = await base44.asServiceRole.entities.Lobby.update(rowId(lobby), { public_ref: randomRef('lobby') });
  return updated || lobby;
}

async function resolveLobby(base44: any, lobbyRef: unknown, code: unknown = '') {
  const ref = String(lobbyRef || '').trim();
  let lobby = null;
  if (ref) {
    const byPublicRef = await base44.asServiceRole.entities.Lobby.filter({ public_ref: ref }, '-updated_date', 2).catch(() => []);
    lobby = byPublicRef?.[0] || null;
    if (!lobby) lobby = await base44.asServiceRole.entities.Lobby.get(ref).catch(() => null);
  }
  const normalizedCode = normalizeCode(code);
  if (!lobby && normalizedCode) {
    const byCode = await base44.asServiceRole.entities.Lobby.filter({ code: normalizedCode }, '-updated_date', 5).catch(() => []);
    lobby = byCode?.[0] || null;
  }
  return lobby ? ensureLobbyPublicRef(base44, lobby) : null;
}

async function acquireLobbyLock(base44: any, lockKey: string, actor: any, scope: string) {
  const entity = base44?.asServiceRole?.entities?.EconomyOperationLock;
  if (!entity?.filter || !entity?.create || !entity?.update) {
    return {
      ok: false,
      response: json({ ok: false, code: 'lobby_lock_unavailable', error: 'Lobi şu anda güncellenemiyor. Lütfen tekrar dene.' }, 503),
    };
  }
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
      actor_key: actor?.actorKeyHash || 'lookup',
      operation_scope: scope,
      operation_id: randomRef('op'),
      status: 'active',
      acquired_at: now.toISOString(),
      expires_at: new Date(now.getTime() + LOBBY_LOCK_TTL_MS).toISOString(),
      metadata: { backendOwned: true, deterministicWinnerAfterSettle: true },
    }).catch(() => null);
    if (!lock) continue;
    await sleep(LOBBY_LOCK_SETTLE_MS);
    const contenders = await entity.filter({ lock_key: lockKey }, 'acquired_at', 25).catch(() => []);
    const live = (contenders || [])
      .filter((row: any) => String(row?.status) === 'active' && readTime(row?.expires_at) > Date.now())
      .sort((a: any, b: any) => {
        const timeDelta = readTime(a?.acquired_at) - readTime(b?.acquired_at);
        return timeDelta || String(rowId(a)).localeCompare(String(rowId(b)));
      });
    if (rowId(live[0]) === rowId(lock)) return { ok: true, lock };
    await entity.update(rowId(lock), { status: 'released', released_at: new Date().toISOString() }).catch(() => null);
  }
  return { ok: false, response: json({ ok: false, code: 'lobby_operation_in_progress', error: 'Lobi güncelleniyor. Lütfen tekrar dene.' }, 409) };
}

async function releaseLobbyLock(base44: any, lock: any) {
  if (!rowId(lock)) return;
  await base44.asServiceRole.entities.EconomyOperationLock.update(rowId(lock), {
    status: 'released',
    released_at: new Date().toISOString(),
  }).catch(() => null);
}

async function appendActorWithRetry(base44: any, lobby: any, actor: any) {
  let latest = lobby;
  for (const delay of [0, 90, 180, 360, 520]) {
    if (delay) await sleep(delay);
    latest = await base44.asServiceRole.entities.Lobby.get(rowId(lobby)).catch(() => latest);
    if (!latest || latest.status !== 'waiting' || lobbyIsStale(latest)) return { ok: false, lobby: latest, code: 'lobby_not_joinable' };
    const players = Array.isArray(latest.players) ? latest.players : [];
    const existing = players.find((player: any) => actorMatchesPlayer(actor, player));
    if (existing) return { ok: true, lobby: latest, alreadyJoined: true };
    const maxPlayers = Math.max(2, Math.min(4, Number(latest.max_players) || 4));
    if (players.length >= maxPlayers) return { ok: false, lobby: latest, code: 'lobby_full' };
    const merged = mergePlayers(players, [internalPlayer(actor)]);
    await base44.asServiceRole.entities.Lobby.update(rowId(latest), {
      players: merged,
      state_revision: readRevision(latest.state_revision) + 1,
      last_activity_at: new Date().toISOString(),
    });
    await sleep(120);
    const verified = await base44.asServiceRole.entities.Lobby.get(rowId(latest));
    if ((verified?.players || []).some((player: any) => actorMatchesPlayer(actor, player))) {
      return { ok: true, lobby: verified, alreadyJoined: false };
    }
  }
  return { ok: false, lobby: latest, code: 'join_race_retry_exhausted' };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || (body?.playerName ? 'join' : 'lookup')).trim().toLowerCase();
    const code = normalizeCode(body?.code);

    if (action === 'lookup') {
      if (!code) return json({ ok: false, found: false, error: 'Lobi kodu boş olamaz.' }, 400);
      const matches = await base44.asServiceRole.entities.Lobby.filter({ code }, '-updated_date', 5).catch(() => []);
      const lobby = matches?.[0] ? await ensureLobbyPublicRef(base44, matches[0]) : null;
      return json({
        ok: true,
        found: Boolean(lobby),
        joinable: Boolean(lobby && lobby.status === 'waiting' && !lobbyIsStale(lobby)),
        lobby: lobby ? publicLobby(lobby, null, { summaryOnly: true }) : null,
      });
    }

    const resolved = await resolveActor(base44, body);
    if (!resolved.ok) return resolved.response;
    const actor = resolved.actor;

    if (action === 'create') {
      if (!code) return json({ ok: false, code: 'invalid_lobby_code', error: 'Lobi kodu oluşturulamadı.' }, 400);
      const lockResult = await acquireLobbyLock(base44, `lobby:create:${code}`, actor, 'lobby_create');
      if (!lockResult.ok) return lockResult.response;
      try {
        const existing = await base44.asServiceRole.entities.Lobby.filter({ code }, '-updated_date', 5).catch(() => []);
        if (existing?.some((row: any) => !['cancelled', 'expired'].includes(String(row?.status || '')))) {
          return json({ ok: false, code: 'lobby_code_collision', error: 'Lobi kodu çakıştı. Lütfen tekrar dene.' }, 409);
        }
        const createdAt = new Date();
        const maxPlayers = Math.max(2, Math.min(4, Number(body?.maxPlayers || body?.max_players) || 2));
        const selectedCategoryIds = Array.isArray(body?.selectedCategories || body?.selected_category_ids)
          ? [...new Set((body.selectedCategories || body.selected_category_ids)
            .map((value: unknown) => Math.trunc(Number(value)))
            .filter((value: number) => Number.isFinite(value) && value > 0))].slice(0, 20)
          : [];
        const publicRef = randomRef('lobby');
        const hostPlayer = internalPlayer(actor);
        const lobby = await base44.asServiceRole.entities.Lobby.create({
          public_ref: publicRef,
          code,
          host_actor_key_hash: actor.actorKeyHash,
          host_email: actor.email,
          host_kronox_user_id: actor.kronoxUserId,
          host_name: actor.username,
          players: [hostPlayer],
          status: 'waiting',
          category: 'karisik',
          selected_category_ids: selectedCategoryIds,
          year_start: 1900,
          year_end: new Date().getUTCFullYear(),
          turn_duration: 60,
          win_card_count: 10,
          max_players: maxPlayers,
          state_revision: 0,
          created_at: createdAt.toISOString(),
          last_activity_at: createdAt.toISOString(),
          expires_at: new Date(createdAt.getTime() + LOBBY_STALE_AFTER_MS).toISOString(),
        });
        return json({ ok: true, created: true, lobby: publicLobby(lobby, actor, { snapshotScope: 'waiting_room' }) });
      } finally {
        await releaseLobbyLock(base44, lockResult.lock);
      }
    }

    if (action === 'find_active') {
      const rows = await base44.asServiceRole.entities.Lobby.list('-updated_date', 100).catch(() => []);
      const lobby = (rows || []).find((candidate: any) => (
        candidate?.status === 'waiting' &&
        !lobbyIsStale(candidate) &&
        (actorIsHost(actor, candidate) || (candidate?.players || []).some((player: any) => actorMatchesPlayer(actor, player)))
      ));
      const withRef = lobby ? await ensureLobbyPublicRef(base44, lobby) : null;
      return json({ ok: true, lobby: withRef ? publicLobby(withRef, actor, { snapshotScope: 'waiting_room' }) : null });
    }

    const lobby = await resolveLobby(base44, body?.lobbyId || body?.lobby_id, code);
    if (!lobby) return json({ ok: false, found: false, code: 'lobby_not_found', error: 'Lobi bulunamadı.' }, 404);
    const isMember = actorIsHost(actor, lobby) || (lobby.players || []).some((player: any) => actorMatchesPlayer(actor, player));

    if (action === 'get') {
      if (!isMember) return json({ ok: false, code: 'not_lobby_participant', error: 'Bu lobiye erişim iznin yok.' }, 403);
      return json({
        ok: true,
        found: true,
        lobby: publicLobby(lobby, actor, { snapshotScope: normalizeSnapshotScope(body?.snapshot_scope) }),
      });
    }

    if (action === 'join') {
      if (lobby.status !== 'waiting' || lobbyIsStale(lobby)) {
        return json({ ok: false, found: true, joinable: false, code: 'lobby_not_joinable', error: 'Bu lobi artık katılıma kapalı.' }, 409);
      }
      const lockResult = await acquireLobbyLock(base44, `lobby:mutate:${rowId(lobby)}`, actor, 'lobby_join');
      if (!lockResult.ok) return lockResult.response;
      try {
        const joined = await appendActorWithRetry(base44, lobby, actor);
        if (!joined.ok) {
          const message = joined.code === 'lobby_full' ? 'Lobi dolu.' : 'Lobi katılımı tamamlanamadı. Lütfen tekrar dene.';
          return json({ ok: false, found: true, joinable: joined.code !== 'lobby_not_joinable', joined: false, code: joined.code, error: message }, 409);
        }
        return json({
          ok: true,
          found: true,
          joinable: true,
          joined: true,
          alreadyJoined: joined.alreadyJoined,
          lobby: publicLobby(joined.lobby, actor, { snapshotScope: 'waiting_room' }),
        });
      } finally {
        await releaseLobbyLock(base44, lockResult.lock);
      }
    }

    if (action === 'leave') {
      if (!isMember) return json({ ok: true, left: true, alreadyLeft: true });
      const lockResult = await acquireLobbyLock(base44, `lobby:mutate:${rowId(lobby)}`, actor, 'lobby_leave');
      if (!lockResult.ok) return lockResult.response;
      try {
        const latest = await base44.asServiceRole.entities.Lobby.get(rowId(lobby));
        if (actorIsHost(actor, latest)) {
          await base44.asServiceRole.entities.Lobby.update(rowId(latest), {
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
            state_revision: readRevision(latest.state_revision) + 1,
          });
          return json({ ok: true, left: true, lobbyClosed: true });
        }
        const players = (latest.players || []).filter((player: any) => !actorMatchesPlayer(actor, player));
        await base44.asServiceRole.entities.Lobby.update(rowId(latest), {
          players,
          last_activity_at: new Date().toISOString(),
          state_revision: readRevision(latest.state_revision) + 1,
        });
        return json({ ok: true, left: true, lobbyClosed: false });
      } finally {
        await releaseLobbyLock(base44, lockResult.lock);
      }
    }

    return json({ ok: false, code: 'unsupported_lobby_action', error: 'Lobi işlemi desteklenmiyor.' }, 400);
  } catch (error) {
    console.error('[findLobbyByCode] failed', error?.message || error);
    return json({ ok: false, code: 'lobby_operation_failed', error: 'Lobi işlemi tamamlanamadı.' }, 500);
  }
});
