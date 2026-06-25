/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const QUEST_TYPES = [
  'start_solo_attempt',
  'correct_cards',
  'complete_solo_level',
  'use_joker',
] as const;
const DAILY_QUEST_RUNTIME_VERSION = 'daily-quest-runtime-v1';
const DAILY_QUESTS_PER_DAY = 1;
const GUEST_ID_PREFIX = 'guest_';
const DEFAULT_DEFINITIONS = [
  {
    quest_key: 'start_1_solo_attempt',
    title: 'Solo’ya Başla',
    description: 'Bugün 1 Solo oyunu başlat.',
    quest_type: 'start_solo_attempt',
    target_value: 1,
    reward_diamonds: 20,
    status: 'active',
    sort_order: 10,
  },
  {
    quest_key: 'correct_5_cards',
    title: '5 Kart Doğru Yerleştir',
    description: 'Bugün 5 kartı doğru yerleştir.',
    quest_type: 'correct_cards',
    target_value: 5,
    reward_diamonds: 30,
    status: 'active',
    sort_order: 20,
  },
  {
    quest_key: 'complete_1_solo_level',
    title: '1 Level Tamamla',
    description: 'Bugün 1 Solo level tamamla.',
    quest_type: 'complete_solo_level',
    target_value: 1,
    reward_diamonds: 50,
    status: 'active',
    sort_order: 30,
  },
  {
    quest_key: 'use_1_joker',
    title: '1 Joker Kullan',
    description: 'Bugün 1 joker kullan.',
    quest_type: 'use_joker',
    target_value: 1,
    reward_diamonds: 20,
    status: 'active',
    sort_order: 40,
  },
] as const;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeQuestType(value: unknown) {
  const text = String(value || '').trim();
  return QUEST_TYPES.includes(text as typeof QUEST_TYPES[number]) ? text : '';
}

function normalizeQuestKey(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function normalizeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function buildAssignmentKey(email: string, dateKey: string, questKey: string) {
  return `daily_quest:${email}:${dateKey}:${questKey}`;
}

function buildProgressEventKey(email: string, dateKey: string, questKey: string, eventType: string, eventId: string) {
  const safeEventId = String(eventId || 'event').trim().replace(/[^a-zA-Z0-9_.:@-]/g, '_').slice(0, 160);
  return `daily_quest_progress:${email}:${dateKey}:${questKey}:${eventType}:${safeEventId}`;
}

function safeCredentialText(value: unknown, maxLength = 180) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) return '';
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : '';
}

function normalizeGuestId(value: unknown) {
  const text = safeCredentialText(value, 80);
  return text.startsWith(GUEST_ID_PREFIX) ? text : '';
}

