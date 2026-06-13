export const KRONOX_SUPPORT_EMAIL_ENV_VAR = 'VITE_KRONOX_SUPPORT_EMAIL';

function normalizeSupportEmail(value) {
  const email = String(value || '').trim();
  if (!email || /\s/.test(email)) return '';
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) return '';
  return email;
}

export function getPublicSupportEmail() {
  return normalizeSupportEmail(import.meta.env.VITE_KRONOX_SUPPORT_EMAIL);
}

export function buildPublicSupportMailto({ subject } = {}) {
  const email = getPublicSupportEmail();
  if (!email) return '';
  const params = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return `mailto:${email}${params}`;
}

export function isPublicSupportEmailConfigured() {
  return Boolean(getPublicSupportEmail());
}
