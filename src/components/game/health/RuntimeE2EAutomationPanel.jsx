import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Clipboard,
  FileJson,
  Import,
  Play,
  ShieldCheck,
} from 'lucide-react';

import {
  AUTOMATION_STATUS,
  buildAllAutomationFailuresJson,
  buildAllAutomationSetupGapsJson,
  buildAutomationFailureJson,
  buildFullAutomationReportJson,
  createNotRunAutomationReport,
  normalizeRuntimeE2EReport,
} from '@/lib/health/runtimeE2EReport';
import {
  RUNTIME_E2E_REPORT_STORAGE_KEY,
  RUNTIME_E2E_REPORT_URL,
  RUNTIME_E2E_RUN_COMMAND,
  RUNTIME_E2E_SCENARIOS,
} from '@/lib/health/runtimeE2EScenarios';
import { extractBuildMarker } from './simulationRunner';

const STATUS_STYLE = {
  [AUTOMATION_STATUS.PASS]: { label: 'PASS', color: '#86efac', background: 'rgba(34,197,94,.12)' },
  [AUTOMATION_STATUS.FAIL]: { label: 'FAIL', color: '#fda4af', background: 'rgba(244,63,94,.13)' },
  [AUTOMATION_STATUS.NOT_RUN]: { label: 'NOT RUN', color: '#cbd5e1', background: 'rgba(148,163,184,.11)' },
  [AUTOMATION_STATUS.NOT_AUTOMATABLE]: { label: 'NOT AUTOMATABLE', color: '#fde68a', background: 'rgba(250,204,21,.10)' },
  [AUTOMATION_STATUS.MANUAL_EXTERNAL]: { label: 'MANUAL / EXTERNAL', color: '#c4b5fd', background: 'rgba(139,92,246,.12)' },
};

const COUNTERS = [
  ['automationPassed', 'Passed', '#86efac'],
  ['automationFailed', 'Failed', '#fda4af'],
  ['automationNotRun', 'Not run', '#cbd5e1'],
  ['automationNotAutomatable', 'Not automatable', '#fde68a'],
  ['automationManualExternal', 'Manual / external', '#c4b5fd'],
];

function readStoredReport(buildMarker) {
  try {
    const value = localStorage.getItem(RUNTIME_E2E_REPORT_STORAGE_KEY);
    return value ? normalizeRuntimeE2EReport(JSON.parse(value), buildMarker) : null;
  } catch (_) {
    return null;
  }
}

function durationLabel(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 0) return 'Süre yok';
  return duration < 1000 ? `${duration} ms` : `${(duration / 1000).toFixed(1)} sn`;
}

