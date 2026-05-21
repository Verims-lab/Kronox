export const ADMIN_EMAIL = 'sariverim@gmail.com';

export function isAdminUser(user) {
  return user?.email === ADMIN_EMAIL || user?.role === 'admin';
}
