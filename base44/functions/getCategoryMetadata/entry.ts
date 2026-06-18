import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MAX_CATEGORY_LIMIT = 1000;
const ACTIVE_CATEGORY_STATUSES = new Set(['', 'a', 'active', 'aktif']);

function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function normalizeCategoryId(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const id = Math.trunc(numeric);
  return id > 0 ? id : null;
}

function isActiveCategory(row: any) {
  const status = String(row?.status || '').trim().toLowerCase();
  return ACTIVE_CATEGORY_STATUSES.has(status);
}

function safeText(value: unknown, maxLength = 160) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function publicCategoryMetadata(row: any) {
  const categoryId = normalizeCategoryId(row?.category_id ?? row?.categoryid);
  const name = safeText(row?.name, 80);
  if (!categoryId || !name || !isActiveCategory(row)) return null;
  return {
    category_id: categoryId,
    name,
    description: safeText(row?.description, 240),
    status: 'A',
  };
}

function byCategorySort(a: any, b: any) {
  const aId = Number(a?.category_id) || 0;
  const bId = Number(b?.category_id) || 0;
  if (aId !== bId) return aId - bId;
  return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr');
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405);
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(
      MAX_CATEGORY_LIMIT,
      Math.max(1, Math.trunc(Number((body as any)?.limit) || MAX_CATEGORY_LIMIT)),
    );

    const base44 = createClientFromRequest(req);
    const entity = base44?.asServiceRole?.entities?.Category;
    if (!entity?.list) {
      return json({ ok: false, error: 'category_metadata_unavailable' }, 500);
    }

    const rows = await entity.list('category_id', limit).catch(() => []);
    const byId = new Map<number, any>();
    for (const row of Array.isArray(rows) ? rows : []) {
      const category = publicCategoryMetadata(row);
      if (category && !byId.has(category.category_id)) byId.set(category.category_id, category);
    }

    const categories = Array.from(byId.values()).sort(byCategorySort);
    return json({
      ok: true,
      categories,
      contract: {
        source: 'Category',
        metadataOnly: true,
        guestCallableWithoutLogin: true,
        rawQuestionRowsExposed: false,
        legacyHardcodedCategoryFallbackAllowed: false,
      },
    });
  } catch {
    return json({ ok: false, error: 'category_metadata_load_failed' }, 500);
  }
});
