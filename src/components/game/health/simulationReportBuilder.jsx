// Kronox Health Center — Report builder (Codex123 split).
//
// SCOPE
//   Pure functions that turn a list of executed case results into the
//   Health report JSON. Every report field name and shape is preserved.
//
// REPORT SHAPE CONTRACT (DO NOT RENAME / DO NOT REMOVE)
//   runId, timestamp, startedAt, finishedAt, buildMarker, build,
//   environment, route, suites, suiteSummary, counts, totalCases,
//   totalDurationMs, score, scorePenaltyBreakdown, topBlockers,
//   currentCriticalFailures, topRegressions, recommendedNextActions,
//   releaseReadyChecklist, manualVerificationNeeded,
//   runtimeProofNeededByActionType, knownNonAutomatableCriticalRisks,
//   recentlyFixedRegressions, recentlyChangedAreas, sreSignals, cases.
//
// SEMANTICS PRESERVED
//   - STATUS.FAIL/ERROR/BLOCKED/NOT_AUTOMATABLE/WARNING/PASS counts kept.
//   - Score penalties identical: case+mobile+authority+social+static-limit.
//   - Critical/top-blockers/manual/runtime-proof sections kept.
//   - 0 FAIL with critical NOT_AUTOMATABLE is still NOT "Good" rating.

import { STATUS, STATUS_ORDER } from './healthStatus';
import { captureEnvironment, createRunMeta } from './simulationRunner';
import {
  ACTION_TYPES,
  criticalSocialUncertaintyPenalty,
  criticalStaticLimitationPenalty,
} from '../simulationPanelCaseRegistry';

const PROOF_ACTION_TYPES = [
  ACTION_TYPES.DEVICE_TEST,
  ACTION_TYPES.TWO_ACCOUNT_TEST,
  ACTION_TYPES.BACKEND_RUNTIME_PROBE,
  ACTION_TYPES.HUMAN_VISUAL_REVIEW,
  ACTION_TYPES.CI_ENVIRONMENT,
];

export function normalizeLabels(item) {
  const labels = new Set(Array.isArray(item.verificationLabels) ? item.verificationLabels : []);
  if (item.verification) labels.add(item.verification);
  if (item.classification) labels.add(item.classification);
  if (item.status === STATUS.NOT_AUTOMATABLE) {
    labels.add('NOT_AUTOMATABLE');
    labels.add('MANUAL_REQUIRED');
  }
  if (item.actionType === ACTION_TYPES.DEVICE_TEST) labels.add('EXTERNAL_DEVICE_REQUIRED');
  if (item.actionType === ACTION_TYPES.TWO_ACCOUNT_TEST) labels.add('TWO_ACCOUNT_REQUIRED');
  if (item.actionType === ACTION_TYPES.BACKEND_RUNTIME_PROBE) labels.add('BACKEND_RUNTIME_PROBE');
  return Array.from(labels).filter(Boolean);
}

export function categorizeCase(item) {
  if (item.actionType) return item.actionType;
  const id = `${item.suiteId || ''}.${item.id || ''}`.toLowerCase();
  if (/mobile|gesture|timeline|touch|viewport|dom_geometry|keyboard|orientation|scroll/.test(id)) return ACTION_TYPES.DEVICE_TEST;
  if (/rls|two_account|friend|invite|recipient|sender|horizontal|cross-user|cross_user/.test(id)) return ACTION_TYPES.TWO_ACCOUNT_TEST;
  if (/service_role|backend|runtime_probe|admin|auth|route/.test(id)) return ACTION_TYPES.BACKEND_RUNTIME_PROBE;
  if (/visual|fantasy|title|logo|asset|beauty|tactile|game_feel|cta/.test(id)) return ACTION_TYPES.HUMAN_VISUAL_REVIEW;
  if (/performance|build|ci|direct_url|report/.test(id)) return ACTION_TYPES.CI_ENVIRONMENT;
  return ACTION_TYPES.CODE_FIX;
}

