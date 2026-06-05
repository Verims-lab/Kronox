import { base44 } from '@/api/base44Client';

export function normalizeAdminEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isAdminUser(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.is_admin === true) return true;
  if (Array.isArray(user.permissions) && user.permissions.includes('admin')) return true;
  return false;
}

function adminStatusBase(user, patch = {}) {
  const authEmailRaw = String(user?.email || '');
  const normalizedEmail = normalizeAdminEmail(authEmailRaw);
  return {
    authEmailRaw,
    normalizedEmail,
    called: false,
    loading: false,
    statusCall: normalizedEmail ? 'not_started' : 'skipped',
    responseShape: '',
    responseShapeKeys: [],
    responseKeys: [],
    dataKeys: [],
    nestedDataKeys: [],
    parsedIsAdmin: false,
    role: '',
    status: '',
    source: 'AdminUser',
    statusFunction: '',
    reason: normalizedEmail ? 'not_checked' : 'no_auth_email',
    error: '',
    ...patch,
  };
}

function withoutAdminPermission(user) {
  const permissions = Array.isArray(user?.permissions)
    ? user.permissions.filter((permission) => permission !== 'admin')
    : user?.permissions;
  return {
    ...user,
    is_admin: false,
    role: user?.role === 'admin' ? 'user' : user?.role,
    permissions,
    admin_status_source: 'AdminUser',
  };
}

function objectKeys(value) {
  return value && typeof value === 'object' ? Object.keys(value).slice(0, 12) : [];
}

function unwrapFunctionBody(value, source) {
  if (!value || typeof value !== 'object') {
    return {
      body: null,
      responseShape: `${source}:empty`,
      responseShapeKeys: [],
      responseKeys: [],
      dataKeys: [],
      nestedDataKeys: [],
    };
  }
  const responseKeys = objectKeys(value);
  if (value.data && typeof value.data === 'object') {
    const dataKeys = objectKeys(value.data);
    if (value.data.data && typeof value.data.data === 'object') {
      const nestedDataKeys = objectKeys(value.data.data);
      return {
        body: value.data.data,
        responseShape: `${source}:data.data`,
        responseShapeKeys: nestedDataKeys,
        responseKeys,
        dataKeys,
        nestedDataKeys,
      };
    }
    return {
      body: value.data,
      responseShape: `${source}:data`,
      responseShapeKeys: dataKeys,
      responseKeys,
      dataKeys,
      nestedDataKeys: [],
    };
  }
  return {
    body: value,
    responseShape: `${source}:direct`,
    responseShapeKeys: objectKeys(value),
    responseKeys,
    dataKeys: [],
    nestedDataKeys: [],
  };
}

function parseAdminStatusBody(user, body, meta = {}) {
  const role = String(body?.role || '').trim().toLowerCase();
  const status = String(body?.status || '').trim().toLowerCase();
  const parsedIsAdmin = body?.isAdmin === true || body?.is_admin === true || body?.admin === true;
  return adminStatusBase(user, {
    called: true,
    loading: false,
    statusCall: 'success',
    responseShape: meta.responseShape || '',
    responseShapeKeys: meta.responseShapeKeys || [],
    responseKeys: meta.responseKeys || [],
    dataKeys: meta.dataKeys || [],
    nestedDataKeys: meta.nestedDataKeys || [],
    parsedIsAdmin,
    role,
    status,
    source: body?.source || meta.source || 'AdminUser',
    statusFunction: body?.statusFunction || meta.statusFunction || '',
    reason: parsedIsAdmin
      ? 'active_admin'
      : (body?.ok === false
        ? (body?.error || 'function_returned_not_ok')
        : (status && status !== 'active' ? 'inactive_status' : 'no_admin_user_row')),
  });
}

async function fetchFunctionJson(path, payload) {
  const response = await base44.functions.fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const raw = await response.json().catch(() => ({}));
  const unwrapped = unwrapFunctionBody(raw, `fetch:${path}`);
  return {
    ok: response?.ok === true,
    body: unwrapped.body,
    responseShape: unwrapped.responseShape,
    responseShapeKeys: unwrapped.responseShapeKeys,
    responseKeys: unwrapped.responseKeys,
    dataKeys: unwrapped.dataKeys,
    nestedDataKeys: unwrapped.nestedDataKeys,
    httpStatus: response?.status || 0,
  };
}

async function invokeFunctionJson(name, payload) {
  const response = await base44.functions.invoke(name, payload || {});
  const unwrapped = unwrapFunctionBody(response, `invoke:${name}`);
  return {
    ok: true,
    body: unwrapped.body,
    responseShape: unwrapped.responseShape,
    responseShapeKeys: unwrapped.responseShapeKeys,
    responseKeys: unwrapped.responseKeys,
    dataKeys: unwrapped.dataKeys,
    nestedDataKeys: unwrapped.nestedDataKeys,
    httpStatus: response?.status || 0,
  };
}

export async function getCurrentAdminStatus(user) {
  const base = adminStatusBase(user, { loading: true, statusCall: 'pending' });
  if (!base.normalizedEmail) return adminStatusBase(user);

  const attempts = [
    () => fetchFunctionJson('/getAdminStatus', {}),
    () => invokeFunctionJson('getAdminStatus', {}),
    () => fetchFunctionJson('/getQuestions', { action: 'admin_status' }),
    () => invokeFunctionJson('getQuestions', { action: 'admin_status' }),
  ];
  let lastError = '';

  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (result?.ok && result.body && typeof result.body === 'object') {
        return parseAdminStatusBody(user, result.body, result);
      }
      lastError = `http_${result?.httpStatus || 'not_ok'}`;
    } catch (error) {
      lastError = error?.status
        ? `http_${error.status}`
        : (error?.message || 'status_call_failed');
    }
  }

  return adminStatusBase(user, {
    called: true,
    loading: false,
    statusCall: 'error',
    reason: 'function_error',
    error: lastError || 'status_call_failed',
  });
}

async function readAdminStatus(user) {
  try {
    return await getCurrentAdminStatus(user);
  } catch (_error) {
    return adminStatusBase(user, {
      called: true,
      loading: false,
      statusCall: 'error',
      reason: 'status_exception',
      error: _error?.message || 'status_exception',
    });
  }
}

export async function withAdminStatus(user, options = {}) {
  if (!user?.email) return user || null;
  try {
    const status = await readAdminStatus(user);
    options.onStatus?.(status);
    const isAdmin = status?.parsedIsAdmin === true;
    const permissions = Array.isArray(user.permissions)
      ? user.permissions.filter((permission) => permission !== 'admin')
      : [];
    return {
      ...user,
      role: isAdmin ? 'admin' : (user.role === 'admin' ? 'user' : user.role),
      is_admin: isAdmin,
      permissions: isAdmin ? [...permissions, 'admin'] : permissions,
      admin_role: isAdmin ? (status?.role || 'admin') : '',
      admin_status_source: status?.source || 'AdminUser',
      admin_status_debug: status,
    };
  } catch (_error) {
    const status = adminStatusBase(user, {
      called: true,
      loading: false,
      statusCall: 'error',
      reason: 'status_exception',
      error: _error?.message || 'status_exception',
    });
    options.onStatus?.(status);
    return { ...withoutAdminPermission(user), admin_status_debug: status };
  }
}
