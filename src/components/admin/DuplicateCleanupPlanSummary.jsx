import React from 'react';

const number = (value) => Math.max(0, Number(value) || 0).toLocaleString('tr-TR');

export default function DuplicateCleanupPlanSummary({ plan = {} }) {
  const summary = plan.summary || {};
  const metrics = [
    ['FAIL kontrol', summary.failingChecks],
    ['Duplicate grup', summary.totalDuplicateGroups],
    ['Fazla satır', summary.totalDuplicateRows],
    ['P0 grup', summary.p0DuplicateGroups],
    ['P1 grup', summary.p1DuplicateGroups],
    ['Review', summary.REVIEW_REQUIRED],
    ['Do not automate', summary.DO_NOT_AUTOMATE],
  ];
  return (
    <section className="rounded-xl border border-amber-300/20 bg-amber-400/5 p-3" aria-label="Duplicate cleanup dry-run özeti">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map(([label, value]) => <div key={label} className="rounded-lg bg-black/15 p-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="kronox-number text-base font-black text-white">{number(value)}</p></div>)}
      </div>
      <p className="mt-2 text-[11px] font-semibold text-amber-100">{plan.nextRecommendedAction}</p>
    </section>
  );
}