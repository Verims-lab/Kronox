// Kronox Health Center — Side panel (suite list + counts + run buttons).
// Codex123 split.
//
// SCOPE
//   Presentational sidebar: Run All / Run Suite buttons, count pills
//   (PASS/FAIL/WARNING/BLOCKED/NOT_AUTOMATABLE/ERROR), last-run summary,
//   and the suite picker list. All behavior is preserved.

import React from 'react';
import { AlertTriangle, Play, RefreshCw } from 'lucide-react';
import { STATUS, STATUS_LOOK } from './healthStatus';

export function ActionButton({ icon: Icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-45"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function CountPill({ status, count }) {
  const look = STATUS_LOOK[status];
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-2">
      <div className="text-sm font-bold" style={{ color: look.color }}>{count || 0}</div>
      <div className="truncate text-[9px] uppercase text-white/45">{status.replace('_', ' ')}</div>
    </div>
  );
}

export default function SimulationSuiteSummary({
  suites,
  tests,
  selectedSuiteId,
  setSelectedSuiteId,
  allResults,
  counts,
  lastRun,
  running,
  onRunAll,
  onRunSuite,
}) {
  return (
    <aside className="border-b border-white/10 bg-white/[0.03] p-3 md:border-b-0 md:border-r md:overflow-y-auto">
      <div className="mb-3 grid grid-cols-2 gap-2">
        <ActionButton icon={Play} label="Run All" onClick={onRunAll} disabled={running} />
        <ActionButton icon={RefreshCw} label="Run Suite" onClick={onRunSuite} disabled={running} />
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <CountPill status={STATUS.PASS} count={counts.PASS} />
        <CountPill status={STATUS.FAIL} count={counts.FAIL} />
        <CountPill status={STATUS.WARNING} count={counts.WARNING} />
        <CountPill status={STATUS.BLOCKED} count={counts.BLOCKED} />
        <CountPill status={STATUS.NOT_AUTOMATABLE} count={counts.NOT_AUTOMATABLE} />
        <CountPill status={STATUS.ERROR} count={counts.ERROR} />
      </div>

      {lastRun && (
        <div className="mb-3 rounded-md border border-white/10 bg-black/25 p-3 text-xs text-white/70">
          <div className="mb-1 font-semibold text-white">Last Run</div>
          <div>{lastRun.runId}</div>
          <div>{lastRun.score.value} / {lastRun.score.rating}</div>
          <div>{lastRun.buildMarker}</div>
        </div>
      )}

      <div className="max-h-48 overflow-y-auto pr-1 md:max-h-none">
        {suites.map(suite => {
          const suiteResults = allResults.filter(item => item.suiteId === suite.id);
          const hasProblems = suiteResults.some(item => item.status !== STATUS.PASS);
          return (
            <button
              key={suite.id}
              type="button"
              onClick={() => setSelectedSuiteId(suite.id)}
              className={`mb-2 w-full rounded-md border px-3 py-3 text-left transition ${selectedSuiteId === suite.id ? 'border-white/35 bg-white/12' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: suite.color }} />
                <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">{suite.name}</span>
                {hasProblems && <AlertTriangle className="h-4 w-4 text-amber-300" />}
              </div>
              <div className="mt-1 text-[11px] text-white/50">
                {suiteResults.length || tests.filter(item => item.suiteId === suite.id).length} cases
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}