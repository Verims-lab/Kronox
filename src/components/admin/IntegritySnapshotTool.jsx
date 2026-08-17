import React, { useCallback, useState } from 'react';
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import AdminCollapsibleSection from '@/components/admin/AdminCollapsibleSection';
import IntegritySnapshotSummary from '@/components/admin/IntegritySnapshotSummary';
import IntegrityProofSections from '@/components/admin/IntegrityProofSections';
import IntegrityDuplicateChecks from '@/components/admin/IntegrityDuplicateChecks';

export default function IntegritySnapshotTool() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const response = await base44.functions.invoke('adminDuplicateKeyReport', { mode: 'dry_run', scanLimit: 1000 });
      const body = response?.data?.data || response?.data || {};
      if (!body?.ok || body?.readOnly !== true) throw new Error('integrity_report_unavailable');
      setReport(body);
    } catch {
      setError('Bütünlük özeti hazırlanamadı. Lütfen tekrar dene.');
    } finally { setLoading(false); }
  }, [loading]);
  const failed = report?.checks?.filter((item) => item.status === 'FAIL').length || 0;
  return (
    <AdminCollapsibleSection title="Integrity Snapshot" description="Ekonomi, tekrar ve kaynak kanıtı için salt okunur teknik özet." icon={loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />} summary={report ? `${failed} risk` : 'Açınca yüklenir'} onOpenChange={(open) => open && !report && load()} bodyClassName="space-y-3" data-admin-integrity-proof="read-only">
      <div className="flex justify-end"><Button size="sm" variant="outline" disabled={loading} onClick={load} aria-label="Bütünlük özetini yenile"><RefreshCw className={loading ? 'animate-spin' : ''} /></Button></div>
      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">{error}</p>}
      {!report && !error && <p role="status" className="text-xs text-muted-foreground">{loading ? 'Salt okunur rapor hazırlanıyor...' : 'Rapor henüz yüklenmedi.'}</p>}
      {report && <><IntegritySnapshotSummary report={report} /><IntegrityProofSections snapshot={report.integritySnapshot} /><IntegrityDuplicateChecks checks={report.checks} /></>}
    </AdminCollapsibleSection>
  );
}