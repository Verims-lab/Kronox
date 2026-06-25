import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
const JOB_NAME = 'refreshLeaderboardProjection';

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

  const exactRows = (rows || [])
    .map((candidate: any) => {
      const emailField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.email);
      const roleField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.role);
      const statusField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.status);
      return {
        candidate,
        email: normalizeAdminAuthEmail(emailField.value),
        role: String(roleField.value || '').trim().toLowerCase(),
        status: String(statusField.value || '').trim().toLowerCase(),
      };
    })
    .filter((candidate) => candidate.email === email);

  const active = exactRows.find((candidate) => (
    isActiveAdminStatus(candidate.status) && isActiveAdminRole(candidate.role)
  )) || null;

  return {
    isAdmin: Boolean(active?.candidate),
    row: active?.candidate || null,
    role: active?.role || '',
    status: active?.status || '',
  };
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

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch (_error) {
    return {};
  }
}

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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

function getInitial(user: any) {
  const source = String(user?.display_name || user?.full_name || user?.name || user?.email || '?').trim();
  return (source[0] || '?').toUpperCase();
}

function getDisplayName(user: any) {
  return String(user?.display_name || user?.full_name || user?.name || 'Kronox Oyuncusu').trim();
}

function getSoloSummary(progress: any) {
  const summary = progress?.summary && typeof progress.summary === 'object' ? progress.summary : {};
  const levels = progress?.levels && typeof progress.levels === 'object' ? progress.levels : {};
  let totalSoloScore = Math.max(0, Math.floor(safeNumber(summary.totalSoloScore)));
  let totalStars = Math.max(0, Math.floor(safeNumber(summary.totalStars)));
  let completedLevelCount = Math.max(0, Math.floor(safeNumber(summary.completedLevelCount)));

  if (!totalSoloScore && Object.keys(levels).length > 0) {
    for (const entry of Object.values(levels) as any[]) {
      const stars = Math.max(0, Math.floor(safeNumber(entry?.bestStars)));
      const score = Math.max(0, Math.floor(safeNumber(entry?.bestScore)));
      totalSoloScore += score;
      totalStars += stars;
      if (stars > 0) completedLevelCount += 1;
    }
  }

  return {
    totalSoloScore,
    totalStars,
    completedLevelCount,
    currentLevel: Math.max(1, Math.floor(safeNumber(summary.currentLevel ?? progress?.currentLevel, 1))),
    unlockedLevel: Math.max(1, Math.floor(safeNumber(summary.unlockedLevel ?? progress?.unlockedLevel, 1))),
    aggregateBestTimeSeconds: Math.max(0, Math.floor(safeNumber(summary.aggregateBestTimeSeconds))),
    totalAttempts: Math.max(0, Math.floor(safeNumber(summary.totalAttempts))),
  };
}

async function upsertByFilter(entity: any, filter: Record<string, unknown>, payload: Record<string, unknown>, dryRun: boolean) {
  const existing = await entity.filter(filter, '-updated_at', 1).catch(() => []);
  const id = existing?.[0]?.id;
  if (dryRun) return id ? 'would_update' : 'would_create';
  if (id) {
    await entity.update(id, payload);
    return 'updated';
  }
  await entity.create(payload);
  return 'created';
}

async function writeJobLog(base44: any, user: any, result: string, metadata: Record<string, unknown>) {
  try {
    await base44.asServiceRole.entities.AdminMaintenanceLog.create({
      action: `job:${JOB_NAME}`,
      job_name: JOB_NAME,
      admin_email: normalizeEmail(user?.email),
      target_email: '__system__',
      result,
      retention_status: 'active',
      metadata,
      created_at: new Date().toISOString(),
    });
  } catch (_error) {}
}

Deno.serve(async (req: Request) => {
  const base44 = createClientFromRequest(req);
  const admin = await requireAdmin(base44);
  if (admin.response) return admin.response;

  const body = await readBody(req);
  const dryRun = body?.dryRun !== false;
  const limit = Math.max(1, Math.min(Number(body?.limit) || DEFAULT_LIMIT, MAX_LIMIT));
  const nowIso = new Date().toISOString();
  const users = await base44.asServiceRole.entities.User.list('-kronox_puan_total', limit).catch(() => []);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const user of users) {
    const email = normalizeEmail(user?.email);
    const ownerKey = ownerKeyFromEmail(email);
    if (!ownerKey) {
      skipped += 1;
      continue;
    }

    const solo = getSoloSummary(user?.solo_progress);
    const onlineScore = Math.max(0, Math.floor(safeNumber(user?.online_progress?.score)));
    const totalScore = Math.max(0, Math.floor(safeNumber(user?.kronox_puan_total, solo.totalSoloScore + onlineScore)));
    const leaderboardRow = {
      owner_key: ownerKey,
      display_name: getDisplayName(user),
      initial: getInitial(user),
      total_kronox_score: totalScore,
      total_solo_score: solo.totalSoloScore,
      online_score: onlineScore,
      current_level: solo.currentLevel,
      unlocked_level: solo.unlockedLevel,
      total_stars: solo.totalStars,
      completed_level_count: solo.completedLevelCount,
      aggregate_best_time_seconds: solo.aggregateBestTimeSeconds,
      updated_at: nowIso,
    };
    const statsRow = {
      owner_key: ownerKey,
      user_email: email,
      kronox_puan_total: totalScore,
      solo_score: solo.totalSoloScore,
      online_score: onlineScore,
      current_level: solo.currentLevel,
      diamonds: Math.max(0, Math.floor(safeNumber(user?.diamonds))),
      total_games: solo.totalAttempts,
      solo_attempts: solo.totalAttempts,
      online_matches: Math.max(0, Math.floor(safeNumber(user?.online_progress?.wins) + safeNumber(user?.online_progress?.losses))),
      last_active_at: user?.last_active_at || user?.updated_date || '',
      updated_at: nowIso,
    };

    const leaderboardResult = await upsertByFilter(
      base44.asServiceRole.entities.SoloLeaderboardEntry,
      { owner_key: ownerKey },
      leaderboardRow,
      dryRun,
    );
    await upsertByFilter(
      base44.asServiceRole.entities.UserStatsProjection,
      { owner_key: ownerKey },
      statsRow,
      dryRun,
    ).catch(() => null);
    if (leaderboardResult === 'created' || leaderboardResult === 'would_create') created += 1;
    else updated += 1;
  }

  const summary = {
    ok: true,
    jobName: JOB_NAME,
    dryRun,
    scanned: users.length,
    created,
    updated,
    skipped,
    projectionEntity: 'SoloLeaderboardEntry',
  };

  if (!dryRun) await writeJobLog(base44, admin.user, 'success', summary);
  return json(summary);
});
