import {
  CATEGORY_METADATA_POLICY,
  ONLINE_GAME_POLICY,
} from './categoryPolicy';

/**
 * Online category presentation helpers.
 *
 * Runtime category IDs, labels, descriptions, and active/passive state come
 * from current Category metadata. This module intentionally contains no
 * fallback category IDs or names; it only provides reusable visual slots and
 * policy helpers for the Online category selector.
 */

export const ONLINE_CATEGORY_VISUAL_SLOTS = Object.freeze([
  Object.freeze({ visualKey: 'time', iconKey: 'Calendar', color: '#facc15' }),
  Object.freeze({ visualKey: 'memory', iconKey: 'Clock', color: '#60a5fa' }),
  Object.freeze({ visualKey: 'culture', iconKey: 'Crown', color: '#c084fc' }),
  Object.freeze({ visualKey: 'signal', iconKey: 'Radio', color: '#f472b6' }),
  Object.freeze({ visualKey: 'arena', iconKey: 'Trophy', color: '#34d399' }),
  Object.freeze({ visualKey: 'play', iconKey: 'Gamepad2', color: '#fb923c' }),
]);

export const ONLINE_CATEGORY_POLICY = Object.freeze({
  ...ONLINE_GAME_POLICY,
  metadataPolicy: CATEGORY_METADATA_POLICY,
  visualFallbackOnly: true,
  categoryListFallbackAllowed: false,
});

export function getOnlineCategoryVisualSlot(index = 0) {
  const normalizedIndex = Math.max(0, Math.trunc(Number(index) || 0));
  return ONLINE_CATEGORY_VISUAL_SLOTS[normalizedIndex % ONLINE_CATEGORY_VISUAL_SLOTS.length];
}

export function decorateOnlineCategory(row, index = 0) {
  const slot = getOnlineCategoryVisualSlot(index);
  return {
    ...row,
    id: Number(row?.category_id),
    label: String(row?.name || '').trim(),
    description: String(row?.description || '').trim(),
    visualKey: slot.visualKey,
    iconKey: slot.iconKey,
    color: slot.color,
  };
}
