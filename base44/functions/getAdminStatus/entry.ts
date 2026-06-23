// Verims comment-2 23.06.2026
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function normalizeAdminAuthEmail(value) {
  return String(value || '').trim().toLowerCase();
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

function adminDebugBase(email, patch = {}) {
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


async function getAdminAuthorization(base44, user) {
  const email = normalizeAdminAuthEmail(user?.email);
  if (!email) {
    return {
      isAdmin: false,
      row: null,
      role: '',
      status: '',
      source: 'AdminUser',
      debug: adminDebugBase(email),
    };
  }

  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) {
    return {
      isAdmin: false,
      row: null,
      role: '',
      status: '',
      source: 'AdminUser',
      debug: adminDebugBase(email, { lookupAttempted: false, reason: 'lookup_error' }),
    };
  }

  let rows = [];
  let lookupError = '';
  let lookupAttemptSucceeded = false;
  for (const field of ADMIN_AUTH_FIELD_CANDIDATES.email) {
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

  const exactRows = (rows || []).map((candidate) => {
    const emailField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.email);
    const roleField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.role);
    const statusField = readAdminAuthField(candidate, ADMIN_AUTH_FIELD_CANDIDATES.status);
    return {
      candidate,
      email: normalizeAdminAuthEmail(emailField.value),
      role: String(roleField.value || '').trim().toLowerCase(),
      status: String(statusField.value || '').trim().toLowerCase(),
      fields: {
        email: emailField.field,
        role: roleField.field,
        status: statusField.field,
      },
    };
  }).filter((candidate) => candidate.email === email);

  const active = exactRows.find((candidate) => isActiveAdminStatus(candidate.status) && isActiveAdminRole(candidate.role)) || null;
  const row = active?.candidate || null;
  const nearestMatch = active || exactRows[0] || null;
  const reason = row
    ? 'active_admin_match'
    : (exactRows.length > 0
      ? (!isActiveAdminStatus(nearestMatch?.status) ? 'status_not_active' : 'role_not_allowed')
      : (!lookupAttemptSucceeded && lookupError ? 'lookup_error' : 'admin_user_not_found'));

  return {
    isAdmin: Boolean(row),
    row,
    role: row ? active.role : (nearestMatch?.role || ''),
    status: row ? active.status : (nearestMatch?.status || ''),
    source: 'AdminUser',
    debug: adminDebugBase(email, {
      lookupAttempted: true,
      matchedRow: Boolean(row),
      matchedFieldNames: nearestMatch?.fields || { email: '', role: '', status: '' },
      reason,
    }),
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user?.email) return json({ ok: false, error: 'Authentication required' }, 401);

    const authorization = await getAdminAuthorization(base44, user);
    return json({
      ok: true,
      isAdmin: authorization.isAdmin,
      role: authorization.role || null,
      status: authorization.status || null,
      source: 'AdminUser',
      statusFunction: 'getAdminStatus',
      debug: authorization.debug,
    });
  } catch (_error) {
    return json({ ok: false, error: 'Authentication required' }, 401);
  }
});
