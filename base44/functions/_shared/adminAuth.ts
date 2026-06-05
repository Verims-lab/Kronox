export function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function json(payload: unknown, status = 200) {
  return Response.json(payload, { status });
}

function isActiveAdminRole(role: unknown) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}

function isActiveStatus(status: unknown) {
  return String(status || '').trim().toLowerCase() === 'active';
}

export async function getAdminAuthorization(base44: any, user: any) {
  const email = normalizeEmail(user?.email);
  if (!email) return { isAdmin: false, row: null, role: '', status: '', source: 'AdminUser' };

  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  const rows = adminEntity?.filter
    ? await adminEntity.filter({ email }, '-updated_at', 10).catch(() => [])
    : [];

  const row = (rows || []).find((candidate: any) => (
    normalizeEmail(candidate?.email) === email &&
    isActiveStatus(candidate?.status) &&
    isActiveAdminRole(candidate?.role)
  )) || null;

  return {
    isAdmin: Boolean(row),
    row,
    role: row ? String(row.role || 'admin').trim().toLowerCase() : '',
    status: row ? String(row.status || '').trim().toLowerCase() : '',
    source: 'AdminUser',
  };
}

export async function isAuthorizedAdmin(base44: any, user: any) {
  const authorization = await getAdminAuthorization(base44, user);
  return authorization.isAdmin;
}

export async function requireAdmin(base44: any) {
  try {
    const user = await base44.auth.me();
    if (!user?.email) return { response: json({ ok: false, error: 'Authentication required' }, 401) };

    const authorization = await getAdminAuthorization(base44, user);
    if (!authorization.isAdmin) return { response: json({ ok: false, error: 'Admin access required' }, 403) };

    return { user, admin: authorization.row, adminRole: authorization.role };
  } catch (_error) {
    return { response: json({ ok: false, error: 'Authentication required' }, 401) };
  }
}
