import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { json, normalizeEmail, requireAdmin } from './_shared/adminAuth.js';

// Callable Base44 root function: functions/resetQuestionAnalyticsData.js
// Settings invokes functions.invoke('resetQuestionAnalyticsData', payload).
const JOB_NAME = 'resetQuestionAnalyticsData';
const RESET_CONFIRMATION = 'RESET_QUESTION_ANALYTICS';
const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 1000;
const DEFAULT_MAX_BATCHES = 100;
const MAX_BATCHES = 200;

const ANALYTICS_RESET_ENTITIES = [
  'QuestionAttemptEvent',
  'QuestionStatsProjection',
  'CategoryStatsProjection',
];

const UNTOUCHED_ENTITIES = [
  'Question',
  'Category',
  'SubCategory',
  'UserCategoryPreference',
  'UserSubCategoryPreference',
  'UserStatsProjection',
  'GameRecord',
  'OnlineMatchResult',
  'Lobby',
  'SoloLeaderboardEntry',
  'DiamondTransaction',
  'DailyWheelSpin',
  'AdminUser',
  'User',
];

async function readBody(req) {
  try {
    return await req.json();
  } catch (_error) {
    return {};
  }
}

function clampInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function uniqueRows(rows) {
  const seen = new Set();
  return (rows || []).filter((row) => {
    const id = String(row?.id || row?._id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function listEntityRows(entity, batchSize) {
  if (!entity?.list) return [];
  const sortOrders = ['-created_at', '-created_date', '-updated_at', '-updated_date'];
  for (const sortOrder of sortOrders) {
    const rows = await entity.list(sortOrder, batchSize).catch(() => null);
    if (Array.isArray(rows)) return uniqueRows(rows);
  }
  return [];
}

async function clearEntityRows(base44, entityName, { dryRun, batchSize, maxBatches }) {
  const entity = base44?.asServiceRole?.entities?.[entityName];
  if (!entity?.list || (!dryRun && !entity?.delete)) {
    return {
      entityName,
      available: false,
      scanned: 'unknown',
      deleted: 'unknown',
      failed: 0,
      capped: false,
      warning: `${entityName} entity API unavailable`,
    };
  }

  let scanned = 0;
  let deleted = 0;
  let failed = 0;
  let capped = false;

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
    const rows = await listEntityRows(entity, batchSize);
    scanned += rows.length;

    if (dryRun) {
      capped = rows.length >= batchSize;
      break;
    }

    if (!rows.length) break;

    for (const row of rows) {
      const id = String(row?.id || row?._id || '').trim();
      if (!id) continue;
      try {
        await entity.delete(id);
        deleted += 1;
      } catch (_error) {
        failed += 1;
      }
    }

    if (rows.length < batchSize) break;
    if (batchIndex === maxBatches - 1) capped = true;
  }

  return {
    entityName,
    available: true,
    scanned,
    deleted,
    failed,
    capped,
  };
}

async function writeAdminMaintenanceLog(base44, user, result, metadata) {
  try {
    const entity = base44?.asServiceRole?.entities?.AdminMaintenanceLog;
    if (!entity?.create) return { available: false, created: false };
    const created = await entity.create({
      action: 'reset_question_analytics',
      job_name: JOB_NAME,
      admin_email: normalizeEmail(user?.email),
      target_email: '__question_analytics__',
      result,
      retention_status: 'active',
      metadata,
      created_at: metadata.resetAt || new Date().toISOString(),
      description: 'Admin-only reset of question analytics events/projections after question pool replacement.',
    });
    return { available: true, created: true, id: created?.id || null };
  } catch (_error) {
    return { available: true, created: false };
  }
}

Deno.serve(async (req) => {
  let base44 = null;
  let adminUser = null;

  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

    base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    if (admin.response) return admin.response;
    adminUser = admin.user;

    const body = await readBody(req);
    const action = String(body?.action || 'preview').trim().toLowerCase();
    const dryRun = action !== 'execute';
    const batchSize = clampInteger(body?.batchSize, DEFAULT_BATCH_SIZE, 1, MAX_BATCH_SIZE);
    const maxBatches = clampInteger(body?.maxBatches, DEFAULT_MAX_BATCHES, 1, MAX_BATCHES);
    const resetAt = new Date().toISOString();

    if (action !== 'preview' && action !== 'execute') {
      return json({ ok: false, error: 'invalid_action', expected: ['preview', 'execute'] }, 400);
    }

    if (!dryRun && String(body?.confirmText || body?.confirmation || '').trim() !== RESET_CONFIRMATION) {
      return json({
        ok: false,
        error: 'confirmation_required',
        expectedConfirmText: RESET_CONFIRMATION,
        description: 'Bu islem soru gosterim/cevap analiz gecmisini sifirlar. Sorular silinmez.',
      }, 400);
    }

    const results = [];
    for (const entityName of ANALYTICS_RESET_ENTITIES) {
      results.push(await clearEntityRows(base44, entityName, { dryRun, batchSize, maxBatches }));
    }

    const deletedCounts = Object.fromEntries(results.map((row) => [row.entityName, row.deleted]));
    const resetCounts = deletedCounts;
    const unavailableEntities = results.filter((row) => !row.available).map((row) => row.entityName);
    const totalFailed = results.reduce((sum, row) => sum + (Number(row.failed) || 0), 0);
    const anyCapped = results.some((row) => row.capped);
    const resetIncomplete = !dryRun && (totalFailed > 0 || anyCapped);

    const summary = {
      ok: !resetIncomplete,
      jobName: JOB_NAME,
      action,
      dryRun,
      resetAt,
      resetBy: normalizeEmail(adminUser?.email),
      destructiveAnalyticsReset: !dryRun,
      resetDescription: 'Question analytics history/projections only; gameplay, progress, economy, questions, categories, and preferences are untouched.',
      confirmation: RESET_CONFIRMATION,
      targetEntities: ANALYTICS_RESET_ENTITIES,
      entitiesTouched: ANALYTICS_RESET_ENTITIES,
      untouchedEntities: UNTOUCHED_ENTITIES,
      entitiesUntouched: UNTOUCHED_ENTITIES,
      results,
      deletedCounts,
      resetCounts,
      totalScanned: results.reduce((sum, row) => sum + (Number(row.scanned) || 0), 0),
      totalDeleted: results.reduce((sum, row) => sum + (Number(row.deleted) || 0), 0),
      totalFailed,
      anyCapped,
      unavailableEntities,
      warnings: unavailableEntities.length
        ? [`Unavailable analytics entities were skipped: ${unavailableEntities.join(', ')}`]
        : [],
      safetyNote: 'Question, Category, SubCategory, preferences, progress, economy, leaderboard, Daily Wheel, users, and AdminUser are not touched.',
    };

    const log = await writeAdminMaintenanceLog(base44, adminUser, resetIncomplete ? 'incomplete' : (dryRun ? 'preview_ok' : 'success'), summary);
    summary.maintenanceLog = log;

    if (resetIncomplete) {
      return json({
        ...summary,
        ok: false,
        error: 'analytics_reset_incomplete',
        code: 'analytics_reset_incomplete',
      }, 500);
    }

    return json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${JOB_NAME}] failed`, message);
    if (base44 && adminUser?.email) {
      await writeAdminMaintenanceLog(base44, adminUser, 'failed', {
        resetAt: new Date().toISOString(),
        error: 'reset_question_analytics_failed',
      }).catch(() => {});
    }
    return json({ ok: false, error: 'reset_question_analytics_failed' }, 500);
  }
});
