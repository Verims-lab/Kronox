/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const QUEST_TYPES = [
  'start_solo_attempt',
  'correct_cards',
  'complete_solo_level',
  'use_joker',
] as const;
const DAILY_QUEST_RUNTIME_VERSION = 'daily-quest-runtime-v1';
const DAY_MS = 24 * 60 * 60 * 1000;
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

function normalizeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
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

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnightIso(dateKey: string) {
  const start = Date.parse(`${dateKey}T00:00:00.000Z`);
  return new Date(start + DAY_MS).toISOString();
}

function buildAssignmentKey(email: string, dateKey: string, questKey: string) {
  return `daily_quest:${email}:${dateKey}:${questKey}`;
}

function clampProgress(value: unknown, target: unknown) {
  const normalizedTarget = Math.max(1, normalizeNumber(target, 1));
  return Math.max(0, Math.min(normalizedTarget, normalizeNumber(value, 0)));
}

function publicProgress(row: any) {
  const targetValue = Math.max(1, normalizeNumber(row?.target_value, 1));
  const progressValue = clampProgress(row?.progress_value, targetValue);
  const status = ['active', 'completed', 'claimed'].includes(String(row?.status || ''))
    ? String(row.status)
    : (progressValue >= targetValue ? 'completed' : 'active');
  return {
    id: row?.id || null,
    questDefinitionId: row?.quest_definition_id || null,
    questKey: String(row?.quest_key || ''),
    questDate: String(row?.quest_date || ''),
    title: String(row?.title || row?.quest_key || ''),
    description: String(row?.description || ''),
    questType: normalizeQuestType(row?.quest_type),
    progressValue,
    targetValue,
    rewardDiamonds: Math.max(1, normalizeNumber(row?.reward_diamonds, 1)),
    status,
    completedAt: row?.completed_at || null,
    claimedAt: row?.claimed_at || null,
    idempotencyKey: row?.idempotency_key || null,
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
  const duplicateGroups: any[] = [];
  for (const [questKey, groupRows] of grouped.entries()) {
    const sorted = [...groupRows].sort(canonicalDefinitionSort);
    const primary = sorted[0];
    const duplicateRows = sorted.slice(1);
    definitions.push({
      ...primary,
      duplicate_count: duplicateRows.length,
      duplicate_ids: duplicateRows.map((row) => row.id).filter(Boolean),
      canonical_definition_id: primary.id,
    });
    if (duplicateRows.length > 0) {
      duplicateGroups.push({
        quest_key: questKey,
        duplicate_count: duplicateRows.length,
        canonical_definition_id: primary.id,
        duplicate_ids: duplicateRows.map((row) => row.id).filter(Boolean),
      });
    }
  }
  return {
    definitions: definitions.sort(canonicalDefinitionSort),
    duplicateGroups,
  };
}

function progressEntity(base44: any) {
  // Runtime/deployability contract: Daily Quest status explicitly binds
  // entities.UserDailyQuestProgress while retaining the service-role fallback.
  const authEntity = base44?.entities ? base44.entities.UserDailyQuestProgress : null;
  const serviceEntity = base44?.asServiceRole?.entities ? base44.asServiceRole.entities.UserDailyQuestProgress : null;
  return authEntity || serviceEntity;
}

function progressEntitySource(base44: any) {
  return base44?.entities?.UserDailyQuestProgress ? 'auth_user' : 'service_role_fallback';
}

function sortDefinitions(rows: any[] = []) {
  return rows
    .map(publicDefinition)
    .filter((row) => row.id && row.quest_key && row.quest_type)
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      const aCreated = Date.parse(a.created_at || '');
      const bCreated = Date.parse(b.created_at || '');
      if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) {
        return aCreated - bCreated;
      }
      return a.quest_key.localeCompare(b.quest_key, 'tr');
    });
}

async function readActiveDefinitions(base44: any) {
  const entity = base44.asServiceRole.entities.DailyQuestDefinition;
  const rows = await entity.filter({ status: 'active' }, 'sort_order', 100).catch(() => []);
  return dedupeDefinitionsByQuestKey(sortDefinitions(Array.isArray(rows) ? rows : []));
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
  const grouped = dedupeDefinitionsByQuestKey(Array.isArray(rows) ? rows : []);
  return grouped.definitions.length ? grouped.definitions[0] : null;
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
  const rows = [...(Array.isArray(byKey) ? byKey : []), ...(Array.isArray(byQuest) ? byQuest : [])];
  return rows.find((row: any) => row?.id) || null;
}

