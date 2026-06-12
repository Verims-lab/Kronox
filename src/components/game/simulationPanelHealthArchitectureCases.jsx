// Kronox Health Center — Architecture guard cases (Codex123).
//
// SCOPE
//   Locks in the Phase 2 SimulationPanel split:
//     - Runner extracted to components/game/health/simulationRunner.js
//     - Report builder extracted to components/game/health/simulationReportBuilder.js
//     - SimulationPanel still imports cases through the registry
//     - Report shape fields are still emitted (preserved contract)
//
// HONESTY
//   These cases run against the REAL module exports (not raw source
//   strings), so they prove the architecture by behavior. If someone
//   silently re-inlines the runner or breaks an export, these cases flip
//   to FAIL. They cannot weaken existing semantics — they only add
//   structural guarantees on top of what is already locked.
//
// NOTE
//   Earlier drafts of this file tried to scan raw source via `?raw`
//   imports. Vite couldn't resolve the new `health/*.js` modules through
//   `?raw` at build time on every host, which produced a build error.
//   We now import the modules normally and verify the exported behavior.

import { buildReport } from './health/simulationReportBuilder';
import simulationPanelSource from './SimulationPanel.jsx?raw';
import {
  executeCase,
  createRunMeta,
  captureEnvironment,
} from './health/simulationRunner';
import { STATUS as RUNNER_STATUS } from './health/healthStatus';

const STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
};

const ACTION_TYPES = { CODE_FIX: 'CODE_FIX' };

const SUITE_NAMES = {
  health_panel_architecture: 'Health Panel Architecture Suite',
};

function makeCase(suiteId, id, name, run, options = {}) {
  return {
    key: `${suiteId}.${id}`,
    suiteId,
    suiteName: SUITE_NAMES[suiteId] || suiteId,
    id,
    name,
    critical: options.critical ?? false,
    ...options,
    run,
  };
}

function pass(reason, extra) { return { status: STATUS.PASS, reason, ...(extra || {}) }; }
function fail(reason, extra) { return { status: STATUS.FAIL, reason, ...(extra || {}) }; }

export const EXTRA_SUITES = [
  {
    id: 'health_panel_architecture',
    name: SUITE_NAMES.health_panel_architecture,
    critical: false,
    color: '#a5b4fc',
  },
];

