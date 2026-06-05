import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { requireAdmin } from '../_shared/adminAuth.ts';

const DEFAULT_LIMIT = 500;
const DEFAULT_RETENTION_DAYS = 180;
const JOB_NAME = 'cleanupAdminMaintenanceLog';

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

function parseTime(value: unknown) {
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : null;
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
  const limit = Math.max(1, Math.min(Number(body?.limit) || DEFAULT_LIMIT, DEFAULT_LIMIT));
  const retentionDays = Math.max(30, Number(body?.retentionDays) || DEFAULT_RETENTION_DAYS);
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const nowIso = new Date().toISOString();

  const rows = await base44.asServiceRole.entities.AdminMaintenanceLog
    .filter({ retention_status: 'active' }, 'created_at', limit)
    .catch(() => []);
  const archiveRows = rows.filter((row: any) => {
    if (!row?.id || row.job_name === JOB_NAME) return false;
    const createdAt = parseTime(row?.created_at) ?? parseTime(row?.created_date) ?? Date.now();
    return createdAt <= cutoffMs;
  });

  const updatedIds: string[] = [];
  if (!dryRun) {
    for (const row of archiveRows) {
      await base44.asServiceRole.entities.AdminMaintenanceLog.update(row.id, {
        retention_status: 'archived',
        archived_at: nowIso,
      }).catch(() => null);
      updatedIds.push(String(row.id));
    }
  }

  const summary = {
    ok: true,
    jobName: JOB_NAME,
    dryRun,
    scanned: rows.length,
    archivedCount: archiveRows.length,
    updatedCount: updatedIds.length,
  };

  if (!dryRun) await writeJobLog(base44, admin.user, 'success', summary);
  return json(summary);
});
