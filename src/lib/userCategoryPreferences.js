import { base44 } from '@/api/base44Client';

export const CATEGORY_STATUS_ACTIVE = 'A';
export const CATEGORY_STATUS_PASSIVE = 'P';
export const CATEGORY_ROW_ACTIVE_STATUSES = Object.freeze(['A', 'ACTIVE', 'AKTIF']);
export const MIN_CATEGORY_SELECTION_COUNT = 3;
export const NO_MAX_CATEGORY_SELECTION_LIMIT = true;
export const SAFE_GUEST_CATEGORY_METADATA = Object.freeze([
  { category_id: 1, name: 'Chronicle', status: CATEGORY_STATUS_ACTIVE, description: 'Tarihin önemli olayları ve dönemleri.' },
  { category_id: 2, name: 'Flashback', status: CATEGORY_STATUS_ACTIVE, description: 'Geçmişten hafızada kalan kültürel anlar.' },
  { category_id: 3, name: 'Kült', status: CATEGORY_STATUS_ACTIVE, description: 'Kültleşmiş filmler, diziler, müzikler ve popüler kültür.' },
  { category_id: 4, name: 'Viral', status: CATEGORY_STATUS_ACTIVE, description: 'İnternette yayılan viral olaylar ve dijital kültür.' },
  { category_id: 5, name: 'Arena', status: CATEGORY_STATUS_ACTIVE, description: 'Spor, rekabet ve unutulmaz karşılaşmalar.' },
  { category_id: 6, name: 'Level Up', status: CATEGORY_STATUS_ACTIVE, description: 'Oyun dünyası, teknoloji ve gelişim anları.' },
]);
export const GAMEPLAY_CATEGORY_PREFERENCE_FALLBACK = Object.freeze({
  authenticatedNoPreferenceUsesAllActiveCategories: true,
  noSavedPreferencesUsesAllActiveCategories: true,
  emptyPreferencesAreNotOfflineNoCache: true,
  saveValidationSeparateFromGameplayStart: true,
  guestOnboardingSafeMetadataFallback: true,
});

export function normalizePreferenceEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function getPreferenceUserId(user) {
  return String(user?.id || user?.user_id || user?.email || user?.user_email || '').trim();
}

export function normalizeCategoryId(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const id = Math.trunc(numeric);
  return id > 0 ? id : null;
}

export function isActiveCategory(row) {
  const status = String(row?.status || '').trim().toUpperCase();
  return !status || CATEGORY_ROW_ACTIVE_STATUSES.includes(status);
}

export function isActiveCategoryPreference(row) {
  return String(row?.status || '').trim().toUpperCase() === CATEGORY_STATUS_ACTIVE;
}

function byCategorySort(a, b) {
  const aId = normalizeCategoryId(a?.category_id) || 0;
  const bId = normalizeCategoryId(b?.category_id) || 0;
  if (aId !== bId) return aId - bId;
  return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr');
}

function normalizeActiveCategoryRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter(isActiveCategory)
    .filter((row) => normalizeCategoryId(row?.category_id) !== null && String(row?.name || '').trim())
    .sort(byCategorySort);
}

export async function loadActiveCategories({ limit = 1000, allowSafeFallback = false } = {}) {
  try {
    const rows = await base44.entities.Category.list('category_id', limit);
    const activeRows = normalizeActiveCategoryRows(rows);
    if (activeRows.length > 0) return activeRows;
    return allowSafeFallback ? normalizeActiveCategoryRows(SAFE_GUEST_CATEGORY_METADATA) : [];
  } catch (error) {
    if (allowSafeFallback) return normalizeActiveCategoryRows(SAFE_GUEST_CATEGORY_METADATA);
    throw error;
  }
}

export async function loadUserCategoryPreferences(user, { limit = 1000 } = {}) {
  const userEmail = normalizePreferenceEmail(user?.email || user?.user_email);
  if (!userEmail) return [];
  const rows = await base44.entities.UserCategoryPreference.filter(
    { user_email: userEmail },
    '-updated_date',
    limit,
  );
  return Array.isArray(rows) ? rows : [];
}

export function getSelectedCategoryIds(preferences) {
  return new Set((Array.isArray(preferences) ? preferences : [])
    .filter(isActiveCategoryPreference)
    .map((row) => normalizeCategoryId(row?.category_id))
    .filter((id) => id !== null));
}

export function getActiveCategoryIdSet(activeCategories) {
  return new Set((Array.isArray(activeCategories) ? activeCategories : [])
    .filter(isActiveCategory)
    .map((row) => normalizeCategoryId(row?.category_id))
    .filter((id) => id !== null));
}

