import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { requireAdmin } from '../_shared/adminAuth.ts';

const MAX_LOOKUP_ROWS = 20;
const HARD_ZERO_MODE = 'hard_zero';
const NEW_PLAYER_MODE = 'new_player';
const VALID_MODES = new Set([HARD_ZERO_MODE, NEW_PLAYER_MODE]);

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function todayUtcKey() {
  return new Date().toISOString().slice(0, 10);
}

function nextUtcDayIso(dateKey = todayUtcKey()) {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) + 24 * 60 * 60 * 1000).toISOString();
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

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getSoloSummary(progress: any) {
  const levels = progress?.levels && typeof progress.levels === 'object' ? progress.levels : {};
  let totalSoloScore = 0;
  let totalStars = 0;
  let completedLevelCount = 0;
  let totalAttempts = 0;
  let highestCompleted = 0;

  for (const [levelKey, entry] of Object.entries(levels)) {
    const levelNumber = Math.max(0, Math.floor(Number(levelKey) || 0));
    const stars = Math.max(0, Math.min(3, Math.floor(safeNumber((entry as any)?.bestStars))));
    const score = Math.max(0, Math.floor(safeNumber((entry as any)?.bestScore)));
    const attempts = Math.max(0, Math.floor(safeNumber((entry as any)?.attempts)));
    totalSoloScore += score;
    totalStars += stars;
    totalAttempts += attempts;
    if (stars > 0) {
      completedLevelCount += 1;
      highestCompleted = Math.max(highestCompleted, levelNumber);
    }
  }

  const currentLevel = Math.max(
    1,
    Math.floor(safeNumber(progress?.currentLevel ?? progress?.summary?.currentLevel, 1)),
    highestCompleted + 1,
  );
  const unlockedLevel = Math.max(
    currentLevel,
    Math.floor(safeNumber(progress?.unlockedLevel ?? progress?.summary?.unlockedLevel, currentLevel)),
  );

  return {
    currentLevel,
    unlockedLevel,
    totalSoloScore,
    totalStars,
    completedLevelCount,
    totalAttempts,
  };
}

function getOnlineSummary(progress: any) {
  const source = progress && typeof progress === 'object' ? progress : {};
  return {
    score: Math.max(0, Math.floor(safeNumber(source.score))),
    peakScore: Math.max(0, Math.floor(safeNumber(source.peakScore))),
    peakCheckpoint: Math.max(0, Math.floor(safeNumber(source.peakCheckpoint))),
    wins: Math.max(0, Math.floor(safeNumber(source.wins))),
    losses: Math.max(0, Math.floor(safeNumber(source.losses))),
    lastMatchAt: String(source.lastMatchAt || source.lastUpdatedAt || ''),
  };
}

function cleanDisplayText(raw: unknown) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 28);
}

function safeLeaderboardName(user: any, ownerKey: string) {
  const displayName = [
    user?.display_name,
    user?.full_name,
    user?.displayName,
    user?.username,
    user?.name,
  ].map(cleanDisplayText).find((value) => value && !value.includes('@'));
  if (displayName) return displayName;
  const suffix = ownerKey ? ownerKey.slice(-4).toLocaleUpperCase('tr-TR') : '';
  return suffix ? `Oyuncu ${suffix}` : 'Oyuncu';
}

