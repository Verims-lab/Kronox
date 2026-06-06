// Kronox Health Center — Admin/Health panel mobile-safe UI contracts.
//
// These cases protect the Health Center itself. They intentionally stay
// static/manual: viewport clipping, WebView safe areas, and PWA report
// visibility still need real-device proof before release.

import simulationPanelSource from './SimulationPanel.jsx?raw';
import simulationReportActionsSource from './health/SimulationReportActions.jsx?raw';
import simulationRunnerSource from './health/simulationRunner.jsx?raw';
import simulationSuiteSummarySource from './health/SimulationSuiteSummary.jsx?raw';
import settingsPageSource from '../../pages/SettingsPage.jsx?raw';

const STATUS = {
  PASS: 'PASS',
  NOT_AUTOMATABLE: 'NOT_AUTOMATABLE',
  FAIL: 'FAIL',
};

const ACTION_TYPES = {
  CODE_FIX: 'CODE_FIX',
  DEVICE_TEST: 'DEVICE_TEST',
};

const SUITE_ID = 'health_panel_architecture';
const SUITE_NAME = 'Health Panel Architecture Suite';

function safeStr(src) {
  if (src == null) return '';
  if (typeof src === 'string') return src;
  try { return String(src); } catch { return ''; }
}

function missingTokens(source, tokens) {
  const src = safeStr(source);
  return tokens.filter((token) => !src.includes(token));
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }
function notAutomatable(reason, extra) { return { status: STATUS.NOT_AUTOMATABLE, reason, ...(extra || {}) }; }

function makeCase(id, name, run, options = {}) {
  return {
    key: `${SUITE_ID}.${id}`,
    suiteId: SUITE_ID,
    suiteName: SUITE_NAME,
    id,
    name,
    critical: options.critical ?? false,
    actionType: options.actionType || ACTION_TYPES.CODE_FIX,
    nextStep: options.nextStep || 'Fix the Health/Admin panel UI contract and rerun the Health suite.',
    ...options,
    run,
  };
}

export const EXTRA_SUITES = [];

