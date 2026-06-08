/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FUNCTION_NAME = 'createDailyQuestDefinition';
const QUEST_TYPES = [
  'start_solo_attempt',
  'correct_cards',
  'complete_solo_level',
  'use_joker',
] as const;
const STATUSES = ['active', 'passive'] as const;
const DAILY_QUEST_DISPLAY_ONLY_CONTRACT = Object.freeze({
  titleDescriptionDisplayOnly: true,
  executableLogicFields: ['quest_type', 'target_value'],
  rewardField: 'reward_diamonds',
  textIsNeverParsedIntoLogic: true,
  noRegexParser: true,
  noAiParser: true,
  noNlpParser: true,
  noArbitraryScripts: true,
  noKronoxPuan: true,
  noLeaderboardImpact: true,
});
const FUTURE_PROGRESS_CONTRACT = Object.freeze({
  futureEntity: 'UserDailyQuestProgress',
  futureStatusValues: ['active', 'completed', 'claimed'],
  futureRewardSource: 'daily_quest_reward',
  oneClaimPerQuestPerUtcDay: true,
});
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

function safeText(value: unknown, maxLength: number) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function nowIso() {
  return new Date().toISOString();
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

function normalizeQuestType(value: unknown) {
  const text = String(value || '').trim();
  return QUEST_TYPES.includes(text as typeof QUEST_TYPES[number]) ? text : '';
}

function normalizeStatus(value: unknown) {
  const text = String(value || '').trim().toLowerCase();
  return STATUSES.includes(text as typeof STATUSES[number]) ? text : 'active';
}

function parsePositiveInteger(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : fallback;
}

function publicDefinition(row: any) {
  return {
    id: row?.id || null,
    quest_key: String(row?.quest_key || ''),
    title: String(row?.title || ''),
    description: String(row?.description || ''),
    quest_type: normalizeQuestType(row?.quest_type),
    target_value: Math.max(1, parsePositiveInteger(row?.target_value, 1)),
    reward_diamonds: Math.max(1, parsePositiveInteger(row?.reward_diamonds, 1)),
    status: normalizeStatus(row?.status),
    sort_order: parsePositiveInteger(row?.sort_order, 0),
    created_by: normalizeEmail(row?.created_by),
    created_at: row?.created_at || row?.created_date || null,
    updated_by: normalizeEmail(row?.updated_by),
    updated_at: row?.updated_at || row?.updated_date || null,
  };
}

function sortDefinitions(rows: any[] = []) {
  return rows
    .map(publicDefinition)
    .sort((a, b) => {
      const orderA = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : 0;
      const orderB = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.quest_key.localeCompare(b.quest_key, 'tr');
    });
}

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function isActiveAdminRole(role: unknown) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}

function isActiveStatus(status: unknown) {
  return String(status || '').trim().toLowerCase() === 'active';
}

const ADMIN_EMAIL_FIELDS = ['email', 'Email', 'user_email', 'admin_email'];
const ADMIN_ROLE_FIELDS = ['role', 'Role', 'user_role'];
const ADMIN_STATUS_FIELDS = ['status', 'Status'];

function readAdminField(row: any, candidates: string[]) {
  for (const field of candidates) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) return row[field];
  }
  return undefined;
}

async function getAdminAuthorization(base44: any, user: any) {
  const email = normalizeEmail(user?.email);
  if (!email) return { isAdmin: false, row: null, role: '', reason: 'no_auth_email' };
  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) return { isAdmin: false, row: null, role: '', reason: 'lookup_error' };
  let rows: any[] = [];
  for (const field of ADMIN_EMAIL_FIELDS) {
    try {
      const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10);
      if (Array.isArray(result) && result.length > 0) { rows = result; break; }
    } catch (_error) { /* try next field */ }
  }
  const activeRow = (rows || [])
    .map((candidate) => ({
      candidate,
      email: normalizeEmail(readAdminField(candidate, ADMIN_EMAIL_FIELDS)),
      role: String(readAdminField(candidate, ADMIN_ROLE_FIELDS) || '').trim().toLowerCase(),
      status: String(readAdminField(candidate, ADMIN_STATUS_FIELDS) || '').trim().toLowerCase(),
    }))
    .find((candidate) => candidate.email === email && isActiveStatus(candidate.status) && isActiveAdminRole(candidate.role));
  return {
    isAdmin: Boolean(activeRow),
    row: activeRow?.candidate || null,
    role: activeRow?.role || '',
    reason: activeRow ? 'active_admin_match' : 'admin_user_not_found',
  };
}

