/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const QUEST_TYPES = [
  'start_solo_attempt',
  'correct_cards',
  'complete_solo_level',
  'use_joker',
] as const;
const DAILY_QUEST_RUNTIME_VERSION = 'daily-quest-runtime-v1';
const DAILY_QUESTS_PER_DAY = 1;
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

function boundedEventKeys(metadata: any) {
  const keys = metadata?.progress_event_keys;
  return Array.isArray(keys) ? keys.map((key) => String(key)).slice(-80) : [];
}

function progressEntity(base44: any) {
  return base44?.entities?.UserDailyQuestProgress
    || base44?.asServiceRole?.entities?.UserDailyQuestProgress;
}

function progressEntitySource(base44: any) {
  return base44?.entities?.UserDailyQuestProgress ? 'auth_user' : 'service_role_fallback';
}

async function readActiveDefinitions(base44: any) {
  const rows = await base44.asServiceRole.entities.DailyQuestDefinition
    .filter({ status: 'active' }, 'sort_order', 100)
    .catch(() => []);
  return (Array.isArray(rows) ? rows : [])
    .filter((row: any) => row?.id && row?.quest_key && normalizeQuestType(row?.quest_type))
    .sort((a: any, b: any) => {
      const orderA = normalizeNumber(a?.sort_order, 0);
      const orderB = normalizeNumber(b?.sort_order, 0);
      if (orderA !== orderB) return orderA - orderB;
      const createdA = Date.parse(String(a?.created_at || a?.created_date || ''));
      const createdB = Date.parse(String(b?.created_at || b?.created_date || ''));
      if (Number.isFinite(createdA) && Number.isFinite(createdB) && createdA !== createdB) {
        return createdA - createdB;
      }
      return String(a?.quest_key || '').localeCompare(String(b?.quest_key || ''), 'tr');
    });
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
  const rows = await base44.asServiceRole.entities.DailyQuestDefinition
    .filter({ quest_key: questKey }, '-updated_at', 5)
    .catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
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
  for (const definition of DEFAULT_DEFINITIONS) {
    const existing = await findDefinitionByKey(base44, definition.quest_key);
    if (existing) continue;
    await entity.create({
      ...definition,
      created_by: 'system:daily_quest_runtime_seed',
      created_at: timestamp,
      updated_by: 'system:daily_quest_runtime_seed',
      updated_at: timestamp,
    });
    seededDefaultKeys.push(definition.quest_key);
  }
  return { seededDefaultKeys, seedMode: seededDefaultKeys.length ? 'default_seed_created' : 'default_seed_existing' };
}

async function readTodayRows(base44: any, email: string, dateKey: string) {
  const entity = progressEntity(base44);
  if (!entity?.filter) return [];
  const rows = await entity
    .filter({ user_email: email, quest_date: dateKey }, 'created_at', 20)
    .catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function findProgressByAssignment(base44: any, email: string, dateKey: string, questKey: string, idempotencyKey: string) {
  const entity = progressEntity(base44);
  if (!entity?.filter) return null;
  const [byKey, byQuest] = await Promise.all([
    entity
      .filter({ user_email: email, idempotency_key: idempotencyKey }, '-created_at', 1)
      .catch(() => []),
    entity
      .filter({ user_email: email, quest_date: dateKey, quest_key: questKey }, '-created_at', 1)
      .catch(() => []),
  ]);
  return [...(Array.isArray(byKey) ? byKey : []), ...(Array.isArray(byQuest) ? byQuest : [])]
    .find((row: any) => row?.id) || null;
}

async function createProgressRow(base44: any, email: string, dateKey: string, definition: any) {
  const entity = progressEntity(base44);
  if (!entity?.create) return null;
  const timestamp = new Date().toISOString();
  const idempotencyKey = buildAssignmentKey(email, dateKey, String(definition.quest_key || ''));
  const existing = await findProgressByAssignment(base44, email, dateKey, String(definition.quest_key || ''), idempotencyKey);
  if (existing) return existing;
  try {
    return await entity.create({
      user_email: email,
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
      metadata: { runtimeVersion: DAILY_QUEST_RUNTIME_VERSION, serverDayBoundary: 'UTC' },
      created_at: timestamp,
      updated_at: timestamp,
    });
  } catch (error) {
    console.error('[recordDailyQuestProgress] progress create failed', {
      code: error?.code || 'progress_create_failed',
      questKey: definition.quest_key,
      message: error?.message || 'unknown',
    });
    return await findProgressByAssignment(base44, email, dateKey, String(definition.quest_key || ''), idempotencyKey);
  }
}

async function ensureTodayDailyQuests(base44: any, email: string, dateKey: string) {
  await ensureDefaultDefinitions(base44);
  const definitions = await readActiveDefinitions(base44);
  const selectedDefinitions = definitions.slice(0, DAILY_QUESTS_PER_DAY);
  const selectedQuestKeys = new Set(selectedDefinitions.map((definition: any) => String(definition.quest_key || '')));
  let rows = await readTodayRows(base44, email, dateKey);
  const keys = new Set(rows.map((row: any) => String(row?.quest_key || '')));
  for (const definition of selectedDefinitions) {
    if (rows.filter((row: any) => selectedQuestKeys.has(String(row?.quest_key || ''))).length >= DAILY_QUESTS_PER_DAY) break;
    if (keys.has(String(definition.quest_key || ''))) continue;
    const created = await createProgressRow(base44, email, dateKey, definition);
    if (created?.id) {
      rows.push(created);
      keys.add(String(definition.quest_key || ''));
    }
  }
  const refreshedRows = await readTodayRows(base44, email, dateKey);
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
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {
      return json({ ok: false, code: 'unauthenticated', error: 'Günlük görevler için giriş yapmalısın.' }, 401);
    }
    const email = normalizeEmail(user?.email);
    if (!email) {
      return json({ ok: false, code: 'unauthenticated', error: 'Günlük görevler için giriş yapmalısın.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const eventType = normalizeQuestType(body?.eventType || body?.quest_type || body?.questType);
    const mode = String(body?.mode || '').trim().toLowerCase();
    if (!eventType) return json({ ok: false, code: 'invalid_quest_event', error: 'Görev olayı geçersiz.' }, 400);
    if (mode !== 'solo') {
      return json({ ok: true, skipped: true, reason: 'non_solo_mode', updated: [], onlineModeExcluded: true });
    }

    const dateKey = utcDateKey();
    const rows = await ensureTodayDailyQuests(base44, email, dateKey);
    const amount = Math.max(1, Math.min(25, normalizeNumber(body?.amount, 1)));
    const baseEventId = String(body?.eventId || body?.event_id || body?.idempotencyKey || '').trim();
    const updates: any[] = [];

    for (const row of rows) {
      if (normalizeQuestType(row?.quest_type) !== eventType) continue;
      if (String(row?.status || '') === 'claimed' || row?.claimed_at) {
        updates.push({ questKey: row?.quest_key, skipped: true, reason: 'already_claimed' });
        continue;
      }

      const eventKey = buildProgressEventKey(email, dateKey, String(row?.quest_key || ''), eventType, baseEventId || `${Date.now()}`);
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
      const entity = progressEntity(base44);
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

    const refreshedRows = await ensureTodayDailyQuests(base44, email, dateKey);
    const responseRows = refreshedRows.length ? refreshedRows : rows;
    return json({
      ok: true,
      eventType,
      mode: 'solo',
      serverDate: dateKey,
      progressEntitySource: progressEntitySource(base44),
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
