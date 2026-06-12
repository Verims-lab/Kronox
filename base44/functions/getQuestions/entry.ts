import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { isAuthorizedAdmin } from '../_shared/adminAuth.ts';

const FALLBACK_ACTIVE_CATEGORY_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11];
const MAX_GAMEPLAY_LIMIT = 900;
const QUESTION_FETCH_PER_CATEGORY_LIMIT = 1000;
const PROJECTION_SAMPLING_STRATEGY = 'pool_proportional_category_subcategory_daily_sample_v1';
const DIAGNOSTIC_TOP_LIMIT = 12;
const CATEGORY_ACTIVE_STATUS_VALUES = new Set(['', 'a', 'active', 'aktif']);

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

async function getOptionalUser(base44: any) {
  try {
    const user = await base44.auth.me();
    return user?.email ? user : null;
  } catch {
    return null;
  }
}

function parseExplicitYear(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) && Number.isInteger(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || !/^-?\d{1,4}$/.test(text)) return null;
  const year = Number(text);
  return Number.isFinite(year) ? year : null;
}

function getTimelineYearFromAnswer(answer: unknown) {
  const explicitYear = parseExplicitYear(answer);
  if (explicitYear !== null) return explicitYear;
  const text = String(answer ?? '').trim();
  if (!text) return null;
  if (/(?:\bcirca\b|\bca\.|\bc\.|\baround\b|\babout\b|\byaklaşık\b|\byaklasik\b|\btahmini\b|[~?])/i.test(text)) return null;
  const match = text.match(/\b\d{3,4}\b/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

function normalizeCategoryId(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const id = Math.trunc(numeric);
  return id > 0 ? id : null;
}

function normalizeQuestionMainCategoryId(question: Record<string, unknown>) {
  const raw = question?.main_category_id
    ?? question?.mainCategoryId
    ?? question?.category_id
    ?? question?.categoryid
    ?? question?.categoryId;
  const direct = normalizeCategoryId(raw);
  if (direct !== null) return direct;

  const categoryText = String(question?.category || '').trim().toLowerCase();
  return ONLINE_ID_TO_MAIN_CATEGORY_ID[categoryText] ?? null;
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
  return CATEGORY_ACTIVE_STATUS_VALUES.has(status);
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
  const mainCategoryId = normalizeQuestionMainCategoryId(question);
  if (!mainCategoryId || !activeMainCategoryIds.has(mainCategoryId)) return null;
  if (!isActiveQuestion(question)) return null;

  const explicitYear = parseExplicitYear(question?.year);
  const year = explicitYear !== null
    ? explicitYear
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
    category_id: mainCategoryId,
    categoryId: mainCategoryId,
    sub_category: String(question?.sub_category || question?.subcategory || '').trim(),
    tag: String(question?.tag || '').trim(),
    difficulty: Number.isFinite(Number(question?.difficulty)) ? Number(question.difficulty) : 1,
    state: 'A',
    // Runtime compatibility fields. These are intentionally derived and
    // minimal; the raw question-bank metadata is not exposed to gameplay.
    category: 'genel',
    type: 'metin',
    media_url: '',
  };
}

function getQuestionIdentity(question: any) {
  return String(question?.id ?? question?.__id ?? question?.question ?? '').trim();
}

function dedupeQuestions(rows: any[] = []) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const row of rows || []) {
    const key = getQuestionIdentity(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function loadActiveQuestionCandidates(base44: any, categoryIds: number[], perCategoryLimit = QUESTION_FETCH_PER_CATEGORY_LIMIT) {
  const batches: any[] = [];
  const fetchedByCategory: Record<string, number> = {};
  for (const categoryId of categoryIds) {
    const activeRows = await base44.asServiceRole.entities.Question
      .filter({ main_category_id: categoryId, state: 'A' }, '-created_date', perCategoryLimit)
      .catch(() => []);
    fetchedByCategory[String(categoryId)] = Array.isArray(activeRows) ? activeRows.length : 0;
    if (Array.isArray(activeRows) && activeRows.length > 0) batches.push(...activeRows);
  }
  return {
    rows: dedupeQuestions(batches),
    fetchedByCategory,
  };
}

function getUtcDayBucket(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function safeSeedText(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 64);
}

function getProjectionSeed(body: any, allowRequestSeed: boolean) {
  const requestedSeed = allowRequestSeed ? safeSeedText(body?.projectionSeed ?? body?.seed) : '';
  // Admin diagnostics may provide a deterministic seed to reproduce a
  // projection; normal gameplay cannot control fairness and rotates by UTC day.
  return requestedSeed ? `admin-provided:${requestedSeed}` : `utc-day:${getUtcDayBucket()}`;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableQuestionScore(question: any, seed: string, salt: string) {
  return hashText(`${seed}|${salt}|${getQuestionIdentity(question)}`);
}

function stableShuffleQuestions<T extends Record<string, unknown>>(items: T[], seed: string, salt: string) {
  return (items || []).slice().sort((a: any, b: any) => {
    const diff = stableQuestionScore(a, seed, salt) - stableQuestionScore(b, seed, salt);
    if (diff !== 0) return diff;
    return getQuestionIdentity(a).localeCompare(getQuestionIdentity(b));
  });
}

function groupQuestions<T>(items: T[], keyFn: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items || []) {
    const key = keyFn(item) || 'unknown';
    const bucket = groups.get(key) || [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return groups;
}

function getCategoryKey(question: any) {
  return String(question?.main_category_id ?? 'unknown');
}

function getSubcategoryKey(question: any) {
  const text = String(question?.sub_category || '').trim().toLowerCase();
  return text || 'unknown_subcategory';
}

function getEraBand(question: any) {
  const year = Number(question?.year);
  if (!Number.isFinite(year)) return 'unknown_year';
  const start = Math.floor(year / 50) * 50;
  return `${start}-${start + 49}`;
}

function allocateProportionalSlots<T>(groups: Map<string, T[]>, limit: number) {
  const entries = Array.from(groups.entries())
    .map(([key, items]) => ({
      key,
      items,
      size: items.length,
      exact: 0,
      remainder: 0,
      slots: 0,
    }))
    .filter((entry) => entry.size > 0);

  const total = entries.reduce((sum, entry) => sum + entry.size, 0);
  const target = Math.max(0, Math.min(Math.trunc(limit), total));
  if (target === 0 || total === 0) return [];

  if (total <= target) {
    return entries.map((entry) => ({ ...entry, exact: entry.size, slots: entry.size, remainder: 0 }));
  }

  for (const entry of entries) {
    entry.exact = (entry.size / total) * target;
    entry.slots = Math.min(entry.size, Math.floor(entry.exact));
    if (target >= entries.length && entry.slots === 0) entry.slots = 1;
    entry.remainder = entry.exact - Math.floor(entry.exact);
  }

  let assigned = entries.reduce((sum, entry) => sum + entry.slots, 0);
  while (assigned > target) {
    const removable = entries
      .filter((entry) => entry.slots > 0)
      .sort((a, b) => (a.exact - b.exact) || a.size - b.size || a.key.localeCompare(b.key))[0];
    if (!removable) break;
    removable.slots -= 1;
    assigned -= 1;
  }

  let guard = 0;
  while (assigned < target && guard < entries.length * Math.max(1, target)) {
    guard += 1;
    const addable = entries
      .filter((entry) => entry.slots < entry.size)
      .sort((a, b) => (b.remainder - a.remainder) || b.size - a.size || a.key.localeCompare(b.key))[0];
    if (!addable) break;
    addable.slots += 1;
    addable.remainder = Math.max(0, addable.remainder - 1);
    assigned += 1;
  }

  return entries.filter((entry) => entry.slots > 0);
}

function sampleWithinCategory(candidates: any[], quota: number, seed: string, categoryKey: string) {
  const target = Math.max(0, Math.min(quota, candidates.length));
  if (target === 0) return [];
  if (target >= candidates.length) {
    return stableShuffleQuestions(candidates, seed, `category:${categoryKey}:all`);
  }

  const subcategoryGroups = groupQuestions(candidates, getSubcategoryKey);
  const subcategorySlots = allocateProportionalSlots(subcategoryGroups, target);
  const selected: any[] = [];
  const selectedIds = new Set<string>();

  for (const entry of subcategorySlots) {
    const picks = stableShuffleQuestions(entry.items, seed, `subcategory:${categoryKey}:${entry.key}`)
      .slice(0, entry.slots);
    for (const pick of picks) {
      const id = getQuestionIdentity(pick);
      if (!id || selectedIds.has(id)) continue;
      selectedIds.add(id);
      selected.push(pick);
    }
  }

  if (selected.length < target) {
    const fill = stableShuffleQuestions(
      candidates.filter((question) => !selectedIds.has(getQuestionIdentity(question))),
      seed,
      `category:${categoryKey}:fill`,
    );
    for (const pick of fill) {
      if (selected.length >= target) break;
      selected.push(pick);
    }
  }

  return selected.slice(0, target);
}

function buildPoolProportionalProjection(candidates: any[], limit: number, seed: string) {
  const target = Math.max(0, Math.min(Math.trunc(limit), candidates.length));
  if (target === 0) {
    return {
      projected: [],
      categorySlots: {},
    };
  }

  if (target >= candidates.length) {
    return {
      projected: stableShuffleQuestions(candidates, seed, 'full-pool-final'),
      categorySlots: Object.fromEntries(
        Array.from(groupQuestions(candidates, getCategoryKey).entries()).map(([key, items]) => [key, items.length]),
      ),
    };
  }

  const categoryGroups = groupQuestions(candidates, getCategoryKey);
  const categorySlots = allocateProportionalSlots(categoryGroups, target);
  const selected: any[] = [];
  const selectedIds = new Set<string>();
  const categorySlotSummary: Record<string, number> = {};

  for (const entry of categorySlots) {
    categorySlotSummary[entry.key] = entry.slots;
    const picks = sampleWithinCategory(entry.items, entry.slots, seed, entry.key);
    for (const pick of picks) {
      const id = getQuestionIdentity(pick);
      if (!id || selectedIds.has(id)) continue;
      selectedIds.add(id);
      selected.push(pick);
    }
  }

  if (selected.length < target) {
    const fill = stableShuffleQuestions(
      candidates.filter((question) => !selectedIds.has(getQuestionIdentity(question))),
      seed,
      'projection-fill',
    );
    for (const pick of fill) {
      if (selected.length >= target) break;
      selected.push(pick);
    }
  }

  return {
    projected: stableShuffleQuestions(selected, seed, 'final-projection').slice(0, target),
    categorySlots: categorySlotSummary,
  };
}

function buildDistribution(items: any[], keyFn: (item: any) => string, limit = DIAGNOSTIC_TOP_LIMIT) {
  const counts = new Map<string, number>();
  for (const item of items || []) {
    const key = keyFn(item) || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries(
    Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit),
  );
}

function buildProjectionDiagnostics({
  fetchedRows,
  normalizedRows,
  projectedRows,
  fetchedByCategory,
  categorySlots,
  limit,
  seed,
  activeCategoryIds,
}: {
  fetchedRows: any[];
  normalizedRows: any[];
  projectedRows: any[];
  fetchedByCategory: Record<string, number>;
  categorySlots: Record<string, number>;
  limit: number;
  seed: string;
  activeCategoryIds: number[];
}) {
  return {
    strategy: PROJECTION_SAMPLING_STRATEGY,
    projectionSeed: seed,
    projectionLimit: limit,
    questionFetchPath: 'getQuestions:per_category_question_filter',
    wasCappedBeforeBalancing: false,
    queryLimitUsed: QUESTION_FETCH_PER_CATEGORY_LIMIT,
    queryOrderUsed: '-created_date per active category before pool-proportional projection',
    fetchedActiveTotal: fetchedRows.length,
    eligibleAfterNormalization: normalizedRows.length,
    returnedTotal: projectedRows.length,
    droppedDuringNormalization: Math.max(0, fetchedRows.length - normalizedRows.length),
    activeCategoryWhitelistSize: activeCategoryIds.length,
    fetchedByCategory,
    categorySlots,
    eligibleByCategory: buildDistribution(normalizedRows, getCategoryKey),
    returnedByCategory: buildDistribution(projectedRows, getCategoryKey),
    returnedTopSubCategories: buildDistribution(
      projectedRows,
      (question) => `${getCategoryKey(question)} / ${getSubcategoryKey(question)}`,
    ),
    returnedByEraBand: buildDistribution(projectedRows, getEraBand),
    finalProjectionShuffled: true,
    poolProportional: true,
    equalCategoryCounts: false,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const wantsAdminBank = body?.scope === 'admin' || body?.fullBank === true || body?.includeInactive === true;
    const wantsDiagnostics = body?.includeDiagnostics === true || body?.debug === true;
    const needsAdmin = wantsAdminBank || wantsDiagnostics;
    const user = await getOptionalUser(base44);
    if (needsAdmin && !user?.email) {
      return json({ ok: false, error: 'Giris yapmaniz gerekiyor.' }, 401);
    }
    const isAdmin = needsAdmin ? await isAuthorizedAdmin(base44, user) : false;
    if (needsAdmin && !isAdmin) {
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
      : FALLBACK_ACTIVE_CATEGORY_IDS
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
        source: 'public_minimal_playable_projection',
        reason: 'no_active_requested_categories',
      });
    }

    const projectionSeed = getProjectionSeed(body, isAdmin);
    const { rows: questions, fetchedByCategory } = await loadActiveQuestionCandidates(base44, Array.from(allowedMainCategoryIds));
    const normalizedQuestions = (questions || [])
      .map((question: Record<string, unknown>) => normalizeQuestionForRuntime(question, allowedMainCategoryIds))
      .filter(Boolean);
    const projection = buildPoolProportionalProjection(normalizedQuestions, limit, projectionSeed);
    const projected = projection.projected;

    const payload: Record<string, unknown> = {
      ok: true,
      questions: projected,
      activeCategoryIds: Array.from(activeMainCategoryIds),
      source: 'public_minimal_playable_projection',
      limit,
      count: projected.length,
      samplingStrategy: PROJECTION_SAMPLING_STRATEGY,
    };
    if (wantsDiagnostics) {
      payload.projectionDiagnostics = buildProjectionDiagnostics({
        fetchedRows: questions,
        normalizedRows: normalizedQuestions,
        projectedRows: projected,
        fetchedByCategory,
        categorySlots: projection.categorySlots,
        limit,
        seed: projectionSeed,
        activeCategoryIds: Array.from(activeMainCategoryIds),
      });
    }
    return json(payload);
  } catch (error) {
    console.error('[getQuestions] failed:', (error as Error)?.message || error);
    return json({ ok: false, error: 'Sorular yuklenemedi.' }, 500);
  }
});
