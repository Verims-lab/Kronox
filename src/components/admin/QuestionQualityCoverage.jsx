import React from 'react';

export default function QuestionQualityCoverage({ snapshot }) {
  const difficulty = snapshot?.difficultyDistribution || {};
  const categories = snapshot?.categoryCoverage || [];
  return (
    <section className="rounded-xl border border-white/10 bg-black/10 p-3">
      <h3 className="text-xs font-extrabold text-amber-200">Kategori ve Zorluk Dağılımı</h3>
      <div className="mt-2 grid grid-cols-5 gap-1">{[1, 2, 3, 4, 5].map((level) => <div key={level} className="rounded-lg bg-white/[0.03] p-1.5 text-center"><p className="text-[9px] text-muted-foreground">Z{level}</p><p className="kronox-number text-sm font-bold text-white">{difficulty[level] || 0}</p></div>)}</div>
      <div className="kx-contained-scroll mt-2 max-h-64 space-y-1 overflow-y-auto">{categories.map((row) => <div key={row.categoryId} className="rounded-lg border border-white/5 px-2.5 py-2 text-[10px]"><div className="flex justify-between gap-2"><span className="truncate font-bold text-white">{row.categoryId} · {row.name}</span><span className="shrink-0 text-cyan-200">{row.activeQuestions} aktif</span></div><p className="mt-1 text-muted-foreground">Pasif {row.inactiveQuestions || 0} · Z1 {row.difficulty?.[1] || 0} · Z2 {row.difficulty?.[2] || 0} · Z3 {row.difficulty?.[3] || 0} · Z4 {row.difficulty?.[4] || 0} · Z5 {row.difficulty?.[5] || 0} · Online {row.onlineEligible || 0}</p></div>)}</div>
    </section>
  );
}