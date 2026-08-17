import React from 'react';
import { CircleDashed } from 'lucide-react';
import ReleaseStatusBadge from '@/components/admin/ReleaseStatusBadge';

export default function ReleaseChecklistGroup({ group }) {
  return <section className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="flex items-center justify-between gap-2"><h3 className="min-w-0 text-xs font-extrabold text-white">{group.title}</h3><ReleaseStatusBadge status={group.proof} /></div><div className="mt-2 space-y-1">{group.items.map((item) => <div key={item} className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-2 py-2"><CircleDashed className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" aria-hidden="true" /><span className="min-w-0 text-[10px] leading-4 text-muted-foreground">{item}</span><span className="ml-auto shrink-0 text-[9px] font-bold text-amber-200">Bekliyor</span></div>)}</div></section>;
}