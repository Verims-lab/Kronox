export function isAdminUser(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.is_admin === true) return true;
  if (Array.isArray(user.permissions) && user.permissions.includes('admin')) return true;
  return false;
}
