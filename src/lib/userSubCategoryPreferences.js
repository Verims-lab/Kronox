import { base44 } from '@/api/base44Client';

export const SUBCATEGORY_STATUS_ACTIVE = 'A';
export const SUBCATEGORY_STATUS_PASSIVE = 'P';
export const MIN_SUBCATEGORY_SELECTION_COUNT = 5;
export const NO_MAX_SUBCATEGORY_SELECTION_LIMIT = true;

export function normalizePreferenceEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function getPreferenceUserId(user) {
  return String(user?.id || user?.user_id || user?.email || user?.user_email || '').trim();
}

export function normalizeSubCategoryId(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const id = Math.trunc(numeric);
  return id > 0 ? id : null;
}

export function isActiveSubCategory(row) {
  return String(row?.status || '').trim().toUpperCase() === SUBCATEGORY_STATUS_ACTIVE;
}

export function isActiveSubCategoryPreference(row) {
  return String(row?.status || '').trim().toUpperCase() === SUBCATEGORY_STATUS_ACTIVE;
}

function bySubCategorySort(a, b) {
  const aMain = normalizeSubCategoryId(a?.main_category_1) || 0;
  const bMain = normalizeSubCategoryId(b?.main_category_1) || 0;
  if (aMain !== bMain) return aMain - bMain;
  return String(a?.name || '').localeCompare(String(b?.name || ''), 'tr');
}

export async function loadActiveSubCategories({ limit = 1000 } = {}) {
  const rows = await base44.entities.SubCategory.list('name', limit);
  return (Array.isArray(rows) ? rows : [])
    .filter(isActiveSubCategory)
    .filter((row) => normalizeSubCategoryId(row?.id) !== null && String(row?.name || '').trim())
    .sort(bySubCategorySort);
}

export async function loadUserSubCategoryPreferences(user, { limit = 1000 } = {}) {
  const userEmail = normalizePreferenceEmail(user?.email || user?.user_email);
  if (!userEmail) return [];
  const rows = await base44.entities.UserSubCategoryPreference.filter(
    { user_email: userEmail },
    '-updated_date',
    limit,
  );
  return Array.isArray(rows) ? rows : [];
}

export function getSelectedSubCategoryIds(preferences) {
  return new Set((Array.isArray(preferences) ? preferences : [])
    .filter(isActiveSubCategoryPreference)
    .map((row) => normalizeSubCategoryId(row?.sub_category_id))
    .filter((id) => id !== null));
}

function makeValidationError(message) {
  const error = new Error(message);
  error.code = 'subcategory_preference_validation';
  return error;
}

function normalizeActiveIdSet(activeSubCategories) {
  return new Set((Array.isArray(activeSubCategories) ? activeSubCategories : [])
    .filter(isActiveSubCategory)
    .map((row) => normalizeSubCategoryId(row?.id))
    .filter((id) => id !== null));
}

export async function saveUserSubCategoryPreferences(user, selectedSubCategoryIds, activeSubCategories) {
  const userEmail = normalizePreferenceEmail(user?.email || user?.user_email);
  const userId = getPreferenceUserId(user);
  if (!userEmail || !userId) {
    throw makeValidationError('İlgi alanlarını kaydetmek için giriş yapmalısın.');
  }

  const activeIdSet = normalizeActiveIdSet(activeSubCategories);
  const selectedSet = new Set((Array.isArray(selectedSubCategoryIds)
    ? selectedSubCategoryIds
    : Array.from(selectedSubCategoryIds || []))
    .map(normalizeSubCategoryId)
    .filter((id) => id !== null && activeIdSet.has(id)));

  if (selectedSet.size < MIN_SUBCATEGORY_SELECTION_COUNT) {
    throw makeValidationError('En az 5 ilgi alanı seçmelisin.');
  }

  const existingRows = await loadUserSubCategoryPreferences(user);
  const now = new Date().toISOString();
  const bySubCategoryId = new Map();
  const duplicateRows = [];

  for (const row of existingRows) {
    const subCategoryId = normalizeSubCategoryId(row?.sub_category_id);
    if (subCategoryId === null) continue;
    if (bySubCategoryId.has(subCategoryId)) duplicateRows.push(row);
    else bySubCategoryId.set(subCategoryId, row);
  }

  const writes = [];
  for (const subCategoryId of activeIdSet) {
    const selected = selectedSet.has(subCategoryId);
    const row = bySubCategoryId.get(subCategoryId);
    const nextStatus = selected ? SUBCATEGORY_STATUS_ACTIVE : SUBCATEGORY_STATUS_PASSIVE;
    if (row) {
      if (String(row.status || '').toUpperCase() !== nextStatus) {
        writes.push(base44.entities.UserSubCategoryPreference.update(row.id, {
          status: nextStatus,
          updated_date: now,
        }));
      }
    } else if (selected) {
      writes.push(base44.entities.UserSubCategoryPreference.create({
        user_id: userId,
        user_email: userEmail,
        sub_category_id: subCategoryId,
        status: SUBCATEGORY_STATUS_ACTIVE,
        created_date: now,
        updated_date: now,
      }));
    }
  }

  for (const row of existingRows) {
    const subCategoryId = normalizeSubCategoryId(row?.sub_category_id);
    if (subCategoryId !== null && activeIdSet.has(subCategoryId)) continue;
    if (isActiveSubCategoryPreference(row)) {
      writes.push(base44.entities.UserSubCategoryPreference.update(row.id, {
        status: SUBCATEGORY_STATUS_PASSIVE,
        updated_date: now,
      }));
    }
  }

  for (const row of duplicateRows) {
    if (isActiveSubCategoryPreference(row)) {
      writes.push(base44.entities.UserSubCategoryPreference.update(row.id, {
        status: SUBCATEGORY_STATUS_PASSIVE,
        updated_date: now,
      }));
    }
  }

  await Promise.all(writes);
  return {
    ok: true,
    selectedIds: Array.from(selectedSet),
    minimumSelectionCount: MIN_SUBCATEGORY_SELECTION_COUNT,
    noMaximumSelectionLimit: NO_MAX_SUBCATEGORY_SELECTION_LIMIT,
  };
}
