import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Codex157 — Hardcoded admin email literals removed. Admin authorization is
// role/permission based, with ADMIN_EMAILS/KRONOX_ADMIN_EMAILS as a
// deployment-secret fallback. Missing/empty config fails closed unless the
// authenticated user has an admin role/permission.
// Codex158 — Category rows now carry status ('a' active / 'p' passive) and
// optional description. All seeded categories start as active ('a').
// Description is used as future tooltip/help text in category selection.
const QUESTION_CATEGORIES = [
  { category_id: 1, name: 'Chronicle', status: 'a', description: 'Tarihin önemli olayları ve dönemleri.' },
  { category_id: 2, name: 'Flashback', status: 'a', description: 'Geçmişten hafızada kalan kültürel anlar.' },
  { category_id: 3, name: 'Kült', status: 'a', description: 'Kültleşmiş filmler, diziler, müzikler ve popüler kültür.' },
  { category_id: 4, name: 'Viral', status: 'a', description: 'İnternette yayılan viral olaylar ve dijital kültür.' },
  { category_id: 5, name: 'Arena', status: 'a', description: 'Spor, rekabet ve unutulmaz karşılaşmalar.' },
  { category_id: 6, name: 'Level Up', status: 'a', description: 'Oyun dünyası, teknoloji ve gelişim anları.' },
];

function json(body, status = 200) {
  return Response.json(body, { status });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getConfiguredAdminEmails() {
  const raw = Deno.env.get('ADMIN_EMAILS') || Deno.env.get('KRONOX_ADMIN_EMAILS') || '';
  return raw.split(',').map(normalizeEmail).filter(Boolean);
}

function isAuthorizedAdmin(user) {
  if (!user) return false;
  if (user.role === 'admin' || user.is_admin === true) return true;
  if (Array.isArray(user.permissions) && user.permissions.includes('admin')) return true;
  const allowlist = getConfiguredAdminEmails();
  return allowlist.length > 0 && allowlist.includes(normalizeEmail(user.email));
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

  if (!isAuthorizedAdmin(user)) {
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

      // Codex158 — Backfill status/description on pre-existing rows that
      // were seeded before these fields existed. We never overwrite a
      // non-empty description (admin may have edited it) and we never
      // downgrade an explicit 'p' status to 'a'.
      const patch = {};
      if (existing.name !== category.name) patch.name = category.name;
      if (typeof existing.status !== 'string' || existing.status.trim() === '') {
        patch.status = category.status;
      }
      if (typeof existing.description !== 'string') {
        patch.description = category.description;
      }

      if (Object.keys(patch).length > 0) {
        const updated = await base44.asServiceRole.entities.Category.update(existing.id, patch);
        results.push({
          category_id: category.category_id,
          name: category.name,
          action: 'updated',
          id: updated?.id || existing.id,
          patchedFields: Object.keys(patch),
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