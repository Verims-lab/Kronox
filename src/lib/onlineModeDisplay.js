export const SAME_QUESTION_DUEL_MODE = 'same_question_duel';
export const DUELLO_DISPLAY_NAME = 'Duello';

export function getOnlineModeDisplayName(mode) {
  return mode === SAME_QUESTION_DUEL_MODE ? DUELLO_DISPLAY_NAME : 'Online';
}