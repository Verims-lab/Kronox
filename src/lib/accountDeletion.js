export const ACCOUNT_DELETION_SUPPORT_EMAIL = 'support@kronoxgame.com';
export const ACCOUNT_DELETION_ERROR_COPY = 'Hesap silinemedi. Lütfen tekrar dene veya destek ile iletişime geç.';

const KNOWN_USER_CACHE_KEYS = [
  'kx_solo_progress_v1',
  'kronox_question_history_v1',
  'kronox_question_cache_v1',
  'kronox_tutorial_seen_v1',
  'kronox_health_simulator_last_run_v1',
];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function ownerKeyFromEmail(rawEmail) {
  const email = normalizeEmail(rawEmail);
  if (!email) return '';

  let hash = 2166136261;
  for (let i = 0; i < email.length; i += 1) {
    hash ^= email.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `u_${(hash >>> 0).toString(36)}`;
}

function removeMatchingKeys(storage, shouldRemove) {
  if (!storage) return;
  try {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key) keys.push(key);
    }
    keys.filter(shouldRemove).forEach((key) => storage.removeItem(key));
  } catch {
    // Storage can be unavailable in private mode; deletion must still finish.
  }
}

export function clearAccountDeletionLocalCaches(user) {
  if (typeof window === 'undefined') return;

  const email = normalizeEmail(user?.email);
  const ownerKey = ownerKeyFromEmail(email);
  const scopedSoloKey = ownerKey ? `kx_solo_progress_v1:${ownerKey}` : '';
  const emailTokens = [
    email,
    encodeURIComponent(email),
    ownerKey,
  ].filter(Boolean);

  const shouldRemove = (key) => {
    const normalizedKey = String(key || '').toLowerCase();
    if (KNOWN_USER_CACHE_KEYS.includes(key)) return true;
    if (scopedSoloKey && key === scopedSoloKey) return true;
    if (!normalizedKey.startsWith('kx_') && !normalizedKey.startsWith('kronox_')) return false;
    return emailTokens.some((token) => normalizedKey.includes(String(token).toLowerCase()));
  };

  removeMatchingKeys(window.localStorage, shouldRemove);
  removeMatchingKeys(window.sessionStorage, (key) => String(key || '').startsWith('kx-chunk-reloaded:'));
}

export async function requestAccountDeletion(base44, user) {
  const response = await base44.functions.fetch('/deleteAccount', { method: 'POST' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    const message = body?.error || ACCOUNT_DELETION_ERROR_COPY;
    throw new Error(message);
  }
  clearAccountDeletionLocalCaches(user);
  return body;
}
