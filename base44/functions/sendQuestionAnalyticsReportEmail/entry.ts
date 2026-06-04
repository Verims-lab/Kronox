import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const JOB_NAME = 'sendQuestionAnalyticsReportEmail';
const MAX_EVENTS = 5000;
const MAX_QUESTIONS = 5000;
const PERIOD_OPTIONS = new Set([1, 7, 30]);

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

function clampPeriodDays(value: unknown) {
  const number = Number(value);
  if (PERIOD_OPTIONS.has(number)) return number;
  return 7;
}

function eventTimestamp(event: any) {
  return String(event?.answered_at || event?.shown_at || event?.created_at || '');
}

function eventType(event: any) {
  return String(event?.event_type || (event?.answered_at ? 'answered' : 'shown')).trim();
}

function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function questionKey(value: unknown) {
  return String(value ?? '').trim();
}

function shortText(value: unknown, limit = 72) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '(metin yok)';
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function percent(part: number, total: number) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 1000) / 10}%`;
}

function formatMs(ms: number) {
  if (!ms) return '-';
  return `${Math.round(ms / 100) / 10}s`;
}

function getQuestionYear(question: any) {
  const year = Number(question?.year ?? question?.answer_year ?? question?.answer);
  return Number.isFinite(year) ? year : null;
}

function isActiveQuestion(question: any) {
  return String(question?.state || 'A').toUpperCase() === 'A';
}

function isSportsLike(values: unknown[]) {
  const text = values.map((value) => String(value || '').toLowerCase()).join(' ');
  return [
    'spor',
    'sport',
    'futbol',
    'football',
    'basket',
    'tenis',
    'tennis',
    'olimp',
    'olymp',
    'formula',
    'f1',
  ].some((token) => text.includes(token));
}

function getBucket(map: Map<string, any>, id: string, question: any = null) {
  if (!map.has(id)) {
    map.set(id, {
      question_id: id,
      question,
      shown_count: 0,
      correct_count: 0,
      wrong_count: 0,
      swap_count: 0,
      total_response_time_ms: 0,
      response_count: 0,
      last_shown_at: '',
      last_answered_at: '',
    });
  }
  const bucket = map.get(id);
  if (question && !bucket.question) bucket.question = question;
  return bucket;
}

function lineForQuestion(bucket: any, index: number) {
  const q = bucket.question || {};
  const answered = bucket.correct_count + bucket.wrong_count;
  const correctRate = answered ? percent(bucket.correct_count, answered) : '-';
  const avgMs = bucket.response_count ? Math.round(bucket.total_response_time_ms / bucket.response_count) : 0;
  return [
    `${index}. #${bucket.question_id}`,
    shortText(q.question),
    `year=${getQuestionYear(q) ?? bucket.answer_year ?? '-'}`,
    `cat=${q.main_category_id ?? bucket.category_id ?? '-'}`,
    `sub=${q.sub_category || bucket.sub_category || '-'}`,
    `shown=${bucket.shown_count}`,
    `correct=${bucket.correct_count}`,
    `wrong=${bucket.wrong_count}`,
    `rate=${correctRate}`,
    `avg=${formatMs(avgMs)}`,
    `swaps=${bucket.swap_count}`,
  ].join(' | ');
}

function sortDesc(field: string) {
  return (a: any, b: any) => (Number(b?.[field]) || 0) - (Number(a?.[field]) || 0);
}

