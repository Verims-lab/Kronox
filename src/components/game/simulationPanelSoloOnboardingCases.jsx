// Kronox Health Center — Solo Onboarding level-type contracts.
//
// Scope: locks the Phase 1 before_after / timeline_basic onboarding model:
// fixed references, 10 attempt cards, six-correct progress target,
// training consumables, level-start tutorial popups, and privacy-safe local
// analytics. These cases are intentionally targeted and do not run Full Health.

import {
  SOLO_LEVEL_TYPES,
  getSoloAttemptDeckSizeForLevel,
  getSoloCardsRequiredForLevel,
  getSoloLevelType,
  getSoloMaxEvaluatedMovesForLevel,
  getSoloPlayableCardCountForLevel,
  getSoloReferenceCardCountForLevel,
  isSoloOnboardingLevel,
  isSoloSpecialLevel,
} from '@/lib/soloProgressHelpers';
import {
  getSoloLevelStartTutorialConfig,
  getSoloOnboardingSlotLabels,
  isCorrectSoloOnboardingPlacement,
  orderSoloDeckForOnboarding,
} from '@/lib/soloOnboardingLevels';
import gameSource from '../../pages/Game.jsx?raw';
import gameLayoutSource from './GameLayout.jsx?raw';
import timelineSource from './Timeline.jsx?raw';
import soloJokerBarSource from './SoloJokerBar.jsx?raw';
import soloHintButtonSource from './SoloHintButton.jsx?raw';
import soloHintRevealPopupSource from './SoloHintRevealPopup.jsx?raw';
import soloLevelStartTutorialPopupSource from './SoloLevelStartTutorialPopup.jsx?raw';
import soloOnboardingAnalyticsSource from '../../lib/soloOnboardingAnalytics.js?raw';
import soloOnboardingLevelsSource from '../../lib/soloOnboardingLevels.js?raw';
import soloProgressHelpersSource from '../../lib/soloProgressHelpers.js?raw';
import soloLevelsSource from '../../lib/soloLevels.js?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };
const SUITE_ID = 'solo_onboarding_level_types_health';
const SUITE_NAME = 'Solo Onboarding Level Types Suite';

function safeStr(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

function forbiddenTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => src.includes(token));
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep Solo onboarding levels real-scored, fixed-reference, training-consumable-only for levels 1-6, and normal from level 7.',
    ...options,
    run,
  };
}

function buildPool(count = 28) {
  return Array.from({ length: count }, (_, index) => ({
    id: `onboarding_q_${index}`,
    question: `Onboarding fixture ${index}`,
    answer: String(1900 + index * 4),
    year: 1900 + index * 4,
    type: 'metin',
    state: 'A',
    main_category_id: (index % 6) + 1,
  }));
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#38bdf8' },
];

