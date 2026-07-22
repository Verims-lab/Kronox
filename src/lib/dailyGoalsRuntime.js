export const DAILY_GOAL_EVENT_TYPES = Object.freeze({
  WHEEL_CLAIM: 'daily_wheel_claim',
  SOLO_LEVEL_COMPLETE: 'solo_level_complete',
  CONSECUTIVE_CORRECT_4: 'consecutive_correct_4',
  CORRECT_ANSWER: 'correct_answer',
  JOKER_USED: 'joker_used',
  TIME_FREEZE_JOKER_USED: 'time_freeze_joker_used',
  HINT_USED: 'hint_used',
  JOKERLESS_LEVEL_COMPLETE: 'jokerless_solo_level_complete',
  PROFILE_COMPLETE: 'profile_complete',
  FRIEND_INVITE_SENT: 'friend_invite_sent',
  FRIEND_ADDED: 'friend_added',
});

export const DAILY_GOAL_SOURCE_TYPES = Object.freeze({
  WHEEL_CLAIM: 'daily_wheel_claim_backend',
  SOLO_ATTEMPT: 'persisted_solo_attempt',
  QUESTION_ATTEMPT: 'question_attempt_event',
  JOKER_TRANSACTION: 'joker_transaction',
  HINT_TRANSACTION: 'hint_transaction',
  PROFILE_SAVE: 'profile_settings_save',
  FRIEND_INVITE: 'friend_request_created',
  FRIEND_ACCEPT: 'friend_request_accepted',
});

export const DAILY_JOKER_TYPES = Object.freeze({
  MISTAKE_SHIELD: 'mistake_shield',
  CARD_SWAP: 'card_swap',
  TIME_FREEZE: 'time_freeze',
});

const DAILY_JOKER_TYPE_ALIASES = Object.freeze({
  mistake_shield: DAILY_JOKER_TYPES.MISTAKE_SHIELD,
  mistakeShield: DAILY_JOKER_TYPES.MISTAKE_SHIELD,
  kronokalkan: DAILY_JOKER_TYPES.MISTAKE_SHIELD,
  card_swap: DAILY_JOKER_TYPES.CARD_SWAP,
  swapCard: DAILY_JOKER_TYPES.CARD_SWAP,
  kart_degistir: DAILY_JOKER_TYPES.CARD_SWAP,
  time_freeze: DAILY_JOKER_TYPES.TIME_FREEZE,
  freezeTime: DAILY_JOKER_TYPES.TIME_FREEZE,
  zamani_dondur: DAILY_JOKER_TYPES.TIME_FREEZE,
});

export const DEFAULT_DAILY_GOAL_TARGETS = Object.freeze({
  [DAILY_GOAL_EVENT_TYPES.WHEEL_CLAIM]: 1,
  [DAILY_GOAL_EVENT_TYPES.SOLO_LEVEL_COMPLETE]: 1,
  [DAILY_GOAL_EVENT_TYPES.CONSECUTIVE_CORRECT_4]: 1,
  [DAILY_GOAL_EVENT_TYPES.CORRECT_ANSWER]: 5,
  [DAILY_GOAL_EVENT_TYPES.JOKER_USED]: 1,
  [DAILY_GOAL_EVENT_TYPES.TIME_FREEZE_JOKER_USED]: 1,
  [DAILY_GOAL_EVENT_TYPES.HINT_USED]: 1,
  [DAILY_GOAL_EVENT_TYPES.JOKERLESS_LEVEL_COMPLETE]: 1,
  [DAILY_GOAL_EVENT_TYPES.PROFILE_COMPLETE]: 1,
  [DAILY_GOAL_EVENT_TYPES.FRIEND_INVITE_SENT]: 1,
  [DAILY_GOAL_EVENT_TYPES.FRIEND_ADDED]: 1,
});

export function normalizeDailyJokerType(value) {
  return DAILY_JOKER_TYPE_ALIASES[String(value || '').trim()] || '';
}

function normalizeTarget(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.floor(number)) : fallback;
}

function incrementProgress(progress, targets, eventType, amount = 1) {
  const target = normalizeTarget(targets[eventType], 1);
  const current = Math.max(0, Number(progress[eventType]) || 0);
  return {
    ...progress,
    [eventType]: Math.min(target, current + Math.max(0, Math.floor(Number(amount) || 0))),
  };
}

function eventReceipt(event) {
  return String(event?.receiptId || event?.eventId || event?.idempotencyKey || '').trim();
}

function validServerReceipt(event, expectedSource) {
  return event?.serverConfirmed === true
    && event?.success !== false
    && eventReceipt(event)
    && String(event?.source || '') === expectedSource;
}

export function createDailyGoalsSimulationState(targets = DEFAULT_DAILY_GOAL_TARGETS) {
  return {
    targets: { ...DEFAULT_DAILY_GOAL_TARGETS, ...(targets || {}) },
    progress: {},
    receipts: [],
    consecutiveCorrect: 0,
    cacheInvalidated: false,
    acceptedEvents: 0,
    rejectedEvents: 0,
    lastDecision: null,
  };
}

export function isDailyGoalComplete(state, eventType) {
  const target = normalizeTarget(state?.targets?.[eventType], 1);
  return Math.max(0, Number(state?.progress?.[eventType]) || 0) >= target;
}

