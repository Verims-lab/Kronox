import React from 'react';
import { ClipboardCheck } from 'lucide-react';
import AdminCollapsibleSection from '@/components/admin/AdminCollapsibleSection';
import ReleaseHealthSummary from '@/components/admin/ReleaseHealthSummary';
import ReleaseDeployabilitySummary from '@/components/admin/ReleaseDeployabilitySummary';
import ReleaseChecklistGroup from '@/components/admin/ReleaseChecklistGroup';
import ReleaseProofLinks from '@/components/admin/ReleaseProofLinks';
import ReleaseSecuritySummary from '@/components/admin/ReleaseSecuritySummary';
import ReleaseBlockers from '@/components/admin/ReleaseBlockers';
import { RELEASE_CHECKLIST_GROUPS } from '@/lib/releaseReadiness';
import { KRONOX_BUILD_MARKER } from '@/components/dev/BuildMarker';

export default function ReleaseReadinessTool() {
  const manualRequired = RELEASE_CHECKLIST_GROUPS.reduce((total, group) => total + group.items.length, 0);
  return <AdminCollapsibleSection title="Yayın Hazırlığı" description="Manuel, harici ve otomatik kanıt sınırları için salt okunur takip paneli." icon={<ClipboardCheck />} summary={`${manualRequired} kanıt bekliyor`} bodyClassName="space-y-3" data-admin-release-readiness="read-only" data-release-mutation="none" data-release-deployment="manual-only"><div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-3 text-[10px] leading-4 text-amber-50"><strong>Takip paneli, kanıtın kendisi değildir.</strong> Durumlar: Bekliyor · Geçti (kanıt sonrası) · Engelli · Uygulanamaz. Üretim deploy, gerçek cihaz, RLS/çoklu hesap, platform indexleri ve üretim secret provisioning harici veya manuel doğrulama gerektirir.</div><ReleaseHealthSummary /><ReleaseDeployabilitySummary /><ReleaseSecuritySummary /><ReleaseProofLinks />{RELEASE_CHECKLIST_GROUPS.map((group) => <ReleaseChecklistGroup key={group.title} group={group} />)}<ReleaseBlockers /><p className="text-center text-[9px] text-muted-foreground">Son güncelleme: {KRONOX_BUILD_MARKER} · Durumlar kalıcı olarak yazılmaz.</p></AdminCollapsibleSection>;
}