function buildReport({ periodDays, events, questions }: { periodDays: number; events: any[]; questions: any[] }) {
  const questionById = new Map<string, any>();
  const activeQuestions = [];
  for (const question of questions) {
    const id = questionKey(question?.id ?? question?.question_id);
    if (!id) continue;
    questionById.set(id, question);
    if (isActiveQuestion(question)) activeQuestions.push(question);
  }

  const buckets = new Map<string, any>();
  const categoryBuckets = new Map<string, any>();
  const missing = {
    question_id: 0,
    answer_year: 0,
    sub_category_or_tags: 0,
  };
  let shownEvents = 0;
  let answeredEvents = 0;
  let sportsShown = 0;
  const uniqueAttempts = new Set<string>();

  for (const event of events) {
    const qid = questionKey(event?.question_id);
    if (!qid) {
      missing.question_id += 1;
      continue;
    }
    if (event?.attempt_id) uniqueAttempts.add(String(event.attempt_id));
    const q = questionById.get(qid) || null;
    const bucket = getBucket(buckets, qid, q);
    const type = eventType(event);
    const isShown = type === 'shown' || type === 'replacement_shown';
    const isAnswered = type === 'answered';
    const isSwap = type === 'swapped_out' || event?.was_swapped_out === true;
    const categoryId = event?.category_id ?? q?.main_category_id ?? 'unknown';
    const subCategory = event?.sub_category || q?.sub_category || 'unknown';
    const tag = event?.tags || q?.tag || '';
    const answerYear = safeNumber(event?.answer_year ?? getQuestionYear(q), NaN);

    bucket.category_id = categoryId;
    bucket.sub_category = subCategory;
    bucket.answer_year = Number.isFinite(answerYear) ? answerYear : bucket.answer_year;
    if (!Number.isFinite(answerYear)) missing.answer_year += 1;
    if (!subCategory || subCategory === 'unknown' || !tag) missing.sub_category_or_tags += 1;

    if (isShown) {
      shownEvents += 1;
      bucket.shown_count += 1;
      const shownAt = String(event?.shown_at || event?.created_at || '');
      if (shownAt && shownAt > bucket.last_shown_at) bucket.last_shown_at = shownAt;
      const categoryKey = `${categoryId} / ${subCategory}`;
      const categoryBucket = categoryBuckets.get(categoryKey) || {
        category_id: categoryId,
        sub_category: subCategory,
        shown_count: 0,
        correct_count: 0,
        wrong_count: 0,
      };
      categoryBucket.shown_count += 1;
      categoryBuckets.set(categoryKey, categoryBucket);
      if (isSportsLike([subCategory, tag, categoryId, q?.category])) sportsShown += 1;
    }
    if (isAnswered) {
      answeredEvents += 1;
      const answeredAt = String(event?.answered_at || '');
      if (answeredAt && answeredAt > bucket.last_answered_at) bucket.last_answered_at = answeredAt;
      if (event?.is_correct === true) bucket.correct_count += 1;
      if (event?.is_correct === false) bucket.wrong_count += 1;
      const responseMs = Math.max(0, Math.floor(safeNumber(event?.response_time_ms)));
      if (responseMs > 0) {
        bucket.total_response_time_ms += responseMs;
        bucket.response_count += 1;
      }
      const categoryKey = `${categoryId} / ${subCategory}`;
      const categoryBucket = categoryBuckets.get(categoryKey);
      if (categoryBucket) {
        if (event?.is_correct === true) categoryBucket.correct_count += 1;
        if (event?.is_correct === false) categoryBucket.wrong_count += 1;
      }
    }
    if (isSwap) bucket.swap_count += 1;
  }

  const bucketList = [...buckets.values()];
  const shownQuestionIds = new Set(bucketList.filter((bucket) => bucket.shown_count > 0).map((bucket) => bucket.question_id));
  const neverShown = activeQuestions.filter((question) => !shownQuestionIds.has(questionKey(question?.id ?? question?.question_id)));
  const topShown = [...bucketList].sort(sortDesc('shown_count')).slice(0, 20);
  const mostWrong = [...bucketList]
    .filter((bucket) => bucket.wrong_count > 0)
    .sort(sortDesc('wrong_count'))
    .slice(0, 20);
  const easy = [...bucketList]
    .filter((bucket) => bucket.shown_count >= 3 && (bucket.correct_count + bucket.wrong_count) >= 3)
    .sort((a, b) => {
      const ar = a.correct_count / Math.max(1, a.correct_count + a.wrong_count);
      const br = b.correct_count / Math.max(1, b.correct_count + b.wrong_count);
      return br - ar;
    })
    .slice(0, 20);
  const slow = [...bucketList]
    .filter((bucket) => bucket.response_count > 0)
    .sort((a, b) => (b.total_response_time_ms / b.response_count) - (a.total_response_time_ms / a.response_count))
    .slice(0, 20);
  const categoryRows = [...categoryBuckets.values()]
    .sort(sortDesc('shown_count'))
    .slice(0, 30);

  const lines = [
    `Kronox Question Analytics Report - Last ${periodDays} Days`,
    '',
    'Summary',
    `Period: last ${periodDays} day(s)`,
    `Total question events: ${events.length}`,
    `Total Solo attempts: ${uniqueAttempts.size}`,
    `Total questions shown: ${shownEvents}`,
    `Answered events: ${answeredEvents}`,
    `Unique questions shown: ${shownQuestionIds.size}`,
    `Active question pool size: ${activeQuestions.length}`,
    `Active questions never shown in period: ${neverShown.length}`,
    `Average show count per shown question: ${shownQuestionIds.size ? Math.round((shownEvents / shownQuestionIds.size) * 10) / 10 : 0}`,
    '',
    'Top shown questions',
    ...(topShown.length ? topShown.map(lineForQuestion) : ['No shown questions in this period.']),
    '',
    'Rarely / never shown active questions',
    `Never shown active total: ${neverShown.length}`,
    ...neverShown.slice(0, 30).map((question, index) => `${index + 1}. #${questionKey(question?.id ?? question?.question_id)} | ${shortText(question?.question)} | year=${getQuestionYear(question) ?? '-'} | cat=${question?.main_category_id ?? '-'}`),
    '',
    'Most wrong questions',
    ...(mostWrong.length ? mostWrong.map(lineForQuestion) : ['No wrong-answer events in this period.']),
    '',
    'Very easy questions',
    ...(easy.length ? easy.map(lineForQuestion) : ['No high-correct-rate sample yet.']),
    '',
    'Slow questions',
    ...(slow.length ? slow.map(lineForQuestion) : ['No response-time sample yet.']),
    '',
    'Category/subcategory distribution',
    ...(categoryRows.length ? categoryRows.map((row, index) => {
      const answered = row.correct_count + row.wrong_count;
      return `${index + 1}. cat=${row.category_id} | sub=${row.sub_category} | shown=${row.shown_count} | share=${percent(row.shown_count, shownEvents)} | correct_rate=${answered ? percent(row.correct_count, answered) : '-'}`;
    }) : ['No category/subcategory distribution yet.']),
    '',
    'Sports/theme focus warning',
    `Sports-like shown count: ${sportsShown}`,
    `Sports-like shown share: ${percent(sportsShown, shownEvents)}`,
    sportsShown > 0 && shownEvents > 0 && sportsShown / shownEvents > 0.35
      ? 'WARNING: sports-like content exceeded 35% of shown events in this period.'
      : 'No sports-like over-focus warning from available metadata.',
    '',
    'Data quality warnings',
    `Events missing question_id: ${missing.question_id}`,
    `Events missing answer_year: ${missing.answer_year}`,
    `Events missing sub_category/tag metadata: ${missing.sub_category_or_tags}`,
    events.length >= MAX_EVENTS ? `WARNING: report scanned latest ${MAX_EVENTS} events only; older rows were not included.` : 'Scanned event window did not hit the hard limit.',
    'Projection note: QuestionStatsProjection refresh remains manual via aggregateQuestionStats; gameplay does not update projections synchronously.',
  ];

  return {
    body: lines.join('\n'),
    summary: {
      totalEvents: events.length,
      shownEvents,
      answeredEvents,
      uniqueShownQuestions: shownQuestionIds.size,
      activeQuestionPoolSize: activeQuestions.length,
      neverShownActiveQuestions: neverShown.length,
      sportsShown,
    },
  };
}

