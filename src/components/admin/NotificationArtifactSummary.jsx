import React from 'react';

const count = (value) => Math.max(0, Number(value) || 0).toLocaleString('tr-TR');

export default function NotificationArtifactSummary({ snapshot }) {
  if (!snapshot) return null;
  const samples = Array.isArray(snapshot.samples) ? snapshot.samples.slice(0, 3) : [];
  return (
    <section
      className="rounded-xl border border-amber-300/20 bg-amber-400/5 p-3"
      aria-label="Bildirim artifakt özeti"
      data-notification-artifact-recovery="report-only"
    >
      <p className="text-xs font-black text-amber-100">Bildirim artifaktları</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <Metric label="Kabul" value={snapshot.acceptedInviteCount} />
        <Metric label="Eski" value={snapshot.staleAcceptedCount} />
        <Metric label="Test işaretli" value={snapshot.explicitTestArtifactCount} />
      </div>
      {samples.length > 0 && (
        <div className="mt-2 space-y-1" aria-label="Geri döndürülemez artifakt fingerprint örnekleri">
          {samples.map((sample) => (
            <p key={sample.fingerprint} className="font-mono text-[10px] text-amber-100/70">
              {sample.fingerprint} · {count(sample.count)} kayıt
            </p>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] font-semibold text-amber-100/80">Dry-run · Salt okunur · Rapor-only</p>
      <p className="mt-1 text-[11px] font-black text-amber-200">Otomatik silme yok · Yürütme engelli</p>
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-lg bg-black/15 p-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="kronox-number text-lg font-black text-white">{count(value)}</p></div>;
}