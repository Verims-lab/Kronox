import React from 'react';
import { AlertTriangle, Info, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';

/**
 * ReleaseReadinessExplainer
 * -------------------------
 * Visible, human-readable explanation of WHY a Health Simulator run with
 * 0 FAIL can still be "Not release-ready". This is explanation UI ONLY —
 * it does NOT change any case status. It reads `report.releaseReady` /
 * `report.manualGateStatus` from buildReport() and renders text.
 *
 * Honesty contract (must not be weakened):
 *  - 0 FAIL ≠ release-ready.
 *  - Critical NOT_AUTOMATABLE cases are explicitly listed as manual proof gaps
 *    until verified on real device / live DOM / two-account backend probe.
 *  - WARNING and BLOCKED are still visible risk states.
 *  - The component never claims a case "passed" if it did not actually pass.
 */
export default function ReleaseReadinessExplainer({ report }) {
  if (!report) return null;

  const counts = report.counts || {};
  const fail = counts.FAIL || 0;
  const error = counts.ERROR || 0;
  const blocked = counts.BLOCKED || 0;
  const warning = counts.WARNING || 0;
  const notAuto = counts.NOT_AUTOMATABLE || 0;
  const pass = counts.PASS || 0;

  const manualVerificationNeeded = Array.isArray(report.manualVerificationNeeded)
    ? report.manualVerificationNeeded
    : [];
  const realBlockerCount = Number(report.blockerSummary?.blockerCount || report.topBlockers?.length || 0);
  const score = report.score?.value ?? 0;
  const rating = report.score?.rating || 'Unknown';
  const isReleaseReady = report.releaseReady === true && fail === 0 && error === 0 && realBlockerCount === 0;

  return (
    <section
      className="mt-4 rounded-md border p-3 md:p-4"
      style={{
        borderColor: isReleaseReady ? 'rgba(74,222,128,0.40)' : 'rgba(250,204,21,0.45)',
        background: isReleaseReady ? 'rgba(74,222,128,0.06)' : 'rgba(250,204,21,0.05)',
      }}
    >
      <header className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md"
          style={{
            background: isReleaseReady ? 'rgba(74,222,128,0.18)' : 'rgba(250,204,21,0.18)',
            color: isReleaseReady ? '#4ade80' : '#facc15',
          }}
        >
          {isReleaseReady ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-wide text-white md:text-base">
            Release-Ready Durumu — {rating} ({score}/100)
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-white/75">
            {fail === 0 && error === 0 && realBlockerCount === 0 ? (
              <>
                <span className="font-semibold text-white">Kod blocker görünmüyor.</span>{' '}
                Manuel doğrulama gerektiren cihaz, canlı DOM, gesture veya iki hesaplı backend/RLS
                kontrolleri ayrı proof listesinde tutulur; bunlar Copy Blocker JSON'a girmez.
              </>
            ) : fail === 0 && error === 0 ? (
              <>
                <span className="font-semibold text-amber-100">Gerçek blocker var.</span>{' '}
                {realBlockerCount} BLOCKED/critical static case release öncesi çözülmeli; manuel
                doğrulama eksikleri ayrı proof listesinde tutulur.
              </>
            ) : (
              <>
                <span className="font-semibold text-rose-200">Tespit edilen kusur var.</span>{' '}
                {fail} FAIL, {error} ERROR. Bunlar release blocker'dır; düzeltilmeden çıkış yapılamaz.
              </>
            )}
          </p>
        </div>
      </header>

      {/* Status legend — what each bucket actually means */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <LegendRow
          Icon={XCircle}
          color="#fb7185"
          label={`FAIL: ${fail}`}
          desc="Doğrudan tespit edilmiş kusur. Release blocker."
        />
        <LegendRow
          Icon={ShieldAlert}
          color="#f43f5e"
          label={`ERROR: ${error}`}
          desc="Test çalıştırılamadı / kod hatası. Release blocker."
        />
        <LegendRow
          Icon={AlertTriangle}
          color="#facc15"
          label={`WARNING: ${warning}`}
          desc="Görünür risk; gözden geçirilmesi gerekir."
        />
        <LegendRow
          Icon={Info}
          color="#fb923c"
          label={`BLOCKED: ${blocked}`}
          desc="Bağımlılık eksik; çalıştırılamadı."
        />
        <LegendRow
          Icon={Info}
          color="#93c5fd"
          label={`NOT_AUTOMATABLE: ${notAuto}`}
          desc="Simülatör kanıtlayamaz. Manual proof; code blocker sayılmaz."
        />
        <LegendRow
          Icon={CheckCircle2}
          color="#4ade80"
          label={`PASS: ${pass}`}
          desc="Sadece simülatörün doğrulayabildiği kısım yeşildir."
        />
      </div>

      <div
        className="mt-3 rounded border p-2 text-[11px] leading-relaxed text-white/70"
        style={{ borderColor: 'rgba(147,197,253,0.30)', background: 'rgba(147,197,253,0.06)' }}
      >
        <span className="font-semibold text-blue-200">Kritik NOT_AUTOMATABLE</span>{' '}
        cases are <span className="font-semibold text-blue-200">manual proof required</span>,
        not copied as code blockers. Real device / live DOM / two-account backend proof still
        must be collected before release confidence.
        {report.score?.explanation && (
          <span className="mt-1 block text-white/60">
            {report.score.explanation}
          </span>
        )}
      </div>

      {/* Manual verification gaps */}
      <div className="mt-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-white/70">
          Manuel doğrulama eksikleri
        </h4>
        {manualVerificationNeeded.length === 0 ? (
          <p className="mt-2 text-xs text-white/55">
            Manuel doğrulama bekleyen case yok. Yine de iki cihazlı multiplayer ve iki hesaplı
            RLS smoke test'i release sürecinde korunmalı.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {manualVerificationNeeded.slice(0, 12).map((c) => (
              <li
                key={c.key || `${c.suiteId}.${c.id}`}
                className="flex items-start gap-2 rounded border border-white/10 bg-black/30 p-2 text-[11px] leading-relaxed text-white/75"
              >
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-300" />
                <span className="min-w-0">
                  <span className="font-semibold text-white">{c.name}</span>
                  <span className="text-white/45"> · {c.suiteName || c.suiteId}</span>
                  {c.reason && <span className="block text-white/55">{c.reason}</span>}
                </span>
              </li>
            ))}
            {manualVerificationNeeded.length > 12 && (
              <li className="text-[11px] text-white/45">
                + {manualVerificationNeeded.length - 12} more manual verification cases —
                see Manual Verification / Raw JSON.
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}

function LegendRow({ Icon, color, label, desc }) {
  return (
    <div className="flex items-start gap-2 rounded border border-white/10 bg-black/25 p-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color }} />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold" style={{ color }}>
          {label}
        </div>
        <div className="text-[11px] leading-snug text-white/60">{desc}</div>
      </div>
    </div>
  );
}