export function describeNextStep(item) {
  const actionType = item.actionType || categorizeCase(item);
  if (actionType === ACTION_TYPES.DEVICE_TEST) {
    return 'Run a real phone/WebView/PWA check with touch gestures and mobile viewport screenshots.';
  }
  if (actionType === ACTION_TYPES.TWO_ACCOUNT_TEST) {
    return 'Run a live two-account probe and confirm unrelated users cannot read or mutate the row.';
  }
  if (actionType === ACTION_TYPES.BACKEND_RUNTIME_PROBE) {
    return 'Exercise the backend function or protected route with real auth contexts before release.';
  }
  if (actionType === ACTION_TYPES.HUMAN_VISUAL_REVIEW) {
    return 'Capture the target screen and do human visual/game-feel review against the fantasy direction.';
  }
  if (actionType === ACTION_TYPES.CI_ENVIRONMENT) {
    return 'Run the browser/build harness in a reliable CI or local dev environment and attach the result.';
  }
  return 'Inspect and fix the code contract, then rerun the affected Health Simulator suite.';
}

export function normalizeCaseResult(item) {
  const actionType = categorizeCase(item);
  const labels = normalizeLabels({ ...item, actionType });
  const classification = item.classification || (labels.includes('STATIC_CHECK_LIMITATION') ? 'STATIC_CHECK_LIMITATION' : item.status === STATUS.PASS ? 'RUNTIME_VERIFIED' : 'REAL_PRODUCT_RISK');
  const verificationLabels = Array.from(new Set([...labels, classification])).filter(Boolean);
  return {
    ...item,
    actionType,
    classification,
    verificationLabels,
    nextStep: item.nextStep || describeNextStep({ ...item, actionType }),
  };
}

export function buildScoreExplanation({ counts, penalty, mobileViewportPenalty, authorityPenalty, socialUncertaintyPenalty, staticLimitationPenalty, score, rating }) {
  const failCount = counts.FAIL || 0;
  const errorCount = counts.ERROR || 0;
  const criticalUnknown = (counts.NOT_AUTOMATABLE || 0) + (counts.BLOCKED || 0);
  if (failCount === 0 && errorCount === 0 && criticalUnknown > 0) {
    return `0 FAIL does not mean release-ready: ${criticalUnknown} unresolved BLOCKED/NOT_AUTOMATABLE checks still require device, live DOM, backend, or two-account proof. Penalties: case=${penalty}, mobile=${mobileViewportPenalty}, authority=${authorityPenalty}, social=${socialUncertaintyPenalty}, static-limit=${staticLimitationPenalty}.`;
  }
  return `${rating} score ${score}/100. Penalties: case=${penalty}, mobile=${mobileViewportPenalty}, authority=${authorityPenalty}, social=${socialUncertaintyPenalty}, static-limit=${staticLimitationPenalty}.`;
}

export function buildReleaseReadyChecklist(cases) {
  const hasBlocking = (actionType) => cases.some(item =>
    item.actionType === actionType &&
    [STATUS.FAIL, STATUS.ERROR, STATUS.BLOCKED, STATUS.NOT_AUTOMATABLE, STATUS.WARNING].includes(item.status),
  );
  return [
    { label: 'No FAIL or ERROR cases', passed: !cases.some(item => [STATUS.FAIL, STATUS.ERROR].includes(item.status)), actionType: ACTION_TYPES.CODE_FIX },
    { label: 'Real mobile/WebView gesture proof completed', passed: !hasBlocking(ACTION_TYPES.DEVICE_TEST), actionType: ACTION_TYPES.DEVICE_TEST },
    { label: 'Two-account social/RLS probe completed', passed: !hasBlocking(ACTION_TYPES.TWO_ACCOUNT_TEST), actionType: ACTION_TYPES.TWO_ACCOUNT_TEST },
    { label: 'Backend/service-role runtime probe completed', passed: !hasBlocking(ACTION_TYPES.BACKEND_RUNTIME_PROBE), actionType: ACTION_TYPES.BACKEND_RUNTIME_PROBE },
    { label: 'Human visual/game-feel review completed', passed: !hasBlocking(ACTION_TYPES.HUMAN_VISUAL_REVIEW), actionType: ACTION_TYPES.HUMAN_VISUAL_REVIEW },
    { label: 'Build/browser harness available', passed: !hasBlocking(ACTION_TYPES.CI_ENVIRONMENT), actionType: ACTION_TYPES.CI_ENVIRONMENT },
  ];
}

