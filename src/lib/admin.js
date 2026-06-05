import { base44 } from '@/api/base44Client';

export function isAdminUser(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.is_admin === true) return true;
  if (Array.isArray(user.permissions) && user.permissions.includes('admin')) return true;
  return false;
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

export async function withAdminStatus(user) {
  if (!user?.email) return user || null;
  try {
    const response = await base44.functions.fetch('/getAdminStatus', { method: 'POST' });
    if (!response.ok) return withoutAdminPermission(user);
    const body = await response.json().catch(() => ({}));
    const isAdmin = body?.ok === true && body?.isAdmin === true;
    const permissions = Array.isArray(user.permissions)
      ? user.permissions.filter((permission) => permission !== 'admin')
      : [];
    return {
      ...user,
      role: isAdmin ? 'admin' : (user.role === 'admin' ? 'user' : user.role),
      is_admin: isAdmin,
      permissions: isAdmin ? [...permissions, 'admin'] : permissions,
      admin_role: isAdmin ? (body?.role || 'admin') : '',
      admin_status_source: 'AdminUser',
    };
  } catch (_error) {
    return withoutAdminPermission(user);
  }
}
