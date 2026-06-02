/**
 * Category active/passive filter helpers — Codex158.
 *
 * Single source of truth for how UI category lists treat the new
 * Category.status field:
 *
 *   status === 'a'  → active (visible in UI selection)
 *   status === 'p'  → passive (hidden from UI; data is preserved)
 *   missing/null    → treated as ACTIVE for backward compatibility with
 *                     rows seeded before Codex158.
 *
 * This module is intentionally tiny and dependency-free so it can be
 * reused by any future Online/Solo selection surface that reads the
 * Category DB lookup table. The legacy static `lib/onlineCategories.js`
 * taxonomy (used by current Online lobby UI) is NOT affected by these
 * helpers — it has no status concept.
 */

export const CATEGORY_STATUS_ACTIVE = 'a';
export const CATEGORY_STATUS_PASSIVE = 'p';

/**
 * True if a Category row should be shown in UI selection lists.
 * Rows with no status are treated as active (backward compatible).
 */
export function isActiveCategory(category) {
  if (!category) return false;
  const status = typeof category.status === 'string' ? category.status.trim().toLowerCase() : '';
  if (!status) return true; // backward-compat: missing status = active
  return status === CATEGORY_STATUS_ACTIVE;
}

/**
 * Filter a Category DB row list down to active-only entries, preserving
 * order. Safe with non-array input (returns []).
 */
export function filterActiveCategories(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(isActiveCategory);
}