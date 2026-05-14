/**
 * Tutorial state — persisted in localStorage.
 * No server calls, instant read/write.
 */
const KEY = 'kronox_tutorial_seen';

export const tutorialState = {
  hasSeen: () => localStorage.getItem(KEY) === 'true',
  markSeen: () => localStorage.setItem(KEY, 'true'),
  reset: () => localStorage.removeItem(KEY),
};