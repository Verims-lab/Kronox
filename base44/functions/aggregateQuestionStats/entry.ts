import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;
const MAX_QUESTIONS = 5000;
const JOB_NAME = 'aggregateQuestionStats';

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

function getBucket(map: Map<string, any>, key: string, seed: Record<string, unknown>) {
  if (!map.has(key)) {
    map.set(key, {
      ...seed,
      shown_count: 0,
      correct_count: 0,
      wrong_count: 0,
      total_response_time_ms: 0,
      response_count: 0,
      swap_count: 0,
      solo_shown_count: 0,
      online_shown_count: 0,
      last_shown_at: '',
      last_answered_at: '',
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
  const questions = await base44.asServiceRole.entities.Question.list('-created_date', MAX_QUESTIONS).catch(() => []);
  const activeQuestionIds = new Set(
    (questions || [])
      .map((question: any) => String(question?.id ?? question?.question_id ?? '').trim())
      .filter(Boolean),
  );

  const questionBuckets = new Map<string, any>();
  const categoryBuckets = new Map<string, any>();
  let staleQuestionReferenceEvents = 0;
  for (const event of events) {
    const questionId = String(event?.question_id || '').trim();
    if (!questionId) continue;
    if (activeQuestionIds.size > 0 && !activeQuestionIds.has(questionId)) {
      staleQuestionReferenceEvents += 1;
      continue;
    }
    const categoryId = Number(event?.category_id);
    const mode = event?.mode === 'online' ? 'online' : 'solo';
    const eventType = String(event?.event_type || (event?.answered_at ? 'answered' : 'shown')).trim();
    const isShownEvent = eventType === 'shown' || eventType === 'replacement_shown';
    const isAnsweredEvent = eventType === 'answered';
    const isSwapEvent = eventType === 'swapped_out' || event?.was_swapped_out === true;
    const shownAt = String(event?.shown_at || event?.created_at || '');
    const answeredAt = String(event?.answered_at || '');
    const answered = isAnsweredEvent && (event?.is_correct === true || event?.is_correct === false);
    const responseMs = Math.max(0, Math.floor(safeNumber(event?.response_time_ms)));

    const q = getBucket(questionBuckets, questionId, { question_id: questionId });
    if (Number.isFinite(categoryId)) q.category_id = categoryId;
    if (event?.sub_category) q.sub_category = String(event.sub_category);
    if (event?.tags) q.tags = String(event.tags);
    if (Number.isFinite(Number(event?.answer_year))) q.answer_year = Number(event.answer_year);
    if (isShownEvent) {
      q.shown_count += 1;
      if (mode === 'online') q.online_shown_count += 1;
      else q.solo_shown_count += 1;
      if (shownAt && shownAt > q.last_shown_at) q.last_shown_at = shownAt;
    }
    if (isSwapEvent) q.swap_count += 1;
    if (answered && event.is_correct === true) q.correct_count += 1;
    if (answered && event.is_correct === false) q.wrong_count += 1;
    if (answeredAt && answeredAt > q.last_answered_at) q.last_answered_at = answeredAt;
    if (answered && responseMs > 0) {
      q.total_response_time_ms += responseMs;
      q.response_count += 1;
    }

    if (isShownEvent && Number.isFinite(categoryId)) {
      const c = getBucket(categoryBuckets, String(categoryId), { category_id: categoryId });
      c.shown_count += 1;
    }
    if (answered && Number.isFinite(categoryId)) {
      const c = getBucket(categoryBuckets, String(categoryId), { category_id: categoryId });
      if (event.is_correct === true) c.correct_count += 1;
      if (event.is_correct === false) c.wrong_count += 1;
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
        swap_count: bucket.swap_count,
        correct_rate: answeredCount > 0 ? bucket.correct_count / answeredCount : 0,
        avg_response_time_ms: bucket.response_count > 0 ? Math.round(bucket.total_response_time_ms / bucket.response_count) : 0,
        solo_shown_count: bucket.solo_shown_count,
        online_shown_count: bucket.online_shown_count,
        last_shown_at: bucket.last_shown_at,
        last_answered_at: bucket.last_answered_at,
        ...(Number.isFinite(Number(bucket.category_id)) ? { category_id: Number(bucket.category_id) } : {}),
        ...(bucket.sub_category ? { sub_category: bucket.sub_category } : {}),
        ...(bucket.tags ? { tags: bucket.tags } : {}),
        ...(Number.isFinite(Number(bucket.answer_year)) ? { answer_year: Number(bucket.answer_year) } : {}),
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
    staleQuestionReferenceEvents,
    questionProjectionRows: questionRows,
    categoryProjectionRows: categoryRows,
  };

  if (!dryRun) await writeJobLog(base44, admin.user, 'success', summary);
  return json(summary);
});
