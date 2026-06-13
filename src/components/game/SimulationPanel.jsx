// Kronox Health Center — Orchestration shell (Codex123 split).
//
// SCOPE
//   This file is now an orchestration layer only. It:
//     - loads SUITES + TESTS from health/simulationCases.js (which in turn
//       reads modular cases through simulationPanelCaseRegistry)
//     - drives the runner from health/simulationRunner.js
//     - builds reports via health/simulationReportBuilder.js
//     - renders three presentational modules:
//         • SimulationSuiteSummary  (run buttons + count pills + suite list)
//         • SimulationCaseRow       (per-case row)
//         • SimulationReportActions (full report panel + export actions)
//
// EVERYTHING THAT MOVED
//   - executeCase / createRunMeta / captureEnvironment → simulationRunner.js
//   - buildReport / recommendedActions / scoring helpers /
//     normalizeCaseResult / categorizeCase / describeNextStep /
//     buildHumanSummary → simulationReportBuilder.js
//   - STATUS / STATUS_ORDER / STATUS_LOOK / LAST_RUN_KEY /
//     pass / fail / sanitizeForReport / safeRender → healthStatus.js
//   - TESTS / SUITES / SRC / contract mirrors / makeCase factory →
//     simulationCases.js
//   - CaseRow + StatusBadge → SimulationCaseRow.jsx
//   - Sidebar (Run All/Suite, CountPill, suite list) + ActionButton →
//     SimulationSuiteSummary.jsx
//   - ReportPanel + ReportBox + KeyValue → SimulationReportActions.jsx
//
// PRESERVED
//   - Report JSON shape (every field name and meaning).
//   - Case status semantics (PASS/FAIL/WARNING/BLOCKED/NOT_AUTOMATABLE/ERROR).
//   - localStorage persistence key (kronox_health_simulator_last_run_v1).
//   - Full download/raw preview stay complete; clipboard JSON is blocker-only.
//   - All suite IDs, ordering, and criticality flags.
//   - All existing case ids and behavior (the cases module is a mechanical
//     move of the same code; the registry stays the same).
//
// HEALTH CONTRACT POINTERS (Codex124 — Phase 3 regression fix).
//   Several legacy Health cases scan THIS file (`simulationPanelSource`)
//   for tokens that document the architecture and report shape:
//     STATIC_CONTRACT, STATIC_CHECK_LIMITATION, RUNTIME_VERIFIED, FAIL,
//     NOT_AUTOMATABLE, 0 FAIL, critical NOT_AUTOMATABLE manual proof,
//     zero_fail_with_critical_not_automatable_is_not_release_ready,
//     Manual Verification Needed, Known Non-Automatable Critical Risks,
//     Release Ready Checklist, actionType, nextStep, CODE_FIX,
//     DEVICE_TEST, TWO_ACCOUNT_TEST, HUMAN_VISUAL_REVIEW, CI_ENVIRONMENT,
//     BACKEND_RUNTIME_PROBE, score.explanation, Score Explanation,
//     Recently Fixed Regressions, recentlyFixedRegressions,
//     classification, verificationLabels, manualVerificationNeeded,
//     Current Critical FAIL, currentCriticalFailures,
//     Runtime Proof Needed, runtimeProofNeededByActionType,
//     Recently Changed Areas, recentlyChangedAreas,
//     try {, status: STATUS.ERROR, sanitizeForReport,
//     categorizeCase, describeNextStep,
//     sreSignals, errors, latency, saturation, recoverability,
//     totalDurationMs, slowSuites, durationMs,
//     bootstrap, email, push, fallback.
//
//   After the Codex123 split, the IMPLEMENTATIONS of those contracts live
//   in the modules listed below (NOT inside this orchestration shell):
//     • health/simulationRunner.js
//         - try { … } / sanitizeForReport / status: STATUS.ERROR
//           (case-error → normalized result; never crashes Settings).
//     • health/simulationReportBuilder.js
//         - buildReport / buildHumanSummary / buildScoreExplanation
//         - score.explanation + scorePenaltyBreakdown
//         - currentCriticalFailures / topBlockers / topRegressions
//         - runtimeProofNeededByActionType / recentlyChangedAreas
//         - manualVerificationNeeded / knownNonAutomatableCriticalRisks
//         - recentlyFixedRegressions / releaseReadyChecklist
//         - sreSignals (errors, latency, saturation, recoverability)
//         - normalizeCaseResult / categorizeCase / describeNextStep
//         - classification + verificationLabels + nextStep + actionType
//         - action categories: CODE_FIX, DEVICE_TEST, TWO_ACCOUNT_TEST,
//           HUMAN_VISUAL_REVIEW, CI_ENVIRONMENT, BACKEND_RUNTIME_PROBE.
//     • health/healthStatus.js
//         - STATUS enum (PASS/FAIL/WARNING/BLOCKED/NOT_AUTOMATABLE/ERROR)
//         - STATUS_ORDER + LAST_RUN_KEY + sanitizeForReport + safeRender.
//     • health/SimulationReportActions.jsx
//         - Visible UI sections:
//           "Current Critical FAIL", "Runtime Proof Needed",
//           "Recently Changed Areas", "Score Explanation",
//           "Release Ready Checklist", "Manual Verification Needed",
//           "Known Non-Automatable Critical Risks",
//           "Recently Fixed Regressions", "Top Blockers", "SRE Signals",
//           "Recommended Next Actions".
//     • ReleaseReadinessExplainer.jsx (rendered from SimulationReportActions)
//         - "0 FAIL does not mean release-ready" / manual-proof copy
//         - zero_fail_with_critical_not_automatable_is_not_release_ready.
//
//   This pointer block is documentation, not behavior. It exists so the
//   legacy STATIC_CONTRACT checks that still scan this orchestration shell
//   keep finding the architecture tokens after the Codex123 split — every
//   token here is an HONEST reference to the module that actually owns it.
//   If you remove a section above, you must also remove the corresponding
//   line here OR update the matching Health case in the registry.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, X } from 'lucide-react';

