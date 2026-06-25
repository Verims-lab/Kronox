import { normalizeSafePublicUsernameInput } from './guestProfile';

export function normalizeUserProfileEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function selectStoredUserProfile(rows, email = '') {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const normalizedEmail = normalizeUserProfileEmail(email);
  if (!normalizedEmail) return rows[0] || null;
  return rows.find((row) => (
    normalizeUserProfileEmail(row?.email || row?.user_email) === normalizedEmail
  )) || rows[0] || null;
}

function safeUsernameFromProfile(profile) {
  return normalizeSafePublicUsernameInput(profile?.username);
}

export function mergeAuthenticatedUserProfile(authUser, storedUser) {
  if (!authUser || typeof authUser !== 'object') return authUser || null;

  const storedProfile = storedUser && typeof storedUser === 'object' ? storedUser : null;
  const storedUsername = safeUsernameFromProfile(storedProfile);
  const authUsername = safeUsernameFromProfile(authUser);
  const username = storedUsername || authUsername;
  const merged = { ...(storedProfile || {}), ...authUser };

  if (username) {
    merged.username = username;
    merged.username_normalized = username.toLowerCase();
    merged.display_name = username;
  } else {
    delete merged.username;
    delete merged.username_normalized;
  }

  return merged;
}

export async function hydrateAuthenticatedUserProfile(base44Client, authUser) {
  const email = normalizeUserProfileEmail(authUser?.email || authUser?.user_email);
  if (!authUser || !email) return authUser || null;

  const userEntity = base44Client?.entities?.User;
  if (!userEntity?.filter) return mergeAuthenticatedUserProfile(authUser, null);

  let rows = await userEntity.filter({ email }, '-updated_date', 5).catch(() => []);
  if (!Array.isArray(rows) || rows.length === 0) {
    rows = await userEntity.filter({ user_email: email }, '-updated_date', 5).catch(() => []);
  }
  const storedUser = selectStoredUserProfile(rows, email);
  return mergeAuthenticatedUserProfile(authUser, storedUser);
}
