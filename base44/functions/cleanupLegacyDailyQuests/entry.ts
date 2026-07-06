/* global Deno */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const DAILY_CALENDAR_RUNTIME_VERSION = 'daily-calendar-streak-v1';
const DELETE_CONFIRMATION = 'DELETE_LEGACY_DAILY_QUESTS';
const LEGACY_QUEST_KEYS = new Set([
  'solo_level_complete',
  'start_1_solo_attempt',
  'correct_5_cards',
  'complete_1_solo_level',
  'use_1_joker',
]);
const LEGACY_QUEST_TYPES = new Set([
  'start_solo_attempt',
  'correct_cards',
  'complete_solo_level',
  'use_joker',
]);

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function rowId(row: any) {
  return row?.id || row?._id || null;
}

function isActiveAdminRole(role: unknown) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}

function isActiveAdminStatus(status: unknown) {
  return String(status || '').trim().toLowerCase() === 'active';
}

const ADMIN_AUTH_FIELD_CANDIDATES = {
  email: ['email', 'Email', 'user_email', 'admin_email'],
  role: ['role', 'Role', 'user_role'],
  status: ['status', 'Status'],
};

function readAdminAuthField(row: any, candidates: string[]) {
  for (const field of candidates) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) {
      return { value: row[field], field };
    }
  }
  return { value: undefined, field: '' };
}

async function getAdminAuthorization(base44: any, user: any) {
  const email = normalizeEmail(user?.email);
  if (!email) return { isAdmin: false, role: '', status: '' };
  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) return { isAdmin: false, role: '', status: '' };

  let rows: any[] = [];
  for (const field of ADMIN_AUTH_FIELD_CANDIDATES.email) {
    const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10).catch(() => []);
    if (Array.isArray(result) && result.length > 0) {
      rows = result;
      break;
    }
  }

  const active = rows
    .map((candidate) => {
      const emailField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.email);
      const roleField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.role);
      const statusField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.status);
      return {
        email: normalizeEmail(emailField.value),
        role: String(roleField.value || '').trim().toLowerCase(),
        status: String(statusField.value || '').trim().toLowerCase(),
      };
    })
    .find((candidate) => candidate.email === email && isActiveAdminStatus(candidate.status) && isActiveAdminRole(candidate.role));

  return { isAdmin: Boolean(active), role: active?.role || '', status: active?.status || '' };
}

async function requireAdmin(base44: any) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) return { response: json({ ok: false, code: 'auth_required', error: 'Giris gerekli.' }, 401) };
    const authorization = await getAdminAuthorization(base44, user);
    if (!authorization.isAdmin) return { response: json({ ok: false, code: 'admin_required', error: 'Admin yetkisi gerekli.' }, 403) };
    return { user, adminRole: authorization.role, adminActorEmail: normalizeEmail(user.email) };
  } catch (_error) {
    return { response: json({ ok: false, code: 'auth_required', error: 'Giris gerekli.' }, 401) };
  }
}

function entityStore(base44: any, entityName: string) {
  return base44?.asServiceRole?.entities?.[entityName] || base44?.entities?.[entityName] || null;
}

async function safeList(base44: any, entityName: string, sort = '-created_at', limit = 1000) {
  const entity = entityStore(base44, entityName);
  if (!entity?.list) return [];
  const rows = await entity.list(sort, limit).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function isLegacyDefinition(row: any) {
  return LEGACY_QUEST_KEYS.has(String(row?.quest_key || '')) ||
    LEGACY_QUEST_TYPES.has(String(row?.quest_type || ''));
}

function isLegacyProgress(row: any) {
  const questKey = String(row?.quest_key || '');
  const runtimeVersion = String(row?.metadata?.runtimeVersion || '');
  if (runtimeVersion === DAILY_CALENDAR_RUNTIME_VERSION || questKey.startsWith('daily_calendar:')) return false;
  return LEGACY_QUEST_KEYS.has(questKey) || LEGACY_QUEST_TYPES.has(String(row?.quest_type || ''));
}

async function deleteRows(base44: any, entityName: string, rows: any[]) {
  const entity = entityStore(base44, entityName);
  if (!entity?.delete) return { deleted: 0, skipped: rows.length, deleteAvailable: false };
  let deleted = 0;
  let skipped = 0;
  for (const row of rows) {
    const id = rowId(row);
    if (!id) {
      skipped += 1;
      continue;
    }
    const ok = await entity.delete(id).then(() => true).catch(() => false);
    if (ok) deleted += 1;
    else skipped += 1;
  }
  return { deleted, skipped, deleteAvailable: true };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    if (admin.response) return admin.response;
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || 'dry_run').trim().toLowerCase();
    if (mode !== 'dry_run' && mode !== 'delete') {
      return json({ ok: false, code: 'invalid_mode', error: 'Geçersiz temizlik modu.' }, 400);
    }
    if (mode === 'delete' && String(body?.confirm || '') !== DELETE_CONFIRMATION) {
      return json({
        ok: false,
        code: 'delete_confirmation_required',
        error: 'Silme için açık admin onayı gerekli.',
        requiredConfirmation: DELETE_CONFIRMATION,
      }, 400);
    }

    const definitions = (await safeList(base44, 'DailyQuestDefinition')).filter(isLegacyDefinition);
    const progressRows = (await safeList(base44, 'UserDailyQuestProgress')).filter(isLegacyProgress);
    const protectedEntities = [
      'DailyWheelSpin',
      'DiamondTransaction',
      'JokerTransaction',
      'User',
      'GuestProfile',
      'Question',
      'QuestionAttemptEvent',
      'PlayerQuestionExposure',
      'Leaderboard',
    ];

    const result = {
      ok: true,
      mode,
      dryRun: mode === 'dry_run',
      runtimeVersion: DAILY_CALENDAR_RUNTIME_VERSION,
      legacyDefinitionCount: definitions.length,
      legacyProgressCount: progressRows.length,
      deleteConfirmation: DELETE_CONFIRMATION,
      protectedEntities,
      deleted: {
        DailyQuestDefinition: 0,
        UserDailyQuestProgress: 0,
      },
      skipped: {
        DailyQuestDefinition: 0,
        UserDailyQuestProgress: 0,
      },
      adminActorEmail: admin.adminActorEmail,
      adminRole: admin.adminRole,
    };

    if (mode === 'delete') {
      const definitionDelete = await deleteRows(base44, 'DailyQuestDefinition', definitions);
      const progressDelete = await deleteRows(base44, 'UserDailyQuestProgress', progressRows);
      result.deleted.DailyQuestDefinition = definitionDelete.deleted;
      result.deleted.UserDailyQuestProgress = progressDelete.deleted;
      result.skipped.DailyQuestDefinition = definitionDelete.skipped;
      result.skipped.UserDailyQuestProgress = progressDelete.skipped;
    }

    return json(result);
  } catch (error) {
    console.error('[cleanupLegacyDailyQuests] failed', error?.message || error);
    return json({
      ok: false,
      code: 'legacy_daily_quest_cleanup_failed',
      error: 'Eski günlük görev temizliği hazırlanamadı.',
    }, 500);
  }
});
