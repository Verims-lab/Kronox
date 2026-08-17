import React from 'react';
import { RELEASE_HEALTH_GROUPS } from '@/lib/releaseReadiness';
import ReleaseStatusBadge from '@/components/admin/ReleaseStatusBadge';

export default function ReleaseHealthSummary() {
  return <section className="rounded-xl border border-white/10 bg-black/10 p-3" data-release-health-status="not-faked"><div className="flex items-start justify-between gap-2"><div><h3 className="text-xs font-extrabold text-cyan-100">Health Durumu</h3><p className="mt-1 text-[10px] text-muted-foreground">Canlı sonuç yok. Health PASS yayın kanıtı değildir.</p></div><ReleaseStatusBadge status="Koşum gerekli" /></div><div className="mt-3 grid grid-cols-2 gap-1">{RELEASE_HEALTH_GROUPS.map((group) => <div key={group.label} className="rounded-lg bg-white/[0.03] px-2 py-2"><p className="truncate text-[10px] font-bold text-white">{group.label}</p><p className="mt-0.5 text-[9px] text-amber-200">{group.status}</p></div>)}</div></section>;
}