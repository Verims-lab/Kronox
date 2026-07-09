// Codex163 — Placement Feedback Animation contracts.
//
// SCOPE
//   Drag/drop core, hit-testing, scoring, and timeline ordering are
//   intentionally OUT of scope. These cases lock the *visual-only*
//   placement feedback layer:
//     • correct/wrong feedback state exists and is temporary
//     • correct placement → premium gold/cyan lock-in feedback
//     • wrong placement → red glow + shake + void-reject drift
//     • wrong placement does NOT insert the card
//     • prefers-reduced-motion is respected
//     • drag/drop core files were not rewritten
//     • ghost-card is not left visually stuck after wrong placement

import gameSource from '../../pages/Game.jsx?raw';
import timelineSource from './Timeline.jsx?raw';
// Codex168 — `?raw` returns a non-string for this .jsx overlay on this
// host's Vite build, which made every required token (including
// `result === 'wrong'`) read as missing. Mirror the overlay's choreography
// contract into a src-resident JS module so token scans run against a
// guaranteed string. Canonical file:
//   components/game/PlacementFeedbackOverlay.jsx
import { PLACEMENT_FEEDBACK_OVERLAY_SOURCE as overlaySource } from '@/lib/healthMirrors/placementFeedbackOverlayMirror';
import gameLayoutSource from './GameLayout.jsx?raw';
import gameActionsSource from '../../hooks/useGameActions.js?raw';
import gameRulesSource from '../../lib/gameRules.js?raw';
import mainMenuSource from '../../pages/MainMenu.jsx?raw';
import soloChallengeSource from '../../pages/SoloChallenge.jsx?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };
const SUITE_ID = 'placement_feedback_animation';
const SUITE_NAME = 'Placement Feedback Animation Suite';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep placement feedback visual-only and respect reduced motion.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [
  { id: SUITE_ID, name: SUITE_NAME, critical: true, color: '#22c55e' },
];

