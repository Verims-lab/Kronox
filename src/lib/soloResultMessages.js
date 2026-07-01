// Solo level-end success message pool. Purely presentational — no scoring,
// star, or progression logic lives here. A stable index keeps the message
// steady across re-renders of the same result screen.

export const SOLO_SUCCESS_MESSAGES = [
  'Harika! Böyle devam et!',
  'Mükemmel bir tur!',
  'Zamanı sen yönettin!',
  'Tarih senin elinde!',
  'Efsanevi bir performans!',
];

export const SOLO_FAILURE_MESSAGE = 'Yeniden denemeye ne dersin?';

/**
 * Pick a deterministic success message for a given level so the copy does
 * not flicker between re-renders. Falls back to the first (safe default)
 * message when the pool is somehow empty.
 */
export function pickSoloSuccessMessage(levelNumber) {
  const pool = SOLO_SUCCESS_MESSAGES;
  if (!pool.length) return 'Harika! Böyle devam et!';
  const idx = Math.abs(Math.floor(Number(levelNumber) || 0)) % pool.length;
  return pool[idx];
}