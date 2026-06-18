// Kronox Health Center — Full report panel UI (Codex123 split).
//
// SCOPE
//   Presentational report panel: blocker-copy/full-download actions + every report
//   section (critical fails, runtime proof, recently changed, environment,
//   top blockers, score explanation, SRE signals, recommended actions,
//   release-ready checklist, manual verification, known non-automatable,
//   recently-fixed regressions, raw JSON preview).
//
// CONTRACT PRESERVED
//   Identical sections + labels + class names as the original ReportPanel
//   inside SimulationPanel.jsx pre-Codex123.

import React from 'react';
import { ClipboardCopy, Download } from 'lucide-react';
import ReleaseReadinessExplainer from '../ReleaseReadinessExplainer';
import { safeRender } from './healthStatus';
import { StatusBadge } from './SimulationCaseRow';
import { ActionButton } from './SimulationSuiteSummary';

function ReportBox({ title, children, className = '' }) {
  return (
    <div className={`rounded-md border border-white/10 bg-black/20 p-3 ${className}`}>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-white/50">{title}</div>
      {children}
    </div>
  );
}

function KeyValue({ label, value }) {
  return (
    <div className="mb-2 grid grid-cols-[92px_minmax(0,1fr)] gap-2 text-xs">
      <span className="text-white/45">{label}</span>
      <span className="min-w-0 break-words text-white/75">{safeRender(value)}</span>
    </div>
  );
}

function RunStateBadge({ runFreshState }) {
  const state = String(runFreshState || '').toLowerCase();
  const isRunning = state === 'running';
  const isFresh = state === 'fresh';
  const isFailed = state === 'failed';
  const isPrevious = !isRunning && !isFresh && !isFailed;
  const label = isRunning ? 'Run in progress' : isFresh ? 'Current run (fresh)' : isFailed ? 'Run partially completed (verify)' : 'Previous result';
  const tone = isFresh ? 'border-emerald-400/35 bg-emerald-400/10' : isFailed ? 'border-rose-400/35 bg-rose-400/10' : 'border-amber-300/35 bg-amber-300/10';
  return (
    <div className={`self-start rounded-md border px-2 py-1 text-[11px] ${tone}`}>
      {label}
    </div>
  );
}

