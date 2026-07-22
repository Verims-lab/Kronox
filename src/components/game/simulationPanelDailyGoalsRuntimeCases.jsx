// Kronox Health Center - executable Daily Goals source-event simulations.

import recordDailyQuestProgressSource from '../../../base44/functions/recordDailyQuestProgress/entry.ts?raw';
import claimDailyWheelRewardSource from '../../../base44/functions/claimDailyWheelReward/entry.ts?raw';
import gameSource from '../../pages/Game.jsx?raw';
import profileEditSource from '../../pages/ProfileEditPage.jsx?raw';
import friendsApiSource from '../../lib/friendsApi.js?raw';
import dailyQuestEventsSource from '../../lib/dailyQuestEvents.js?raw';
import dailyQuestGatewaySource from '../../lib/dbGateway/dailyQuestGateway.js?raw';
import dailyStatusCacheSource from '../../lib/dailyStatusCache.js?raw';
import useDailyQuestsSource from '../../hooks/useDailyQuests.js?raw';
import soloAttemptEffectsSource from '../../features/solo/services/soloAttemptEffects.js?raw';
import soloLevelsSource from '../../lib/soloLevels.js?raw';
import {
  applyDailyGoalSourceEvent,
  createDailyGoalsSimulationState,
  DAILY_GOAL_EVENT_TYPES,
  DAILY_GOAL_SOURCE_TYPES,
  DAILY_JOKER_TYPES,
  isDailyGoalComplete,
} from '@/lib/dailyGoalsRuntime';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const SUITE_ID = 'daily_goals_runtime_simulation';
const SUITE_NAME = 'Daily Goals Runtime Simulation Suite';

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, verification: 'EXECUTABLE', ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, verification: 'EXECUTABLE', ...extra }; }

function makeCase(id, name, run) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: true,
    actionType: 'CODE_FIX',
    nextStep: 'Keep Daily progress source-proofed, idempotent, training-safe, and separate from Puan/Leaderboard.',
    run,
  };
}

function missingTokens(source, tokens) {
  return tokens.filter((token) => !String(source || '').includes(token));
}

function sourceEvent(kind, source, receiptId, extra = {}) {
  return {
    kind,
    source,
    receiptId,
    serverConfirmed: true,
    success: true,
    ...extra,
  };
}

function wheelClaim(receiptId = 'wheel-1') {
  return sourceEvent(
    DAILY_GOAL_EVENT_TYPES.WHEEL_CLAIM,
    DAILY_GOAL_SOURCE_TYPES.WHEEL_CLAIM,
    receiptId,
    { claimed: true },
  );
}

function jokerSpend(receiptId, jokerType = DAILY_JOKER_TYPES.CARD_SWAP, extra = {}) {
  return sourceEvent('joker_spent', DAILY_GOAL_SOURCE_TYPES.JOKER_TRANSACTION, receiptId, {
    jokerType,
    quantityDelta: -1,
    levelNumber: 7,
    ...extra,
  });
}

function hintSpend(receiptId, extra = {}) {
  return sourceEvent('hint_spent', DAILY_GOAL_SOURCE_TYPES.HINT_TRANSACTION, receiptId, {
    quantityDelta: -1,
    levelNumber: 7,
    ...extra,
  });
}

function answer(receiptId, isCorrect) {
  return sourceEvent('question_answered', DAILY_GOAL_SOURCE_TYPES.QUESTION_ATTEMPT, receiptId, { isCorrect });
}

function soloAttempt(receiptId, extra = {}) {
  return sourceEvent('solo_attempt_finished', DAILY_GOAL_SOURCE_TYPES.SOLO_ATTEMPT, receiptId, {
    persisted: true,
    passed: true,
    usedRealJoker: false,
    ...extra,
  });
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#facc15' },
];

