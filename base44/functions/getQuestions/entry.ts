import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const KNOWN_CATEGORY_IDS = [1, 2, 3, 4, 5, 6];
const MAX_GAMEPLAY_LIMIT = 500;
const QUESTION_FETCH_PER_CATEGORY_LIMIT = 250;

const ONLINE_ID_TO_MAIN_CATEGORY_ID: Record<string, number> = {
  chronicle: 1,
  flashback: 2,
  kult: 3,
  viral: 4,
  arena: 5,
  level_up: 6,
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function getConfiguredAdminEmails() {
  const raw = Deno.env.get('ADMIN_EMAILS') || Deno.env.get('KRONOX_ADMIN_EMAILS') || '';
  return raw.split(',').map(normalizeEmail).filter(Boolean);
}

function isAuthorizedAdmin(user: any) {
  if (!user) return false;
  if (user.role === 'admin' || user.is_admin === true) return true;
  if (Array.isArray(user.permissions) && user.permissions.includes('admin')) return true;
  const allowlist = getConfiguredAdminEmails();
  return allowlist.length > 0 && allowlist.includes(normalizeEmail(user.email));
}

async function requireUser(base44: any) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) return { response: json({ ok: false, error: 'Giris yapmaniz gerekiyor.' }, 401) };
    return { user };
  } catch {
    return { response: json({ ok: false, error: 'Giris yapmaniz gerekiyor.' }, 401) };
  }
}

function getTimelineYearFromAnswer(answer: unknown) {
  if (typeof answer === 'number' && Number.isFinite(answer)) return answer;
  const text = String(answer ?? '').trim();
  if (!text) return null;
  const match = text.match(/\b\d{3,4}\b/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

function normalizeCategoryId(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const id = Math.trunc(numeric);
  return KNOWN_CATEGORY_IDS.includes(id) ? id : null;
}

function isKnownCategoryId(value: number | null): value is number {
  return value !== null;
}

function getCategoryId(row: any) {
  return normalizeCategoryId(row?.category_id ?? row?.categoryid);
}

function isActiveCategory(row: any) {
  if (!row) return false;
  const status = String(row.status ?? '').trim().toLowerCase();
  return status === '' || status === 'a';
}

function isActiveQuestion(row: any) {
  const state = String(row?.state ?? 'A').trim().toUpperCase();
  return state === 'A';
}

function normalizeRequestedMainCategoryIds(body: any) {
  const direct = Array.isArray(body?.main_category_ids)
    ? body.main_category_ids
    : (Array.isArray(body?.category_ids) ? body.category_ids : []);
  const fromDirect = direct.map(normalizeCategoryId).filter(isKnownCategoryId);

  const selected = Array.isArray(body?.selected_category_ids) ? body.selected_category_ids : [];
  const fromSelected = selected
    .map((id: unknown) => typeof id === 'string'
      ? (ONLINE_ID_TO_MAIN_CATEGORY_ID[id] ?? normalizeCategoryId(id))
      : normalizeCategoryId(id))
    .map(normalizeCategoryId)
    .filter(isKnownCategoryId);

  const merged = Array.from(new Set([...fromDirect, ...fromSelected]));
  return merged.length ? new Set(merged) : null;
}

function normalizeQuestionForRuntime(question: Record<string, unknown>, activeMainCategoryIds: Set<number>) {
  const mainCategoryId = normalizeCategoryId(question?.main_category_id);
  if (!mainCategoryId || !activeMainCategoryIds.has(mainCategoryId)) return null;
  if (!isActiveQuestion(question)) return null;

  const legacyYear = Number(question?.year);
  const year = Number.isFinite(legacyYear)
    ? legacyYear
    : getTimelineYearFromAnswer(question?.answer);
  if (!Number.isFinite(year)) return null;

  const text = String(question?.question || '').trim();
  if (!text) return null;

  return {
    id: question?.id,
    question: text,
    answer: String(question?.answer || '').trim(),
    year,
    main_category_id: mainCategoryId,
    difficulty: Number.isFinite(Number(question?.difficulty)) ? Number(question.difficulty) : 1,
    state: 'A',
    // Runtime compatibility fields. These are intentionally derived and
    // minimal; the raw question-bank metadata is not exposed to gameplay.
    category: 'genel',
    type: 'metin',
    media_url: '',
  };
}

function dedupeQuestions(rows: any[] = []) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const row of rows || []) {
    const key = String(row?.id ?? row?.__id ?? row?.question ?? '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function loadActiveQuestionCandidates(base44: any, categoryIds: number[], perCategoryLimit = QUESTION_FETCH_PER_CATEGORY_LIMIT) {
  const batches: any[] = [];
  for (const categoryId of categoryIds) {
    const activeRows = await base44.asServiceRole.entities.Question
      .filter({ main_category_id: categoryId, state: 'A' }, '-created_date', perCategoryLimit)
      .catch(() => []);
    if (Array.isArray(activeRows) && activeRows.length > 0) batches.push(...activeRows);
  }
  return dedupeQuestions(batches);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const auth = await requireUser(base44);
    if (auth.response) return auth.response;

    const body = await req.json().catch(() => ({}));
    const wantsAdminBank = body?.scope === 'admin' || body?.fullBank === true || body?.includeInactive === true;
    if (wantsAdminBank && !isAuthorizedAdmin(auth.user)) {
      return json({ ok: false, error: 'Admin yetkisi gerekli.' }, 403);
    }

    const requestedIds = normalizeRequestedMainCategoryIds(body);
    const limit = Math.min(
      MAX_GAMEPLAY_LIMIT,
      Math.max(1, Math.floor(Number(body?.limit) || MAX_GAMEPLAY_LIMIT)),
    );

    const categoryRows = await base44.asServiceRole.entities.Category.list('category_id', 50).catch(() => []);
    const activeIds = (Array.isArray(categoryRows) && categoryRows.length > 0
      ? categoryRows.filter(isActiveCategory).map(getCategoryId).filter(isKnownCategoryId)
      : KNOWN_CATEGORY_IDS
    );
    const activeMainCategoryIds = new Set(activeIds);
    const allowedMainCategoryIds = requestedIds
      ? new Set(Array.from(requestedIds).filter((id) => activeMainCategoryIds.has(id)))
      : activeMainCategoryIds;

    if (allowedMainCategoryIds.size === 0) {
      return json({
        ok: true,
        questions: [],
        activeCategoryIds: Array.from(activeMainCategoryIds),
        source: 'authenticated_minimal_projection',
        reason: 'no_active_requested_categories',
      });
    }

    const questions = await loadActiveQuestionCandidates(base44, Array.from(allowedMainCategoryIds));
    const projected = (questions || [])
      .map((question: Record<string, unknown>) => normalizeQuestionForRuntime(question, allowedMainCategoryIds))
      .filter(Boolean)
      .slice(0, limit);

    return json({
      ok: true,
      questions: projected,
      activeCategoryIds: Array.from(activeMainCategoryIds),
      source: 'authenticated_minimal_projection',
      limit,
      count: projected.length,
    });
  } catch (error) {
    console.error('[getQuestions] failed:', (error as Error)?.message || error);
    return json({ ok: false, error: 'Sorular yuklenemedi.' }, 500);
  }
});