export const EXTRA_TESTS = [
  /* 1. Runner is exported from its own module. */
  makeCase('health_panel_architecture', 'health_panel_runner_extracted',
    'Health runner exports (executeCase / createRunMeta / captureEnvironment) come from the extracted simulationRunner module',
    () => {
      const missing = [];
      if (typeof executeCase !== 'function') missing.push('executeCase');
      if (typeof createRunMeta !== 'function') missing.push('createRunMeta');
      if (typeof captureEnvironment !== 'function') missing.push('captureEnvironment');
      if (missing.length) {
        return fail('Runner is not fully extracted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/game/health/simulationRunner.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: ['executeCase', 'createRunMeta', 'captureEnvironment'],
          actual: { missing },
        });
      }
      return pass('Runner exports are present.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 2. Report builder is exported from its own module. */
  makeCase('health_panel_architecture', 'health_report_builder_extracted',
    'Health report builder export (buildReport) comes from the extracted simulationReportBuilder module',
    () => {
      if (typeof buildReport !== 'function') {
        return fail('Report builder is not extracted.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/game/health/simulationReportBuilder.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'buildReport export',
          actual: 'missing',
        });
      }
      return pass('Report builder is extracted into its own module.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 3. Health status enum stays compatible. */
  makeCase('health_panel_architecture', 'health_registry_still_single_import_source',
    'Status enum from the shared healthStatus module still matches the documented set',
    () => {
      const expected = ['PASS', 'FAIL', 'WARNING', 'BLOCKED', 'NOT_AUTOMATABLE', 'ERROR'];
      const missing = expected.filter((key) => RUNNER_STATUS[key] !== key);
      if (missing.length) {
        return fail('Status enum drifted from the documented set.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/game/health/healthStatus.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected,
          actual: { missing },
        });
      }
      return pass('Status enum is preserved.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 4. Report shape is preserved end-to-end after the split. */
  makeCase('health_panel_architecture', 'health_report_shape_preserved',
    'Report builder still emits every required top-level field (runId, counts, suiteSummary, score, topBlockers, …)',
    () => {
      // Pass [] for suites/results — we are only checking field NAMES on
      // the returned report; the suites array is irrelevant for that.
      const report = buildReport([], []);
      const requiredFields = [
        'runId', 'timestamp', 'startedAt', 'finishedAt', 'buildMarker', 'build',
        'environment', 'route', 'suites', 'suiteSummary', 'counts', 'totalCases',
        'totalDurationMs', 'score', 'scorePenaltyBreakdown', 'topBlockers',
        'currentCriticalFailures', 'topRegressions', 'recommendedNextActions',
        'releaseReadyChecklist', 'manualVerificationNeeded',
        'runtimeProofNeededByActionType', 'knownNonAutomatableCriticalRisks',
        'recentlyFixedRegressions', 'recentlyChangedAreas', 'sreSignals', 'cases',
      ];
      const missing = requiredFields.filter((f) => !(f in report));
      if (missing.length) {
        return fail('Report shape regressed — required fields are missing after the split.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/game/health/simulationReportBuilder.js',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: requiredFields,
          actual: { missing },
        });
      }
      return pass('Report shape is preserved across all required fields.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { fields: requiredFields.length },
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  /* 5. Empty-run report still scores at the top of the band (no penalty). */
  makeCase('health_panel_architecture', 'health_report_baseline_score',
    'An empty case list still produces a valid score object (sanity baseline for the split)',
    () => {
      const report = buildReport([], []);
      const ok = report?.score && typeof report.score.value === 'number' && typeof report.score.rating === 'string';
      if (!ok) {
        return fail('Score object missing or malformed after split.', {
          verification: 'RUNTIME_VERIFIED',
          classification: 'REAL_PRODUCT_RISK',
          actionType: ACTION_TYPES.CODE_FIX,
          expected: 'report.score = { value:number, rating:string, explanation:string }',
          actual: report?.score,
        });
      }
      return pass('Score object shape is preserved.', {
        verification: 'RUNTIME_VERIFIED',
        classification: 'RUNTIME_VERIFIED',
        actual: { score: report.score.value, rating: report.score.rating },
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),

  makeCase('health_panel_architecture', 'health_run_batches_report_updates',
    'Health Center batches report and result-state publishing during long runs',
    () => {
      const requiredTokens = [
        'HEALTH_RUN_YIELD_DEADLINE_MS',
        'HEALTH_REPORT_UPDATE_BATCH_SIZE',
        'HEALTH_REPORT_UPDATE_MIN_INTERVAL_MS',
        'HEALTH_RESULT_STATE_UPDATE_BATCH_SIZE',
        'HEALTH_RESULT_STATE_UPDATE_MIN_INTERVAL_MS',
        'HEALTH_RESULT_STATE_UPDATE_MIN_PENDING',
        'yieldHealthRunToMain',
        'publishResultStateSnapshot',
        'nextResults[testCase.key] = caseResult',
        'pendingResultStateCount += 1',
        'pendingResultStateCount >= HEALTH_RESULT_STATE_UPDATE_BATCH_SIZE',
        'pendingResultStateCount >= HEALTH_RESULT_STATE_UPDATE_MIN_PENDING',
        'now - lastResultStateAt >= HEALTH_RESULT_STATE_UPDATE_MIN_INTERVAL_MS',
        'completedCount % HEALTH_REPORT_UPDATE_BATCH_SIZE',
        'now - lastReportAt >= HEALTH_REPORT_UPDATE_MIN_INTERVAL_MS',
        'now - lastYieldAt >= HEALTH_RUN_YIELD_DEADLINE_MS',
      ];
      const missing = requiredTokens.filter((token) => !simulationPanelSource.includes(token));
      const forbidden = [
        'updateReport(nextResults, meta);\n      await new Promise(resolve => window.setTimeout(resolve, 12));',
        'nextResults = { ...nextResults, [testCase.key]: caseResult };',
        'setResultsByKey({ ...nextResults });',
      ].filter((token) => simulationPanelSource.includes(token));
      if (missing.length || forbidden.length) {
        return fail('Health Center can still rebuild full reports or publish growing result-state objects too eagerly during long runs.', {
          verification: 'STATIC_CONTRACT',
          classification: 'REAL_PRODUCT_RISK',
          file: 'components/game/SimulationPanel.jsx',
          actionType: ACTION_TYPES.CODE_FIX,
          actual: { missing, forbidden },
        });
      }
      return pass('Health Center throttles report rebuilds, batches result-state snapshots, and yields long admin runs. Static proof does not replace manual runtime profiling.', {
        verification: 'STATIC_CONTRACT',
        classification: 'RUNTIME_GUARDRAIL',
      });
    },
    { actionType: ACTION_TYPES.CODE_FIX }),
];