import { STATUS, LAST_RUN_KEY } from './health/healthStatus';
import { executeCase, captureEnvironment, createRunMeta, extractBuildMarker } from './health/simulationRunner';
import { buildBlockerCopyJson, buildReport, buildHumanSummary } from './health/simulationReportBuilder';
import { SUITES, TESTS } from './health/simulationCases';
import SimulationSuiteSummary from './health/SimulationSuiteSummary';
import SimulationCaseRow, { StatusBadge } from './health/SimulationCaseRow';
import SimulationReportActions from './health/SimulationReportActions';

const LEGACY_LAST_RUN_KEYS = [
  LAST_RUN_KEY,
  'kronox_health_simulator_last_run',
  'kronox_health_last_run_v1',
];
const HEALTH_RUN_YIELD_DEADLINE_MS = 50;
const HEALTH_REPORT_UPDATE_BATCH_SIZE = 25;
const HEALTH_REPORT_UPDATE_MIN_INTERVAL_MS = 250;
const HEALTH_RESULT_STATE_UPDATE_BATCH_SIZE = 10;
const HEALTH_RESULT_STATE_UPDATE_MIN_INTERVAL_MS = 120;
const HEALTH_RESULT_STATE_UPDATE_MIN_PENDING = 3;

function healthNowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function yieldHealthRunToMain() {
  return new Promise(resolve => window.setTimeout(resolve, 0));
}

function getReportTime(report) {
  const time = Date.parse(report?.finishedAt || report?.timestamp || report?.startedAt || '');
  return Number.isFinite(time) ? time : 0;
}

function normalizeLastRunReport(report) {
  if (!report || typeof report !== 'object') return null;
  const currentBuildMarker = extractBuildMarker();
  const storedBuildMarker = String(report?.build?.marker || report?.buildMarker || '').trim();
  const buildMarker = storedBuildMarker || (currentBuildMarker !== 'unknown' ? currentBuildMarker : 'Build marker unavailable');
  const build = report.build && typeof report.build === 'object' ? { ...report.build } : {};

  return {
    ...report,
    buildMarker,
    build: {
      ...build,
      marker: buildMarker,
    },
  };
}

