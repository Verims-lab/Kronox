import React from 'react';

const tone = { PASS: 'text-emerald-300', FAIL: 'text-red-300', INCOMPLETE: 'text-amber-300' };

export default function IntegrityDuplicateChecks({ checks = [] }) {
  return (
    <section className="rounded-xl border border-white/10 bg-black/10 p-3">
      <h3 className="text-xs font-extrabold text-amber-200">Duplicate Key Report</h3>
      <p className="mt-1 text-[10px] text-muted-foreground">Örnek anahtarlar yalnızca geri döndürülemez fingerprint olarak gösterilir.</p>
      <div className="kx-contained-scroll mt-2 max-h-72 space-y-1 overflow-y-auto">
        {checks.map((check) => (
          <div key={check.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2 text-[11px]">
            <div className="min-w-0"><p className="truncate font-bold text-white">{check.id}</p><p className="text-muted-foreground">{check.entity} · {check.duplicateRowCount || 0} tekrar</p></div>
            <span className={`shrink-0 font-black ${tone[check.status] || tone.INCOMPLETE}`}>{check.status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}