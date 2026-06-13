import { createClientFromRequest } from 'npm:@base44/sdk';

// Codex200 — Admin authorization is DB-backed via AdminUser and shared
// backend guard. Admin email env allowlists are no longer used.
// Static contract: requireAdmin checks base44.asServiceRole.entities.AdminUser.
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

function normalizeAdminAuthEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function adminAuthJson(payload, status = 200) {
  return Response.json(payload, { status });
}

function isActiveAdminRole(role) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}

function isActiveAdminStatus(status) {
  return String(status || '').trim().toLowerCase() === 'active';
}

const ADMIN_AUTH_FIELD_CANDIDATES = {
  email: ['email', 'Email', 'user_email', 'admin_email'],
  role: ['role', 'Role', 'user_role'],
  status: ['status', 'Status'],
};

function readAdminAuthField(row, candidates) {
  for (const field of candidates) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) {
      return { value: row[field], field };
    }
  }
  return { value: undefined, field: '' };
}

async function getAdminAuthorization(base44, user) {
  const email = normalizeAdminAuthEmail(user?.email);
  if (!email) return { isAdmin: false, row: null, role: '', status: '' };
  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) return { isAdmin: false, row: null, role: '', status: '' };

  let rows = [];
  for (const field of ADMIN_AUTH_FIELD_CANDIDATES.email) {
    const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10).catch(() => []);
    if (Array.isArray(result) && result.length > 0) {
      rows = result;
      break;
    }
  }

  const active = (rows || []).map((candidate) => {
    const emailField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.email);
    const roleField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.role);
    const statusField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.status);
    return {
      candidate,
      email: normalizeAdminAuthEmail(emailField.value),
      role: String(roleField.value || '').trim().toLowerCase(),
      status: String(statusField.value || '').trim().toLowerCase(),
    };
  }).find((candidate) => candidate.email === email && isActiveAdminStatus(candidate.status) && isActiveAdminRole(candidate.role)) || null;

  return { isAdmin: Boolean(active?.candidate), row: active?.candidate || null, role: active?.role || '', status: active?.status || '' };
}

async function requireAdmin(base44) {
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
