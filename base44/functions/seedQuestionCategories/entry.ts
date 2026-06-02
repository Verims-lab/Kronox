import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Codex154 — Hardcoded admin email literal removed. Admin allowlist is now
// sourced from the KRONOX_ADMIN_EMAILS env/secret (comma-separated). Missing
// or empty config fails closed (403).

const QUESTION_CATEGORIES = [
  { category_id: 1, name: 'Chronicle' },
  { category_id: 2, name: 'Flashback' },
  { category_id: 3, name: 'Kült' },
  { category_id: 4, name: 'Viral' },
  { category_id: 5, name: 'Arena' },
  { category_id: 6, name: 'Level Up' },
];

function json(body, status = 200) {
  return Response.json(body, { status });
}

function parseAdminAllowlist() {
  const raw = Deno.env.get('KRONOX_ADMIN_EMAILS');
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

async function requireAdmin(base44) {
  let user = null;
  try {
    user = await base44.auth.me();
  } catch {
    return { response: json({ error: 'Authentication required' }, 401) };
  }

  if (!user?.email) {
    return { response: json({ error: 'Authentication required' }, 401) };
  }

  const allowlist = parseAdminAllowlist();
  const callerEmail = String(user.email).trim().toLowerCase();
  const isAllowlisted = allowlist.length > 0 && allowlist.includes(callerEmail);

  if (user.role !== 'admin' && !isAllowlisted) {
    return { response: json({ error: 'Admin access required' }, 403) };
  }

  return { user };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const base44 = createClientFromRequest(req);
    const auth = await requireAdmin(base44);
    if (auth.response) return auth.response;

    const results = [];

    for (const category of QUESTION_CATEGORIES) {
      const existingRows = await base44.asServiceRole.entities.Category.filter(
        { category_id: category.category_id },
        '-created_date',
        10,
      );
      const existing = existingRows?.[0] || null;

      if (!existing) {
        const created = await base44.asServiceRole.entities.Category.create(category);
        results.push({
          category_id: category.category_id,
          name: category.name,
          action: 'created',
          id: created?.id || null,
        });
        continue;
      }

      if (existing.name !== category.name) {
        const updated = await base44.asServiceRole.entities.Category.update(existing.id, {
          name: category.name,
        });
        results.push({
          category_id: category.category_id,
          name: category.name,
          action: 'updated',
          id: updated?.id || existing.id,
          duplicateCount: Math.max(0, (existingRows?.length || 0) - 1),
        });
        continue;
      }

      results.push({
        category_id: category.category_id,
        name: category.name,
        action: 'exists',
        id: existing.id,
        duplicateCount: Math.max(0, (existingRows?.length || 0) - 1),
      });
    }

    return json({
      ok: true,
      categories: QUESTION_CATEGORIES,
      results,
    });
  } catch (error) {
    console.error('[seedQuestionCategories] failed', error);
    return json({ error: 'Internal server error' }, 500);
  }
});