export function buildRuntimeProofNeededByActionType(cases) {
  return PROOF_ACTION_TYPES.map(actionType => {
    const items = cases.filter(item =>
      item.actionType === actionType &&
      item.status !== STATUS.PASS &&
      (
        item.runtimeProofRequired ||
        [STATUS.WARNING, STATUS.BLOCKED, STATUS.NOT_AUTOMATABLE, STATUS.ERROR, STATUS.FAIL].includes(item.status) ||
        item.verificationLabels?.some(label => ['MANUAL_REQUIRED', 'EXTERNAL_DEVICE_REQUIRED', 'TWO_ACCOUNT_REQUIRED', 'BACKEND_RUNTIME_PROBE', 'HUMAN_VISUAL_REVIEW', 'STATIC_CHECK_LIMITATION'].includes(label))
      ),
    );
    return {
      actionType,
      count: items.length,
      criticalCount: items.filter(item => item.critical).length,
      examples: items.slice(0, 3).map(item => ({
        key: item.key,
        name: item.name,
        status: item.status,
        nextStep: item.nextStep,
      })),
    };
  }).filter(group => group.count > 0);
}

export function buildRecentlyChangedAreas(cases) {
  const areas = [
    { id: 'online_start', label: 'Online start / host black-screen recovery', pattern: /host_start|online_start|waiting_room|route_bootstrap|diagnostic|black_screen/i },
    { id: 'friends', label: 'Friends normalized model / realtime refresh', pattern: /friend|FriendRequest|reciprocal|accepted/i },
    { id: 'email', label: 'Friend-request email / deep link', pattern: /email|deep_link|sendFriendRequestEmail|next_redirect/i },
    { id: 'push', label: 'Game invite push notifications', pattern: /push|notification|service_worker|vapid|subscription/i },
    { id: 'categories', label: 'Online category taxonomy', pattern: /category|taxonomy|selected_category/i },
    { id: 'reporting', label: 'Health report UX / release proof', pattern: /report|sre|proof|score|checklist/i },
  ];

  return areas.map(area => {
    const matches = cases.filter(item =>
      item.recentlyFixed ||
      area.pattern.test(`${item.suiteId} ${item.id} ${item.name}`),
    ).filter(item => area.pattern.test(`${item.suiteId} ${item.id} ${item.name}`));

    return {
      ...area,
      caseCount: matches.length,
      failingOrUnknown: matches.filter(item => item.status !== STATUS.PASS).length,
      examples: matches.slice(0, 3).map(item => ({ key: item.key, status: item.status, name: item.name })),
    };
  }).filter(area => area.caseCount > 0);
}