async function copyText(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function StatusBadge({ status }) {
  const style = STATUS_STYLE[status] || STATUS_STYLE[AUTOMATION_STATUS.NOT_RUN];
  return (
    <span
      className="inline-flex min-h-6 items-center rounded-md px-2 text-[10px] font-black uppercase"
      style={{ color: style.color, background: style.background, border: `1px solid ${style.color}55` }}
    >
      {style.label}
    </span>
  );
}

export default function RuntimeE2EAutomationPanel() {
  const buildMarker = extractBuildMarker();
  const inputRef = useRef(null);
  const [report, setReport] = useState(() => readStoredReport(buildMarker) || createNotRunAutomationReport(buildMarker));
  const [selectedScenarioId, setSelectedScenarioId] = useState(RUNTIME_E2E_SCENARIOS[0].scenarioId);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(RUNTIME_E2E_REPORT_URL, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('No published automation report');
        return response.json();
      })
      .then((value) => {
        if (cancelled) return;
        const normalized = normalizeRuntimeE2EReport(value, buildMarker);
        setReport(normalized);
        localStorage.setItem(RUNTIME_E2E_REPORT_STORAGE_KEY, JSON.stringify(normalized));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [buildMarker]);

  const selectedResult = useMemo(
    () => report.scenarios.find((item) => item.scenarioId === selectedScenarioId) || null,
    [report.scenarios, selectedScenarioId],
  );
  const failedResults = useMemo(
    () => report.scenarios.filter((item) => item.status === AUTOMATION_STATUS.FAIL),
    [report.scenarios],
  );
  const setupGapResults = useMemo(
    () => report.scenarios.filter((item) => (
      item.status === AUTOMATION_STATUS.NOT_AUTOMATABLE
      || item.status === AUTOMATION_STATUS.MANUAL_EXTERNAL
    )),
    [report.scenarios],
  );
  const selectedIsIssue = selectedResult?.status === AUTOMATION_STATUS.FAIL
    || selectedResult?.status === AUTOMATION_STATUS.NOT_AUTOMATABLE
    || selectedResult?.status === AUTOMATION_STATUS.MANUAL_EXTERNAL;

  const copyRunCommand = async () => {
    await copyText(RUNTIME_E2E_RUN_COMMAND);
    setMessage('Tarayıcı içinden çalıştırma yapılmadı. CLI komutu kopyalandı.');
  };

  const copySelectedFailure = async () => {
    const payload = buildAutomationFailureJson(report, selectedScenarioId);
    if (!payload) {
      setMessage('Seçili senaryo için kopyalanabilir hata veya kurulum eksiği yok.');
      return;
    }
    await copyText(payload);
    setMessage('Seçili otomasyon hatası/kurulum eksiği güvenli JSON olarak kopyalandı.');
  };

  const copySetupGaps = async () => {
    if (!setupGapResults.length) {
      setMessage('Kopyalanabilir kurulum eksiği yok.');
      return;
    }
    await copyText(buildAllAutomationSetupGapsJson(report));
    setMessage('Tüm otomasyon kurulum eksikleri güvenli JSON olarak kopyalandı.');
  };

  const copyFullReport = async () => {
    await copyText(buildFullAutomationReportJson(report));
    setMessage('Tam otomasyon raporu güvenli JSON olarak kopyalandı.');
  };

  const copyAllFailures = async () => {
    if (!failedResults.length) {
      setMessage('Kopyalanabilir otomasyon hatası yok.');
      return;
    }
    await copyText(buildAllAutomationFailuresJson(report));
    setMessage('Tüm otomasyon hataları güvenli JSON olarak kopyalandı.');
  };

  const importReport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const normalized = normalizeRuntimeE2EReport(JSON.parse(await file.text()), buildMarker);
      setReport(normalized);
      localStorage.setItem(RUNTIME_E2E_REPORT_STORAGE_KEY, JSON.stringify(normalized));
      setMessage(`${normalized.runId || 'Rapor'} içe aktarıldı.`);
    } catch (_) {
      setMessage('Otomasyon raporu okunamadı. Geçerli JSON seç.');
    }
  };

  return (
    <div data-health-runtime-e2e-panel="separate-report" className="space-y-3">
      <section className="rounded-md border border-cyan-300/25 bg-cyan-300/[0.06] p-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-white">Ayrı otomasyon raporu</h3>
            <p className="mt-1 text-xs leading-relaxed text-white/65">
              Bu otomasyon ayrı çalışır. Full Run bu otomasyonu çalıştırmaz. Otomasyon sonuçları Health blocker, fail veya warning sayaçlarına eklenmez.
            </p>
            <p className="mt-2 break-all font-mono text-[11px] text-cyan-100">Komut: {RUNTIME_E2E_RUN_COMMAND}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled
            aria-label="Otomasyonu Çalıştır"
            title="Gerçek tarayıcı otomasyonu yalnızca CLI üzerinden çalışır"
            className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-white/45"
          >
            <Play className="h-4 w-4" /> CLI'dan Çalıştır
          </button>
          <button
            type="button"
            onClick={copyRunCommand}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100"
          >
            <Clipboard className="h-4 w-4" /> Komutu Kopyala
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.05] px-3 text-sm font-semibold text-white"
          >
            <Import className="h-4 w-4" /> Rapor İçe Aktar
          </button>
          <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={importReport} />
        </div>
      </section>

      <section aria-label="Runtime automation counters" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {COUNTERS.map(([key, label, color]) => (
          <div key={key} className="rounded-md border border-white/10 bg-black/25 p-2 text-center">
            <div className="kronox-number text-lg" style={{ color }}>{report.counts?.[key] || 0}</div>
            <div className="text-[9px] font-bold uppercase text-white/50">{label}</div>
          </div>
        ))}
      </section>

      <section className="rounded-md border border-white/10 bg-white/[0.025] p-3 text-xs text-white/65">
        <div className="grid gap-1 sm:grid-cols-3">
          <span>Run: {report.runId || 'Henüz çalıştırılmadı'}</span>
          <span>Build: {report.buildMarker || buildMarker}</span>
          <span>Senaryo: {report.scenarios.length}/10</span>
        </div>
      </section>

      <section
        data-health-runtime-preflight="visible"
        className="rounded-md border border-cyan-300/20 bg-black/25 p-3 text-xs text-white/65"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-white">Backend preflight</strong>
          <span
            data-health-runtime-preflight-status={report.preflight?.status || 'NOT_RUN'}
            className="rounded-md border border-white/15 px-2 py-1 font-mono text-[10px] text-cyan-100"
          >
            {report.preflight?.status || 'NOT RUN'}
          </span>
        </div>
        <dl className="mt-2 grid gap-1 sm:grid-cols-2">
          <div><dt className="inline font-semibold text-white/80">Target: </dt><dd className="inline">{report.targetKind || 'NOT RECORDED'}</dd></div>
          <div><dt className="inline font-semibold text-white/80">Production custom domain: </dt><dd className="inline">{report.productionCustomDomainMode ? 'YES' : 'NO'}</dd></div>
          <div><dt className="inline font-semibold text-white/80">Direct backend: </dt><dd className="inline">{report.directBackendPreflightStatus || 'NOT RUN'}</dd></div>
          <div><dt className="inline font-semibold text-white/80">Runtime probe: </dt><dd className="inline">{report.runtimeBackendProbeStatus || 'NOT RUN'}</dd></div>
          <div><dt className="inline font-semibold text-white/80">Proof level: </dt><dd className="inline">{report.backendProofLevel || 'UI_ONLY'}</dd></div>
          <div><dt className="inline font-semibold text-white/80">Runtime probes allowed: </dt><dd className="inline">{report.canRunRuntimeProbes ? 'YES' : 'NO'}</dd></div>
          <div><dt className="inline font-semibold text-white/80">Home visible: </dt><dd className="inline">{report.homeVisible ? 'YES' : 'NO'}</dd></div>
          <div><dt className="inline font-semibold text-white/80">Stored/auth session: </dt><dd className="inline">{report.authenticatedOrStoredSession ? 'YES' : 'NO'}</dd></div>
          <div><dt className="inline font-semibold text-white/80">App config: </dt><dd className="inline">{report.appConfigAvailable ? 'AVAILABLE' : 'MISSING'}</dd></div>
          <div><dt className="inline font-semibold text-white/80">Backend: </dt><dd className="inline">{report.backendAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}</dd></div>
          <div className="break-all"><dt className="inline font-semibold text-white/80">Base URL: </dt><dd className="inline">{report.configuredBaseUrl || 'not recorded'}</dd></div>
          <div className="break-all"><dt className="inline font-semibold text-white/80">Page origin: </dt><dd className="inline">{report.pageOrigin || 'not recorded'}</dd></div>
          <div><dt className="inline font-semibold text-white/80">Critical console summaries: </dt><dd className="inline">{report.criticalConsoleErrorCount || 0}</dd></div>
          <div><dt className="inline font-semibold text-white/80">Route: </dt><dd className="inline">{report.appRoute || 'not recorded'}</dd></div>
          <div className="sm:col-span-2"><dt className="inline font-semibold text-white/80">Service categories: </dt><dd className="inline">{Object.keys(report.serviceSummary || {}).join(', ') || 'none observed'}</dd></div>
          {report.serviceSummaryUnavailableReason && (
            <div className="sm:col-span-2"><dt className="inline font-semibold text-white/80">Backend observation: </dt><dd className="inline">{report.serviceSummaryUnavailableReason}</dd></div>
          )}
        </dl>
        {report.preflightStatusReason && <p className="mt-2 text-white/55">{report.preflightStatusReason}</p>}
        {(report.preflightLimitations || []).map((limitation) => (
          <p key={limitation} className="mt-1 text-white/45">{limitation}</p>
        ))}
        {report.preflight?.nextAction && (
          <p className="mt-2 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-2 text-amber-100/80">
            {report.preflight.nextAction}
          </p>
        )}
      </section>

      <div className="space-y-2" data-health-runtime-scenario-list="10">
        {RUNTIME_E2E_SCENARIOS.map((scenario, index) => {
          const result = report.scenarios.find((item) => item.scenarioId === scenario.scenarioId);
          const failedStep = result?.steps?.find((item) => item.status === AUTOMATION_STATUS.FAIL);
          const selected = selectedScenarioId === scenario.scenarioId;
          return (
            <details
              key={scenario.scenarioId}
              open={selected}
              onToggle={(event) => {
                if (event.currentTarget.open) setSelectedScenarioId(scenario.scenarioId);
              }}
              className="overflow-hidden rounded-md border border-white/10 bg-white/[0.035]"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-3 py-2">
                <span className="kronox-number w-6 shrink-0 text-center text-cyan-200">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight text-white">{scenario.title}</span>
                  <span className="mt-1 block text-[10px] text-white/50">
                    {result?.proofLevel || (result?.uiOnly ? 'UI_ONLY' : 'BACKEND_RUNTIME_PROBE')} · {result?.preflightDependency || 'not recorded'} · {result?.preflightDecision || 'NOT RECORDED'} · {durationLabel(result?.durationMs)}{failedStep ? ` · Hata: ${failedStep.title}` : ''}
                  </span>
                </span>
                <StatusBadge status={result?.status} />
                <ChevronDown className="h-4 w-4 shrink-0 text-white/45" />
              </summary>

              <div className="border-t border-white/10 px-3 py-3">
                <p className="text-xs leading-relaxed text-white/65">{scenario.description}</p>
                <div className="mt-2 grid gap-1 text-[10px] text-white/50 sm:grid-cols-2">
                  <span>Risk: {scenario.riskArea}</span>
                  <span>Maksimum: {durationLabel(scenario.maxExpectedDuration)}</span>
                  <span className="sm:col-span-2">Test kullanıcısı: {scenario.testUserStrategy}</span>
                  <span className="sm:col-span-2">Status reason: {result?.statusReason || result?.actual || 'Not recorded.'}</span>
                  <span className="sm:col-span-2">Backend evidence: {result?.backendEvidence?.safeSummary || 'No backend evidence recorded.'}</span>
                  {result?.blockReason && <span className="sm:col-span-2">Block reason: {result.blockReason}</span>}
                </div>

                <div
                  data-health-runtime-capabilities={result?.uiOnly ? 'ui-only' : 'backend-dependent'}
                  className="mt-3 flex flex-wrap gap-1.5"
                >
                  {(result?.capabilityStatus || []).map((capability) => (
                    <span
                      key={capability.name}
                      title={capability.reason}
                      className="rounded-md border border-white/10 bg-black/25 px-2 py-1 text-[9px] text-white/65"
                    >
                      {capability.name}: {capability.status}
                    </span>
                  ))}
                </div>

                <div className="mt-3 space-y-2" data-health-runtime-step-details="visible">
                  {scenario.steps.map((step, stepIndex) => {
                    const stepResult = result?.steps?.find((item) => item.id === step.id);
                    const failed = stepResult?.status === AUTOMATION_STATUS.FAIL;
                    return (
                      <div
                        key={step.id}
                        className="rounded-md border p-2"
                        style={{ borderColor: failed ? 'rgba(251,113,133,.55)' : 'rgba(255,255,255,.09)', background: failed ? 'rgba(244,63,94,.08)' : 'rgba(0,0,0,.18)' }}
                      >
                        <div className="flex flex-wrap items-start gap-2">
                          <span className="kronox-number text-[10px] text-white/45">{stepIndex + 1}</span>
                          <span className="min-w-0 flex-1 text-xs font-semibold text-white">{step.id} · {step.title}</span>
                          <StatusBadge status={stepResult?.status || AUTOMATION_STATUS.NOT_RUN} />
                        </div>
                        <dl className="mt-2 grid gap-1 text-[10px] leading-relaxed text-white/60">
                          <div><dt className="inline font-bold text-white/75">Action: </dt><dd className="inline">{step.action}</dd></div>
                          <div><dt className="inline font-bold text-white/75">Expected: </dt><dd className="inline">{step.expected}</dd></div>
                          <div><dt className="inline font-bold text-white/75">Actual: </dt><dd className="inline">{stepResult?.actual || 'Not executed.'}</dd></div>
                          <div><dt className="inline font-bold text-white/75">Selector: </dt><dd className="inline break-all">{stepResult?.selector || step.selector || 'none'}</dd></div>
                          <div><dt className="inline font-bold text-white/75">Route: </dt><dd className="inline">{stepResult?.route || 'none'}</dd></div>
                          <div><dt className="inline font-bold text-white/75">Artifacts: </dt><dd className="inline break-all">{stepResult?.screenshotPath || 'screenshot: none'} · {stepResult?.tracePath || 'trace: none'}</dd></div>
                        </dl>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={copySelectedFailure}
          disabled={!selectedIsIssue}
          className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-rose-300/25 bg-rose-300/10 px-3 text-sm font-semibold text-rose-100 disabled:opacity-40"
        >
          <FileJson className="h-4 w-4" /> Copy JSON - Automation Fail
        </button>
        <button
          type="button"
          onClick={copySetupGaps}
          disabled={!setupGapResults.length}
          data-health-copy-automation-setup-gap="true"
          className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 text-sm font-semibold text-amber-100 disabled:opacity-40"
        >
          <FileJson className="h-4 w-4" /> Copy JSON - Setup Gap
        </button>
        <button
          type="button"
          onClick={copyFullReport}
          data-health-copy-full-automation-report="true"
          className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.05] px-3 text-sm font-semibold text-white"
        >
          <FileJson className="h-4 w-4" /> Copy JSON - Full Automation Report
        </button>
        <button
          type="button"
          onClick={copyAllFailures}
          disabled={!failedResults.length && !setupGapResults.length}
          className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.05] px-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          <FileJson className="h-4 w-4" /> Copy JSON - All Automation Failures
        </button>
      </section>

      {message && <p role="status" className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/70">{message}</p>}
    </div>
  );
}
