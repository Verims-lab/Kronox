import React from 'react';
import DuplicateCleanupPlanCheck from '@/components/admin/DuplicateCleanupPlanCheck';
import DuplicateCleanupPlanSummary from '@/components/admin/DuplicateCleanupPlanSummary';

export default function DuplicateCleanupPlan({ plan }) {
  if (!plan) return null;
  const failing = (plan.checks || []).filter((check) => check.status !== 'PASS');
  return (
    <section className="space-y-2" data-admin-duplicate-cleanup-plan="dry-run-read-only">
      <div className="rounded-xl border border-sky-300/20 bg-sky-400/5 p-3">
        <h3 className="text-xs font-extrabold text-sky-200">Veri Temizliği Planı — Dry Run</h3>
        <p className="mt-1 text-[10px] text-muted-foreground">Salt okunur analiz. Örnekler yalnızca geri döndürülemez fingerprint içerir; ham satır veya özel kimlik gösterilmez.</p>
        <p className="mt-2 text-[11px] font-bold text-amber-100">Yürütme engelli</p>
        <p className="mt-1 text-[11px] font-semibold text-amber-100/80">{plan.approvalBoundary}</p>
      </div>
      <DuplicateCleanupPlanSummary plan={plan} />
      <div className="kx-contained-scroll max-h-[32rem] space-y-2 overflow-y-auto">{failing.map((check) => <DuplicateCleanupPlanCheck key={check.checkId} check={check} />)}</div>
    </section>
  );
}