async function requireAdmin(base44: any) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) return { response: json({ ok: false, code: 'unauthenticated', error: 'Oturum doğrulaması gerekli.' }, 401) };
    const authorization = await getAdminAuthorization(base44, user);
    if (!authorization.isAdmin) return { response: json({ ok: false, code: 'admin_required', error: 'Admin yetkisi gerekli.' }, 403) };
    return { user, admin: authorization.row, adminRole: authorization.role, adminEmail: normalizeEmail(user.email) };
  } catch {
    return { response: json({ ok: false, code: 'unauthenticated', error: 'Oturum doğrulaması gerekli.' }, 401) };
  }
}

function validateDefinitionInput(input: any) {
  const quest_key = normalizeQuestKey(input?.quest_key || input?.questKey);
  const title = safeText(input?.title, 120);
  const description = safeText(input?.description, 500);
  const quest_type = normalizeQuestType(input?.quest_type || input?.questType);
  const target_value = parsePositiveInteger(input?.target_value ?? input?.targetValue, 0);
  const reward_diamonds = parsePositiveInteger(input?.reward_diamonds ?? input?.rewardDiamonds, 0);
  const status = normalizeStatus(input?.status);
  const sort_order = parsePositiveInteger(input?.sort_order ?? input?.sortOrder, 0);

  if (!quest_key) return { error: 'missing_quest_key', message: 'Görev anahtarı gerekli.' };
  if (!/^[a-z0-9_]+$/.test(quest_key)) return { error: 'invalid_quest_key', message: 'Görev anahtarı yalnızca küçük harf, sayı ve alt çizgi içermeli.' };
  if (!title) return { error: 'missing_title', message: 'Başlık gerekli.' };
  if (!description) return { error: 'missing_description', message: 'Açıklama gerekli.' };
  if (!quest_type) return { error: 'invalid_quest_type', message: 'Geçerli bir görev tipi seçin.' };
  if (target_value < 1 || reward_diamonds < 1) {
    return { error: 'invalid_positive_numbers', message: 'Hedef ve ödül 1 veya daha büyük olmalı.' };
  }

  return {
    value: {
      quest_key,
      title,
      description,
      quest_type,
      target_value,
      reward_diamonds,
      status,
      sort_order,
    },
  };
}