export function buildSreSignals(cases, suiteSummary, environment, totalDurationMs) {
  const problemCases = cases.filter(item => item.status !== STATUS.PASS);
  const runtimeErrorRisks = problemCases.filter(item =>
    [STATUS.FAIL, STATUS.ERROR].includes(item.status) ||
    /500|crash|error|failed|black screen|permission|unauthorized/i.test(`${item.name} ${item.reason || ''}`),
  );
  const recoverabilityCases = cases.filter(item =>
    /retry|recover|fallback|refetch|failure|error boundary|bootstrap|email failure|push failure|Tekrar Dene/i.test(`${item.id} ${item.name} ${item.reason || ''}`),
  );

  return {
    errors: {
      fail: cases.filter(item => item.status === STATUS.FAIL).length,
      error: cases.filter(item => item.status === STATUS.ERROR).length,
      topRuntimeErrorRisks: runtimeErrorRisks.slice(0, 5).map(item => ({ key: item.key, status: item.status, name: item.name, actionType: item.actionType })),
    },
    latency: {
      totalDurationMs,
      slowSuites: suiteSummary
        .filter(suite => suite.durationMs > 250)
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 5)
        .map(suite => ({ id: suite.id, name: suite.name, durationMs: suite.durationMs })),
    },
    saturation: {
      totalCases: cases.length,
      totalSuites: suiteSummary.length,
      memory: environment.memory,
      note: 'Local browser memory is only available when performance.memory exists.',
    },
    recoverability: {
      namedRecoveryContracts: recoverabilityCases.length,
      examples: recoverabilityCases.slice(0, 6).map(item => ({ key: item.key, status: item.status, name: item.name })),
    },
  };
}

export function recommendedActions(problemCases) {
  const actions = [];
  if (problemCases.some(item => item.suiteId === 'multiplayer_authority')) actions.push('Review multiplayer authority checks before release; do not compensate with client-side logic.');
  if (problemCases.some(item => item.suiteId === 'mobile_viewport')) actions.push('Run the simulator on a real mobile WebView/PWA viewport and verify page scroll containment.');
  if (problemCases.some(item => item.suiteId === 'timeline_hit_testing')) actions.push('Exercise drag/drop manually on a phone before shipping any timeline-adjacent change.');
  if (problemCases.some(item => item.suiteId === 'friends_security')) actions.push('Run a two-account RLS probe against Friendship / FriendRequest before claiming friend-data security.');
  if (problemCases.some(item => item.suiteId === 'game_invites')) actions.push('Run a two-account GameInvite probe (cross-user read/update attempt) before claiming invite security.');
  if (problemCases.some(item => item.suiteId === 'create_lobby_invite_gate')) actions.push('Manually verify the "Lobi Oluştur ve Davet Et" disabled state and helper text on a real mobile device.');
  if (problemCases.some(item => item.suiteId === 'mobile_social_flow')) actions.push('Verify Profile / Friends / Invite screens on a narrow real phone (320×568) including keyboard focus behavior.');
  if (problemCases.some(item => item.suiteId === 'research_test_strategy' || item.suiteId === 'report_ux_human_decision')) actions.push('Keep the report honest: distinguish runtime proof, static contracts, manual gaps, and action categories before release decisions.');
  if (problemCases.some(item => item.suiteId === 'historical_kronox_regression')) actions.push('Re-test recently fixed Kronox incidents, especially Settings stability and duplicate lobby title composition.');
  if (problemCases.some(item => item.suiteId === 'mobile_gesture_risk' || item.suiteId === 'live_dom_geometry')) actions.push('Run mounted DOM and real-device drag checks for Timeline geometry, page scroll, and touch-action behavior.');
  if (problemCases.some(item => item.suiteId === 'social_rls_two_account_risk')) actions.push('Execute the required User A / User B / User C RLS matrix before claiming social security readiness.');
  if (problemCases.some(item => item.suiteId === 'invite_contract_drift')) actions.push('Resolve invite behavior/comment drift and verify pending-recipient filters with a two-account backend probe.');
  if (problemCases.some(item => item.suiteId === 'visual_composition_regression' || item.suiteId === 'kronox_game_feel')) actions.push('Capture mobile screenshots and review tactile fantasy presentation, duplicate headers, asset paths, and CTA readability.');
  if (problemCases.some(item => item.suiteId === 'route_navigation_resilience')) actions.push('Run direct URL and back-navigation smoke tests for /settings, /profile, /friends, /lobby, /game, and /test-suite.');
  if (problemCases.some(item => item.suiteId === 'friend_request_email_deep_link')) actions.push('Verify FriendRequest email delivery with a real recipient inbox and confirm the /friends deep link survives login.');
  if (problemCases.some(item => item.suiteId === 'game_invite_push_notifications')) actions.push('Run push-notification proof on a subscribed device with VAPID configured; keep in-app invites working if push fails.');
  if (problemCases.some(item => item.suiteId === 'online_category_taxonomy')) actions.push('Confirm Online category selection actually changes lobby/question filtering, not only the visual selected state.');
  if (problemCases.some(item => item.suiteId === 'sre_release_health_signals')) actions.push('Use the report as release-risk intelligence only; production latency/error/saturation need deployed telemetry.');
  if (problemCases.some(item => item.status === STATUS.NOT_AUTOMATABLE)) actions.push('Treat non-automatable critical cases as release risk until covered by device/backend tests.');
  if (problemCases.some(item => item.suiteId === 'debug_hygiene' || item.suiteId === 'admin_visibility')) actions.push('Confirm debug/test surfaces and admin tooling are gated outside gameplay and Profile for normal users.');
  return actions.length ? actions : ['No major simulator blockers detected; still run the required two-device multiplayer smoke test plus a two-account invite/RLS probe.'];
}

