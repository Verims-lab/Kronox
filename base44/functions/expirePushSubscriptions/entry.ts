import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_LIMIT = 500;
const DEFAULT_STALE_DAYS = 45;
const JOB_NAME = 'expirePushSubscriptions';

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function configuredEmailList(raw: string) {
  return String(raw || '').split(',').map(normalizeEmail).filter(Boolean);
}

function isAuthorizedAdmin(user: any) {
  if (!user) return false;
  if (user.role === 'admin' || user.is_admin === true) return true;
  if (Array.isArray(user.permissions) && user.permissions.includes('admin')) return true;
  const allowlist = [
    ...configuredEmailList(Deno.env.get('ADMIN_EMAILS') || ''),
    ...configuredEmailList(Deno.env.get('KRONOX_ADMIN_EMAILS') || ''),
  ];
  return allowlist.length > 0 && allowlist.includes(normalizeEmail(user.email));
}

async function requireAdmin(base44: any) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) return { response: json({ ok: false, error: 'Authentication required' }, 401) };
    if (!isAuthorizedAdmin(user)) return { response: json({ ok: false, error: 'Admin access required' }, 403) };
    return { user };
  } catch (_error) {
    return { response: json({ ok: false, error: 'Authentication required' }, 401) };
  }
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
  const staleDays = Math.max(1, Number(body?.staleDays) || DEFAULT_STALE_DAYS);
  const includeStaleActive = body?.includeStaleActive === true;
  const cutoffMs = Date.now() - staleDays * 24 * 60 * 60 * 1000;
  const nowIso = new Date().toISOString();

  const candidates = [
    ...await base44.asServiceRole.entities.PushSubscription.filter({ status: 'disabled' }, 'last_seen_at', limit).catch(() => []),
    ...(includeStaleActive
      ? await base44.asServiceRole.entities.PushSubscription.filter({ status: 'active' }, 'last_seen_at', limit).catch(() => [])
      : []),
  ];

  const seen = new Set<string>();
  const staleRows = candidates.filter((row: any) => {
    if (!row?.id || seen.has(String(row.id))) return false;
    seen.add(String(row.id));
    const touchedAt = parseTime(row?.last_seen_at) ?? parseTime(row?.updated_date) ?? parseTime(row?.created_date) ?? 0;
    return touchedAt <= cutoffMs;
  });

  const updatedIds: string[] = [];
  if (!dryRun) {
    for (const row of staleRows) {
      await base44.asServiceRole.entities.PushSubscription.update(row.id, {
        status: 'expired',
        disabled_at: row.disabled_at || nowIso,
      }).catch(() => null);
      updatedIds.push(String(row.id));
    }
  }

  const summary = {
    ok: true,
    jobName: JOB_NAME,
    dryRun,
    includeStaleActive,
    scanned: seen.size,
    staleCount: staleRows.length,
    updatedCount: updatedIds.length,
  };

  if (!dryRun) await writeJobLog(base44, admin.user, 'success', summary);
  return json(summary);
});