async function findDefinitionByKey(entity: any, questKey: string) {
  const rows = await entity.filter({ quest_key: questKey }, '-updated_at', 5).catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function listDefinitions(entity: any) {
  let rows: any[] = [];
  if (entity?.list) {
    rows = await entity.list('sort_order', 500).catch(() => []);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    rows = await entity.filter({}, 'sort_order', 500).catch(() => []);
  }
  return sortDefinitions(Array.isArray(rows) ? rows : []);
}

async function ensureSeedDefinitions(entity: any, adminEmail: string) {
  const timestamp = nowIso();
  const created: string[] = [];
  for (const seed of DEFAULT_DEFINITIONS) {
    const existing = await findDefinitionByKey(entity, seed.quest_key);
    if (existing) continue;
    await entity.create({
      ...seed,
      created_by: adminEmail || 'system:daily_quest_seed',
      created_at: timestamp,
      updated_by: adminEmail || 'system:daily_quest_seed',
      updated_at: timestamp,
    });
    created.push(seed.quest_key);
  }
  return created;
}

async function writeAdminLog(base44: any, adminEmail: string, action: string, result: string, metadata: Record<string, unknown>) {
  try {
    await base44.asServiceRole.entities.AdminMaintenanceLog.create({
      action: `admin:${FUNCTION_NAME}:${action}`,
      job_name: FUNCTION_NAME,
      admin_email: adminEmail,
      target_email: adminEmail,
      result,
      retention_status: 'active',
      metadata,
      created_at: nowIso(),
    });
  } catch (_error) {
    /* audit logging is best-effort and must not expose errors to users */
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    if (admin.response) return admin.response;

    const entity = base44?.asServiceRole?.entities?.DailyQuestDefinition;
    if (!entity?.filter || !entity?.create || !entity?.update) {
      return json({ ok: false, code: 'daily_quest_entity_missing', error: 'Günlük görev kayıtları hazır değil.' }, 500);
    }

    const body: any = await readBody(req);
    const action = String(body?.action || 'create').trim().toLowerCase();

    if (action === 'list') {
      const seededKeys = await ensureSeedDefinitions(entity, admin.adminEmail);
      const definitions = await listDefinitions(entity);
      return json({
        ok: true,
        action,
        definitions,
        seededKeys,
        questTypes: QUEST_TYPES,
        statuses: STATUSES,
        displayOnlyContract: DAILY_QUEST_DISPLAY_ONLY_CONTRACT,
        futureProgressContract: FUTURE_PROGRESS_CONTRACT,
      });
    }

    if (action === 'seed') {
      const seededKeys = await ensureSeedDefinitions(entity, admin.adminEmail);
      await writeAdminLog(base44, admin.adminEmail, action, 'success', { seededKeys });
      return json({ ok: true, action, seededKeys, definitions: await listDefinitions(entity) });
    }

    if (action === 'update_status') {
      const id = safeText(body?.id, 120);
      const status = normalizeStatus(body?.status);
      if (!id) return json({ ok: false, code: 'missing_definition_id', error: 'Günlük görev kaydı bulunamadı.' }, 400);
      const updated = await entity.update(id, {
        status,
        updated_by: admin.adminEmail,
        updated_at: nowIso(),
      });
      await writeAdminLog(base44, admin.adminEmail, action, 'success', { id, status });
      return json({
        ok: true,
        action,
        message: 'Günlük görev güncellendi.',
        definition: publicDefinition(updated),
        definitions: await listDefinitions(entity),
      });
    }

    if (action !== 'create') {
      return json({ ok: false, code: 'invalid_action', error: 'Bu işlem desteklenmiyor.' }, 400);
    }

    const validation = validateDefinitionInput(body);
    if (validation.error) {
      return json({ ok: false, code: validation.error, error: validation.message }, 400);
    }

    const value = validation.value;
    const existing = await findDefinitionByKey(entity, value.quest_key);
    if (existing) {
      return json({ ok: false, code: 'duplicate_quest_key', error: 'Bu görev anahtarı zaten var.' }, 409);
    }

    const timestamp = nowIso();
    const created = await entity.create({
      ...value,
      created_by: admin.adminEmail,
      created_at: timestamp,
      updated_by: admin.adminEmail,
      updated_at: timestamp,
    });
    await writeAdminLog(base44, admin.adminEmail, action, 'success', {
      quest_key: value.quest_key,
      quest_type: value.quest_type,
      target_value: value.target_value,
      reward_diamonds: value.reward_diamonds,
      noKronoxPuan: DAILY_QUEST_DISPLAY_ONLY_CONTRACT.noKronoxPuan,
      noLeaderboardImpact: DAILY_QUEST_DISPLAY_ONLY_CONTRACT.noLeaderboardImpact,
    });

    return json({
      ok: true,
      action,
      message: 'Günlük görev kaydedildi.',
      definition: publicDefinition(created),
      definitions: await listDefinitions(entity),
      questTypes: QUEST_TYPES,
      statuses: STATUSES,
      displayOnlyContract: DAILY_QUEST_DISPLAY_ONLY_CONTRACT,
    });
  } catch (error) {
    console.error('[createDailyQuestDefinition] failed', error?.message || error);
    return json({ ok: false, code: 'daily_quest_definition_failed', error: 'Günlük görev işlemi tamamlanamadı. Lütfen tekrar dene.' }, 500);
  }
});
