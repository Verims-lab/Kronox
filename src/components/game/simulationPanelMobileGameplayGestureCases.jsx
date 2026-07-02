// Kronox Health Center — Mobile gameplay drag / pull-to-refresh contracts.
//
// Static checks cover the source contracts that prevent mobile browser
// pull-to-refresh during card drag. Real iOS/Android/PWA gesture behavior
// remains manual proof.

import gameSource from '../../pages/Game.jsx?raw';
import gameLayoutSource from './GameLayout.jsx?raw';
import questionCardSource from './QuestionCard.jsx?raw';
import timelineSource from './Timeline.jsx?raw';
import indexCssSource from '../../index.css?raw';
import appSource from '../../App.jsx?raw';
import preventAppZoomSource from '../../hooks/usePreventAppZoom.js?raw';
import indexHtmlSource from '../../../index.html?raw';

const STATUS = { PASS: 'PASS', FAIL: 'FAIL', NOT_AUTOMATABLE: 'NOT_AUTOMATABLE' };
const ACTION_TYPES = { CODE_FIX: 'CODE_FIX', DEVICE_TEST: 'DEVICE_TEST' };

function safeStr(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  try { return String(source); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

function forbiddenTokensFound(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => src.includes(token));
}

function pass(reason, extra = {}) { return { status: STATUS.PASS, reason, ...extra }; }
function fail(reason, extra = {}) { return { status: STATUS.FAIL, reason, ...extra }; }
function notAutomatable(reason, extra = {}) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...extra }; }

