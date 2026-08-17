import React from 'react';

const n = (value) => Math.max(0, Number(value) || 0).toLocaleString('tr-TR');
export default function QuestionQualitySummary({ snapshot }) {
  const totals = snapshot?.totals || {};
  const readiness = snapshot?.readiness || {};
  const metrics = [
    ['Toplam', totals.total], ['Aktif', totals.active], ['Pasif/Taslak', (totals.inactive || 0) + (totals.draftOrUnknown || 0)],
    ['Online uygun', readiness.onlineEligibleCount], ['Solo uygun', readiness.soloEligibleCount], ['Son 30 gün', totals.recentUpdated30Days],
  ];
  return (
    <section className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-3" aria-label="Soru kalite özeti">
      <div className="grid grid-cols-3 gap-2">{metrics.map(([label, value]) => <div key={label} className="rounded-lg bg-black/15 p-2 text-center"><p className="text-[9px] text-muted-foreground">{label}</p><p className="kronox-number text-base font-black text-white">{n(value)}</p></div>)}</div>
      <p className="mt-2 text-[10px] text-cyan-100/75">Salt okunur · {snapshot.scanWindowComplete ? 'Tarama tamamlandı' : 'Tarama üst sınıra ulaştı'}</p>
    </section>
  );
}