async function writeJobLog(base44: any, user: any, result: string, metadata: Record<string, unknown>) {
  try {
    await base44.asServiceRole.entities.AdminMaintenanceLog.create({
      action: `admin:${JOB_NAME}`,
      job_name: JOB_NAME,
      admin_email: normalizeEmail(user?.email),
      target_email: normalizeEmail(user?.email),
      result,
      retention_status: 'active',
      metadata,
      created_at: new Date().toISOString(),
    });
  } catch (_error) {}
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
    const base44 = createClientFromRequest(req);
    const admin = await requireAdmin(base44);
    if (admin.response) return admin.response;

    const body = await readBody(req);
    const periodDays = clampPeriodDays(body?.periodDays);
    const recipient = normalizeEmail(body?.recipientEmail || admin.user?.email);
    if (!recipient) return json({ ok: false, error: 'Report recipient is required' }, 400);

    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
    const rawEvents = await base44.asServiceRole.entities.QuestionAttemptEvent.list('-created_at', MAX_EVENTS).catch(() => []);
    const events = rawEvents.filter((event: any) => eventTimestamp(event) >= since);
    const rawQuestions = await base44.asServiceRole.entities.Question.list('-created_date', MAX_QUESTIONS).catch(() => []);
    const report = buildReport({ periodDays, events, questions: rawQuestions });
    const subject = `Kronox Question Analytics Report - Last ${periodDays} Days`;

    try {
      await base44.integrations.Core.SendEmail({
        from_name: 'Kronox',
        to: recipient,
        subject,
        body: report.body,
      });
    } catch (mailError) {
      const reason = mailError instanceof Error ? mailError.message : 'send failed';
      await writeJobLog(base44, admin.user, 'email_failed', { periodDays, recipient, reason });
      return json({ ok: false, error: 'email_failed' }, 502);
    }

    const summary = {
      ok: true,
      jobName: JOB_NAME,
      periodDays,
      recipient,
      ...report.summary,
    };
    await writeJobLog(base44, admin.user, 'success', summary);
    return json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${JOB_NAME}] failed`, message);
    return json({ ok: false, error: 'report_failed' }, 500);
  }
});