function makeCase(suiteId, suiteName, id, name, run, options = {}) {
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName,
    id,
    name,
    critical: options.critical ?? true,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Keep mobile gameplay drag guarded without changing Timeline hit-testing or horizontal auto-scroll.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [];

export const EXTRA_TESTS = [
  makeCase('mobile_viewport', 'Mobile Viewport Suite',
    'root_viewport_locked_to_scale_one',
    'Root viewport meta locks Kronox to app scale 1',
    () => {
      const viewportMatches = safeStr(indexHtmlSource).match(/<meta\s+name=["']viewport["'][^>]*>/gi) || [];
      const viewport = viewportMatches[0] || '';
      const missing = missingTokens(viewport, [
        'width=device-width',
        'initial-scale=1',
        'maximum-scale=1',
        'minimum-scale=1',
        'user-scalable=no',
        'viewport-fit=cover',
      ]);
      if (viewportMatches.length !== 1 || missing.length) return fail('Root viewport meta is missing, duplicated, or allows page scaling.', {
        verification: 'STATIC_CONTRACT',
        file: 'index.html',
        actual: { viewportCount: viewportMatches.length, missing },
      });
      return pass('index.html has exactly one viewport meta tag locked to scale 1 with viewport-fit=cover.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('mobile_viewport', 'Mobile Viewport Suite',
    'app_shell_zoom_guard_mounted_once',
    'App shell mounts one centralized zoom-prevention guard',
    () => {
      const missing = missingTokens(`${appSource}\n${preventAppZoomSource}`, [
        "import usePreventAppZoom from '@/hooks/usePreventAppZoom'",
        'usePreventAppZoom();',
        'KRONOX_LOCKED_VIEWPORT_CONTENT',
        "document.querySelectorAll('meta[name=\"viewport\"]')",
        "viewportMetas.slice(1).forEach((node) => node.remove())",
      ]);
      if (missing.length) return fail('Central app-shell zoom guard is missing or not mounted at App root.', {
        verification: 'STATIC_CONTRACT',
        files: ['src/App.jsx', 'src/hooks/usePreventAppZoom.js'],
        missing,
      });
      return pass('App mounts a single centralized zoom guard and normalizes duplicate viewport metas at runtime.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('mobile_gesture_risk', 'Mobile Gesture Risk Suite',
    'zoom_guard_blocks_only_scale_gestures',
    'Zoom guard blocks scale gestures without blocking one-finger gameplay touch',
    () => {
      const missing = missingTokens(preventAppZoomSource, [
        "document.addEventListener('gesturestart', preventGestureZoom, nonPassiveCapture)",
        "document.addEventListener('gesturechange', preventGestureZoom, nonPassiveCapture)",
        "document.addEventListener('gestureend', preventGestureZoom, nonPassiveCapture)",
        "document.addEventListener('touchmove', preventMultiTouchZoom, nonPassiveCapture)",
        'event.touches && event.touches.length > 1',
        "window.addEventListener('wheel', preventWheelZoom, nonPassiveCapture)",
        'event.ctrlKey || event.metaKey',
        "document.addEventListener('touchend', preventDoubleTapZoom, nonPassiveCapture)",
        "document.addEventListener('dblclick', preventDoubleClickZoom, nonPassiveCapture)",
        'isEditableTarget(event.target)',
        'return () => {',
      ]);
      const forbidden = forbiddenTokensFound(preventAppZoomSource, [
        'touches.length >= 1',
        'touches.length > 0',
      ]);
      if (missing.length || forbidden.length) return fail('Zoom guard may block normal one-finger touch or lacks scale gesture coverage.', {
        verification: 'STATIC_CONTRACT',
        file: 'src/hooks/usePreventAppZoom.js',
        actual: { missing, forbidden },
      });
      return pass('Zoom guard prevents iOS gesture events, multi-touch touchmove, ctrl/meta wheel, and double-tap zoom while preserving one-finger touchmove.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('mobile_gesture_risk', 'Mobile Gesture Risk Suite',
    'gameplay_drag_lock_class_lifecycle',
    'Gameplay card drag adds/removes a scoped drag-lock class',
    () => {
      const missing = missingTokens(`${gameSource}\n${gameLayoutSource}\n${indexCssSource}`, [
        "GAMEPLAY_DRAG_LOCK_CLASS = 'kronox-game-drag-lock'",
        'document.documentElement.classList.add(GAMEPLAY_DRAG_LOCK_CLASS)',
        'document.body.classList.add(GAMEPLAY_DRAG_LOCK_CLASS)',
        'document.documentElement.classList.remove(GAMEPLAY_DRAG_LOCK_CLASS)',
        'document.body.classList.remove(GAMEPLAY_DRAG_LOCK_CLASS)',
        'data-kronox-gameplay-root="true"',
        '.kronox-gameplay-root.kronox-game-drag-lock',
      ]);
      if (missing.length) return fail('Gameplay drag lock lifecycle is missing or not scoped to gameplay.', {
        verification: 'STATIC_CONTRACT',
        files: ['pages/Game.jsx', 'components/game/GameLayout.jsx', 'src/index.css'],
        missing,
      });
      return pass('Gameplay drag lock is added to html/body and game root, then removed on cleanup.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('mobile_gesture_risk', 'Mobile Gesture Risk Suite',
    'active_drag_touchmove_passive_false',
    'Active card drag blocks mobile pull-to-refresh with passive:false touchmove',
    () => {
      const missing = missingTokens(gameSource, [
        "window.addEventListener('touchmove', preventPullToRefreshDuringDrag, { passive: false })",
        "window.addEventListener('pointermove', preventPullToRefreshDuringDrag, { passive: false })",
        'if (!gameplayDragLockRef.current) return;',
        'event.preventDefault()',
        "event.pointerType !== 'touch'",
      ]);
      if (missing.length) return fail('Active-drag pull-to-refresh guard is missing passive:false or scoped preventDefault.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Native active-drag touchmove/pointermove listeners use passive:false and preventDefault only under the drag lock.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('mobile_gesture_risk', 'Mobile Gesture Risk Suite',
    'drag_lock_cleanup_cancel_unmount_route',
    'Drag-lock cleanup covers drag end, cancellation, unmount, and route change',
    () => {
      const missing = missingTokens(gameSource, [
        'cleanupCancelledDrag',
        "window.addEventListener('touchcancel', cleanupCancelledDrag, { passive: true })",
        "window.addEventListener('pointercancel', cleanupCancelledDrag, { passive: true })",
        "window.removeEventListener('touchcancel', cleanupCancelledDrag)",
        "window.removeEventListener('pointercancel', cleanupCancelledDrag)",
        'releaseGameplayDragLock();',
        'return () => {',
      ]);
      if (missing.length) return fail('Drag lock may survive cancellation/unmount/route changes.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Drag-lock cleanup covers native cancel/end listeners and component cleanup.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('mobile_viewport', 'Mobile Viewport Suite',
    'gameplay_drag_lock_not_global_permanent',
    'Pull-to-refresh guard is gameplay-scoped and not a permanent global touch-action:none',
    () => {
      const css = safeStr(indexCssSource);
      const hasGlobalPermanentNone = /(^|\n)\s*(html|body|\*)\s*\{[^}]*touch-action\s*:\s*none/i.test(css);
      const missing = missingTokens(`${gameLayoutSource}\n${indexCssSource}`, [
        'kronox-gameplay-root',
        '.kronox-question-card-drag-surface',
        '.kronox-timeline-horizontal-scroll',
        'touch-action: pan-x',
      ]);
      if (hasGlobalPermanentNone || missing.length) return fail('Mobile drag guard is too global or lacks scoped gameplay/timeline contracts.', {
        verification: 'STATIC_CONTRACT',
        files: ['components/game/GameLayout.jsx', 'src/index.css'],
        actual: { hasGlobalPermanentNone, missing },
      });
      return pass('No permanent global touch-action:none rule; drag lock is scoped to gameplay/card surfaces.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('question_card_touch', 'QuestionCard Touch Suite',
    'touch_pointer_cancel_handlers_present',
    'QuestionCard handles touch/pointer cancellation for drag cleanup',
    () => {
      const missing = missingTokens(questionCardSource, [
        'onTouchCancel',
        'onPointerDown',
        'onPointerUp',
        'onPointerCancel',
        'handleTouchCancel',
        'onTouchDragCancel',
        'kronox-question-card-drag-surface',
      ]);
      if (missing.length) return fail('QuestionCard touch/pointer lifecycle cleanup is incomplete.', {
        verification: 'STATIC_CONTRACT',
        file: 'components/game/QuestionCard.jsx',
        missing,
      });
      return pass('QuestionCard includes touch/pointer cancel hooks for interrupted mobile drags.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('timeline_hit_testing', 'Timeline / Hit Testing Suite',
    'timeline_autoscroll_and_hit_testing_unchanged',
    'Timeline horizontal auto-scroll and hit-testing contracts remain present',
    () => {
      const missing = missingTokens(timelineSource, [
        'scrollLeft += direction * 10',
        'requestAnimationFrame(step)',
        'getZoneAtClientX',
        'clientX - containerRect.left + scroll.scrollLeft',
        'dropZoneRefs.current',
        'kronox-timeline-horizontal-scroll',
        "touchAction: isDragMode ? 'none' : 'pan-x'",
      ]);
      if (missing.length) return fail('Timeline drag/drop auto-scroll or hit-testing contract drifted while adding mobile drag guard.', {
        verification: 'STATIC_CONTRACT',
        file: 'components/game/Timeline.jsx',
        missing,
      });
      return pass('Timeline auto-scroll, drop-zone refs, and scrollLeft hit-testing remain intact.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('mobile_gesture_risk', 'Mobile Gesture Risk Suite',
    'beforeunload_guard_active_gameplay_only',
    'Beforeunload guard is scoped to active gameplay attempts',
    () => {
      const missing = missingTokens(gameSource, [
        'activeGameplayAttempt',
        'gameStarted && currentQuestion',
        "window.addEventListener('beforeunload', handleBeforeUnload)",
        "window.removeEventListener('beforeunload', handleBeforeUnload)",
      ]);
      if (missing.length) return fail('Beforeunload guard is missing or no longer scoped to active gameplay.', {
        verification: 'STATIC_CONTRACT',
        file: 'pages/Game.jsx',
        missing,
      });
      return pass('Beforeunload prompt is scoped to active gameplay attempts and removed on cleanup.', { verification: 'STATIC_CONTRACT' });
    }),

  makeCase('live_dom_geometry', 'Live DOM Geometry / Timeline Suite',
    'real_phone_pull_to_refresh_proof_required',
    'Real phone proof is required for mobile browser pull-to-refresh prevention',
    () => notAutomatable('Static source verifies the guard contracts; iOS Safari, Android Chrome, and PWA standalone still require a real-device drag proof.', {
      verification: 'NOT_AUTOMATABLE',
      verificationLabels: ['NOT_AUTOMATABLE', 'EXTERNAL_DEVICE_REQUIRED'],
      actionType: ACTION_TYPES.DEVICE_TEST,
    }),
    { actionType: ACTION_TYPES.DEVICE_TEST }),
];
