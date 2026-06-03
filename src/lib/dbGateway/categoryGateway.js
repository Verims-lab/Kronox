import { base44 } from '@/api/base44Client';
import {
  CATEGORY_ID_FIELD,
  CATEGORY_IMPORT_ALIAS_FIELD,
  filterActiveCategories,
  getActiveCategoryIds,
  getCategoryId,
  mapImportCategoryIdToCategoryId,
  normalizeCategoryId,
} from '@/lib/categoryFilters';

export {
  CATEGORY_ID_FIELD,
  CATEGORY_IMPORT_ALIAS_FIELD,
  filterActiveCategories,
  getActiveCategoryIds,
  getCategoryId,
  mapImportCategoryIdToCategoryId,
  normalizeCategoryId,
};

export async function loadActiveCategories({ limit = 50 } = {}) {
  const rows = await base44.entities.Category.list('category_id', limit);
  return filterActiveCategories(rows);
}

export async function loadActiveCategoryIds(options = {}) {
  const rows = await loadActiveCategories(options);
  return getActiveCategoryIds(rows);
}

export const categoryGatewayContract = Object.freeze({
  canonicalField: CATEGORY_ID_FIELD,
  importAlias: CATEGORY_IMPORT_ALIAS_FIELD,
  statusFilter: 'status=a active; status=p passive; missing status active for compatibility',
});
