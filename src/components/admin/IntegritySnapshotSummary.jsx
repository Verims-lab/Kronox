import React from 'react';

const number = (value) => Math.max(0, Number(value) || 0).toLocaleString('tr-TR');

export default function IntegritySnapshotSummary({ report }) {
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  const duplicateRows = checks.reduce((sum, item) => sum + (Number(item.duplicateRowCount) || 0), 0);
  const incomplete = checks.filter((item) => item.status === 'INCOMPLETE').length;
  const metrics = [
    ['Kontrol', checks.length],
    ['Tekrar satırı', duplicateRows],
    ['Eksik tarama', incomplete],
  ];
  return (
    <section className="rounded-xl border border-emerald-300/20 bg-emerald-400/5 p-3" aria-label="Bütünlük özeti">
      <div className="grid grid-cols-3 gap-2">
        {metrics.map(([label, value]) => <div key={label} className="rounded-lg bg-black/15 p-2 text-center"><p className="text-[10px] text-muted-foreground">{label}</p><p className="kronox-number text-lg font-black text-white">{number(value)}</p></div>)}
      </div>
      <p className="mt-2 text-[11px] text-emerald-100/80">Dry-run · Salt okunur · Satır/bakiye değişikliği yok</p>
    </section>
  );
}