export function applyDailyGoalSourceEvent(inputState, event = {}) {
  const state = inputState || createDailyGoalsSimulationState();
  const receiptId = eventReceipt(event);
  if (receiptId && state.receipts.includes(receiptId)) {
    return {
      ...state,
      lastDecision: { accepted: false, reason: 'duplicate_receipt', receiptId },
    };
  }

  const reject = (reason, patch = {}) => ({
    ...state,
    ...patch,
    rejectedEvents: state.rejectedEvents + 1,
    lastDecision: { accepted: false, reason, receiptId },
  });
  const accept = (progress, patch = {}) => ({
    ...state,
    ...patch,
    progress,
    receipts: receiptId ? [...state.receipts, receiptId] : state.receipts,
    cacheInvalidated: true,
    acceptedEvents: state.acceptedEvents + 1,
    lastDecision: { accepted: true, reason: 'source_receipt_verified', receiptId },
  });

  if (event?.training === true || (Number(event?.levelNumber || 0) <= 6 && event?.trainingConsumable === true)) {
    return reject('training_event_excluded');
  }

  const kind = String(event?.kind || event?.eventType || '');
  if (kind === 'wheel_opened' || kind === 'wheel_closed' || kind === 'profile_opened' || kind === 'friend_modal_opened') {
    return reject('visual_event_not_progress');
  }

  if (kind === DAILY_GOAL_EVENT_TYPES.WHEEL_CLAIM) {
    if (!validServerReceipt(event, DAILY_GOAL_SOURCE_TYPES.WHEEL_CLAIM) || event?.claimed !== true) return reject('wheel_claim_receipt_required');
    return accept(incrementProgress(state.progress, state.targets, DAILY_GOAL_EVENT_TYPES.WHEEL_CLAIM));
  }

  if (kind === 'question_answered') {
    if (!validServerReceipt(event, DAILY_GOAL_SOURCE_TYPES.QUESTION_ATTEMPT)) return reject('question_attempt_receipt_required');
    if (event?.isCorrect !== true) {
      return accept(state.progress, { consecutiveCorrect: 0 });
    }
    const nextStreak = state.consecutiveCorrect + 1;
    let progress = incrementProgress(state.progress, state.targets, DAILY_GOAL_EVENT_TYPES.CORRECT_ANSWER);
    if (nextStreak >= 4) {
      progress = incrementProgress(progress, state.targets, DAILY_GOAL_EVENT_TYPES.CONSECUTIVE_CORRECT_4);
    }
    return accept(progress, { consecutiveCorrect: nextStreak });
  }

  if (kind === 'joker_spent') {
    const jokerType = normalizeDailyJokerType(event?.jokerType);
    if (!validServerReceipt(event, DAILY_GOAL_SOURCE_TYPES.JOKER_TRANSACTION)
      || Number(event?.quantityDelta) !== -1
      || !jokerType) return reject('joker_transaction_receipt_required');
    let progress = incrementProgress(state.progress, state.targets, DAILY_GOAL_EVENT_TYPES.JOKER_USED);
    if (jokerType === DAILY_JOKER_TYPES.TIME_FREEZE) {
      progress = incrementProgress(progress, state.targets, DAILY_GOAL_EVENT_TYPES.TIME_FREEZE_JOKER_USED);
    }
    return accept(progress);
  }

  if (kind === 'hint_spent') {
    if (!validServerReceipt(event, DAILY_GOAL_SOURCE_TYPES.HINT_TRANSACTION) || Number(event?.quantityDelta) !== -1) {
      return reject('hint_transaction_receipt_required');
    }
    return accept(incrementProgress(state.progress, state.targets, DAILY_GOAL_EVENT_TYPES.HINT_USED));
  }

  if (kind === 'solo_attempt_finished') {
    if (!validServerReceipt(event, DAILY_GOAL_SOURCE_TYPES.SOLO_ATTEMPT) || event?.persisted !== true || event?.passed !== true) {
      return reject('passed_persisted_solo_receipt_required');
    }
    let progress = incrementProgress(state.progress, state.targets, DAILY_GOAL_EVENT_TYPES.SOLO_LEVEL_COMPLETE);
    if (event?.usedRealJoker !== true) {
      progress = incrementProgress(progress, state.targets, DAILY_GOAL_EVENT_TYPES.JOKERLESS_LEVEL_COMPLETE);
    }
    return accept(progress);
  }

  if (kind === DAILY_GOAL_EVENT_TYPES.PROFILE_COMPLETE) {
    if (!validServerReceipt(event, DAILY_GOAL_SOURCE_TYPES.PROFILE_SAVE) || event?.profileComplete !== true) return reject('completed_profile_save_required');
    return accept(incrementProgress(state.progress, state.targets, DAILY_GOAL_EVENT_TYPES.PROFILE_COMPLETE));
  }

  if (kind === DAILY_GOAL_EVENT_TYPES.FRIEND_INVITE_SENT) {
    if (!validServerReceipt(event, DAILY_GOAL_SOURCE_TYPES.FRIEND_INVITE) || event?.inviteCreated !== true) return reject('created_friend_invite_required');
    return accept(incrementProgress(state.progress, state.targets, DAILY_GOAL_EVENT_TYPES.FRIEND_INVITE_SENT));
  }

  if (kind === DAILY_GOAL_EVENT_TYPES.FRIEND_ADDED) {
    if (!validServerReceipt(event, DAILY_GOAL_SOURCE_TYPES.FRIEND_ACCEPT) || event?.friendshipAccepted !== true) return reject('accepted_friendship_required');
    return accept(incrementProgress(state.progress, state.targets, DAILY_GOAL_EVENT_TYPES.FRIEND_ADDED));
  }

  return reject('unsupported_or_unproven_event');
}