export const EXTRA_TESTS = [
  makeCase('health_admin_panel_top_not_clipped_static_contract',
    'Health/Admin panel has a bounded safe-area-aware top layout',
    () => {
      const missing = missingTokens(simulationPanelSource, [
        'data-health-admin-panel',
        "boxSizing: 'border-box'",
        "minHeight: '100dvh'",
        "height: '100dvh'",
        "paddingTop: 'calc(1rem + env(safe-area-inset-top))'",
      ]);
      if (missing.length) return fail('Health panel top safe-area contract is missing.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX, missing });
      return pass('Health panel root is dvh-bounded and safe-area padded so the top title is not clipped.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX });
    }),

  makeCase('health_admin_panel_has_safe_top_padding',
    'Settings/Admin host page and Health overlay both reserve top safe area',
    () => {
      const source = `${safeStr(settingsPageSource)}\n${safeStr(simulationPanelSource)}`;
      const missing = missingTokens(source, [
        "paddingTop: 'calc(4.5rem + env(safe-area-inset-top))'",
        "paddingTop: 'calc(1rem + env(safe-area-inset-top))'",
      ]);
      if (missing.length) return fail('Admin/Health top padding can still overlap fixed headers or safe areas.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX, missing });
      return pass('Settings host and Health overlay both reserve safe top padding.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX });
    }),

  makeCase('health_admin_panel_uses_scroll_container',
    'Health/Admin panel uses an internal mobile-safe scroll container',
    () => {
      const missing = missingTokens(simulationPanelSource, [
        'data-health-scroll-container',
        'overflow-y-auto',
        "WebkitOverflowScrolling: 'touch'",
        "overscrollBehavior: 'contain'",
        "paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))'",
      ]);
      if (missing.length) return fail('Health panel scroll container contract is missing.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX, missing });
      return pass('Health panel content scrolls inside a bounded, momentum-enabled container.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX });
    }),

  makeCase('health_report_mobile_visible_static_contract',
    'Health report renders before the long case list on mobile',
    () => {
      const src = safeStr(simulationPanelSource);
      const missing = missingTokens(src, [
        'data-health-report-slot="top"',
        '<SimulationReportActions',
        '<SimulationCaseRow',
      ]);
      const reportBeforeRows = src.indexOf('data-health-report-slot="top"') >= 0 &&
        src.indexOf('data-health-report-slot="top"') < src.indexOf('<SimulationCaseRow');
      if (missing.length || !reportBeforeRows) {
        return fail('Health report may be buried after the case list on mobile.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          actual: { reportBeforeRows },
        });
      }
      return pass('Report panel is rendered before case rows, so the mobile summary appears immediately after a run.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX });
    }),

  makeCase('health_report_scroll_container_mobile_safe',
    'Health report is inside the safe scroll container, not a fixed hidden pane',
    () => {
      const missing = missingTokens(`${safeStr(simulationPanelSource)}\n${safeStr(simulationReportActionsSource)}`, [
        'data-health-scroll-container',
        'data-health-report-panel',
        'kronox-health-report',
        'overflow-y-auto',
      ]);
      if (missing.length) return fail('Health report scroll/container contract is missing.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX, missing });
      return pass('Report panel lives in the same safe vertical scroll container as the case list.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX });
    }),

  makeCase('health_report_not_hidden_by_bottom_nav',
    'Health report overlay reserves bottom safe area and sits above app chrome',
    () => {
      const missing = missingTokens(simulationPanelSource, [
        'z-[100]',
        "paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))'",
        "paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))'",
      ]);
      if (missing.length) return fail('Health report can still be hidden behind bottom chrome.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX, missing });
      return pass('Health overlay/report reserve bottom safe area and stay above bottom navigation.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX });
    }),

  makeCase('health_report_summary_renders_before_large_details',
    'Health report summary counts render before large detail sections/raw JSON',
    () => {
      const src = safeStr(simulationReportActionsSource);
      const missing = missingTokens(src, [
        'data-health-report-summary',
        'Current Critical FAIL',
        'Raw JSON Preview',
      ]);
      const summaryBeforeDetails = src.indexOf('data-health-report-summary') >= 0 &&
        src.indexOf('data-health-report-summary') < src.indexOf('Current Critical FAIL') &&
        src.indexOf('data-health-report-summary') < src.indexOf('Raw JSON Preview');
      if (missing.length || !summaryBeforeDetails) {
        return fail('Health report summary is not guaranteed to render before large details.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          actual: { summaryBeforeDetails },
        });
      }
      return pass('Health report puts summary counts before blocker/detail/raw JSON sections.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX });
    }),

  makeCase('last_run_card_uses_real_fail_count',
    'Last Run summary card displays report FAIL count instead of score value',
    () => {
      const src = safeStr(simulationSuiteSummarySource);
      const missing = missingTokens(src, [
        'deriveLastRunFailCount',
        'lastRun?.counts?.[STATUS.FAIL]',
        'lastRun.cases.filter(item => item?.status === STATUS.FAIL).length',
        'lastRun.suiteSummary.reduce',
        '{deriveLastRunFailCount(lastRun)} FAIL / {deriveLastRunRating(lastRun)}',
      ]);
      const forbidden = src.includes('lastRun.score.value') ? ['lastRun.score.value'] : [];
      if (missing.length || forbidden.length) {
        return fail('Last Run card can still show score value instead of real FAIL count.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          forbidden,
        });
      }
      return pass('Last Run card prefers report.counts.FAIL and keeps rating/build marker from the run.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX });
    }),

  makeCase('last_run_build_marker_uses_report_metadata',
    'Last Run summary card displays build marker from latest report metadata',
    () => {
      const src = safeStr(simulationSuiteSummarySource);
      const missing = missingTokens(src, [
        'deriveLastRunBuildMarker',
        'lastRun?.build?.marker',
        'lastRun?.buildMarker',
        'Build marker unavailable',
      ]);
      const forbidden = src.includes('Codex181') ? ['Codex181'] : [];
      if (missing.length || forbidden.length) {
        return fail('Last Run card can still show a stale or hardcoded build marker.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          forbidden,
        });
      }
      return pass('Last Run card derives build marker from report build metadata and has a clear unavailable fallback.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX });
    }),

  makeCase('health_build_marker_parser_reads_current_constant',
    'Health run metadata reads the current BUILD_MARKER constant, not the first historical Codex note',
    () => {
      const src = safeStr(simulationRunnerSource);
      const missing = missingTokens(src, [
        'BUILD_MARKER\\s*=',
        'matchAll(/Codex\\d+/g)',
        'const buildMarker = extractBuildMarker()',
      ]);
      const forbidden = src.includes('match(/Codex\\d+/)?.[0]') ? ['match(/Codex\\d+/)?.[0]'] : [];
      if (missing.length || forbidden.length) {
        return fail('Health run metadata can still capture the first historical Codex marker instead of the current build marker.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          forbidden,
        });
      }
      return pass('Health run metadata parses the BUILD_MARKER assignment and only uses Codex history as a fallback.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX });
    }),

  makeCase('last_run_persistence_uses_completed_report',
    'Last Run restore/persistence uses the newest completed report and ignores stale partial summaries',
    () => {
      const src = safeStr(simulationPanelSource);
      const missing = missingTokens(src, [
        'restoreLatestStoredReport',
        'persistCompletedReport',
        'normalizeLastRunReport',
        'finishedAt || report?.timestamp || report?.startedAt',
        'withRunId.length ? withRunId : reports',
        'updateReport(nextResults, meta, { persist: true })',
      ]);
      const forbidden = src.includes('persistReport(nextReport)') ? ['persistReport(nextReport)'] : [];
      if (missing.length || forbidden.length) {
        return fail('Last Run storage can still persist partial or stale summaries instead of the latest completed report.', {
          verification: 'STATIC_CONTRACT',
          actionType: ACTION_TYPES.CODE_FIX,
          missing,
          forbidden,
        });
      }
      return pass('Last Run restore chooses the newest usable report and persistence happens only at completed-run boundary.', { verification: 'STATIC_CONTRACT', actionType: ACTION_TYPES.CODE_FIX });
    }),

  makeCase('mobile_health_report_runtime_proof_needed',
    'Mobile/PWA Health report visibility still needs real-device proof',
    () => notAutomatable('Static contracts cannot prove a WebView/PWA renders and scrolls correctly with real browser chrome, notches, and bottom system bars. Run the mobile Health report manual check before release.', {
      verification: 'NOT_AUTOMATABLE',
      verificationLabels: ['DEVICE_TEST', 'PWA_RUNTIME_PROOF'],
      actionType: ACTION_TYPES.DEVICE_TEST,
      nextStep: 'Open Health on a real mobile app/PWA, run all cases, confirm the report summary appears and details scroll without top/bottom clipping.',
    }), { critical: false, actionType: ACTION_TYPES.DEVICE_TEST }),
];
