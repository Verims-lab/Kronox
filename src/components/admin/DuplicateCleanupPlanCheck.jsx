import React from 'react';
import DuplicateEligibilityReview from '@/components/admin/DuplicateEligibilityReview';

const riskTone = { P0: 'text-red-300', P1: 'text-amber-300', P2: 'text-sky-300' };

export default function DuplicateCleanupPlanCheck({ check }) {
  return (
    <article className="rounded-xl border border-white/10 bg-black/10 p-3" data-cleanup-plan-check={check.checkId}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h4 className="truncate text-xs font-extrabold text-white">{check.entity}</h4><p className="truncate text-[10px] text-muted-foreground">{check.duplicateKeyName}</p></div>
        <div className="text-right"><p className={`text-xs font-black ${riskTone[check.riskLevel] || riskTone.P2}`}>{check.riskLevel}</p><p className="text-[10px] font-bold text-red-200">{check.status}</p></div>
      </div>
      <p className="mt-2 text-[11px] text-white"><b>{check.duplicateGroupCount}</b> grup · <b>{check.duplicateRowCount}</b> fazla satır</p>
      <dl className="mt-2 space-y-1 text-[10px]"><div><dt className="font-bold text-amber-200">Kanonik strateji</dt><dd className="text-muted-foreground">{check.canonicalStrategyName} — {check.canonicalStrategy}</dd></div><div><dt className="font-bold text-amber-200">Öneri</dt><dd className="text-muted-foreground">{check.recommendedAction}</dd></div><div><dt className="font-bold text-amber-200">Risk</dt><dd className="text-muted-foreground">{check.relatedRuntimeRisk}</dd></div></dl>
      <div className="mt-2 space-y-1">{(check.groupReviews || []).map((review) => <DuplicateEligibilityReview key={review.fingerprintKey} review={review} />)}</div>
      <p className="mt-2 text-[10px] font-bold text-amber-100">Yürütme engelli · Temizlik ayrı onaylı görev gerektirir.</p>
    </article>
  );
}