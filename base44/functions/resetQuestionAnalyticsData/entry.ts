import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { requireAdmin } from '../_shared/adminAuth.ts';

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
  'UserCategoryPreference',
  'UserStatsProjection',
  'SoloLeaderboardEntry',
  'DiamondTransaction',
  'DailyWheelSpin',
  'OnlineMatchResult',
  'User',
];

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch (_error) {
    return {};
  }
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function uniqueRows(rows: any[]) {
  const seen = new Set<string>();
  return (rows || []).filter((row) => {
    const id = String(row?.id || row?._id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function listEntityRows(entity: any, batchSize: number) {
  if (!entity?.list) return [];
  const sortOrders = ['-created_at', '-created_date', '-updated_at', '-updated_date'];
  for (const sortOrder of sortOrders) {
    const rows = await entity.list(sortOrder, batchSize).catch(() => null);
    if (Array.isArray(rows)) return uniqueRows(rows);
  }
  return [];
}

async function clearEntityRows(
  base44: any,
  entityName: string,
  { dryRun, batchSize, maxBatches }: { dryRun: boolean; batchSize: number; maxBatches: number },
) {
  const entity = base44?.asServiceRole?.entities?.[entityName];
  if (!entity?.list || (!dryRun && !entity?.delete)) {
    return {
      entityName,
      available: false,
      scanned: 0,
      deleted: 0,
      failed: 0,
      capped: false,
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

async function writeAdminMaintenanceLog(base44: any, user: any, result: string, metadata: Record<string, unknown>) {
  try {
    await base44.asServiceRole.entities.AdminMaintenanceLog.create({
      action: `admin:${JOB_NAME}`,
      job_name: JOB_NAME,
      admin_email: normalizeEmail(user?.email),
      target_email: '__question_analytics__',
      result,
      retention_status: 'active',
      metadata,
      created_at: new Date().toISOString(),
      description: 'Admin-only reset of question analytics events/projections after question pool replacement.',
    });
  } catch (_error) {}
}

Deno.serve(async (req: Request) => {
  let base44: any = null;
  let adminUser: any = null;

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

    if (action !== 'preview' && action !== 'execute') {
      return json({ ok: false, error: 'invalid_action', expected: ['preview', 'execute'] }, 400);
    }

    if (!dryRun && String(body?.confirmText || '').trim() !== RESET_CONFIRMATION) {
      return json({
        ok: false,
        error: 'confirmation_required',
        expectedConfirmText: RESET_CONFIRMATION,
        description: 'Bu işlem soru gösterim/cevap analiz geçmişini sıfırlar. Sorular silinmez.',
      }, 400);
    }

    const results = [];
    for (const entityName of ANALYTICS_RESET_ENTITIES) {
      results.push(await clearEntityRows(base44, entityName, { dryRun, batchSize, maxBatches }));
    }

    const summary = {
      ok: true,
      jobName: JOB_NAME,
      action,
      dryRun,
      destructiveAnalyticsReset: !dryRun,
      resetDescription: 'Question analytics history/projections only; gameplay, progress, economy, questions, categories, and preferences are untouched.',
      confirmation: RESET_CONFIRMATION,
      targetEntities: ANALYTICS_RESET_ENTITIES,
      untouchedEntities: UNTOUCHED_ENTITIES,
      results,
      totalScanned: results.reduce((sum, row) => sum + (Number(row.scanned) || 0), 0),
      totalDeleted: results.reduce((sum, row) => sum + (Number(row.deleted) || 0), 0),
      totalFailed: results.reduce((sum, row) => sum + (Number(row.failed) || 0), 0),
      anyCapped: results.some((row) => row.capped),
      unavailableEntities: results.filter((row) => !row.available).map((row) => row.entityName),
    };

    const resetIncomplete = !dryRun && (
      summary.unavailableEntities.length > 0 ||
      summary.totalFailed > 0 ||
      summary.anyCapped
    );

    if (resetIncomplete) {
      const failedSummary = {
        ...summary,
        ok: false,
        error: 'analytics_reset_incomplete',
        code: 'analytics_reset_incomplete',
      };
      await writeAdminMaintenanceLog(base44, adminUser, 'incomplete', failedSummary);
      return json(failedSummary, 500);
    }

    await writeAdminMaintenanceLog(base44, adminUser, dryRun ? 'preview_ok' : 'success', summary);
    return json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${JOB_NAME}] failed`, message);
    if (base44 && adminUser?.email) {
      await writeAdminMaintenanceLog(base44, adminUser, 'failed', {
        error: 'reset_question_analytics_failed',
      }).catch(() => {});
    }
    return json({ ok: false, error: 'reset_question_analytics_failed' }, 500);
  }
});
