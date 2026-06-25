import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const MAX_ROWS = 50;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeAdminAuthEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function adminAuthJson(payload: unknown, status = 200) {
  return Response.json(payload, { status });
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
  const email = normalizeAdminAuthEmail(user?.email);
  if (!email) return { isAdmin: false, row: null, role: '', status: '' };
  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) return { isAdmin: false, row: null, role: '', status: '' };

  let rows: any[] = [];
  for (const field of ADMIN_AUTH_FIELD_CANDIDATES.email) {
    const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10).catch(() => []);
    if (Array.isArray(result) && result.length > 0) {
      rows = result;
      break;
    }
  }

  const exactRows = (rows || []).map((candidate: any) => {
    const emailField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.email);
    const roleField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.role);
    const statusField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.status);
    return {
      candidate,
      email: normalizeAdminAuthEmail(emailField.value),
      role: String(roleField.value || '').trim().toLowerCase(),
      status: String(statusField.value || '').trim().toLowerCase(),
    };
  }).filter((candidate) => candidate.email === email);

  const active = exactRows.find((candidate) => isActiveAdminStatus(candidate.status) && isActiveAdminRole(candidate.role)) || null;
  return { isAdmin: Boolean(active?.candidate), row: active?.candidate || null, role: active?.role || '', status: active?.status || '' };
}

async function requireAdmin(base44: any) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) return { response: adminAuthJson({ ok: false, error: 'Authentication required' }, 401) };
    const authorization = await getAdminAuthorization(base44, user);
    if (!authorization.isAdmin) return { response: adminAuthJson({ ok: false, error: 'Admin access required' }, 403) };
    return { user, admin: authorization.row, adminRole: authorization.role };
  } catch (_error) {
    return { response: adminAuthJson({ ok: false, error: 'Authentication required' }, 401) };
  }
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

function emptySoloProgress() {
  return {
    currentLevel: 1,
    unlockedLevel: 1,
    levels: {},
    summary: {
      totalSoloScore: 0,
      currentLevel: 1,
      unlockedLevel: 1,
      totalStars: 0,
      completedLevelCount: 0,
      aggregateBestTimeSeconds: 0,
      totalAttempts: 0,
    },
  };
}

function emptyOnlineProgress() {
  return {
    score: 0,
    peakScore: 0,
    peakCheckpoint: 0,
    wins: 0,
    losses: 0,
    lastMatchId: '',
    lastMatchAt: '',
  };
}

function todayUtcKey() {
  return new Date().toISOString().slice(0, 10);
}

function uniqueRows(rows: any[]) {
  const seen = new Set<string>();
  return (rows || []).filter((row) => {
    const id = String(row?.id || row?._id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function safeFilter(base44: any, entityName: string, filter: Record<string, unknown>, sort = '-created_date', limit = MAX_ROWS) {
  try {
    const entity = base44.asServiceRole.entities[entityName];
    if (!entity?.filter) return [];
    return await entity.filter(filter, sort, limit).catch(() => []);
  } catch {
    return [];
  }
}

async function updateSoloLeaderboardRows(base44: any, targetUser: any, targetEmail: string, nowIso: string) {
  const userId = String(targetUser?.id || '');
  const ownerKey = ownerKeyFromEmail(targetEmail);
  const [byOwner, byCreator] = await Promise.all([
    ownerKey ? safeFilter(base44, 'SoloLeaderboardEntry', { owner_key: ownerKey }, '-updated_at') : Promise.resolve([]),
    userId ? safeFilter(base44, 'SoloLeaderboardEntry', { created_by_id: userId }, '-updated_at') : Promise.resolve([]),
  ]);

  const rows = uniqueRows([...byOwner, ...byCreator]);
  const entity = base44.asServiceRole.entities.SoloLeaderboardEntry;
  if (!entity?.update) return { updated: 0, available: false };

  let updated = 0;
  for (const row of rows) {
    await entity.update(row.id, {
      total_kronox_score: 0,
      total_solo_score: 0,
      online_score: 0,
      current_level: 1,
      unlocked_level: 1,
      total_stars: 0,
      completed_level_count: 0,
      aggregate_best_time_seconds: 0,
      updated_at: nowIso,
    });
    updated += 1;
  }
  return { updated, available: true };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const adminAuth = await requireAdmin(base44);
    if (adminAuth.response) return adminAuth.response;

    const body = await req.json().catch(() => ({}));
    const targetEmail = normalizeEmail(body?.targetEmail || body?.email);
    const confirmEmail = normalizeEmail(body?.confirmEmail);
    if (!targetEmail) {
      return json({
        ok: false,
        code: 'missing_target_email',
        error: 'Hedef test hesabı e-postası gerekli.',
      }, 400);
    }
    if (confirmEmail !== targetEmail) {
      return json({
        ok: false,
        code: 'confirmation_mismatch',
        error: 'Onay e-postası hedef test hesabı e-postası ile birebir aynı olmalı.',
      }, 400);
    }

    const users = await safeFilter(base44, 'User', { email: targetEmail }, '-created_date', 5);
    const targetUser = users.find((user: any) => normalizeEmail(user?.email) === targetEmail) || null;
    if (!targetUser?.id) {
      return json({ ok: false, code: 'account_not_found', error: 'Test hesabı bulunamadı.' }, 404);
    }

    const nowIso = new Date().toISOString();
    const patch = {
      solo_progress: emptySoloProgress(),
      online_progress: emptyOnlineProgress(),
      kronox_puan_total: 0,
      diamonds: 0,
      starter_bonus_granted_at: nowIso,
      last_daily_diamond_reward_date: todayUtcKey(),
      economy_updated_at: nowIso,
    };

    await base44.asServiceRole.entities.User.update(targetUser.id, patch);
    const leaderboard = await updateSoloLeaderboardRows(base44, targetUser, targetEmail, nowIso);

    return json({
      ok: true,
      authorization: {
        source: 'AdminUser',
        role: adminAuth.adminRole,
        status: 'active',
      },
      reset: {
        user: true,
        leaderboard,
        fields: Object.keys(patch),
        scope: [
          'User.solo_progress',
          'User.online_progress',
          'User.kronox_puan_total',
          'User.diamonds',
          'User.daily reward guard fields',
          'SoloLeaderboardEntry score/progress projection',
        ],
      },
    });
  } catch {
    console.error('[resetTestAccountProgress] failed', { reason: 'test_account_reset_failed' });
    return json({
      ok: false,
      code: 'test_account_reset_failed',
      error: 'Test hesabı sıfırlanamadı. Lütfen tekrar deneyin.',
    }, 500);
  }
});
