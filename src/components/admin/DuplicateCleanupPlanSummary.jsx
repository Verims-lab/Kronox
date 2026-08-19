import React from 'react';

const number = (value) => Math.max(0, Number(value) || 0).toLocaleString('tr-TR');

export default function DuplicateCleanupPlanSummary({ plan = {} }) {
  const summary = plan.summary || {};
  const p0 = summary.p0Eligibility || {};
  const metrics = [
    ['P0 grup', summary.p0DuplicateGroups],
    ['AUTO SAFE', p0.AUTO_SAFE_CANDIDATE],
    ['REVIEW REQUIRED', p0.REVIEW_REQUIRED],
    ['DO NOT AUTOMATE', p0.DO_NOT_AUTOMATE],
    ['P1 grup', summary.p1DuplicateGroups],
    ['Fazla satır', summary.totalDuplicateRows],
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