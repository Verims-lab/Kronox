export const SOLO_EXIT_FAILURE_CATEGORY = Object.freeze({
  CONTROL_MISSING: 'SOLO_EXIT_CONTROL_MISSING',
  CONTROL_HIDDEN: 'SOLO_EXIT_CONTROL_HIDDEN',
  BLOCKED_BY_OVERLAY: 'SOLO_EXIT_BLOCKED_BY_OVERLAY',
  BLOCKED_BY_TUTORIAL: 'SOLO_EXIT_BLOCKED_BY_TUTORIAL',
  CLICK_TIMEOUT: 'SOLO_EXIT_CLICK_TIMEOUT',
  ROUTE_STALL: 'SOLO_EXIT_ROUTE_STALL',
});

export function createSoloExitRuntimeEvidence(expectedExitRoute = '/') {
  return {
    backButtonPresent: false,
    backButtonVisible: false,
    backButtonEnabled: false,
    backButtonBoundingBox: null,
    backButtonCount: 0,
    blockingOverlayDetected: false,
    tutorialOverlayDetected: false,
    tutorialOverlayBlockingExit: false,
    activeDialogDetected: false,
    pointerEventsOnBackButton: null,
    routeBeforeExit: null,
    routeAfterExit: null,
    expectedExitRoute,
    exitClickOutcome: 'not_attempted',
    evaluatedMoveCountBeforeExit: null,
    evaluatedMoveCountAfterExit: null,
    exitMoveEvaluationObserved: false,
    tutorialHandlingOutcome: 'not_checked',
  };
}

export function classifySoloExitFailure(evidence = {}) {
  if (!evidence.backButtonPresent || Number(evidence.backButtonCount || 0) < 1) {
    return SOLO_EXIT_FAILURE_CATEGORY.CONTROL_MISSING;
  }
  if (!evidence.backButtonVisible || !evidence.backButtonBoundingBox) {
    return SOLO_EXIT_FAILURE_CATEGORY.CONTROL_HIDDEN;
  }
  if (
    evidence.tutorialOverlayBlockingExit === true
    || (evidence.tutorialOverlayDetected && evidence.tutorialHandlingOutcome !== 'closed')
  ) {
    return SOLO_EXIT_FAILURE_CATEGORY.BLOCKED_BY_TUTORIAL;
  }
  if (
    evidence.blockingOverlayDetected
    || evidence.activeDialogDetected
    || evidence.backButtonEnabled === false
    || evidence.pointerEventsOnBackButton === 'none'
  ) {
    return SOLO_EXIT_FAILURE_CATEGORY.BLOCKED_BY_OVERLAY;
  }
  if (evidence.exitClickOutcome === 'timeout') {
    return SOLO_EXIT_FAILURE_CATEGORY.CLICK_TIMEOUT;
  }
  if (
    evidence.exitClickOutcome === 'clicked'
    && evidence.expectedExitRoute
    && evidence.routeAfterExit !== evidence.expectedExitRoute
  ) {
    return SOLO_EXIT_FAILURE_CATEGORY.ROUTE_STALL;
  }
  return null;
}
