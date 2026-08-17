import React from 'react';
import ReleaseStatusBadge from '@/components/admin/ReleaseStatusBadge';

const ROWS = [
  ['VAPID üretim yapılandırması', 'Bu ortamda doğrulanmadı', 'Manuel'],
  ['Üretim secret değerleri', 'Asla gösterilmez', 'Harici'],
  ['RLS / çoklu hesap izolasyonu', 'Canlı hesap kanıtı gerekli', 'Manuel'],
  ['Platform unique indexleri', 'Platform kanıtı gerekli', 'Harici'],
];

export default function ReleaseSecuritySummary() {
  return <section className="rounded-xl border border-white/10 bg-black/10 p-3" data-release-secret-values="never-rendered"><h3 className="text-xs font-extrabold text-cyan-100">Güvenlik / Secret Kanıtı</h3><div className="mt-2 space-y-1">{ROWS.map(([label, value, status]) => <div key={label} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-2"><span className="min-w-0 flex-1 text-[10px] text-muted-foreground">{label}<strong className="ml-1 text-white">{value}</strong></span><ReleaseStatusBadge status={status} /></div>)}</div></section>;
}