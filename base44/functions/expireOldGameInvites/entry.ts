import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { requireAdmin } from '../_shared/adminAuth.ts';

const DEFAULT_LIMIT = 500;
const JOB_NAME = 'expireOldGameInvites';

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
  } catch (_error) {
    // Maintenance logs are audit support; a log failure must not hide the job summary.
  }
}

Deno.serve(async (req: Request) => {
  const base44 = createClientFromRequest(req);
  const admin = await requireAdmin(base44);
  if (admin.response) return admin.response;

  const body = await readBody(req);
  const dryRun = body?.dryRun !== false;
  const limit = Math.max(1, Math.min(Number(body?.limit) || DEFAULT_LIMIT, DEFAULT_LIMIT));
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  const pendingRows = await base44.asServiceRole.entities.GameInvite
    .filter({ status: 'pending' }, 'expires_at', limit)
    .catch(() => []);

  const expiredRows = pendingRows.filter((row: any) => {
    const expiresAt = parseTime(row?.expires_at);
    return expiresAt !== null && expiresAt <= nowMs;
  });

  const updatedIds: string[] = [];
  if (!dryRun) {
    for (const row of expiredRows) {
      if (!row?.id) continue;
      await base44.asServiceRole.entities.GameInvite.update(row.id, {
        status: 'expired',
        expired_at: nowIso,
      }).catch(() => null);
      updatedIds.push(String(row.id));
    }
  }

  const summary = {
    ok: true,
    jobName: JOB_NAME,
    dryRun,
    scanned: pendingRows.length,
    expiredCount: expiredRows.length,
    updatedCount: updatedIds.length,
  };

  if (!dryRun) await writeJobLog(base44, admin.user, 'success', summary);
  return json(summary);
});
