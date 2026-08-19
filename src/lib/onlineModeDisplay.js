export const STANDARD_RANDOM_MODE = 'random_online';
export const SAME_QUESTION_DUEL_MODE = 'same_question_duel';
export const DUELLO_DISPLAY_NAME = 'Duello';
export const ONLINE_MATCHMAKING_MODES = Object.freeze([
  STANDARD_RANDOM_MODE,
  SAME_QUESTION_DUEL_MODE,
]);

export function normalizeOnlineMatchmakingMode(value) {
  const mode = String(value || STANDARD_RANDOM_MODE).trim().toLowerCase();
  return ONLINE_MATCHMAKING_MODES.includes(mode) ? mode : STANDARD_RANDOM_MODE;
}

export function getOnlineModeDisplayName(mode) {
  return mode === SAME_QUESTION_DUEL_MODE ? DUELLO_DISPLAY_NAME : 'Online';
}
