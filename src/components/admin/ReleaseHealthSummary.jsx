import React, { useEffect, useState } from 'react';
import { RELEASE_HEALTH_GROUPS } from '@/lib/releaseReadiness';
import ReleaseStatusBadge from '@/components/admin/ReleaseStatusBadge';
import { LAST_RUN_KEY } from '@/components/game/health/healthStatus';

function readLatestHealth() {
  try {
    const value = JSON.parse(localStorage.getItem(LAST_RUN_KEY) || 'null');
    return value?.runState === 'completed' ? value : null;
  } catch { return null; }
}

export default function ReleaseHealthSummary() {
  const [latest, setLatest] = useState(readLatestHealth);
  useEffect(() => {
    const refresh = () => setLatest(readLatestHealth());
    window.addEventListener('kronox-health-run-completed', refresh);
    return () => window.removeEventListener('kronox-health-run-completed', refresh);
  }, []);
  return <section className="rounded-xl border border-white/10 bg-black/10 p-3" data-release-health-status="not-faked"><div className="flex items-start justify-between gap-2"><div><h3 className="text-xs font-extrabold text-cyan-100">Health Durumu</h3><p className="mt-1 text-[10px] text-muted-foreground">Health PASS yayın kanıtı değildir.</p></div><ReleaseStatusBadge status={latest ? 'Son koşum var' : 'Koşum gerekli'} /></div>{!latest && <p className="mt-2 text-[10px] font-semibold text-amber-200">Canlı sonuç yok</p>}{latest && <div className="mt-2 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-2 text-[9px] text-cyan-50"><strong>{latest.runPack?.label || 'Custom'}</strong> · {latest.runId} · {latest.buildMarker}<span className="block text-muted-foreground">{latest.blockerSummary?.blockerCount || 0} blocker · {latest.blockerSummary?.warningCount || 0} warning · {latest.blockerSummary?.manualRequiredCount || 0} manual · {latest.totalDurationMs || 0}ms</span></div>}<div className="mt-3 grid grid-cols-2 gap-1">{RELEASE_HEALTH_GROUPS.map((group) => <div key={group.label} className="rounded-lg bg-white/[0.03] px-2 py-2"><p className="truncate text-[10px] font-bold text-white">{group.label}</p><p className="mt-0.5 text-[9px] text-amber-200">{group.status}</p></div>)}</div></section>;
}