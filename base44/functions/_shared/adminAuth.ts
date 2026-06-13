/* global Response */
export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function isActiveAdminRole(role) {
  const value = String(role || '').trim().toLowerCase();
  return value === 'owner' || value === 'admin';
}

function isActiveStatus(status) {
  return String(status || '').trim().toLowerCase() === 'active';
}

const FIELD_CANDIDATES = {
  email: ['email', 'Email', 'user_email', 'admin_email'],
  role: ['role', 'Role', 'user_role'],
  status: ['status', 'Status'],
};

function readField(row, candidates) {
  for (const field of candidates) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) {
      return { value: row[field], field };
    }
  }
  return { value: undefined, field: '' };
}

function debugBase(email, patch = {}) {
  return {
    source: 'AdminUser',
    authEmailPresent: Boolean(email),
    normalizedEmail: email,
    lookupAttempted: false,
    matchedRow: false,
    matchedFieldNames: {
      email: '',
      role: '',
      status: '',
    },
    reason: email ? 'admin_user_not_found' : 'no_auth_email',
    ...patch,
  };
}

export async function getAdminAuthorization(base44, user) {
  const email = normalizeEmail(user?.email);
  if (!email) {
    return {
      isAdmin: false,
      row: null,
      role: '',
      status: '',
      source: 'AdminUser',
      debug: debugBase(email),
    };
  }

  // Static contract: DB-backed admin guard reads base44.asServiceRole.entities.AdminUser.
  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) {
    return {
      isAdmin: false,
      row: null,
      role: '',
      status: '',
      source: 'AdminUser',
      debug: debugBase(email, { lookupAttempted: false, reason: 'lookup_error' }),
    };
  }

  let rows = [];
  let lookupError = '';
  let lookupAttemptSucceeded = false;
  for (const field of FIELD_CANDIDATES.email) {
    try {
      const result = await adminEntity.filter({ [field]: email }, '-updated_at', 10);
      if (Array.isArray(result)) lookupAttemptSucceeded = true;
      if (Array.isArray(result) && result.length > 0) {
        rows = result;
        break;
      }
    } catch (error) {
      lookupError = String(error?.message || 'lookup_error');
    }
  }

  const exactEmailRows = (rows || [])
    .map((candidate) => {
      const emailField = readField(candidate, FIELD_CANDIDATES.email);
      const roleField = readField(candidate, FIELD_CANDIDATES.role);
      const statusField = readField(candidate, FIELD_CANDIDATES.status);
      return {
        candidate,
        email: normalizeEmail(emailField.value),
        role: String(roleField.value || '').trim().toLowerCase(),
        status: String(statusField.value || '').trim().toLowerCase(),
        fields: {
          email: emailField.field,
          role: roleField.field,
          status: statusField.field,
        },
      };
    })
    .filter((candidate) => candidate.email === email);

  const activeRow = exactEmailRows.find((candidate) => (
    isActiveStatus(candidate.status) && isActiveAdminRole(candidate.role)
  )) || null;
  const row = activeRow?.candidate || null;
  const nearestMatch = activeRow || exactEmailRows[0] || null;
  const reason = row
    ? 'active_admin_match'
    : (exactEmailRows.length > 0
      ? (!isActiveStatus(nearestMatch?.status) ? 'status_not_active' : 'role_not_allowed')
      : (!lookupAttemptSucceeded && lookupError ? 'lookup_error' : 'admin_user_not_found'));

  return {
    isAdmin: Boolean(row),
    row,
    role: row ? activeRow.role : (nearestMatch?.role || ''),
    status: row ? activeRow.status : (nearestMatch?.status || ''),
    source: 'AdminUser',
    debug: debugBase(email, {
      lookupAttempted: true,
      matchedRow: Boolean(row),
      matchedFieldNames: nearestMatch?.fields || { email: '', role: '', status: '' },
      reason,
    }),
  };
}

export async function isAuthorizedAdmin(base44, user) {
  const authorization = await getAdminAuthorization(base44, user);
  return authorization.isAdmin;
}

export async function requireAdmin(base44) {
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
