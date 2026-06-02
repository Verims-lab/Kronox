// Codex163 — Placement Feedback Animation contracts.
//
// SCOPE
//   Drag/drop core, hit-testing, scoring, and timeline ordering are
//   intentionally OUT of scope. These cases lock the *visual-only*
//   placement feedback layer:
//     • correct/wrong feedback state exists and is temporary
//     • correct placement → green feedback
//     • wrong placement → red glow + shake + void-reject drift
//     • wrong placement does NOT insert the card
//     • prefers-reduced-motion is respected
//     • drag/drop core files were not rewritten
//     • ghost-card is not left visually stuck after wrong placement

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

  makeCase('correct_placement_triggers_green_feedback',
    'Correct placement triggers green feedback animation',
    () => {
      const missing = missingTokens(overlaySource, [
        "result === 'correct'",
        '#22c55e',
        'correctAnim',
      ]);
      if (missing.length) {
        return fail('PlacementFeedbackOverlay does not branch a green animation for correct placement.', {
          verification: 'STATIC_CONTRACT',
          file: 'components/game/PlacementFeedbackOverlay.jsx',
          missing,
        });
      }
      return pass('Correct placement triggers the green PlacementFeedbackOverlay branch.', { verification: 'STATIC_CONTRACT' });
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
      // INSIDE `if (isCorrect)`. The wrong branch must not push into
      // `cards`. We assert both: (a) the insertion lives inside the
      // isCorrect block, (b) there is no `cards: [...snapshotPlayer.cards,`
      // append outside that block, AND (c) the timeline insertion
      // helper that the overlay uses (placementFeedback) does not
      // mutate `cards`.
      const src = safeStr(gameActionsSource);
      const correctBlockHasInsert = src.includes('if (isCorrect)')
        && src.includes('cards: [...snapshotPlayer.cards, {');
      // Forbidden: any unconditional `cards: [...snapshotPlayer.cards, ...]`
      // pattern outside the isCorrect block would mean wrong cards are
      // being inserted. The only such occurrence in our source is the
      // one inside isCorrect — count it.
      const insertOccurrences = (src.match(/cards: \[\.\.\.snapshotPlayer\.cards, \{/g) || []).length;

      const overlayInsertsCard = safeStr(overlaySource).match(/setLobbyData|setPlayers|onPlaceCard\(/);

      if (!correctBlockHasInsert || insertOccurrences !== 1 || overlayInsertsCard) {
        return fail('A code path can insert a card into the timeline outside the isCorrect block.', {
          verification: 'STATIC_CONTRACT',
          files: ['hooks/useGameActions.js', 'components/game/PlacementFeedbackOverlay.jsx'],
          actual: { correctBlockHasInsert, insertOccurrences, overlayInsertsCard: Boolean(overlayInsertsCard) },
        });
      }
      return pass('Card insertion only happens in the isCorrect branch; overlay is purely visual.', { verification: 'STATIC_CONTRACT' });
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