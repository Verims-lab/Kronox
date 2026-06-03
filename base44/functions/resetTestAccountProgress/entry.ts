import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MAX_ROWS = 50;

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function getConfiguredEmails(name: string) {
  return String(Deno.env.get(name) || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
}

function getAdminEmails() {
  return [
    ...getConfiguredEmails('ADMIN_EMAILS'),
    ...getConfiguredEmails('KRONOX_ADMIN_EMAILS'),
  ];
}

function getResettableTestEmails() {
  return [
    ...getConfiguredEmails('KRONOX_TEST_RESET_EMAILS'),
    ...getConfiguredEmails('TEST_RESET_EMAILS'),
  ];
}

function isAuthorizedAdmin(user: any) {
  if (!user) return false;
  if (user.role === 'admin' || user.is_admin === true) return true;
  if (Array.isArray(user.permissions) && user.permissions.includes('admin')) return true;
  const allowlist = getAdminEmails();
  return allowlist.length > 0 && allowlist.includes(normalizeEmail(user.email));
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
    let actor = null;
    try {
      actor = await base44.auth.me();
    } catch {
      return json({ ok: false, code: 'unauthenticated', error: 'Giriş yapmanız gerekiyor.' }, 401);
    }

    if (!actor?.email) {
      return json({ ok: false, code: 'unauthenticated', error: 'Giriş yapmanız gerekiyor.' }, 401);
    }
    if (!isAuthorizedAdmin(actor)) {
      return json({ ok: false, code: 'forbidden', error: 'Bu işlem için yönetici yetkisi gerekiyor.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetEmail = normalizeEmail(body?.targetEmail || body?.email);
    const resettableEmails = getResettableTestEmails();
    if (!targetEmail || !resettableEmails.includes(targetEmail)) {
      return json({
        ok: false,
        code: 'test_account_not_allowlisted',
        error: 'Bu test hesabı sıfırlama için allowlist içinde değil.',
      }, 403);
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
      reset: {
        user: true,
        leaderboard,
        fields: Object.keys(patch),
      },
    });
  } catch (error) {
    console.error('[resetTestAccountProgress] failed', error);
    return json({
      ok: false,
      code: 'test_account_reset_failed',
      error: 'Test hesabı sıfırlanamadı. Lütfen tekrar deneyin.',
    }, 500);
  }
});