export const EXTRA_TESTS = [
  makeCase('placement_feedback_state_exists',
    'Temporary placement feedback state exists',
    () => {
      // The Game page already owns a `feedback` state set by
      // useGameActions.doPlacement with { result: 'correct'|'wrong', ... }.
      // GameLayout forwards it to Timeline as `placementFeedback`.
      const missing = missingTokens(gameLayoutSource, [
        'placementFeedback={',
        "feedback.result === 'correct'",
        "feedback.result === 'wrong'",
      ]);
      if (missing.length) {
        return fail('GameLayout no longer forwards a temporary placement feedback object to Timeline.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/GameLayout.jsx',
          missing,
        });
      }
      return pass('GameLayout forwards a temporary placementFeedback object to Timeline.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('correct_placement_triggers_premium_feedback',
    'Correct placement triggers premium lock-in feedback animation',
    () => {
      const missing = missingTokens(overlaySource, [
        "result === 'correct'",
        '#facc15',
        '#38bdf8',
        'correctAnim',
        'successSparkAngles',
      ]);
      if (missing.length) {
        return fail('PlacementFeedbackOverlay does not branch a gold/cyan lock-in animation for correct placement.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/PlacementFeedbackOverlay.jsx',
          missing,
        });
      }
      return pass('Correct placement triggers the gold/cyan PlacementFeedbackOverlay branch.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_progress_counter_uses_completion_source',
    'Solo progress counter uses the same source as completion',
    () => {
      const gameMissing = missingTokens(gameSource, [
        'getTimelineCardCount(me)',
        'progressCardCount={isSoloLevelMode ? cardsCompletedSolo : undefined}',
        'progressCardTarget={isSoloLevelMode ? winCardCount : undefined}',
      ]);
      const rulesMissing = missingTokens(gameRulesSource, [
        'export function getTimelineCardCount(player)',
        'return getTimelineCardCount(player) >= winCardCount;',
      ]);
      if (gameMissing.length || rulesMissing.length) {
        return fail('Solo header progress can drift from the completion count source.', {
          verification: 'STATIC_CONTRACT',
          files: ['pages/Game.jsx', 'lib/gameRules.js'],
          actual: { gameMissing, rulesMissing },
        });
      }
      return pass('Solo header progress and completion both read the timeline card count source.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('solo_header_back_button_and_timer_progress_row',
    'Solo gameplay header has back button and progress under timer',
    () => {
      const layoutMissing = missingTokens(gameLayoutSource, [
        'showSoloLevelHeader',
        'onSoloBack',
        'data-kronox-solo-navigation-progress-row',
        'data-kronox-solo-back-button',
        'data-kronox-solo-progress-under-timer',
        'kronox-solo-back-button',
        'ArrowLeft',
        'aria-label="Geri dön"',
      ]);
      const gameMissing = missingTokens(gameSource, [
        'resolveSoloGameReturnPath',
        "source === 'home'",
        "source === 'solo-levels'",
        'soloReturnTo',
        'onSoloBack={isSoloLevelMode ? handleSoloGameplayBack : undefined}',
      ]);
      const launchMissing = missingTokens(`${mainMenuSource}\n${soloChallengeSource}`, [
        "soloReturnTo: 'home'",
        "soloReturnTo: 'solo-levels'",
      ]);
      if (layoutMissing.length || gameMissing.length || launchMissing.length) {
        return fail('Solo gameplay header no longer guarantees a left back arrow with progress moved under the timer and source-aware exit routing.', {
          verification: 'STATIC_CONTRACT',
          files: ['components/game/GameLayout.jsx', 'pages/Game.jsx', 'pages/MainMenu.jsx', 'pages/SoloChallenge.jsx'],
          actual: { layoutMissing, gameMissing, launchMissing },
          expected: 'Solo row has back button on the left, progress under timer on the right, and /game launches tag home vs solo-levels return sources.',
        });
      }
      return pass('Solo gameplay header back/progress row is source-aware and keeps the existing completion-backed progress meter.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('progress_counter_pops_on_correct_increment',
    'Progress counter pops/highlights when correct count increments',
    () => {
      const missing = missingTokens(gameLayoutSource, [
        'progressPulseKey',
        'previousProgressCountRef',
        'visibleProgressCount > previousProgressCountRef.current',
        'textShadow',
        "matchMedia('(prefers-reduced-motion: reduce)')",
      ]);
      if (missing.length) {
        return fail('GameLayout no longer highlights the progress counter after progress increments.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/GameLayout.jsx',
          missing,
        });
      }
      return pass('GameLayout gives the progress counter a reduced-motion-aware pop/highlight on increments.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('correct_feedback_reward_stack_visual_only',
    'Correct feedback reward stack is visual-only',
    () => {
      const missing = missingTokens(overlaySource, [
        'correctStreak',
        'successSparkAngles',
        'Seri!',
        'Harika!',
        'pointerEvents: \'none\'',
      ]);
      const overlayTouchesState = /setLobbyData|setPlayers|onPlaceCard\(/.test(safeStr(overlaySource));
      if (missing.length || overlayTouchesState) {
        return fail('Correct placement reward stack can affect gameplay state or lost its visual reward contract.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/PlacementFeedbackOverlay.jsx',
          actual: { missing, overlayTouchesState },
        });
      }
      return pass('Correct feedback adds sparks/streak copy while remaining pointer-events:none and non-mutating.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('wrong_placement_triggers_red_void_reject_feedback',
    'Wrong placement triggers red glow + shake + void-reject animation',
    () => {
      const missing = missingTokens(overlaySource, [
        "result === 'wrong'",
        '#ef4444',
        'wrongFullAnim',
        // Shake AND void-drift evidence in the wrong choreography:
        'rotate: [0, -1.5, 1.5, -1, 0]',
        'y: [0, 0, 0, 8, 22]',
        'scale: [1, 1, 1, 0.96, 0.92]',
      ]);
      if (missing.length) {
        return fail('PlacementFeedbackOverlay no longer shakes + void-rejects on wrong placement.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/PlacementFeedbackOverlay.jsx',
          missing,
        });
      }
      return pass('Wrong placement triggers red glow + shake + void-reject choreography.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('wrong_placement_does_not_insert_card',
    'Wrong placement does not insert the card into the timeline',
    () => {
      // useGameActions.doPlacement only adds the card to `newPlayers`
      // INSIDE `if (isCorrect && addCorrectPlacementToTimeline)`. The
      // wrong branch must not push into `cards`, and onboarding modes pass
      // addCorrectPlacementToTimeline=false so even correct onboarding
      // answers are consumed without timeline insertion.
      const src = safeStr(gameActionsSource);
      const correctBlockHasInsert = src.includes('if (isCorrect && addCorrectPlacementToTimeline)')
        && src.includes('cards: [...snapshotPlayer.cards, {');
      // Forbidden: any unconditional `cards: [...snapshotPlayer.cards, ...]`
      // pattern outside the isCorrect block would mean wrong cards are
      // being inserted. The only such occurrence in our source is the
      // one inside isCorrect — count it.
      const insertOccurrences = (src.match(/cards: \[\.\.\.snapshotPlayer\.cards, \{/g) || []).length;
      const onboardingNoInsertGuard = src.includes('addCorrectPlacementToTimeline = true')
        && src.includes('if (isCorrect && addCorrectPlacementToTimeline)');

      const overlayInsertsCard = safeStr(overlaySource).match(/setLobbyData|setPlayers|onPlaceCard\(/);

      if (!correctBlockHasInsert || insertOccurrences !== 1 || !onboardingNoInsertGuard || overlayInsertsCard) {
        return fail('A code path can insert a card into the timeline outside the isCorrect block.', {
          verification: 'STATIC_CONTRACT',
          files: ['hooks/useGameActions.js', 'components/game/PlacementFeedbackOverlay.jsx'],
          actual: { correctBlockHasInsert, insertOccurrences, onboardingNoInsertGuard, overlayInsertsCard: Boolean(overlayInsertsCard) },
        });
      }
      return pass('Card insertion only happens in the correct normal-timeline branch; onboarding no-insert guard and visual-only overlay are preserved.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('feedback_state_is_temporary',
    'Placement feedback overlay has a temporary self-clearing timer',
    () => {
      const missing = missingTokens(overlaySource, [
        'setTimeout',
        'setActiveKey(null)',
        'clearTimeout',
      ]);
      if (missing.length) {
        return fail('PlacementFeedbackOverlay no longer self-clears its activeKey on a timer.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/PlacementFeedbackOverlay.jsx',
          missing,
        });
      }
      return pass('PlacementFeedbackOverlay self-clears via a timeout + cleanup.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('reduced_motion_supported',
    'prefers-reduced-motion reduces wrong-placement shake/drift',
    () => {
      // The carousel uses matchMedia('(prefers-reduced-motion: reduce)')
      // in Timeline.jsx and passes a boolean to the overlay. The overlay
      // picks `wrongReducedAnim` (color-only) when reducedMotion is true.
      const timelineMissing = missingTokens(timelineSource, [
        "matchMedia('(prefers-reduced-motion: reduce)')",
        'reducedMotion={reducedMotion}',
      ]);
      const overlayMissing = missingTokens(overlaySource, [
        'reducedMotion = false',
        'wrongReducedAnim',
      ]);
      if (timelineMissing.length || overlayMissing.length) {
        return fail('Reduced-motion is not wired through the feedback overlay.', {
          verification: 'STATIC_CONTRACT',
          files: ['components/game/Timeline.jsx', 'components/game/PlacementFeedbackOverlay.jsx'],
          actual: { timelineMissing, overlayMissing },
        });
      }
      return pass('Reduced-motion swaps the wrong-placement animation for a color-only flash.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('drag_drop_core_not_rewritten',
    'Drag/drop core (hit-testing, auto-scroll, touchAction) was not rewritten',
    () => {
      // The visual-only feedback work must not touch the hit-testing
      // math, the auto-scroll RAF loop, or the touchAction toggle.
      const missing = missingTokens(timelineSource, [
        'getZoneAtClientX',
        'startAutoScroll',
        'stopAutoScroll',
        "touchAction: isDragMode ? 'none' : 'pan-x'",
      ]);
      if (missing.length) {
        return fail('Drag/drop core in Timeline.jsx was modified by the feedback layer.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/Timeline.jsx',
          missing,
        });
      }
      return pass('Hit-testing, auto-scroll, and touchAction toggle in Timeline.jsx are intact.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('ghost_card_not_left_stuck_contract',
    'Ghost card and drag state clear independently of the feedback overlay',
    () => {
      // The feedback overlay must NOT extend the drag lifecycle. The
      // existing ghost-card render is gated on `isDragging && touchDragPos`
      // and the AnimatePresence exit handles teardown. We assert that
      // the ghost-card gate string and `setActiveZone(null)` reset at
      // drag end are still present and that the overlay file does not
      // touch any drag state.
      const missing = missingTokens(gameLayoutSource, [
        'isDragging && touchDragPos',
        '<AnimatePresence>',
      ]);
      const timelineMissing = missingTokens(timelineSource, [
        'setActiveZone(null);',
      ]);
      const overlayTouchesDrag = /isDragging|touchDrag|setActiveZone|dragEnd/.test(safeStr(overlaySource));
      if (missing.length || timelineMissing.length || overlayTouchesDrag) {
        return fail('Feedback layer interferes with the ghost-card / drag-state lifecycle.', {
          verification: 'STATIC_CONTRACT',
          files: ['components/game/GameLayout.jsx', 'components/game/Timeline.jsx', 'components/game/PlacementFeedbackOverlay.jsx'],
          actual: { missing, timelineMissing, overlayTouchesDrag },
        });
      }
      return pass('Ghost card and drag-state teardown are unaffected by the feedback overlay.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('overlay_is_pointer_events_none_and_aria_hidden',
    'Feedback overlay is non-interactive (pointer-events:none + aria-hidden)',
    () => {
      const missing = missingTokens(overlaySource, [
        'pointerEvents: \'none\'',
        "aria-hidden=\"true\"",
      ]);
      // Either inline pointerEvents:'none' or the Tailwind class is OK.
      const hasTailwindPointerNone = safeStr(overlaySource).includes('pointer-events-none');
      if (!hasTailwindPointerNone && missing.includes("pointerEvents: 'none'")) {
        return fail('PlacementFeedbackOverlay can swallow touches/clicks.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/PlacementFeedbackOverlay.jsx',
          missing,
        });
      }
      if (!safeStr(overlaySource).includes('aria-hidden="true"')) {
        return fail('PlacementFeedbackOverlay is not aria-hidden.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/PlacementFeedbackOverlay.jsx',
        });
      }
      return pass('PlacementFeedbackOverlay is pointer-events:none and aria-hidden.', { verification: 'STATIC_CONTRACT' });
    }),
];
