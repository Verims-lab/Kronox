import React from 'react';

function ProofCard({ title, rows }) {
  return <section className="rounded-xl border border-white/10 bg-black/10 p-3"><h3 className="text-xs font-extrabold text-amber-200">{title}</h3><div className="mt-2 space-y-1">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3 text-[11px]"><span className="text-muted-foreground">{label}</span><span className="text-right font-bold text-white">{String(value)}</span></div>)}</div></section>;
}

export default function IntegrityProofSections({ snapshot = {} }) {
  const economy = snapshot.economy || {};
  const daily = snapshot.daily || {};
  const solo = snapshot.solo || {};
  const online = snapshot.online || {};
  const ledgerRows = ['diamondLedger', 'jokerLedger', 'hintLedger'].reduce((sum, key) => sum + (economy[key] || []).reduce((n, row) => n + Number(row.rowCount || 0), 0), 0);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <ProofCard title="Economy Ledger Proof" rows={[["Ledger satırı", ledgerRows], ["Kaynak modeli", "Ayrı earn/spend kaynakları"], ["Operation locks", (economy.operationLocks || []).length]]} />
      <ProofCard title="Daily Source Proof" rows={[["Görev kanıt türü", (daily.tasks || []).length], ["Bugünkü satır", daily.currentDayRows || 0], ["Duplicate risk", daily.duplicateReceiptRisk ? "Var" : "Yok"]]} />
      <ProofCard title="Solo Streak Proof" rows={[["Ödül receipt", solo.streakRewardReceipts || 0], ["Attempt proof", solo.attemptProof || "—"], ["Duplicate risk", solo.duplicateReceiptRisk ? "Var" : "Yok"]]} />
      <ProofCard title="Online Authority Proof" rows={[["Shared deck lobby", online.sharedDeckLobbyCount || 0], ["Applied result", online.appliedResultCount || 0], ["Kural", online.scoreRule || "—"]]} />
    </div>
  );
}