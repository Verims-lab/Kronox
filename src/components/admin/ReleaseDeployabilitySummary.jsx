import React from 'react';
import { RELEASE_DEPLOYABILITY } from '@/lib/releaseReadiness';
import { KRONOX_BUILD_MARKER } from '@/components/dev/BuildMarker';
import ReleaseStatusBadge from '@/components/admin/ReleaseStatusBadge';

export default function ReleaseDeployabilitySummary() {
  const rows = [
    ['Base44 fonksiyon sınırı', `${RELEASE_DEPLOYABILITY.functionCount} / ${RELEASE_DEPLOYABILITY.functionLimit}`, 'Bekliyor'],
    ['Frontend SDK', RELEASE_DEPLOYABILITY.currentSdk, RELEASE_DEPLOYABILITY.sdkStatus],
    ['Deploy SDK politikası', RELEASE_DEPLOYABILITY.expectedSdk, RELEASE_DEPLOYABILITY.sdkStatus],
    ['Package-lock', RELEASE_DEPLOYABILITY.packageLockStatus, 'Engelli'],
    ['Backend compile kanıtı', RELEASE_DEPLOYABILITY.backendCompile, 'Manuel'],
    ['Build Marker', KRONOX_BUILD_MARKER, 'Bekliyor'],
    ['Otomatik deploy', RELEASE_DEPLOYABILITY.deployment, 'Harici'],
  ];
  return <section className="rounded-xl border border-white/10 bg-black/10 p-3" data-release-deployability="50-of-50"><h3 className="text-xs font-extrabold text-amber-200">Deployability Özeti</h3><div className="mt-2 space-y-1">{rows.map(([label, value, status]) => <div key={label} className="flex min-w-0 items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-2 text-[10px]"><span className="min-w-0 flex-1 text-muted-foreground">{label}<strong className="ml-1 text-white">{value}</strong></span><ReleaseStatusBadge status={status} /></div>)}</div></section>;
}