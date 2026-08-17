import React from 'react';

export default function QuestionQualityTimeline({ snapshot }) {
  const years = snapshot?.yearQuality?.distribution?.slice(0, 10) || [];
  const subcategories = snapshot?.subcategoryDistribution?.slice(0, 8) || [];
  const metadata = snapshot?.metadataCompleteness || {};
  const gaps = [
    ['Soru', metadata.questionText], ['Cevap', metadata.answerText], ['Yıl', metadata.year], ['Kategori', metadata.category],
    ['Alt kategori', metadata.subcategory], ['Etiket', metadata.tag], ['Zorluk', metadata.difficulty], ['Durum', metadata.state],
  ];
  return (
    <section className="rounded-xl border border-white/10 bg-black/10 p-3">
      <h3 className="text-xs font-extrabold text-amber-200">Yıl ve Metadata Tamlığı</h3>
      <p className="mt-2 text-[10px] text-muted-foreground">En yoğun yıllar</p>
      <div className="mt-1 flex flex-wrap gap-1">{years.map((row) => <span key={row.year} className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-white">{row.year} · {row.count}</span>)}</div>
      <p className="mt-3 text-[10px] text-muted-foreground">Alt kategori kapsamı</p>
      <div className="mt-1 flex flex-wrap gap-1">{subcategories.map((row) => <span key={row.name} className="max-w-full truncate rounded-full bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-100">{row.name} · {row.count}</span>)}</div>
      <div className="mt-3 grid grid-cols-2 gap-1">{gaps.map(([label, value]) => <div key={label} className="flex justify-between rounded-lg bg-white/[0.03] px-2 py-1 text-[10px]"><span className="text-muted-foreground">Eksik {label}</span><span className="font-bold text-white">{Number(value) || 0}</span></div>)}</div>
    </section>
  );
}