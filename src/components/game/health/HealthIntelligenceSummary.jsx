import React from 'react';

function Metric({ label, value }) {
  return <div className="rounded border border-white/10 bg-black/20 p-2"><div className="text-[9px] uppercase text-white/40">{label}</div><div className="kronox-number mt-1 text-sm text-white/80">{value || 0}</div></div>;
}

export default function HealthIntelligenceSummary({ report }) {
  const inventory = report.healthInventory || {};
  return (
    <section className="mt-3 rounded-md border border-cyan-300/15 bg-cyan-300/[0.04] p-3" data-health-intelligence-summary="true">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-bold uppercase tracking-wide text-cyan-100">Health Intelligence</h4><span className="text-[10px] text-white/45">{report.runPack?.label || 'Custom'} · {report.suiteCount || 0} suites · {report.totalDurationMs || 0}ms</span></div>
      <div className="mt-2 grid grid-cols-4 gap-1.5"><Metric label="Useful" value={inventory.useful} /><Metric label="Weak" value={inventory.weakProof} /><Metric label="Manual" value={inventory.manualExternal} /><Metric label="Missing target" value={inventory.missingTarget} /></div>
      <div className="mt-2 grid gap-1 sm:grid-cols-2">
        {(report.fixOwnershipSummary || []).map((group) => <div key={group.owner} className="rounded border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] text-white/65"><strong className="text-white/85">{group.owner}</strong> · {group.count}<span className="block text-white/40">{group.nextAction}</span></div>)}
      </div>
      <p className="mt-2 text-[10px] leading-4 text-white/45">On-demand Admin automation only. Scheduled/continuous monitoring still requires external automation or future platform support.</p>
    </section>
  );
}