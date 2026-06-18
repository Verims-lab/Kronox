// Kronox Health Center — Case row UI (Codex123 split).
//
// SCOPE
//   Pure presentational row for one Health case. Receives `testCase`,
//   `result` (the executed case payload, if any), and `running` flag.
//   Renders status icon, name, badges, and details panel.
//
// CONTRACT PRESERVED
//   - Layout, classes, badges, and "Not run yet." copy match the original
//     CaseRow in SimulationPanel.jsx pre-Codex123.
//   - Auto-opens details for non-PASS results.

import React, { useState } from 'react';
import { ChevronDown, ClipboardCopy, RefreshCw } from 'lucide-react';
import { STATUS, STATUS_LOOK } from './healthStatus';

export function StatusBadge({ status, text }) {
  const look = STATUS_LOOK[status] || STATUS_LOOK[STATUS.WARNING];
  const Icon = look.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold"
      style={{ color: look.color, borderColor: `${look.color}55`, background: look.bg }}
    >
      <Icon className="h-3.5 w-3.5" />
      {text || status.replace('_', ' ')}
    </span>
  );
}

export default function SimulationCaseRow({ testCase, result: caseResult, running }) {
  const [copyState, setCopyState] = useState('');
  const status = running ? 'RUNNING' : caseResult?.status || 'PENDING';
  const badgeStatus = caseResult?.status || STATUS.NOT_AUTOMATABLE;
  const look = STATUS_LOOK[badgeStatus] || STATUS_LOOK[STATUS.NOT_AUTOMATABLE];
  const copyCaseDetails = async () => {
    if (!caseResult) return;
    const payload = JSON.stringify({
      caseId: testCase.key,
      suite: testCase.suiteName || testCase.suiteId,
      title: testCase.name,
      status: caseResult.status,
      reason: caseResult.reason,
      verification: caseResult.verification,
      verificationLabels: caseResult.verificationLabels,
      classification: caseResult.classification,
      actionType: caseResult.actionType,
      nextStep: caseResult.nextStep,
      file: caseResult.file,
      expected: caseResult.expected,
      actual: caseResult.actual,
    }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopyState('Case detail copied');
    } catch (_) {
      setCopyState('Clipboard blocked; use Raw JSON Preview export.');
    }
  };

  return (
    <details className="rounded-md border border-white/10 bg-black/25 p-3" open={Boolean(caseResult && caseResult.status !== STATUS.PASS)}>
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
          style={{ background: running ? 'rgba(103,232,249,0.12)' : look.bg, color: running ? '#67e8f9' : look.color }}
        >
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <look.Icon className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight">{testCase.name}</span>
          <span className="mt-1 block text-[11px] text-white/45">{testCase.id} {testCase.critical ? '/ critical' : ''}</span>
        </span>
        <span className="hidden sm:block">
          <StatusBadge status={caseResult?.status || STATUS.NOT_AUTOMATABLE} text={status} />
        </span>
        <ChevronDown className="h-4 w-4 text-white/40" />
      </summary>
      <div className="mt-3 border-t border-white/10 pt-3 text-xs text-white/70">
        {caseResult ? (
          <>
            <div className="mb-2 flex flex-wrap gap-2 sm:hidden"><StatusBadge status={caseResult.status} /></div>
            <p className="leading-relaxed">{caseResult.reason}</p>
            <div data-health-case-mobile-details="true" className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <CaseMeta label="Action" value={caseResult.actionType || 'CODE_FIX'} />
              <CaseMeta label="Class" value={caseResult.classification || 'n/a'} />
              <CaseMeta label="Verify" value={caseResult.verification || caseResult.verificationLabels?.[0] || 'n/a'} />
              <CaseMeta label="Duration" value={`${caseResult.durationMs}ms`} />
            </div>
            {caseResult.nextStep && (
              <div className="mt-2 rounded-md border border-white/10 bg-black/20 p-2 text-[11px] leading-relaxed text-white/60">
                <span className="font-semibold text-white/80">Next: </span>{caseResult.nextStep}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyCaseDetails}
                data-health-case-copy="true"
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/15 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-white transition active:scale-[0.98]"
                aria-label={`Copy Health case detail for ${testCase.name}`}
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                Copy case detail
              </button>
              {copyState && <span className="text-[11px] text-cyan-200">{copyState}</span>}
            </div>
            {(caseResult.expected !== undefined || caseResult.actual !== undefined || caseResult.file || caseResult.stack) && (
              <pre data-health-case-detail-json="true" className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/45 p-3 text-[11px] leading-relaxed text-white/75">
                {JSON.stringify({
                  verification: caseResult.verification,
                  verificationLabels: caseResult.verificationLabels,
                  classification: caseResult.classification,
                  actionType: caseResult.actionType,
                  nextStep: caseResult.nextStep,
                  file: caseResult.file,
                  expected: caseResult.expected,
                  actual: caseResult.actual,
                  stack: caseResult.stack,
                }, null, 2)}
              </pre>
            )}
          </>
        ) : (
          <p className="text-white/45">Not run yet.</p>
        )}
      </div>
    </details>
  );
}

function CaseMeta({ label, value }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-black/20 p-2">
      <div className="text-[10px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="mt-1 break-words text-[11px] font-semibold leading-snug text-white/75">{String(value || 'n/a')}</div>
    </div>
  );
}