export default function SimulationReportActions({
  report,
  runFreshState,
  copyFallback,
  copyWarning,
  copyJson,
  copySummary,
  downloadJson,
  copyState,
}) {
  return (
    <section id="kronox-health-report" data-health-report-panel="true" className="mb-4 rounded-md border border-white/12 bg-white/[0.035] p-3 md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">Report</h3>
          <p className="mt-1 text-xs text-white/55">{report.runId} / {report.timestamp}</p>
          <RunStateBadge runFreshState={runFreshState} />
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:w-auto xl:grid-cols-none xl:flex xl:flex-wrap">
          <ActionButton icon={ClipboardCopy} label="Copy Blocker JSON" onClick={copyJson} />
          <ActionButton icon={ClipboardCopy} label="Copy Warning JSON" onClick={copyWarning} />
          <ActionButton icon={Download} label="Download JSON" onClick={downloadJson} />
          <ActionButton icon={ClipboardCopy} label="Copy Summary" onClick={copySummary} />
        </div>
      </div>
      {copyState && <div className="mt-2 text-xs text-cyan-200">{copyState}</div>}
      {copyFallback?.text ? (
        <details className="mt-2 rounded-md border border-white/20">
          <summary className="cursor-pointer px-3 py-2 text-xs text-white/80">Clipboard copy fallback for "{copyFallback.label}"</summary>
          <div className="border-t border-white/10 p-3">
            <textarea
              readOnly
              value={copyFallback.text}
              onFocus={(event) => event.currentTarget.select()}
              className="h-40 w-full resize-y rounded-md bg-black/60 p-2 text-[11px] leading-relaxed text-white/80"
            />
          </div>
        </details>
      ) : null}

      <ReleaseReadinessExplainer report={report} />

      <div data-health-report-summary="true" className="mt-4 grid grid-cols-2 gap-2 text-center text-[11px] sm:grid-cols-6">
        {['PASS', 'FAIL', 'ERROR', 'WARNING', 'NOT_AUTOMATABLE', 'BLOCKED'].map(status => (
          <div key={status} className="rounded-md border border-white/10 bg-black/25 p-2">
            <div className="kronox-number text-sm text-white">{report.counts?.[status] || 0}</div>
            <div className="mt-0.5 truncate uppercase text-white/45">{status.replace('_', ' ')}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ReportBox title="Current Critical FAIL">
          {report.currentCriticalFailures?.length ? (
            <ul className="space-y-2 text-xs text-white/70">
              {report.currentCriticalFailures.slice(0, 4).map(item => (
                <li key={`${item.key}-critical-fail`} className="rounded border border-rose-400/25 bg-rose-400/10 p-2">
                  <span className="font-semibold text-rose-100">{item.name}</span>
                  <span className="block text-rose-100/65">{item.suiteName}</span>
                  {item.nextStep && <span className="mt-1 block text-[11px] text-cyan-100/75">Next: {item.nextStep}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-white/55">None</p>}
        </ReportBox>

        <ReportBox title="Runtime Proof Needed">
          {report.runtimeProofNeededByActionType?.length ? (
            <ul className="space-y-2 text-xs text-white/70">
              {report.runtimeProofNeededByActionType.map(group => (
                <li key={group.actionType} className="rounded border border-white/10 bg-black/20 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">{group.actionType}</span>
                    <span className="text-amber-200">{group.count} / {group.criticalCount} critical</span>
                  </div>
                  {group.examples?.[0] && <span className="mt-1 block text-white/45">{group.examples[0].name}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-white/55">None</p>}
        </ReportBox>

        <ReportBox title="Recently Changed Areas">
          {report.recentlyChangedAreas?.length ? (
            <ul className="space-y-2 text-xs text-white/70">
              {report.recentlyChangedAreas.slice(0, 6).map(area => (
                <li key={area.id} className="rounded border border-white/10 bg-black/20 p-2">
                  <span className="font-semibold text-white">{area.label}</span>
                  <span className="block text-white/45">{area.caseCount} cases / {area.failingOrUnknown} needing attention</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-white/55">None recorded</p>}
        </ReportBox>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ReportBox title="Environment">
          <KeyValue label="Device" value={report.environment.deviceType} />
          <KeyValue label="Viewport" value={`${report.environment.viewport.width}x${report.environment.viewport.height}`} />
          <KeyValue label="DPR" value={report.environment.dpr} />
          <KeyValue label="Touch" value={`${report.environment.touchSupport} (${report.environment.maxTouchPoints})`} />
          <KeyValue label="Standalone" value={String(report.environment.standalone)} />
          <KeyValue label="Route" value={report.environment.route} />
          <KeyValue label="UA" value={report.environment.userAgent} />
        </ReportBox>
        <ReportBox title="Top Blockers">
          {report.topBlockers.length ? report.topBlockers.map(item => (
            <div key={`${item.key}-${item.status}`} className="mb-2 rounded border border-white/10 bg-black/25 p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={item.status} />
                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/55">{item.actionType}</span>
              </div>
              <div className="mt-1 font-semibold">{item.name}</div>
              <div className="mt-1 text-white/55">{item.reason}</div>
              {item.nextStep && <div className="mt-1 text-[11px] text-cyan-100/75">Next: {item.nextStep}</div>}
            </div>
          )) : <p className="text-white/55">None</p>}
        </ReportBox>
      </div>

      <ReportBox title="Score Explanation" className="mt-3">
        <p className="text-xs leading-relaxed text-white/70">{report.score.explanation}</p>
        {report.scorePenaltyBreakdown && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-white/55 sm:grid-cols-5">
            {Object.entries(report.scorePenaltyBreakdown).map(([key, value]) => (
              <div key={key} className="rounded border border-white/10 bg-black/20 p-2">
                <div className="text-white/40">{key}</div>
                <div className="font-semibold text-white/75">{value}</div>
              </div>
            ))}
          </div>
        )}
      </ReportBox>

      <ReportBox title="SRE Signals" className="mt-3">
        <div className="grid gap-2 text-[11px] text-white/60 sm:grid-cols-4">
          <div className="rounded border border-white/10 bg-black/20 p-2">
            <div className="text-white/40">Errors</div>
            <div className="font-semibold text-white/80">FAIL {report.sreSignals?.errors?.fail || 0} / ERROR {report.sreSignals?.errors?.error || 0}</div>
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-2">
            <div className="text-white/40">Latency</div>
            <div className="font-semibold text-white/80">{report.sreSignals?.latency?.totalDurationMs || 0}ms</div>
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-2">
            <div className="text-white/40">Saturation</div>
            <div className="font-semibold text-white/80">{report.sreSignals?.saturation?.totalCases || report.totalCases} cases</div>
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-2">
            <div className="text-white/40">Recoverability</div>
            <div className="font-semibold text-white/80">{report.sreSignals?.recoverability?.namedRecoveryContracts || 0} contracts</div>
          </div>
        </div>
      </ReportBox>

      <ReportBox title="Recommended Next Actions" className="mt-3">
        <ul className="space-y-2 text-xs text-white/70">
          {report.recommendedNextActions.map(action => <li key={action}>- {action}</li>)}
        </ul>
      </ReportBox>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ReportBox title="Release Ready Checklist">
          <ul className="space-y-2 text-xs text-white/70">
            {report.releaseReadyChecklist.map(item => (
              <li key={item.label} className="flex items-start gap-2">
                <span className={item.passed ? 'text-emerald-300' : 'text-amber-300'}>{item.passed ? 'PASS' : 'NEEDS PROOF'}</span>
                <span className="min-w-0 flex-1">{item.label}</span>
                <span className="text-white/35">{item.actionType}</span>
              </li>
            ))}
          </ul>
        </ReportBox>

        <ReportBox title="Manual Verification Needed">
          {report.manualVerificationNeeded.length ? (
            <ul className="space-y-2 text-xs text-white/70">
              {report.manualVerificationNeeded.slice(0, 8).map(item => (
                <li key={`${item.key}-manual`} className="rounded border border-white/10 bg-black/20 p-2">
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="block text-white/45">{item.actionType} / {item.status}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-white/55">None</p>}
        </ReportBox>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ReportBox title="Known Non-Automatable Critical Risks">
          {report.knownNonAutomatableCriticalRisks.length ? (
            <ul className="space-y-2 text-xs text-white/70">
              {report.knownNonAutomatableCriticalRisks.slice(0, 8).map(item => (
                <li key={`${item.key}-known`} className="rounded border border-white/10 bg-black/20 p-2">
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="block text-white/45">{item.suiteName}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-white/55">None</p>}
        </ReportBox>

        <ReportBox title="Recently Fixed Regressions">
          {report.recentlyFixedRegressions.length ? (
            <ul className="space-y-2 text-xs text-white/70">
              {report.recentlyFixedRegressions.slice(0, 8).map(item => (
                <li key={`${item.key}-fixed`} className="rounded border border-white/10 bg-black/20 p-2">
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="block text-white/45">{item.status} / {item.suiteName}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-white/55">None recorded in this run</p>}
        </ReportBox>
      </div>

      <details className="mt-3 rounded-md border border-white/10 bg-black/25 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Raw JSON Preview</summary>
        <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-black/50 p-3 text-[11px] leading-relaxed text-white/70">
          {JSON.stringify(report, null, 2)}
        </pre>
      </details>
    </section>
  );
}
