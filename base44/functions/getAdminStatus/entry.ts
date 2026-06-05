import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function json(payload, status = 200) {
  return Response.json(payload, { status });
}

function isAllowedRole(role) {
  const normalized = normalizeRole(role);
  return normalized === 'admin' || normalized === 'owner';
}

function isActiveStatus(status) {
  return normalizeStatus(status) === 'active';
}

const FIELD_CANDIDATES = {
  email: ['email', 'Email', 'user_email', 'admin_email'],
  role: ['role', 'Role', 'user_role'],
  status: ['status', 'Status'],
};

function readField(row, candidates) {
  for (const field of candidates) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) {
      return row[field];
    }
  }
  return undefined;
}

function debug(reason, lookupAttempted, matchedRow) {
  return {
    source: 'AdminUser',
    lookupAttempted,
    matchedRow,
    reason,
  };
}

async function getAdminAuthorization(base44, user) {
  const normalizedEmail = normalizeEmail(user?.email);
  if (!normalizedEmail) {
    return {
      isAdmin: false,
      role: null,
      status: null,
      debug: debug('no_auth_email', false, false),
    };
  }

  const adminEntity = base44?.asServiceRole?.entities?.AdminUser;
  if (!adminEntity?.filter) {
    return {
      isAdmin: false,
      role: null,
      status: null,
      debug: debug('lookup_error', false, false),
    };
  }

  let rows = [];
  let lookupSucceeded = false;
  let lookupError = false;
  for (const field of FIELD_CANDIDATES.email) {
    try {
      const result = await adminEntity.filter({ [field]: normalizedEmail }, '-updated_at', 10);
      if (Array.isArray(result)) lookupSucceeded = true;
      if (Array.isArray(result) && result.length > 0) {
        rows = result;
        break;
      }
    } catch (_error) {
      lookupError = true;
    }
  }

  const exactMatches = rows
    .map((row) => {
      const email = normalizeEmail(readField(row, FIELD_CANDIDATES.email));
      const role = normalizeRole(readField(row, FIELD_CANDIDATES.role));
      const status = normalizeStatus(readField(row, FIELD_CANDIDATES.status));
      return { email, role, status };
    })
    .filter((row) => row.email === normalizedEmail);

  const activeAdmin = exactMatches.find((row) => isAllowedRole(row.role) && isActiveStatus(row.status));
  if (activeAdmin) {
    return {
      isAdmin: true,
      role: activeAdmin.role,
      status: activeAdmin.status,
      debug: debug('active_admin_match', true, true),
    };
  }

  const nearest = exactMatches[0] || null;
  const reason = nearest
    ? (!isActiveStatus(nearest.status) ? 'status_not_active' : 'role_not_allowed')
    : (!lookupSucceeded && lookupError ? 'lookup_error' : 'admin_user_not_found');

  return {
    isAdmin: false,
    role: nearest?.role || null,
    status: nearest?.status || null,
    debug: debug(reason, true, false),
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
      role: authorization.role,
      status: authorization.status,
      source: 'AdminUser',
      statusFunction: 'getAdminStatus',
      debug: authorization.debug,
    });
  } catch (_error) {
    return json({ ok: false, error: 'Authentication required' }, 401);
  }
});