export const EXTRA_TESTS = [
  makeCase('level_type_mapping_and_special_boundary',
    'Levels 1-6 map to onboarding types and level 5 is not special',
    () => {
      const actual = {
        l1: getSoloLevelType(1),
        l3: getSoloLevelType(3),
        l4: getSoloLevelType(4),
        l6: getSoloLevelType(6),
        l7: getSoloLevelType(7),
        l10: getSoloLevelType(10),
        level5Special: isSoloSpecialLevel(5),
        level10Special: isSoloSpecialLevel(10),
        level1Cards: getSoloCardsRequiredForLevel(1),
        level4Cards: getSoloCardsRequiredForLevel(4),
        level1Moves: getSoloMaxEvaluatedMovesForLevel(1),
        level4Moves: getSoloMaxEvaluatedMovesForLevel(4),
        level1Refs: getSoloReferenceCardCountForLevel(1),
        level4Refs: getSoloReferenceCardCountForLevel(4),
        level1Playable: getSoloPlayableCardCountForLevel(1),
        level4Playable: getSoloPlayableCardCountForLevel(4),
        level1Deck: getSoloAttemptDeckSizeForLevel(1),
        level4Deck: getSoloAttemptDeckSizeForLevel(4),
      };
      const ok = actual.l1 === SOLO_LEVEL_TYPES.BEFORE_AFTER
        && actual.l3 === SOLO_LEVEL_TYPES.BEFORE_AFTER
        && actual.l4 === SOLO_LEVEL_TYPES.TIMELINE_BASIC
        && actual.l6 === SOLO_LEVEL_TYPES.TIMELINE_BASIC
        && actual.l7 === SOLO_LEVEL_TYPES.NORMAL
        && actual.l10 === SOLO_LEVEL_TYPES.SPECIAL
        && actual.level5Special === false
        && actual.level10Special === true
        && actual.level1Cards === 6
        && actual.level4Cards === 6
        && actual.level1Moves === 10
        && actual.level4Moves === 10
        && actual.level1Refs === 1
        && actual.level4Refs === 2
        && actual.level1Playable === 6
        && actual.level4Playable === 6
        && actual.level1Deck >= 17
        && actual.level4Deck >= 18;
      if (!ok) return fail('Solo onboarding level mapping drifted.', { verification: 'EXECUTABLE_HELPER', actual });
      return pass('Levels 1-3 are before_after, 4-6 timeline_basic, 7 normal, and level 10 resumes special levels.', { verification: 'EXECUTABLE_HELPER', actual });
    }),

  makeCase('fixed_reference_deck_and_slot_labels',
    'Onboarding decks use fixed references and Turkish slot labels',
    () => {
      const beforeAfter = orderSoloDeckForOnboarding(buildPool(), 1);
      const timelineBasic = orderSoloDeckForOnboarding(buildPool(), 4);
      const beforeLabels = getSoloOnboardingSlotLabels(1);
      const timelineLabels = getSoloOnboardingSlotLabels(4);
      const beforeReferenceCount = beforeAfter.config?.referenceCards?.length || 0;
      const beforeQuestionCount = beforeAfter.config?.questionCards?.length || 0;
      const timelineReferenceCount = timelineBasic.config?.referenceCards?.length || 0;
      const timelineQuestionCount = timelineBasic.config?.questionCards?.length || 0;
      const timelineReferenceYears = (timelineBasic.config?.referenceCards || []).map((card) => Number(card.year));
      const placementProof = isCorrectSoloOnboardingPlacement(
        4,
        timelineBasic.config?.referenceCards || [],
        timelineReferenceYears[0] + 1,
        1,
      );
      const ok = beforeAfter.ok
        && timelineBasic.ok
        && beforeReferenceCount === 1
        && beforeQuestionCount === 10
        && timelineReferenceCount === 2
        && timelineQuestionCount === 10
        && timelineReferenceYears[0] < timelineReferenceYears[1]
        && beforeLabels.join('|') === 'ÖNCESİ|SONRASI'
        && timelineLabels.join('|') === 'ÖNCESİ|ARASI|SONRASI'
        && placementProof === true;
      if (!ok) {
        return fail('Onboarding deck ordering, references, labels, or placement checks drifted.', {
          verification: 'EXECUTABLE_HELPER',
          actual: {
            beforeReferenceCount,
            beforeQuestionCount,
            timelineReferenceCount,
            timelineQuestionCount,
            beforeLabels,
            timelineLabels,
            timelineReferenceYears,
            placementProof,
          },
        });
      }
      return pass('before_after and timeline_basic decks build with fixed references, 10 attempt cards, six-progress target, labels, and slot placement checks.', { verification: 'EXECUTABLE_HELPER' });
    }),

  makeCase('game_integration_virtual_progress_no_timeline_mutation',
    'Game integrates onboarding as virtual answered-card progress, not timeline insertion',
    () => {
      const missing = missingTokens(`${gameSource}\n${gameLayoutSource}\n${timelineSource}`, [
        'isSoloOnboardingMode',
        'soloOnboardingAnsweredCount',
        'soloOnboardingAnsweredCountRef',
        'return Math.min(soloPlayableCardTarget, soloOnboardingAnsweredCount)',
        'event.isCorrect',
        'correct_progress',
        'addCorrectPlacementToTimeline: !isSoloOnboardingMode',
        'evaluatePlacement: isSoloOnboardingMode ? evaluateSoloOnboardingPlacement : null',
        'getPlacementHasWon: isSoloOnboardingMode ? getSoloOnboardingPlacementHasWon : null',
        'isCorrectSoloOnboardingPlacement',
        'orderSoloDeckForOnboarding',
        'timelineSlotLabels',
        'slotLabels={timelineSlotLabels}',
        "{label || '+'}",
        'data-kronox-before-after-timeline="full-slot-grid"',
        "gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)'",
      ]);
      if (missing.length) {
        return fail('Onboarding Game/Timeline integration is missing virtual progress or labeled slot contracts.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/Game.jsx', 'src/components/game/GameLayout.jsx', 'src/components/game/Timeline.jsx'],
          missing,
        });
      }
      return pass('Game uses virtual correct-card progress for onboarding, passes Turkish slot labels to Timeline, and keeps before_after slots fully visible without adding answer cards.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_drop_slots_static_no_pre_drop_correct_hint',
    'Solo drop slots are static before drop across onboarding and normal timeline',
    () => {
      const combined = `${gameSource}\n${gameLayoutSource}\n${timelineSource}\n${soloOnboardingLevelsSource}`;
      const missing = missingTokens(combined, [
        'data-kronox-before-after-timeline="full-slot-grid"',
        "{label || '+'}",
        'ÖNCESİ',
        'ARASI',
        'SONRASI',
        "animation: 'none'",
        'Generic drag teaching only',
        'PlacementFeedbackOverlay',
      ]);
      const removedCssAnimationToken = 'slot' + 'Pulse';
      const removedBeginnerHintToken = 'show' + 'BeginnerHint';
      const removedGuidedHintToken = 'show' + 'GuidedTarget';
      const removedSlotAttr = 'data-kronox-guided-' + 'correct-target-slot';
      const removedBeginnerProp = 'beginner' + 'PlacementHintZone={';
      const removedZoneProp = 'guided' + 'TargetZone=';
      const removedPositionCallback = 'onGuided' + 'TargetSlotPosition=';
      const removedSlotProp = 'targetSlot' + 'Position={guided' + 'TargetSlotPosition}';
      const forbidden = forbiddenTokens(combined, [
        removedCssAnimationToken,
        removedBeginnerHintToken,
        removedGuidedHintToken,
        removedSlotAttr,
        removedBeginnerProp,
        removedZoneProp,
        removedPositionCallback,
        removedSlotProp,
      ]);
      if (missing.length || forbidden.length) {
        return fail('Solo Timeline/GameLayout still exposes animated or targeted pre-drop slot guidance.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/Game.jsx', 'src/components/game/GameLayout.jsx', 'src/components/game/Timeline.jsx'],
          expected: 'static drop slots, generic tutorial drag teaching only, and post-drop feedback only',
          actual: { missing, forbidden },
        });
      }
      return pass('before_after, timeline_basic, and normal timeline slots are static before drop; tutorial drag teaching is generic and post-drop feedback remains available.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('training_consumables_bypass_real_spend_and_daily_use',
    'Levels 1-6 use Joker/Hint training mode without real inventory spend or Daily use events',
    () => {
      const trainingSources = `${gameSource}\n${gameLayoutSource}\n${soloJokerBarSource}\n${soloHintButtonSource}\n${soloHintRevealPopupSource}`;
      const missing = missingTokens(trainingSources, [
        'isSoloTrainingConsumables',
        'trainingMode={Boolean(soloJokers?.trainingMode)}',
        'trainingMode={Boolean(soloHint?.trainingMode)}',
        'data-kronox-solo-joker-training-mode',
        'data-kronox-solo-hint-training-mode',
        'data-kronox-solo-hint-popup-training-mode',
        'const spendOrTrainCurrentJoker',
        'soloTrainingConsumableUsedRef.current = true',
        'return spendSoloJokerForCurrentCard(jokerType, decisionKey, currentQuestion.id)',
        'if (isSoloTrainingConsumables) {',
        'setHintRevealStagesByCard',
        'consumeUserHint',
        "eventType: 'hint_used'",
      ]);
      if (missing.length) {
        return fail('Training consumable display or spend-bypass contract is incomplete.', {
          verification: 'STATIC_CONTRACT',
          files: ['src/pages/Game.jsx', 'src/components/game/SoloJokerBar.jsx', 'src/components/game/SoloHintButton.jsx', 'src/components/game/SoloHintRevealPopup.jsx'],
          missing,
        });
      }
      return pass('Jokers and Hint expose training mode for onboarding while real spend and Daily progress remain in the non-training path.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('level_start_popups_and_privacy_safe_analytics',
    'Level-start popups and local analytics cover onboarding events without private identifiers',
    () => {
      const configByLevel = [1, 2, 3, 4, 7].map((level) => getSoloLevelStartTutorialConfig(level)?.key).filter(Boolean);
      const noPopupLevels = [5, 6, 8].every((level) => getSoloLevelStartTutorialConfig(level) === null);
      const missing = missingTokens(`${gameSource}\n${soloLevelStartTutorialPopupSource}\n${soloOnboardingLevelsSource}\n${soloOnboardingAnalyticsSource}`, [
        'SoloLevelStartTutorialPopup',
        'data-kronox-solo-level-start-tutorial-popup',
        'data-kronox-solo-level-start-tutorial-video-placeholder',
        'soloLevelStartTutorialPopupOpen',
        'soloLevelStartTutorialPauseOffset',
        'closeSoloLevelStartTutorialPopup',
        'SOLO_ONBOARDING_ANALYTICS_EVENTS.LEVEL_START',
        'SOLO_ONBOARDING_ANALYTICS_EVENTS.FIRST_DRAG',
        'SOLO_ONBOARDING_ANALYTICS_EVENTS.DROP',
        'SOLO_ONBOARDING_ANALYTICS_EVENTS.CORRECT',
        'SOLO_ONBOARDING_ANALYTICS_EVENTS.WRONG',
        'SOLO_ONBOARDING_ANALYTICS_EVENTS.COMPLETE',
        'SOLO_ONBOARDING_ANALYTICS_EVENTS.FAIL',
        'before_after_tutorial_skip',
        'timeline_basic_tutorial_skip',
        'normal_timeline_tutorial_skip',
        'PRIVATE_PAYLOAD_KEYS',
        'owner_key',
        'guest_id',
        'player_key',
        'provider_id',
      ]);
      const forbidden = forbiddenTokens(soloLevelStartTutorialPopupSource, [
        'https://',
        'media.base44.com',
      ]);
      if (missing.length || forbidden.length || configByLevel.length !== 5 || !noPopupLevels) {
        return fail('Level-start popup or privacy-safe analytics contract drifted.', {
          verification: 'STATIC_CONTRACT',
          actual: { missing, forbidden, configByLevel, noPopupLevels },
        });
      }
      return pass('Levels 1/2/3/4/7 have safe start popups, 5/6/8 do not, and onboarding analytics strips private identifiers.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('onboarding_contract_documented_in_sources',
    'Source contracts explicitly name before_after and timeline_basic onboarding',
    () => {
      const missing = missingTokens(`${soloProgressHelpersSource}\n${soloLevelsSource}\n${soloOnboardingLevelsSource}\n${gameSource}`, [
        "BEFORE_AFTER: 'before_after'",
        "TIMELINE_BASIC: 'timeline_basic'",
        'SOLO_ONBOARDING_CARD_TARGET',
        'SOLO_BEFORE_AFTER_REFERENCE_CARDS',
        'SOLO_TIMELINE_BASIC_REFERENCE_CARDS',
        'SOLO_ONBOARDING_MAX_EVALUATED_MOVES',
        'levelType: soloLevelType',
        'trainingConsumables',
      ]);
      if (missing.length || !isSoloOnboardingLevel(1) || !isSoloOnboardingLevel(6) || isSoloOnboardingLevel(7)) {
        return fail('Source onboarding contracts are incomplete or helper predicates drifted.', {
          verification: 'STATIC_CONTRACT',
          missing,
        });
      }
      return pass('before_after/timeline_basic constants, refs, card targets, move limit, and training metadata are present.', { verification: 'STATIC_CONTRACT' });
    }),
];
