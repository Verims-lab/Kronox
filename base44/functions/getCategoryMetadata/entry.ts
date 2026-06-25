import { createClientFromRequest } from 'npm:@base44/sdk@0.8.34';

const MAX_CATEGORY_LIMIT = 1000;
const MAX_REQUEST_BODY_BYTES = 16 * 1024;
const ACTIVE_CATEGORY_STATUSES = new Set(['', 'a', 'active', 'aktif']);
const REQUEST_FIELDS = new Set(['limit']);

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

function isPlainObject(value: unknown) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unexpectedKeys(source: unknown, allowed: Set<string>) {
  if (!isPlainObject(source)) return [];
  return Object.keys(source as Record<string, unknown>)
    .filter((key) => !allowed.has(key))
    .slice(0, 12);
}

function byteLength(text: string) {
  return new TextEncoder().encode(text || '').length;
}

async function readMetadataRequestBody(req: Request) {
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    return { ok: false, response: json({ ok: false, error: 'request_body_too_large' }, 413), body: null };
  }

  const text = await req.text();
  if (byteLength(text) > MAX_REQUEST_BODY_BYTES) {
    return { ok: false, response: json({ ok: false, error: 'request_body_too_large' }, 413), body: null };
  }
  if (!text.trim()) return { ok: true, response: null, body: {} };

  try {
    const body = JSON.parse(text);
    if (!isPlainObject(body)) {
      return { ok: false, response: json({ ok: false, error: 'invalid_request_body' }, 400), body: null };
    }
    const unexpected = unexpectedKeys(body, REQUEST_FIELDS);
    if (unexpected.length) {
      return {
        ok: false,
        response: json({ ok: false, error: 'unexpected_category_metadata_fields', fields: unexpected }, 400),
        body: null,
      };
    }
    return { ok: true, response: null, body };
  } catch {
    return { ok: false, response: json({ ok: false, error: 'invalid_json_body' }, 400), body: null };
  }
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
  // Public by design: guest onboarding category selection must work before
  // Google/Apple/email login. The response is metadata-only and intentionally
  // omits questions, answers, years, user data, and admin/internal fields.
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405);
    }

    const parsed = await readMetadataRequestBody(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body || {};
    const limit = Math.min(
      MAX_CATEGORY_LIMIT,
      Math.max(1, Math.trunc(Number((body as any)?.limit) || MAX_CATEGORY_LIMIT)),
    );

    const base44 = createClientFromRequest(req);
    const entity = base44.asServiceRole.entities.Category;
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
        responseFields: ['category_id', 'name', 'description', 'status'],
        metadataOnly: true,
        guestCallableWithoutLogin: true,
        rawQuestionRowsExposed: false,
        answersExposed: false,
        yearsExposed: false,
        adminFieldsExposed: false,
        legacyHardcodedCategoryFallbackAllowed: false,
      },
    });
  } catch {
    return json({ ok: false, error: 'category_metadata_load_failed' }, 500);
  }
});