async function createProgressRow(base44: any, email: string, dateKey: string, definition: any) {
  const entity = progressEntity(base44);
  if (!entity?.create) return null;
  const timestamp = new Date().toISOString();
  const idempotencyKey = buildAssignmentKey(email, dateKey, definition.quest_key);
  const existing = await findProgressByAssignment(base44, email, dateKey, definition.quest_key, idempotencyKey);
  if (existing) return existing;
  try {
    return await entity.create({
      user_email: email,
      quest_definition_id: definition.id,
      quest_key: definition.quest_key,
      quest_date: dateKey,
      title: definition.title,
      description: definition.description,
      quest_type: definition.quest_type,
      progress_value: 0,
      target_value: definition.target_value,
      reward_diamonds: definition.reward_diamonds,
      status: 'active',
      completed_at: null,
      claimed_at: null,
      idempotency_key: idempotencyKey,
      metadata: {
        runtimeVersion: DAILY_QUEST_RUNTIME_VERSION,
        sourceDefinitionStatus: 'active',
        selectionOrder: definition.sort_order,
        serverDayBoundary: 'UTC',
      },
      created_at: timestamp,
      updated_at: timestamp,
    });
  } catch (error) {
    console.error('[getDailyQuestStatus] progress create failed', {
      code: error?.code || 'progress_create_failed',
      questKey: definition.quest_key,
      message: error?.message || 'unknown',
    });
    return await findProgressByAssignment(base44, email, dateKey, definition.quest_key, idempotencyKey);
  }
}

async function ensureTodayDailyQuests(base44: any, email: string, dateKey: string) {
  const seedResult = await ensureDefaultDefinitions(base44);
  const activeDefinitionPayload = await readActiveDefinitions(base44);
  const definitions = activeDefinitionPayload.definitions;
  const selectedDefinitions = definitions.slice(0, DAILY_QUESTS_PER_DAY);
  const selectedQuestKeys = new Set(selectedDefinitions.map((definition) => definition.quest_key));
  let rows = await readTodayRows(base44, email, dateKey);
  const existingQuestKeys = new Set(rows.map((row: any) => String(row?.quest_key || '')));

  for (const definition of selectedDefinitions) {
    if (rows.filter((row: any) => selectedQuestKeys.has(String(row?.quest_key || ''))).length >= DAILY_QUESTS_PER_DAY) break;
    if (existingQuestKeys.has(definition.quest_key)) continue;
    const created = await createProgressRow(base44, email, dateKey, definition);
    if (created?.id) {
      rows.push(created);
      existingQuestKeys.add(definition.quest_key);
    }
  }

  const ensuredRows = rows;
  const refreshedRows = await readTodayRows(base44, email, dateKey);
  rows = refreshedRows.length ? refreshedRows : ensuredRows;
  return {
    definitions: selectedDefinitions,
    activeDefinitionCount: definitions.length,
    definitionDuplicateGroups: activeDefinitionPayload.duplicateGroups,
    duplicateDefinitionCount: activeDefinitionPayload.duplicateGroups.reduce((total, group) => total + Number(group.duplicate_count || 0), 0),
    seededDefaultKeys: seedResult.seededDefaultKeys,
    seedMode: seedResult.seedMode,
    rows: rows
      .filter((row: any) => selectedQuestKeys.has(String(row?.quest_key || '')))
      .sort((a: any, b: any) => String(a?.quest_key || '').localeCompare(String(b?.quest_key || ''), 'tr'))
      .slice(0, DAILY_QUESTS_PER_DAY),
  };
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

    const serverDate = utcDateKey();
    const nextAvailableAt = nextUtcMidnightIso(serverDate);
    const entity = progressEntity(base44);
    const definitionEntity = base44.asServiceRole.entities.DailyQuestDefinition;
    if (!entity?.filter || !entity?.create || !definitionEntity?.filter) {
      return json({ ok: false, code: 'daily_quest_entities_missing', error: 'Günlük görev kayıtları hazır değil.' }, 500);
    }

    const ensured = await ensureTodayDailyQuests(base44, email, serverDate);
    const quests = ensured.rows.map(publicProgress);
    const activeDefinitionCount = ensured.activeDefinitionCount;

    return json({
      ok: true,
      runtimeVersion: DAILY_QUEST_RUNTIME_VERSION,
      serverDate,
      dayBoundary: 'UTC',
      nextAvailableAt,
      quests,
      questCount: quests.length,
      dailyQuestLimit: DAILY_QUESTS_PER_DAY,
      activeDefinitionCount,
      duplicateDefinitionCount: ensured.duplicateDefinitionCount,
      definitionDuplicateGroups: ensured.definitionDuplicateGroups,
      seededDefaultKeys: ensured.seededDefaultKeys,
      seedMode: ensured.seedMode,
      progressEntitySource: progressEntitySource(base44),
      emptyStateReason: quests.length
        ? ''
        : (activeDefinitionCount > 0 ? 'progress_rows_missing_after_ensure' : 'no_active_definitions'),
      adminWarning: activeDefinitionCount < 1 ? 'insufficient_active_definitions' : null,
      noRewardDuringEnsure: true,
      grantsDiamondsOnly: true,
      doesNotGrantKronoxPuan: true,
      noLeaderboardImpact: true,
    });
  } catch (error) {
    console.error('[getDailyQuestStatus] failed', error?.message || error);
    return json({
      ok: false,
      code: 'daily_quest_status_failed',
      error: 'Günlük görevler yüklenemedi. Lütfen tekrar dene.',
    }, 500);
  }
});
