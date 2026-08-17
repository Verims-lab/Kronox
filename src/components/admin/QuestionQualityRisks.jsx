import React from 'react';

export default function QuestionQualityRisks({ snapshot }) {
  const metadata = snapshot?.metadataCompleteness || {};
  const duplicates = snapshot?.duplicateRisk || {};
  const year = snapshot?.yearQuality || {};
  const taxonomy = snapshot?.taxonomy || {};
  const readiness = snapshot?.readiness || {};
  const rows = [
    ['Eksik metadata sinyali', metadata.totalMissingSignals], ['Geçersiz/eksik yıl', year.invalidOrMissingYearCount],
    ['Yoğun yıl kümesi', year.denseYearClusters?.length], ['Normalize tekrar riski', duplicates.normalizedQuestionText?.duplicateRowCount],
    ['Yıl/cevap/kategori tekrarı', duplicates.answerYearCategory?.duplicateRowCount], ['Yetim kategori referansı', taxonomy.unknownOrOrphanedQuestionCount],
    ['Aktif sorusu olmayan kategori', taxonomy.categoriesWithZeroActive], ['Az doldurulmuş kategori', taxonomy.categoriesUnderfilled],
    ['Aktif havuzda eksik yıl', readiness.highRiskActiveMissingYearCount],
  ];
  const readinessRows = [['Onboarding', readiness.onboardingReady], ['Solo havuzu', readiness.soloPoolReady], ['Online ortak deste', readiness.onlineSharedDeckReady]];
  return (
    <section className="rounded-xl border border-white/10 bg-black/10 p-3"><h3 className="text-xs font-extrabold text-amber-200">Riskler ve Oynanış Hazırlığı</h3><div className="mt-2 space-y-1">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3 text-[11px]"><span className="text-muted-foreground">{label}</span><span className="kronox-number font-bold text-white">{Number(value) || 0}</span></div>)}</div><div className="mt-3 grid grid-cols-3 gap-1">{readinessRows.map(([label, ready]) => <div key={label} className={`rounded-lg p-2 text-center text-[10px] font-bold ${ready ? 'bg-emerald-400/10 text-emerald-200' : 'bg-amber-400/10 text-amber-200'}`}>{label}<br />{ready ? 'Hazır' : 'İncele'}</div>)}</div></section>
  );
}