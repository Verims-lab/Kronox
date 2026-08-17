import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { RELEASE_BLOCKERS } from '@/lib/releaseReadiness';

export default function ReleaseBlockers() {
  return <section className="rounded-xl border border-red-400/20 bg-red-500/[0.06] p-3"><h3 className="flex items-center gap-2 text-xs font-extrabold text-red-100"><AlertTriangle className="h-4 w-4" />Bilinen Yayın Engelleri</h3><div className="mt-2 space-y-1">{RELEASE_BLOCKERS.map((item) => <p key={item} className="rounded-lg bg-black/10 px-2 py-2 text-[10px] leading-4 text-red-50/80">{item}</p>)}</div></section>;
}