export function getValidActiveSelectedCategoryIds(preferences, activeCategories) {
  return sanitizeSelectedCategoryIds(getSelectedCategoryIds(preferences), activeCategories);
}

export function resolveGameplayCategoryPreferenceFilter(preferences, activeCategories) {
  const selected = getValidActiveSelectedCategoryIds(preferences, activeCategories);
  const selectedCategoryIds = Array.from(selected);
  const hasPreferenceFilter = selectedCategoryIds.length >= MIN_CATEGORY_SELECTION_COUNT;
  return {
    selectedCategoryIds: hasPreferenceFilter ? selectedCategoryIds : [],
    hasPreferenceFilter,
    usesAllActiveCategories: !hasPreferenceFilter,
    fallbackReason: hasPreferenceFilter
      ? null
      : selectedCategoryIds.length > 0
        ? 'insufficient_valid_user_category_preferences'
        : 'no_valid_user_category_preferences',
  };
}

export function sanitizeSelectedCategoryIds(selectedCategoryIds, activeCategories) {
  const activeIdSet = getActiveCategoryIdSet(activeCategories);
  const selectedIds = Array.isArray(selectedCategoryIds)
    ? selectedCategoryIds
    : Array.from(selectedCategoryIds || []);
  return new Set(selectedIds
    .map(normalizeCategoryId)
    .filter((id) => id !== null)
    .filter((id) => activeIdSet.has(id)));
}

function makeValidationError(message) {
  const error = new Error(message);
  error.code = 'category_preference_validation';
  return error;
}

function normalizeActiveIdSet(activeCategories) {
  return getActiveCategoryIdSet(activeCategories);
}

export async function saveUserCategoryPreferences(user, selectedIds, activeCategories) {
  const userEmail = normalizePreferenceEmail(user?.email || user?.user_email);
  const userId = getPreferenceUserId(user);
  if (!userEmail || !userId) {
    throw makeValidationError('İlgi alanlarını kaydetmek için giriş yapmalısın.');
  }

  const activeIdSet = normalizeActiveIdSet(activeCategories);
  const selectedSet = sanitizeSelectedCategoryIds(selectedIds, activeCategories);

  if (selectedSet.size < MIN_CATEGORY_SELECTION_COUNT) {
    throw makeValidationError('En az 3 kategori seçmelisin.');
  }

  const existingRows = await loadUserCategoryPreferences(user);
  const now = new Date().toISOString();
  const byCategoryId = new Map();
  const duplicateRows = [];

  for (const row of existingRows) {
    const categoryId = normalizeCategoryId(row?.category_id);
    if (categoryId === null) continue;
    if (byCategoryId.has(categoryId)) duplicateRows.push(row);
    else byCategoryId.set(categoryId, row);
  }

  const writes = [];
  for (const categoryId of activeIdSet) {
    const selected = selectedSet.has(categoryId);
    const row = byCategoryId.get(categoryId);
    const nextStatus = selected ? CATEGORY_STATUS_ACTIVE : CATEGORY_STATUS_PASSIVE;
    if (row) {
      if (String(row.status || '').toUpperCase() !== nextStatus) {
        writes.push(base44.entities.UserCategoryPreference.update(row.id, {
          status: nextStatus,
          updated_date: now,
        }));
      }
    } else if (selected) {
      writes.push(base44.entities.UserCategoryPreference.create({
        user_id: userId,
        user_email: userEmail,
        category_id: categoryId,
        status: CATEGORY_STATUS_ACTIVE,
        created_date: now,
        updated_date: now,
      }));
    }
  }

  for (const row of existingRows) {
    const categoryId = normalizeCategoryId(row?.category_id);
    if (categoryId !== null && activeIdSet.has(categoryId)) continue;
    if (isActiveCategoryPreference(row)) {
      writes.push(base44.entities.UserCategoryPreference.update(row.id, {
        status: CATEGORY_STATUS_PASSIVE,
        updated_date: now,
      }));
    }
  }

  for (const row of duplicateRows) {
    if (isActiveCategoryPreference(row)) {
      writes.push(base44.entities.UserCategoryPreference.update(row.id, {
        status: CATEGORY_STATUS_PASSIVE,
        updated_date: now,
      }));
    }
  }

  await Promise.all(writes);
  return {
    ok: true,
    selectedIds: Array.from(selectedSet),
    minimumSelectionCount: MIN_CATEGORY_SELECTION_COUNT,
    noMaximumSelectionLimit: NO_MAX_CATEGORY_SELECTION_LIMIT,
  };
}
