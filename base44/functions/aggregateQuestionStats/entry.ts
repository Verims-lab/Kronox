import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;
const JOB_NAME = 'aggregateQuestionStats';

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

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getBucket(map: Map<string, any>, key: string, seed: Record<string, unknown>) {
  if (!map.has(key)) {
    map.set(key, {
      ...seed,
      shown_count: 0,
      correct_count: 0,
      wrong_count: 0,
      total_response_time_ms: 0,
      response_count: 0,
      solo_shown_count: 0,
      online_shown_count: 0,
      last_shown_at: '',
    });
  }
  return map.get(key);
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
  const events = await base44.asServiceRole.entities.QuestionAttemptEvent.list('-created_at', limit).catch(() => []);

  const questionBuckets = new Map<string, any>();
  const categoryBuckets = new Map<string, any>();
  for (const event of events) {
    const questionId = String(event?.question_id || '').trim();
    if (!questionId) continue;
    const categoryId = Number(event?.category_id);
    const mode = event?.mode === 'online' ? 'online' : 'solo';
    const shownAt = String(event?.shown_at || event?.created_at || '');
    const answered = event?.is_correct === true || event?.is_correct === false;
    const responseMs = Math.max(0, Math.floor(safeNumber(event?.response_time_ms)));

    const q = getBucket(questionBuckets, questionId, { question_id: questionId });
    q.shown_count += 1;
    if (mode === 'online') q.online_shown_count += 1;
    else q.solo_shown_count += 1;
    if (answered && event.is_correct === true) q.correct_count += 1;
    if (answered && event.is_correct === false) q.wrong_count += 1;
    if (responseMs > 0) {
      q.total_response_time_ms += responseMs;
      q.response_count += 1;
    }
    if (shownAt && shownAt > q.last_shown_at) q.last_shown_at = shownAt;

    if (Number.isFinite(categoryId)) {
      const c = getBucket(categoryBuckets, String(categoryId), { category_id: categoryId });
      c.shown_count += 1;
      if (answered && event.is_correct === true) c.correct_count += 1;
      if (answered && event.is_correct === false) c.wrong_count += 1;
    }
  }

  let questionRows = 0;
  for (const bucket of questionBuckets.values()) {
    const answeredCount = bucket.correct_count + bucket.wrong_count;
    await upsertByFilter(
      base44.asServiceRole.entities.QuestionStatsProjection,
      { question_id: bucket.question_id },
      {
        question_id: bucket.question_id,
        shown_count: bucket.shown_count,
        correct_count: bucket.correct_count,
        wrong_count: bucket.wrong_count,
        correct_rate: answeredCount > 0 ? bucket.correct_count / answeredCount : 0,
        avg_response_time_ms: bucket.response_count > 0 ? Math.round(bucket.total_response_time_ms / bucket.response_count) : 0,
        solo_shown_count: bucket.solo_shown_count,
        online_shown_count: bucket.online_shown_count,
        last_shown_at: bucket.last_shown_at,
        difficulty_signal: answeredCount >= 10 ? (bucket.correct_count / answeredCount >= 0.8 ? 'easy' : bucket.correct_count / answeredCount <= 0.35 ? 'hard' : 'normal') : 'insufficient_data',
        aggregation_window: `latest_${limit}`,
        updated_at: nowIso,
      },
      dryRun,
    ).catch(() => null);
    questionRows += 1;
  }

  let categoryRows = 0;
  for (const bucket of categoryBuckets.values()) {
    const answeredCount = bucket.correct_count + bucket.wrong_count;
    await upsertByFilter(
      base44.asServiceRole.entities.CategoryStatsProjection,
      { category_id: bucket.category_id },
      {
        category_id: bucket.category_id,
        shown_count: bucket.shown_count,
        correct_rate: answeredCount > 0 ? bucket.correct_count / answeredCount : 0,
        play_count: bucket.shown_count,
        popularity_rank: 0,
        aggregation_window: `latest_${limit}`,
        updated_at: nowIso,
      },
      dryRun,
    ).catch(() => null);
    categoryRows += 1;
  }

  const summary = {
    ok: true,
    jobName: JOB_NAME,
    dryRun,
    scanned: events.length,
    questionProjectionRows: questionRows,
    categoryProjectionRows: categoryRows,
  };

  if (!dryRun) await writeJobLog(base44, admin.user, 'success', summary);
  return json(summary);
});