function normalizeGuestToken(value: unknown) {
  return safeCredentialText(value, 220);
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function ownerKeyFromEmail(rawEmail: unknown) {
  const email = normalizeEmail(rawEmail);
  if (!email) return '';
  let hash = 2166136261;
  for (let i = 0; i < email.length; i += 1) {
    hash ^= email.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function ownerKeyFromGuestId(rawGuestId: unknown) {
  const guestId = String(rawGuestId || '').trim().toLowerCase();
  if (!guestId) return '';
  let hash = 2166136261;
  for (let i = 0; i < guestId.length; i += 1) {
    hash ^= guestId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `g_${(hash >>> 0).toString(36)}`;
}

function guestPlayerKey(guestId: string) {
  const ownerKey = ownerKeyFromGuestId(guestId);
  return ownerKey ? `guest:${ownerKey}` : '';
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToBase64Url(new Uint8Array(digest));
}

async function hashGuestToken(guestId: string, guestToken: string) {
  return sha256Base64Url(`kronox_guest_v1:${guestId}:${guestToken}`);
}

function isGuestProfileComplete(row: any) {
  const status = String(row?.onboarding_status || '').trim();
  if (status === 'onboarding_complete' || status === 'completed') return true;
  const profileCompleted = String(row?.profile_setup_status || '').trim() === 'completed' || Boolean(row?.profile_setup_completed_at);
  const categoryCompleted = String(row?.category_setup_status || '').trim() === 'completed' ||
    Boolean(row?.category_setup_completed_at || row?.onboarding_completed_at);
  return Boolean(profileCompleted && categoryCompleted);
}

async function findGuestProfile(base44: any, guestId: string) {
  const entity = base44?.asServiceRole?.entities?.GuestProfile || base44?.entities?.GuestProfile;
  if (!entity?.filter || !guestId) return null;
  const rows = await entity.filter({ guest_id: guestId }, '-created_at', 5).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function resolveDailyQuestPlayer(base44: any, body: any) {
  const user = await base44.auth.me().catch(() => null);
  const email = normalizeEmail(user?.email) || normalizeEmail(user?.user_email);
  if (email && rowId(user)) {
    return {
      ok: true,
      isGuest: false,
      row: user,
      playerKey: email,
      ownerKey: ownerKeyFromEmail(email),
      response: null,
    };
  }

  const guestId = normalizeGuestId(body?.guest_id);
  const guestToken = normalizeGuestToken(body?.guest_token);
  if (!guestId || !guestToken) {
    return { ok: false, response: json({ ok: false, code: 'unauthenticated', error: 'Günlük görev ilerlemesi için profilini tamamlamalısın.' }, 401) };
  }
  const guest = await findGuestProfile(base44, guestId);
  const expectedHash = String(guest?.guest_token_hash || '');
  const providedHash = await hashGuestToken(guestId, guestToken);
  if (!guest || !expectedHash || expectedHash !== providedHash) {
    return { ok: false, response: json({ ok: false, code: 'invalid_guest_token', error: 'Misafir oturumu doğrulanamadı.' }, 401) };
  }
  if (String(guest?.status || '') === 'linked' || !isGuestProfileComplete(guest)) {
    return { ok: false, response: json({ ok: false, code: 'guest_profile_incomplete', error: 'Günlük görev ilerlemesi için profilini tamamlamalısın.' }, 403) };
  }
  return {
    ok: true,
    isGuest: true,
    row: guest,
    playerKey: guestPlayerKey(guestId),
    ownerKey: ownerKeyFromGuestId(guestId),
    response: null,
  };
}

function publicProgress(row: any) {
  const targetValue = Math.max(1, normalizeNumber(row?.target_value, 1));
  const progressValue = Math.max(0, Math.min(targetValue, normalizeNumber(row?.progress_value, 0)));
  return {
    id: row?.id || null,
    questKey: String(row?.quest_key || ''),
    questDate: String(row?.quest_date || ''),
    title: String(row?.title || row?.quest_key || ''),
    description: String(row?.description || ''),
    questType: normalizeQuestType(row?.quest_type),
    progressValue,
    targetValue,
    rewardDiamonds: Math.max(1, normalizeNumber(row?.reward_diamonds, 1)),
    status: String(row?.status || (progressValue >= targetValue ? 'completed' : 'active')),
    completedAt: row?.completed_at || null,
    claimedAt: row?.claimed_at || null,
  };
}

function publicDefinition(row: any) {
  return {
    id: row?.id || null,
    quest_key: normalizeQuestKey(row?.quest_key),
    title: String(row?.title || ''),
    description: String(row?.description || ''),
    quest_type: normalizeQuestType(row?.quest_type),
    target_value: Math.max(1, normalizeNumber(row?.target_value, 1)),
    reward_diamonds: Math.max(1, normalizeNumber(row?.reward_diamonds, 1)),
    sort_order: normalizeNumber(row?.sort_order, 0),
    created_at: row?.created_at || row?.created_date || '',
  };
}

function canonicalDefinitionSort(a: any, b: any) {
  const orderA = normalizeNumber(a?.sort_order, 0);
  const orderB = normalizeNumber(b?.sort_order, 0);
  if (orderA !== orderB) return orderA - orderB;
  const createdA = Date.parse(String(a?.created_at || a?.created_date || ''));
  const createdB = Date.parse(String(b?.created_at || b?.created_date || ''));
  if (Number.isFinite(createdA) && Number.isFinite(createdB) && createdA !== createdB) {
    return createdA - createdB;
  }
  return String(a?.id || '').localeCompare(String(b?.id || ''), 'tr');
}

function dedupeDefinitionsByQuestKey(rows: any[] = []) {
  const grouped = new Map<string, any[]>();
  for (const row of rows || []) {
    const definition = publicDefinition(row);
    if (!definition.id || !definition.quest_key || !definition.quest_type) continue;
    if (!grouped.has(definition.quest_key)) grouped.set(definition.quest_key, []);
    grouped.get(definition.quest_key)?.push(definition);
  }
  const definitions: any[] = [];
  for (const groupRows of grouped.values()) {
    const sorted = [...groupRows].sort(canonicalDefinitionSort);
    const primary = sorted[0];
    definitions.push({
      ...primary,
      duplicate_count: sorted.length - 1,
      duplicate_ids: sorted.slice(1).map((row) => row.id).filter(Boolean),
      canonical_definition_id: primary.id,
    });
  }
  return definitions.sort(canonicalDefinitionSort);
}

function boundedEventKeys(metadata: any) {
  const keys = metadata?.progress_event_keys;
  return Array.isArray(keys) ? keys.map((key) => String(key)).slice(-80) : [];
}

function progressEntity(base44: any, player: any = null) {
  // Runtime/deployability contract: Daily Quest progress explicitly binds
  // entities.UserDailyQuestProgress while retaining the service-role fallback.
  const authEntity = base44?.entities ? base44.entities.UserDailyQuestProgress : null;
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.UserDailyQuestProgress : null;
  return player?.isGuest ? serviceEntity : (authEntity || serviceEntity);
}

function progressEntitySource(base44: any, player: any = null) {
  if (player?.isGuest) return 'service_role_guest';
  return base44?.entities?.UserDailyQuestProgress ? 'auth_user' : 'service_role_fallback';
}

async function readActiveDefinitions(base44: any) {
  const rows = await base44.asServiceRole.entities.DailyQuestDefinition
    .filter({ status: 'active' }, 'sort_order', 100)
    .catch(() => []);
  return dedupeDefinitionsByQuestKey(Array.isArray(rows) ? rows : []);
}

async function readAllDefinitions(base44: any) {
  const entity = base44.asServiceRole.entities.DailyQuestDefinition;
  if (entity?.list) {
    const rows = await entity.list('sort_order', 100).catch(() => []);
    if (Array.isArray(rows) && rows.length) return rows;
  }
  const rows = await entity.filter({}, 'sort_order', 100).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function findDefinitionByKey(base44: any, questKey: string) {
  const normalizedQuestKey = normalizeQuestKey(questKey);
  const rows = await base44.asServiceRole.entities.DailyQuestDefinition
    .filter({ quest_key: normalizedQuestKey }, '-updated_at', 50)
    .catch(() => []);
  const definitions = dedupeDefinitionsByQuestKey(Array.isArray(rows) ? rows : []);
  return definitions.length ? definitions[0] : null;
}

async function ensureDefaultDefinitions(base44: any) {
  const entity = base44.asServiceRole.entities.DailyQuestDefinition;
  const allDefinitions = await readAllDefinitions(base44);
  if (allDefinitions.length > 0) {
    return { seededDefaultKeys: [], seedMode: 'definitions_present' };
  }
  if (!entity?.create) {
    return { seededDefaultKeys: [], seedMode: 'definition_create_unavailable' };
  }
  const timestamp = new Date().toISOString();
  const seededDefaultKeys: string[] = [];
  const existingKeys = new Set(
    (allDefinitions || [])
      .map((definition: any) => normalizeQuestKey(definition?.quest_key))
      .filter(Boolean),
  );
  for (const definition of DEFAULT_DEFINITIONS) {
    if (existingKeys.has(definition.quest_key)) continue;
    const existing = await findDefinitionByKey(base44, definition.quest_key);
    if (existing) {
      existingKeys.add(definition.quest_key);
      continue;
    }
    try {
      await entity.create({
        ...definition,
        created_by: 'system:daily_quest_runtime_seed',
        created_at: timestamp,
        updated_by: 'system:daily_quest_runtime_seed',
        updated_at: timestamp,
      });
      seededDefaultKeys.push(definition.quest_key);
      existingKeys.add(definition.quest_key);
    } catch (error) {
      const afterRace = await findDefinitionByKey(base44, definition.quest_key);
      if (!afterRace) throw error;
      existingKeys.add(definition.quest_key);
    }
  }
  return { seededDefaultKeys, seedMode: seededDefaultKeys.length ? 'default_seed_created' : 'default_seed_existing' };
}

async function readTodayRows(base44: any, player: any, dateKey: string) {
  const entity = progressEntity(base44, player);
  if (!entity?.filter) return [];
  const rows = await entity
    .filter({ user_email: player.playerKey, quest_date: dateKey }, 'created_at', 20)
    .catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function findProgressByAssignment(base44: any, player: any, dateKey: string, questKey: string, idempotencyKey: string) {
  const entity = progressEntity(base44, player);
  if (!entity?.filter) return null;
  const [byKey, byQuest] = await Promise.all([
    entity
      .filter({ user_email: player.playerKey, idempotency_key: idempotencyKey }, '-created_at', 1)
      .catch(() => []),
    entity
      .filter({ user_email: player.playerKey, quest_date: dateKey, quest_key: questKey }, '-created_at', 1)
      .catch(() => []),
  ]);
  return [...(Array.isArray(byKey) ? byKey : []), ...(Array.isArray(byQuest) ? byQuest : [])]
    .find((row: any) => row?.id) || null;
}

async function createProgressRow(base44: any, player: any, dateKey: string, definition: any) {
  const entity = progressEntity(base44, player);
  if (!entity?.create) return null;
  const timestamp = new Date().toISOString();
  const idempotencyKey = buildAssignmentKey(player.playerKey, dateKey, String(definition.quest_key || ''));
  const existing = await findProgressByAssignment(base44, player, dateKey, String(definition.quest_key || ''), idempotencyKey);
  if (existing) return existing;
  try {
    return await entity.create({
      user_email: player.playerKey,
      owner_key: player.ownerKey,
      player_type: player.isGuest ? 'guest' : 'registered',
      quest_definition_id: definition.id,
      quest_key: String(definition.quest_key || ''),
      quest_date: dateKey,
      title: String(definition.title || ''),
      description: String(definition.description || ''),
      quest_type: normalizeQuestType(definition.quest_type),
      progress_value: 0,
      target_value: Math.max(1, normalizeNumber(definition.target_value, 1)),
      reward_diamonds: Math.max(1, normalizeNumber(definition.reward_diamonds, 1)),
      status: 'active',
      completed_at: null,
      claimed_at: null,
      idempotency_key: idempotencyKey,
      metadata: {
        runtimeVersion: DAILY_QUEST_RUNTIME_VERSION,
        serverDayBoundary: 'UTC',
        guestProfileQuest: player.isGuest,
        rawGuestTokenServerStored: false,
      },
      created_at: timestamp,
      updated_at: timestamp,
    });
  } catch (error) {
    console.error('[recordDailyQuestProgress] progress create failed', {
      code: error?.code || 'progress_create_failed',
      questKey: definition.quest_key,
      message: error?.message || 'unknown',
    });
    return await findProgressByAssignment(base44, player, dateKey, String(definition.quest_key || ''), idempotencyKey);
  }
}

async function ensureTodayDailyQuests(base44: any, player: any, dateKey: string) {
  await ensureDefaultDefinitions(base44);
  const definitions = await readActiveDefinitions(base44);
  const selectedDefinitions = definitions.slice(0, DAILY_QUESTS_PER_DAY);
  const selectedQuestKeys = new Set(selectedDefinitions.map((definition: any) => String(definition.quest_key || '')));
  let rows = await readTodayRows(base44, player, dateKey);
  const keys = new Set(rows.map((row: any) => String(row?.quest_key || '')));
  for (const definition of selectedDefinitions) {
    if (rows.filter((row: any) => selectedQuestKeys.has(String(row?.quest_key || ''))).length >= DAILY_QUESTS_PER_DAY) break;
    if (keys.has(String(definition.quest_key || ''))) continue;
    const created = await createProgressRow(base44, player, dateKey, definition);
    if (created?.id) {
      rows.push(created);
      keys.add(String(definition.quest_key || ''));
    }
  }
  const refreshedRows = await readTodayRows(base44, player, dateKey);
  return (refreshedRows.length ? refreshedRows : rows)
    .filter((row: any) => selectedQuestKeys.has(String(row?.quest_key || '')))
    .slice(0, DAILY_QUESTS_PER_DAY);
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const player = await resolveDailyQuestPlayer(base44, body);
    if (!player.ok) return player.response;
    const eventType = normalizeQuestType(body?.eventType || body?.quest_type || body?.questType);
    const mode = String(body?.mode || '').trim().toLowerCase();
    if (!eventType) return json({ ok: false, code: 'invalid_quest_event', error: 'Görev olayı geçersiz.' }, 400);
    if (mode !== 'solo') {
      return json({ ok: true, skipped: true, reason: 'non_solo_mode', updated: [], onlineModeExcluded: true });
    }

    const dateKey = utcDateKey();
    const rows = await ensureTodayDailyQuests(base44, player, dateKey);
    const amount = Math.max(1, Math.min(25, normalizeNumber(body?.amount, 1)));
    const baseEventId = String(body?.eventId || body?.event_id || body?.idempotencyKey || '').trim();
    const updates: any[] = [];

    for (const row of rows) {
      if (normalizeQuestType(row?.quest_type) !== eventType) continue;
      if (String(row?.status || '') === 'claimed' || row?.claimed_at) {
        updates.push({ questKey: row?.quest_key, skipped: true, reason: 'already_claimed' });
        continue;
      }

      const eventKey = buildProgressEventKey(player.playerKey, dateKey, String(row?.quest_key || ''), eventType, baseEventId || `${Date.now()}`);
      const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
      const eventKeys = boundedEventKeys(metadata);
      if (eventKeys.includes(eventKey)) {
        updates.push({ questKey: row?.quest_key, skipped: true, reason: 'duplicate_event', eventKey });
        continue;
      }

      const targetValue = Math.max(1, normalizeNumber(row?.target_value, 1));
      const currentProgress = Math.max(0, Math.min(targetValue, normalizeNumber(row?.progress_value, 0)));
      const nextProgress = Math.min(targetValue, currentProgress + amount);
      const completedNow = currentProgress < targetValue && nextProgress >= targetValue;
      const timestamp = new Date().toISOString();
      const nextStatus = nextProgress >= targetValue ? 'completed' : 'active';
      const entity = progressEntity(base44, player);
      if (!entity?.update) {
        updates.push({ questKey: row?.quest_key, skipped: true, reason: 'progress_update_unavailable' });
        continue;
      }
      const updated = await entity.update(row.id, {
        progress_value: nextProgress,
        status: nextStatus,
        completed_at: row?.completed_at || (completedNow ? timestamp : null),
        updated_at: timestamp,
        last_event_key: eventKey,
        metadata: {
          ...metadata,
          runtimeVersion: DAILY_QUEST_RUNTIME_VERSION,
          progress_event_keys: [...eventKeys, eventKey].slice(-80),
          lastEventType: eventType,
          lastEventId: baseEventId || null,
          lastMode: 'solo',
        },
      });
      updates.push(publicProgress(updated));
    }

    const refreshedRows = await ensureTodayDailyQuests(base44, player, dateKey);
    const responseRows = refreshedRows.length ? refreshedRows : rows;
    return json({
      ok: true,
      eventType,
      mode: 'solo',
      playerType: player.isGuest ? 'guest' : 'registered',
      guestProfile: player.isGuest,
      serverDate: dateKey,
      progressEntitySource: progressEntitySource(base44, player),
      updated: updates,
      dailyQuestLimit: DAILY_QUESTS_PER_DAY,
      quests: responseRows.slice(0, DAILY_QUESTS_PER_DAY).map(publicProgress),
      noDiamondGrantDuringProgress: true,
      grantsDiamondsOnlyOnClaim: true,
      noKronoxPuan: true,
      noLeaderboardImpact: true,
    });
  } catch (error) {
    console.error('[recordDailyQuestProgress] failed', error?.message || error);
    return json({
      ok: false,
      code: 'daily_quest_progress_failed',
      error: 'Günlük görev ilerlemesi kaydedilemedi.',
    }, 500);
  }
});