export function buildReport(caseResults, suites, meta = createRunMeta(), environment = captureEnvironment()) {
  const cases = caseResults.map(item => normalizeCaseResult({ ...item }));
  const counts = Object.values(STATUS).reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
  cases.forEach(item => { counts[item.status] = (counts[item.status] || 0) + 1; });
  const totalDurationMs = Math.round(cases.reduce((sum, item) => sum + (item.durationMs || 0), 0));

  const suiteSummary = suites.map(suite => {
    const suiteCases = cases.filter(item => item.suiteId === suite.id);
    const suiteCounts = Object.values(STATUS).reduce((acc, status) => ({ ...acc, [status]: suiteCases.filter(item => item.status === status).length }), {});
    const durationMs = Math.round(suiteCases.reduce((sum, item) => sum + (item.durationMs || 0), 0));
    return { id: suite.id, name: suite.name, critical: suite.critical, total: suiteCases.length, counts: suiteCounts, durationMs };
  });

  const penalty = cases.reduce((sum, item) => {
    const critical = item.critical ? 1 : 0;
    if (item.status === STATUS.FAIL) return sum + (critical ? 12 : 8);
    if (item.status === STATUS.ERROR) return sum + (critical ? 15 : 10);
    if (item.status === STATUS.BLOCKED) return sum + (critical ? 10 : 5);
    if (item.status === STATUS.NOT_AUTOMATABLE) return sum + (critical ? 8 : 3);
    if (item.status === STATUS.WARNING) return sum + (critical ? 4 : 2);
    return sum;
  }, 0);

  const mobileViewportPenalty = cases.some(item => item.suiteId === 'mobile_viewport' && [STATUS.FAIL, STATUS.ERROR, STATUS.BLOCKED].includes(item.status)) ? 8 : 0;
  const authorityPenalty = cases.some(item => item.suiteId === 'multiplayer_authority' && item.status !== STATUS.PASS) ? 6 : 0;
  // Additive penalty for critical social/security uncertainty.
  const socialUncertaintyPenalty = criticalSocialUncertaintyPenalty(cases);
  const staticLimitationPenalty = criticalStaticLimitationPenalty(cases);
  const score = Math.max(0, Math.round(100 - penalty - mobileViewportPenalty - authorityPenalty - socialUncertaintyPenalty - staticLimitationPenalty));
  const rating = score >= 90 ? 'Good' : score >= 70 ? 'Watch' : score >= 50 ? 'Risky' : 'Not release-ready';

  const problemCases = cases
    .filter(item => item.status !== STATUS.PASS)
    .sort((a, b) => {
      const statusDelta = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (statusDelta !== 0) return statusDelta;
      return Number(b.critical) - Number(a.critical);
    });

  const topBlockers = problemCases.filter(item => [STATUS.FAIL, STATUS.ERROR, STATUS.BLOCKED, STATUS.NOT_AUTOMATABLE].includes(item.status)).slice(0, 8);
  const currentCriticalFailures = problemCases.filter(item => item.critical && [STATUS.FAIL, STATUS.ERROR].includes(item.status));
  const manualVerificationNeeded = problemCases.filter(item =>
    item.verificationLabels?.some(label => ['MANUAL_REQUIRED', 'EXTERNAL_DEVICE_REQUIRED', 'TWO_ACCOUNT_REQUIRED', 'NOT_AUTOMATABLE'].includes(label)) ||
    [STATUS.BLOCKED, STATUS.NOT_AUTOMATABLE].includes(item.status),
  );
  const knownNonAutomatableCriticalRisks = cases.filter(item => item.critical && item.status === STATUS.NOT_AUTOMATABLE);
  const recentlyFixedRegressions = cases.filter(item => item.recentlyFixed);
  const runtimeProofNeededByActionType = buildRuntimeProofNeededByActionType(cases);
  const recentlyChangedAreas = buildRecentlyChangedAreas(cases);
  const sreSignals = buildSreSignals(cases, suiteSummary, environment, totalDurationMs);
  const scoreExplanation = buildScoreExplanation({
    counts,
    penalty,
    mobileViewportPenalty,
    authorityPenalty,
    socialUncertaintyPenalty,
    staticLimitationPenalty,
    score,
    rating,
  });

  return {
    runId: meta.runId,
    timestamp: new Date().toISOString(),
    startedAt: meta.startedAt,
    finishedAt: new Date().toISOString(),
    buildMarker: meta.buildMarker,
    build: meta.build,
    environment,
    route: environment.route,
    suites: suites.map(suite => ({ id: suite.id, name: suite.name, critical: suite.critical })),
    suiteSummary,
    counts,
    totalCases: cases.length,
    totalDurationMs,
    score: { value: score, rating, explanation: scoreExplanation },
    scorePenaltyBreakdown: {
      casePenalty: penalty,
      mobileViewportPenalty,
      authorityPenalty,
      socialUncertaintyPenalty,
      staticLimitationPenalty,
    },
    topBlockers,
    currentCriticalFailures,
    topRegressions: problemCases.filter(item => [STATUS.FAIL, STATUS.ERROR].includes(item.status)).slice(0, 5),
    recommendedNextActions: recommendedActions(problemCases),
    releaseReadyChecklist: buildReleaseReadyChecklist(cases),
    manualVerificationNeeded,
    runtimeProofNeededByActionType,
    knownNonAutomatableCriticalRisks,
    recentlyFixedRegressions,
    recentlyChangedAreas,
    sreSignals,
    cases,
  };
}

export function buildHumanSummary(report) {
  if (!report) return 'No Kronox Health Simulator report is available.';
  const counts = Object.entries(report.counts).map(([status, count]) => `${status}: ${count}`).join(', ');
  const blockers = report.topBlockers.length
    ? report.topBlockers.map(item => `- [${item.status}] [${item.actionType || 'CODE_FIX'}] ${item.suiteName} / ${item.name}: ${item.reason} Next: ${item.nextStep || 'Review manually.'}`).join('\n')
    : '- None';
  const actions = report.recommendedNextActions.map(item => `- ${item}`).join('\n');
  return [
    `Kronox Health Simulator ${report.runId}`,
    `Score: ${report.score.value} (${report.score.rating})`,
    `Score explanation: ${report.score.explanation || 'No score explanation available.'}`,
    `Build: ${report.buildMarker}`,
    `Device: ${report.environment.deviceType} ${report.environment.viewport.width}x${report.environment.viewport.height} DPR ${report.environment.dpr}`,
    `Counts: ${counts}`,
    '',
    'Top blockers:',
    blockers,
    '',
    'Recommended next actions:',
    actions,
  ].join('\n');
}