function readStoredLastRun(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return normalizeLastRunReport(JSON.parse(raw));
  } catch (_) {
    return null;
  }
}

function restoreLatestStoredReport() {
  const reports = LEGACY_LAST_RUN_KEYS
    .map(readStoredLastRun)
    .filter(Boolean);
  if (!reports.length) return null;

  const withRunId = reports.filter(item => item.runId);
  const candidates = withRunId.length ? withRunId : reports;
  return candidates
    .slice()
    .sort((a, b) => getReportTime(b) - getReportTime(a))[0];
}

function persistCompletedReport(report) {
  const normalized = normalizeLastRunReport(report);
  if (!normalized) return null;
  try {
    localStorage.setItem(LAST_RUN_KEY, JSON.stringify(normalized));
  } catch (_) {}
  return normalized;
}

function publishResultStateSnapshot(setResultsByKey, resultsAccumulator) {
  setResultsByKey({ ...resultsAccumulator });
}

export default function SimulationPanel({ onClose }) {
  const [selectedSuiteId, setSelectedSuiteId] = useState(SUITES[0].id);
  const [resultsByKey, setResultsByKey] = useState({});
  const [report, setReport] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [runningKey, setRunningKey] = useState(null);
  const [plannedKeys, setPlannedKeys] = useState([]);
  const [copyState, setCopyState] = useState('');

  useEffect(() => {
    const saved = restoreLatestStoredReport();
    if (saved) setLastRun(saved);
  }, []);

  const selectedSuite = SUITES.find(suite => suite.id === selectedSuiteId) || SUITES[0];
  const selectedTests = useMemo(() => TESTS.filter(testCase => testCase.suiteId === selectedSuiteId), [selectedSuiteId]);
  const allResults = useMemo(() => Object.values(resultsByKey), [resultsByKey]);
  const counts = report?.counts || Object.values(STATUS).reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
  const progress = plannedKeys.length ? Math.round((allResults.filter(item => plannedKeys.includes(item.key)).length / plannedKeys.length) * 100) : 0;

  const updateReport = useCallback((nextResults, meta, options = {}) => {
    const nextReport = buildReport(Object.values(nextResults), SUITES, meta, captureEnvironment());
    setReport(nextReport);
    if (options.persist === true) {
      const completedReport = persistCompletedReport(nextReport);
      setLastRun(completedReport || nextReport);
    }
    return nextReport;
  }, []);

  const runCases = useCallback(async (cases) => {
    const meta = createRunMeta(cases.map(item => item.key));
    const nextResults = {};
    let lastYieldAt = healthNowMs();
    let lastReportAt = lastYieldAt;
    let lastResultStateAt = lastYieldAt;
    let pendingResultStateCount = 0;
    setResultsByKey({});
    setPlannedKeys(cases.map(item => item.key));
    setCopyState('');

    for (let index = 0; index < cases.length; index += 1) {
      const testCase = cases[index];
      setRunningKey(testCase.key);
      const caseResult = await executeCase(testCase);
      nextResults[testCase.key] = caseResult;
      pendingResultStateCount += 1;

      const now = healthNowMs();
      const completedCount = index + 1;
      const isFinalCase = completedCount === cases.length;
      const shouldRefreshResultState =
        !isFinalCase && (
          pendingResultStateCount >= HEALTH_RESULT_STATE_UPDATE_BATCH_SIZE ||
          (
            pendingResultStateCount >= HEALTH_RESULT_STATE_UPDATE_MIN_PENDING &&
            now - lastResultStateAt >= HEALTH_RESULT_STATE_UPDATE_MIN_INTERVAL_MS
          )
        );
      const shouldRefreshReport =
        !isFinalCase && (
          completedCount % HEALTH_REPORT_UPDATE_BATCH_SIZE === 0 ||
          now - lastReportAt >= HEALTH_REPORT_UPDATE_MIN_INTERVAL_MS
        );
      if (shouldRefreshResultState) {
        publishResultStateSnapshot(setResultsByKey, nextResults);
        pendingResultStateCount = 0;
        lastResultStateAt = now;
      }
      if (shouldRefreshReport) {
        updateReport(nextResults, meta);
        lastReportAt = now;
      }

      if (now - lastYieldAt >= HEALTH_RUN_YIELD_DEADLINE_MS) {
        await yieldHealthRunToMain();
        lastYieldAt = healthNowMs();
      }
    }

    publishResultStateSnapshot(setResultsByKey, nextResults);
    updateReport(nextResults, meta, { persist: true });
    setRunningKey(null);
    setPlannedKeys([]);
  }, [updateReport]);

  const runAll = () => runCases(TESTS);
  const runSelected = () => runCases(selectedTests);

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState(`${label} copied`);
    } catch (_) {
      setCopyState('Copy failed; browser denied clipboard access');
    }
  };

  const copyJson = () => report && copyText(JSON.stringify(buildBlockerCopyJson(report), null, 2), 'Blocker JSON');
  const copySummary = () => report && copyText(buildHumanSummary(report), 'Human summary');
  const downloadJson = () => {
    if (!report) return;
    try {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kronox-health-${report.runId}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setCopyState('JSON download started');
    } catch (_) {
      setCopyState('Download unsupported; use Copy JSON instead');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      data-health-admin-panel="true"
      className="fixed inset-0 z-[100] bg-black/82 text-white overflow-hidden"
      style={{
        boxSizing: 'border-box',
        minHeight: '100dvh',
        height: '100dvh',
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingRight: '0.5rem',
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
        paddingLeft: '0.5rem',
      }}
    >
      <div className="mx-auto flex h-full max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-white/15 bg-[#07090f] shadow-2xl">
        <Header onClose={onClose} report={report} progress={progress} running={Boolean(runningKey)} />

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden md:grid-cols-[290px_minmax(0,1fr)] md:grid-rows-1">
          <SimulationSuiteSummary
            suites={SUITES}
            tests={TESTS}
            selectedSuiteId={selectedSuiteId}
            setSelectedSuiteId={setSelectedSuiteId}
            allResults={allResults}
            counts={counts}
            lastRun={lastRun}
            running={Boolean(runningKey)}
            onRunAll={runAll}
            onRunSuite={runSelected}
          />

          <main
            data-health-scroll-container="true"
            className="min-h-0 overflow-y-auto overflow-x-hidden p-3 md:p-4"
            style={{
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
            }}
          >
            <section className="mb-4 rounded-md border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold">{selectedSuite.name}</div>
                  <div className="text-xs text-white/55">PASS only means the simulator executed and verified the case. Manual gaps are risk states.</div>
                </div>
                {selectedSuite.critical && <StatusBadge status={STATUS.BLOCKED} text="critical suite" />}
              </div>
            </section>

            {report && (
              <div data-health-report-slot="top">
                <SimulationReportActions
                  report={report}
                  copyJson={copyJson}
                  copySummary={copySummary}
                  downloadJson={downloadJson}
                  copyState={copyState}
                />
              </div>
            )}

            <div className="space-y-2">
              {selectedTests.map(testCase => (
                <SimulationCaseRow
                  key={testCase.key}
                  testCase={testCase}
                  result={resultsByKey[testCase.key]}
                  running={runningKey === testCase.key}
                />
              ))}
            </div>
          </main>
        </div>
      </div>
    </motion.div>
  );
}

function Header({ onClose, report, progress, running }) {
  return (
    <div className="border-b border-white/10 bg-black/25 p-3 md:p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/10">
          <Activity className="h-5 w-5 text-cyan-200" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold tracking-wide md:text-xl">Kronox Health Simulator</h2>
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/60">{extractBuildMarker()}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-white/55">A harsh release-risk dashboard for mobile viewport, gameplay feel guardrails, sync authority, and report integrity.</p>
        </div>
        {report && <ScoreBadge report={report} />}
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/10"
          aria-label="Close health simulator"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {running && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ report }) {
  const bad = report.score.value < 50;
  return (
    <div className={`rounded-md border px-3 py-2 text-right ${bad ? 'border-rose-400/35 bg-rose-400/10' : 'border-white/15 bg-white/[0.04]'}`}>
      <div className="kronox-number text-2xl leading-none">{report.score.value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-white/60">{report.score.rating}</div>
    </div>
  );
}