export const EXTRA_TESTS = [
  makeCase('wheel_claim_completes_chark_cevir',
    'Wheel claim completes Cark cevir while open/close does not',
    () => {
      let state = createDailyGoalsSimulationState();
      state = applyDailyGoalSourceEvent(state, { kind: 'wheel_opened' });
      state = applyDailyGoalSourceEvent(state, { kind: 'wheel_closed' });
      const beforeClaim = isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.WHEEL_CLAIM);
      state = applyDailyGoalSourceEvent(state, wheelClaim());
      const missing = missingTokens(claimDailyWheelRewardSource, [
        'recordDailyWheelDailyTaskProgress',
        "taskCompletionSource: 'daily_wheel_claim_backend'",
      ]);
      if (beforeClaim || !isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.WHEEL_CLAIM) || missing.length) {
        return fail('Wheel visual events or production claim wiring can complete the task incorrectly.', { missing });
      }
      return pass('Only a server-confirmed wheel claim advances Cark cevir.');
    }),

  makeCase('solo_level_complete_only_after_pass',
    'Solo level completion requires a passed persisted attempt',
    () => {
      let state = createDailyGoalsSimulationState();
      state = applyDailyGoalSourceEvent(state, soloAttempt('solo-fail', { passed: false }));
      const failedCounted = isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.SOLO_LEVEL_COMPLETE);
      state = applyDailyGoalSourceEvent(state, soloAttempt('solo-pass'));
      const missing = missingTokens(`${recordDailyQuestProgressSource}\n${soloAttemptEffectsSource}\n${soloLevelsSource}`, [
        'lastAttemptId',
        'lastAttemptPassed',
        'persisted_solo_attempt_verified',
        'onPersistedCompletion',
      ]);
      if (failedCounted || !isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.SOLO_LEVEL_COMPLETE) || missing.length) {
        return fail('Solo Daily completion is not locked to an exact passed persisted attempt.', { missing });
      }
      return pass('Failed attempts are rejected; the exact passed persisted attempt advances the goal.');
    }),

  makeCase('joker_use_real_spend_completes_generic_joker_task',
    'A real Joker ledger spend completes the generic Joker task',
    () => {
      const state = applyDailyGoalSourceEvent(createDailyGoalsSimulationState(), jokerSpend('joker-real-1'));
      const missing = missingTokens(`${gameSource}\n${recordDailyQuestProgressSource}\n${dailyQuestEventsSource}`, [
        "eventType: 'joker_used'",
        'await recordDailyQuestSourceEvent',
        'JokerTransaction',
        'quantity_delta) === -1',
        'for (const delay of [0, 100, 220, 450])',
      ]);
      const guestDisabled = recordDailyQuestProgressSource.includes('guest_joker_task_disabled');
      if (!isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.JOKER_USED) || missing.length || guestDisabled) {
        return fail('Real Joker spend is not connected to the generic Daily goal.', { missing, guestDisabled });
      }
      return pass('A server-confirmed -1 JokerTransaction advances the generic Joker goal for supported players.');
    }),

  makeCase('joker_use_two_spends_completes_two_joker_task',
    'Two distinct Joker spends complete the count-2 task',
    () => {
      let state = createDailyGoalsSimulationState({ [DAILY_GOAL_EVENT_TYPES.JOKER_USED]: 2 });
      state = applyDailyGoalSourceEvent(state, jokerSpend('joker-two-1'));
      const afterOne = isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.JOKER_USED);
      state = applyDailyGoalSourceEvent(state, jokerSpend('joker-two-2', DAILY_JOKER_TYPES.MISTAKE_SHIELD));
      if (afterOne || !isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.JOKER_USED)) {
        return fail('The count-2 Joker task does not require two distinct spend receipts.');
      }
      return pass('One receipt leaves the target incomplete; the second distinct spend completes it.');
    }),

  makeCase('time_freeze_joker_completes_specific_task',
    'Only a real time-freeze Joker spend completes the specific task',
    () => {
      let state = createDailyGoalsSimulationState();
      state = applyDailyGoalSourceEvent(state, jokerSpend('swap-1'));
      const swapCompletedFreeze = isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.TIME_FREEZE_JOKER_USED);
      state = applyDailyGoalSourceEvent(state, jokerSpend('freeze-1', DAILY_JOKER_TYPES.TIME_FREEZE));
      const missing = missingTokens(recordDailyQuestProgressSource, [
        "String(row?.joker_type || '') === 'time_freeze'",
        'TIME_FREEZE_JOKER_USED',
      ]);
      if (swapCompletedFreeze || !isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.TIME_FREEZE_JOKER_USED) || missing.length) {
        return fail('The time-freeze Daily goal is not exact-type protected.', { missing });
      }
      return pass('Other Jokers do not complete the task; a real time_freeze receipt does.');
    }),

  makeCase('training_joker_does_not_complete_joker_task',
    'Training Joker use never completes a Daily Joker task',
    () => {
      const state = applyDailyGoalSourceEvent(
        createDailyGoalsSimulationState(),
        jokerSpend('training-joker', DAILY_JOKER_TYPES.CARD_SWAP, { training: true, levelNumber: 2 }),
      );
      const missing = missingTokens(gameSource, [
        'if (isSoloTrainingConsumables)',
        'soloTrainingConsumableUsedRef.current = true',
        'return true',
      ]);
      if (isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.JOKER_USED) || state.lastDecision?.reason !== 'training_event_excluded' || missing.length) {
        return fail('Training Joker use can leak into real Daily progress.', { missing });
      }
      return pass('Training Joker use is inventory-free and excluded from Daily progress.');
    }),

  makeCase('hint_use_real_spend_completes_hint_task',
    'A real Hint ledger spend completes the Hint task',
    () => {
      const state = applyDailyGoalSourceEvent(createDailyGoalsSimulationState(), hintSpend('hint-real-1'));
      const missing = missingTokens(`${gameSource}\n${recordDailyQuestProgressSource}`, [
        "eventType: 'hint_used'",
        'HintTransaction',
        'hint_transaction_verified',
      ]);
      if (!isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.HINT_USED) || missing.length) {
        return fail('Real Hint consumption is not source-connected to the Hint Daily task.', { missing });
      }
      return pass('A server-confirmed -1 HintTransaction advances the Hint goal.');
    }),

  makeCase('training_hint_does_not_complete_hint_task',
    'Training Hint use never completes the Hint task',
    () => {
      const state = applyDailyGoalSourceEvent(
        createDailyGoalsSimulationState(),
        hintSpend('training-hint', { trainingConsumable: true, levelNumber: 3 }),
      );
      if (isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.HINT_USED) || state.lastDecision?.reason !== 'training_event_excluded') {
        return fail('Training Hint use can leak into Daily progress.');
      }
      return pass('Training Hint use is excluded from Daily progress.');
    }),

  makeCase('hint_does_not_count_as_joker',
    'Hint use is separate from Joker progress',
    () => {
      const state = applyDailyGoalSourceEvent(createDailyGoalsSimulationState(), hintSpend('hint-separate'));
      const jokerProgress = Number(state.progress?.[DAILY_GOAL_EVENT_TYPES.JOKER_USED] || 0);
      const missing = missingTokens(gameSource, ['hintUseSeparateFromJoker: true']);
      if (!isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.HINT_USED) || jokerProgress !== 0 || missing.length) {
        return fail('Hint can count as Joker or production separation marker is missing.', { missing, jokerProgress });
      }
      return pass('Hint advances only hint_used and never joker_used.');
    }),

  makeCase('consecutive_correct_requires_four_real_correct',
    'Four consecutive correct requires four uninterrupted real answer receipts',
    () => {
      let state = createDailyGoalsSimulationState();
      for (let index = 1; index <= 3; index += 1) state = applyDailyGoalSourceEvent(state, answer(`streak-a-${index}`, true));
      state = applyDailyGoalSourceEvent(state, answer('streak-wrong', false));
      for (let index = 1; index <= 3; index += 1) state = applyDailyGoalSourceEvent(state, answer(`streak-b-${index}`, true));
      const beforeFourth = isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.CONSECUTIVE_CORRECT_4);
      state = applyDailyGoalSourceEvent(state, answer('streak-b-4', true));
      const missing = missingTokens(`${gameSource}\n${recordDailyQuestProgressSource}`, [
        'sourceEventId: correctEventId',
        'four_consecutive_correct_attempt_events_verified',
        'if (orderedRows[index]?.is_correct !== true) break',
      ]);
      if (beforeFourth || !isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.CONSECUTIVE_CORRECT_4) || missing.length) {
        return fail('Correct-answer totals can masquerade as a four-answer streak.', { missing });
      }
      return pass('A wrong answer resets the executable streak; four later receipts are required.');
    }),

  makeCase('five_correct_answers_requires_real_correct_events',
    'Five-correct task requires five real correct answer receipts',
    () => {
      let state = createDailyGoalsSimulationState();
      state = applyDailyGoalSourceEvent(state, answer('five-wrong', false));
      for (let index = 1; index <= 4; index += 1) state = applyDailyGoalSourceEvent(state, answer(`five-${index}`, true));
      const afterFour = isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.CORRECT_ANSWER);
      state = applyDailyGoalSourceEvent(state, answer('five-5', true));
      if (afterFour || !isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.CORRECT_ANSWER)) {
        return fail('The five-correct task can complete without five correct source receipts.');
      }
      return pass('Wrong answers add no count; five distinct correct receipts are required.');
    }),

  makeCase('jokerless_level_complete_requires_passed_no_real_joker',
    'Jokerless completion requires a passed persisted attempt with no real Joker',
    () => {
      let state = createDailyGoalsSimulationState();
      state = applyDailyGoalSourceEvent(state, soloAttempt('jokerless-fail', { passed: false }));
      state = applyDailyGoalSourceEvent(state, soloAttempt('jokerless-joker', { usedRealJoker: true }));
      const beforeCleanAttempt = isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.JOKERLESS_LEVEL_COMPLETE);
      state = applyDailyGoalSourceEvent(state, soloAttempt('jokerless-clean', { usedRealJoker: false, hintUsed: true }));
      const missing = missingTokens(`${recordDailyQuestProgressSource}\n${soloLevelsSource}`, [
        'lastAttemptUsedRealJoker',
        'persisted_jokerless_solo_attempt_verified',
        'persisted_solo_attempt_used_real_joker',
      ]);
      if (beforeCleanAttempt || !isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.JOKERLESS_LEVEL_COMPLETE) || missing.length) {
        return fail('Jokerless completion is not tied to the exact no-real-Joker passed attempt.', { missing });
      }
      return pass('Failed/real-Joker attempts do not count; Hint use does not disqualify a clean passed attempt.');
    }),

  makeCase('profile_complete_requires_successful_profile_save',
    'Profile completion requires a successful complete profile save',
    () => {
      let state = createDailyGoalsSimulationState();
      state = applyDailyGoalSourceEvent(state, sourceEvent(
        DAILY_GOAL_EVENT_TYPES.PROFILE_COMPLETE,
        DAILY_GOAL_SOURCE_TYPES.PROFILE_SAVE,
        'profile-failed',
        { serverConfirmed: false, profileComplete: true },
      ));
      const beforeSave = isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.PROFILE_COMPLETE);
      state = applyDailyGoalSourceEvent(state, sourceEvent(
        DAILY_GOAL_EVENT_TYPES.PROFILE_COMPLETE,
        DAILY_GOAL_SOURCE_TYPES.PROFILE_SAVE,
        'profile-saved',
        { profileComplete: true },
      ));
      const missing = missingTokens(`${profileEditSource}\n${recordDailyQuestProgressSource}`, [
        "eventType: 'profile_complete'",
        'profileUpdatedAt',
        'profile_state_verified',
      ]);
      if (beforeSave || !isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.PROFILE_COMPLETE) || missing.length) {
        return fail('Opening/editing profile can count without a successful complete save.', { missing });
      }
      return pass('Only a successful, backend-verifiable complete profile save advances the goal.');
    }),

  makeCase('friend_invite_requires_created_invite',
    'Friend invite requires a created FriendRequest',
    () => {
      let state = createDailyGoalsSimulationState();
      state = applyDailyGoalSourceEvent(state, { kind: 'friend_modal_opened' });
      state = applyDailyGoalSourceEvent(state, sourceEvent(
        DAILY_GOAL_EVENT_TYPES.FRIEND_INVITE_SENT,
        DAILY_GOAL_SOURCE_TYPES.FRIEND_INVITE,
        'invite-created',
        { inviteCreated: true },
      ));
      const missing = missingTokens(`${friendsApiSource}\n${recordDailyQuestProgressSource}`, [
        "eventType: 'friend_invite_sent'",
        'friend_invite_verified',
        'requestId',
      ]);
      if (!isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.FRIEND_INVITE_SENT) || missing.length) {
        return fail('Friend invite is not tied to a created request receipt.', { missing });
      }
      return pass('Opening the UI does nothing; a created FriendRequest receipt advances the goal.');
    }),

  makeCase('add_friend_requires_accepted_friendship',
    'Add-friend requires an accepted request/friendship',
    () => {
      let state = createDailyGoalsSimulationState();
      state = applyDailyGoalSourceEvent(state, sourceEvent(
        DAILY_GOAL_EVENT_TYPES.FRIEND_ADDED,
        DAILY_GOAL_SOURCE_TYPES.FRIEND_ACCEPT,
        'friend-pending',
        { friendshipAccepted: false },
      ));
      const pendingCounted = isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.FRIEND_ADDED);
      state = applyDailyGoalSourceEvent(state, sourceEvent(
        DAILY_GOAL_EVENT_TYPES.FRIEND_ADDED,
        DAILY_GOAL_SOURCE_TYPES.FRIEND_ACCEPT,
        'friend-accepted',
        { friendshipAccepted: true },
      ));
      const missing = missingTokens(`${friendsApiSource}\n${recordDailyQuestProgressSource}`, [
        "eventType: 'friend_added'",
        'friend_acceptance_verified',
        "String(row?.status || '') === 'accepted'",
      ]);
      if (pendingCounted || !isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.FRIEND_ADDED) || missing.length) {
        return fail('Pending/rejected friend requests can count as accepted friendship.', { missing });
      }
      return pass('Only an accepted FriendRequest receipt advances add-friend.');
    }),

  makeCase('invalid_client_event_rejected',
    'Client-only Daily completion events are rejected',
    () => {
      const state = applyDailyGoalSourceEvent(createDailyGoalsSimulationState(), {
        kind: 'joker_spent',
        source: DAILY_GOAL_SOURCE_TYPES.JOKER_TRANSACTION,
        receiptId: 'fake-client',
        serverConfirmed: false,
        quantityDelta: -1,
        jokerType: DAILY_JOKER_TYPES.CARD_SWAP,
      });
      const missing = missingTokens(recordDailyQuestProgressSource, [
        'eventSourceIsVerified',
        "code: 'daily_event_provenance_invalid'",
        'const amount = 1',
      ]);
      if (state.lastDecision?.accepted !== false || isDailyGoalComplete(state, DAILY_GOAL_EVENT_TYPES.JOKER_USED) || missing.length) {
        return fail('A client-only event can self-award Daily progress.', { missing });
      }
      return pass('Unproven client input is rejected by both simulation and backend provenance gates.');
    }),

  makeCase('duplicate_receipt_idempotency',
    'Duplicate source receipts do not double-count',
    () => {
      let state = createDailyGoalsSimulationState({ [DAILY_GOAL_EVENT_TYPES.JOKER_USED]: 2 });
      const event = jokerSpend('same-joker-receipt');
      state = applyDailyGoalSourceEvent(state, event);
      state = applyDailyGoalSourceEvent(state, event);
      const progress = Number(state.progress?.[DAILY_GOAL_EVENT_TYPES.JOKER_USED] || 0);
      const missing = missingTokens(recordDailyQuestProgressSource, [
        'progress_event_keys',
        'duplicate_event',
        'buildProgressEventKey',
      ]);
      if (progress !== 1 || state.lastDecision?.reason !== 'duplicate_receipt' || missing.length) {
        return fail('The same source receipt can increment a task more than once.', { missing, progress });
      }
      return pass('Receipt dedupe leaves count-2 progress at one after a repeated request.');
    }),

  makeCase('cache_refresh_after_valid_event',
    'A valid Daily event invalidates and refreshes shared status cache',
    () => {
      const invalid = applyDailyGoalSourceEvent(createDailyGoalsSimulationState(), { kind: 'wheel_opened' });
      const valid = applyDailyGoalSourceEvent(createDailyGoalsSimulationState(), wheelClaim('cache-wheel'));
      const missing = missingTokens(`${dailyQuestGatewaySource}\n${dailyStatusCacheSource}\n${useDailyQuestsSource}`, [
        'markDailyQuestStatusStale',
        'DAILY_QUEST_STATUS_CHANGED_EVENT',
        'subscribeDailyQuestStatusChanged',
        'refresh({ ignoreCache: true })',
        'refreshVersionRef',
      ]);
      if (invalid.cacheInvalidated || !valid.cacheInvalidated || missing.length) {
        return fail('Daily cache can stale after a valid event or refresh after an invalid one.', { missing });
      }
      return pass('Only accepted source events invalidate the shared cache; the hook refreshes without restart.');
    }),
];