function initialFromName(displayName: string) {
  return cleanDisplayText(displayName).charAt(0).toLocaleUpperCase('tr-TR') || 'O';
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

async function safeFilter(base44: any, entityName: string, filter: Record<string, unknown>, sort = '-created_date', limit = MAX_LOOKUP_ROWS) {
  try {
    const entity = base44.asServiceRole.entities[entityName];
    if (!entity?.filter) return [];
    return await entity.filter(filter, sort, limit).catch(() => []);
  } catch {
    return [];
  }
}

async function findExactUser(base44: any, targetEmail: string) {
  const rows = await safeFilter(base44, 'User', { email: targetEmail }, '-created_date', MAX_LOOKUP_ROWS);
  const exact = (rows || []).filter((row: any) => normalizeEmail(row?.email) === targetEmail);
  const unique = uniqueRows(exact);
  if (!unique.length) return { error: json({ ok: false, code: 'target_not_found', error: 'Kullanıcı bulunamadı.' }, 404) };
  if (unique.length > 1) return { error: json({ ok: false, code: 'ambiguous_target', error: 'Bu e-posta için birden fazla kullanıcı bulundu. İşlem iptal edildi.' }, 409) };
  if (!unique[0]?.id) return { error: json({ ok: false, code: 'invalid_target', error: 'Hedef kullanıcı doğrulanamadı.' }, 409) };
  return { user: unique[0] };
}

async function getLeaderboardRows(base44: any, targetUser: any, targetEmail: string) {
  const userId = String(targetUser?.id || '');
  const ownerKey = ownerKeyFromEmail(targetEmail);
  const [byOwner, byCreator] = await Promise.all([
    ownerKey ? safeFilter(base44, 'SoloLeaderboardEntry', { owner_key: ownerKey }, '-updated_at', MAX_LOOKUP_ROWS) : Promise.resolve([]),
    userId ? safeFilter(base44, 'SoloLeaderboardEntry', { created_by_id: userId }, '-updated_at', MAX_LOOKUP_ROWS) : Promise.resolve([]),
  ]);
  return uniqueRows([...byOwner, ...byCreator]);
}

function buildPreview(targetUser: any, targetEmail: string, leaderboardRows: any[]) {
  const solo = getSoloSummary(targetUser?.solo_progress);
  const online = getOnlineSummary(targetUser?.online_progress);
  const persistedTotal = Number(targetUser?.kronox_puan_total);
  const computedTotal = solo.totalSoloScore + online.score;
  const currentKronoxPuan = Number.isFinite(persistedTotal)
    ? Math.max(0, Math.floor(persistedTotal))
    : computedTotal;
  const leaderboardRow = leaderboardRows?.[0] || null;
  return {
    targetEmail,
    currentKronoxPuan,
    diamonds: Math.max(0, Math.floor(safeNumber(targetUser?.diamonds))),
    solo,
    online,
    leaderboard: {
      available: Array.isArray(leaderboardRows),
      status: leaderboardRows?.length ? 'exists' : 'missing',
      rowCount: leaderboardRows?.length || 0,
      score: leaderboardRow ? Math.max(0, Math.floor(safeNumber(leaderboardRow.total_kronox_score))) : null,
    },
  };
}

async function upsertZeroLeaderboard(base44: any, targetUser: any, targetEmail: string, nowIso: string) {
  const entity = base44.asServiceRole.entities.SoloLeaderboardEntry;
  if (!entity?.update || !entity?.create) return { available: false, updated: 0, created: 0 };

  const ownerKey = ownerKeyFromEmail(targetEmail);
  const displayName = safeLeaderboardName(targetUser, ownerKey);
  const payload = {
    owner_key: ownerKey,
    display_name: displayName,
    initial: initialFromName(displayName),
    total_kronox_score: 0,
    total_solo_score: 0,
    online_score: 0,
    current_level: 1,
    unlocked_level: 1,
    total_stars: 0,
    completed_level_count: 0,
    aggregate_best_time_seconds: 0,
    updated_at: nowIso,
    description: 'admin_progress_reset',
  };

  const rows = await getLeaderboardRows(base44, targetUser, targetEmail);
  let updated = 0;
  for (const row of rows) {
    await entity.update(row.id, payload);
    updated += 1;
  }
  if (!rows.length) {
    await entity.create(payload);
    return { available: true, updated, created: 1 };
  }
  return { available: true, updated, created: 0 };
}

async function deleteTargetGameRecords(base44: any, targetUser: any, targetEmail: string) {
  const entity = base44.asServiceRole.entities.GameRecord;
  if (!entity?.delete) return { available: false, deleted: 0 };
  const userId = String(targetUser?.id || '');
  const [byEmail, byCreator] = await Promise.all([
    safeFilter(base44, 'GameRecord', { user_email: targetEmail }, '-created_date', 500),
    userId ? safeFilter(base44, 'GameRecord', { created_by_id: userId }, '-created_date', 500) : Promise.resolve([]),
  ]);
  const rows = uniqueRows([...byEmail, ...byCreator]);
  let deleted = 0;
  for (const row of rows) {
    await entity.delete(row.id);
    deleted += 1;
  }
  return { available: true, deleted };
}

async function deleteTargetDailyWheelSpins(base44: any, targetEmail: string) {
  const entity = base44.asServiceRole.entities.DailyWheelSpin;
  if (!entity?.delete) return { available: false, deleted: 0 };
  const rows = await safeFilter(base44, 'DailyWheelSpin', { user_email: targetEmail }, '-claimed_at', 500);
  let deleted = 0;
  for (const row of uniqueRows(rows)) {
    await entity.delete(row.id);
    deleted += 1;
  }
  return { available: true, deleted };
}

async function createDiamondResetLedger(base44: any, targetEmail: string, targetUser: any, actor: any, mode: string, nowIso: string) {
  const entity = base44.asServiceRole.entities.DiamondTransaction;
  if (!entity?.create) return { available: false, created: false };

  const balanceBefore = Math.max(0, Math.floor(safeNumber(targetUser?.diamonds)));
  const row = {
    user_email: targetEmail,
    amount: balanceBefore,
    balance_before: balanceBefore,
    balance_after: 0,
    source: 'admin_adjustment',
    direction: 'spend',
    idempotency_key: `admin_progress_reset:${targetEmail}:${nowIso}`,
    metadata: {
      resetMode: mode,
      adminEmail: normalizeEmail(actor?.email),
      progressResetAt: nowIso,
      note: 'Admin reset user progress maintenance tool',
    },
    created_at: nowIso,
    description: `admin_progress_reset:${mode}`,
  };
  await entity.create(row);
  return { available: true, created: true, amount: balanceBefore };
}

async function writeAdminMaintenanceLog(base44: any, payload: Record<string, unknown>) {
  try {
    const entity = base44.asServiceRole.entities.AdminMaintenanceLog;
    if (!entity?.create) {
      console.warn('[adminResetUserProgress] AdminMaintenanceLog entity unavailable', payload);
      return { available: false, created: false };
    }
    const created = await entity.create(payload);
    return { available: true, created: true, id: created?.id || null };
  } catch (error) {
    console.warn('[adminResetUserProgress] maintenance log failed', error);
    return { available: true, created: false };
  }
}

function buildResetPatch(mode: string, nowIso: string) {
  const hardZero = mode === HARD_ZERO_MODE;
  const todayKey = todayUtcKey();
  return {
    solo_progress: emptySoloProgress(),
    online_progress: emptyOnlineProgress(),
    kronox_puan_total: 0,
    diamonds: 0,
    starter_bonus_granted_at: hardZero ? nowIso : '',
    last_daily_diamond_reward_date: hardZero ? todayUtcKey() : '',
    daily_wheel_last_spin_at: hardZero ? nowIso : '',
    daily_wheel_last_spin_date: hardZero ? todayKey : '',
    daily_wheel_next_available_at: hardZero ? nextUtcDayIso(todayKey) : '',
    daily_wheel_streak: 0,
    daily_wheel_spin_count: 0,
    daily_quest_last_claim_at: hardZero ? nowIso : '',
    daily_quest_last_claim_date: hardZero ? todayKey : '',
    daily_quest_next_available_at: hardZero ? nextUtcDayIso(todayKey) : '',
    daily_quest_claim_count: 0,
    economy_updated_at: nowIso,
    progress_reset_at: nowIso,
    progress_reset_mode: mode,
  };
}

Deno.serve(async (req) => {
  let base44: any = null;
  let actor: any = null;
  let targetEmail = '';
  let mode = '';
  let action = '';
  const startedAt = new Date().toISOString();

  try {
    if (req.method !== 'POST') {
      return json({ ok: false, code: 'method_not_allowed', error: 'Bu işlem desteklenmiyor.' }, 405);
    }

    base44 = createClientFromRequest(req);
    const adminAuth = await requireAdmin(base44);
    if (adminAuth.response) return adminAuth.response;
    actor = adminAuth.user;

    const body = await req.json().catch(() => ({}));
    action = String(body?.action || body?.operation || 'preview').trim().toLowerCase();
    targetEmail = normalizeEmail(body?.targetEmail || body?.email);
    mode = String(body?.mode || HARD_ZERO_MODE).trim().toLowerCase();
    const confirmEmail = normalizeEmail(body?.confirmEmail);

    if (!targetEmail) {
      return json({ ok: false, code: 'missing_target_email', error: 'Hedef kullanıcı e-postası gerekli.' }, 400);
    }
    if (!VALID_MODES.has(mode)) {
      return json({ ok: false, code: 'invalid_reset_mode', error: 'Geçersiz sıfırlama modu.' }, 400);
    }
    if (action !== 'preview' && action !== 'execute') {
      return json({ ok: false, code: 'invalid_action', error: 'Geçersiz işlem.' }, 400);
    }

    const lookup = await findExactUser(base44, targetEmail);
    if (lookup.error) return lookup.error;
    const targetUser = lookup.user;
    const leaderboardRows = await getLeaderboardRows(base44, targetUser, targetEmail);
    const preview = buildPreview(targetUser, targetEmail, leaderboardRows);

    if (action === 'preview') {
      await writeAdminMaintenanceLog(base44, {
        action: 'admin_reset_user_progress_preview',
        admin_email: normalizeEmail(actor.email),
        target_email: targetEmail,
        reset_mode: mode,
        result: 'preview_ok',
        created_at: startedAt,
        metadata: { preview },
      });
      return json({ ok: true, preview });
    }

    if (confirmEmail !== targetEmail) {
      return json({
        ok: false,
        code: 'confirmation_mismatch',
        error: 'Onay e-postası hedef kullanıcı e-postası ile birebir aynı olmalı.',
      }, 400);
    }

    const nowIso = new Date().toISOString();
    const patch = buildResetPatch(mode, nowIso);
    await base44.asServiceRole.entities.User.update(targetUser.id, patch);

    const [leaderboard, gameRecords, dailyWheelSpins, diamondLedger] = await Promise.all([
      upsertZeroLeaderboard(base44, targetUser, targetEmail, nowIso),
      deleteTargetGameRecords(base44, targetUser, targetEmail),
      deleteTargetDailyWheelSpins(base44, targetEmail),
      createDiamondResetLedger(base44, targetEmail, targetUser, actor, mode, nowIso),
    ]);

    const log = await writeAdminMaintenanceLog(base44, {
      action: 'admin_reset_user_progress_execute',
      admin_email: normalizeEmail(actor.email),
      target_email: targetEmail,
      reset_mode: mode,
      result: 'success',
      created_at: nowIso,
      metadata: {
        fields: Object.keys(patch),
        leaderboard,
        gameRecords,
        dailyWheelSpins,
        diamondLedger,
        progressResetAt: nowIso,
      },
    });

    return json({
      ok: true,
      reset: {
        targetEmail,
        mode,
        progressResetAt: nowIso,
        fields: Object.keys(patch),
        leaderboard,
        gameRecords,
        dailyWheelSpins,
        diamondLedger,
        log,
      },
      previewBeforeReset: preview,
    });
  } catch (error) {
    console.error('[adminResetUserProgress] failed', error);
    if (base44 && actor?.email && targetEmail) {
      await writeAdminMaintenanceLog(base44, {
        action: 'admin_reset_user_progress_execute',
        admin_email: normalizeEmail(actor.email),
        target_email: targetEmail,
        reset_mode: mode || 'unknown',
        result: 'failed',
        created_at: new Date().toISOString(),
        metadata: { action, code: 'admin_reset_user_progress_failed' },
      }).catch(() => {});
    }
    return json({
      ok: false,
      code: 'admin_reset_user_progress_failed',
      error: 'Kullanıcı ilerlemesi sıfırlanamadı. Lütfen tekrar deneyin.',
    }, 500);
  }
});
