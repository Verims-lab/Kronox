import React, { useCallback, useState } from 'react';
import { FileSearch, Loader2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import KronoxStatePanel from '@/components/ui/KronoxStatePanel';
import AdminCollapsibleSection from '@/components/admin/AdminCollapsibleSection';
import QuestionQualitySummary from '@/components/admin/QuestionQualitySummary';
import QuestionQualityCoverage from '@/components/admin/QuestionQualityCoverage';
import QuestionQualityTimeline from '@/components/admin/QuestionQualityTimeline';
import QuestionQualityRisks from '@/components/admin/QuestionQualityRisks';

export default function QuestionQualityTool() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true); setError('');
    try {
      const response = await base44.functions.invoke('adminDuplicateKeyReport', { mode: 'question_quality', scanLimit: 2000 });
      const body = response?.data?.data || response?.data || {};
      if (!body?.ok || body?.readOnly !== true || !body?.questionQualitySnapshot) throw new Error('report_unavailable');
      setSnapshot({ ...body.questionQualitySnapshot, scannedAt: body.scannedAt });
    } catch { setError('Soru kalite raporu hazırlanamadı.'); }
    finally { setLoading(false); }
  }, [loading]);
  return (
    <AdminCollapsibleSection title="Soru Kalite Raporu" description="Kategori, zorluk, yıl, tekrar ve içerik hazırlığı için salt okunur QA." icon={loading ? <Loader2 className="animate-spin" /> : <FileSearch />} summary={snapshot ? `${snapshot.totals?.active || 0} aktif` : 'Açınca yüklenir'} onOpenChange={(open) => open && !snapshot && load()} bodyClassName="space-y-3" data-admin-question-quality="read-only">
      <div className="flex items-center justify-between gap-2"><p className="text-[10px] text-muted-foreground">{snapshot?.scannedAt ? `Son yenileme: ${new Date(snapshot.scannedAt).toLocaleString('tr-TR')}` : 'Otomatik değişiklik yapmaz.'}</p><Button size="sm" variant="outline" disabled={loading} onClick={load} aria-label="Soru kalite raporunu yenile"><RefreshCw className={loading ? 'animate-spin' : ''} /></Button></div>
      {error && <KronoxStatePanel compact title="Soru kalite raporu yüklenemedi." message="Şu anda hazırlanamadı. Tekrar dene." actionLabel="Tekrar Dene" onAction={load} />}
      {!snapshot && !error && <p role="status" className="text-xs text-muted-foreground">{loading ? 'Salt okunur içerik QA hazırlanıyor...' : 'Rapor henüz yüklenmedi.'}</p>}
      {snapshot && <><QuestionQualitySummary snapshot={snapshot} /><QuestionQualityCoverage snapshot={snapshot} /><QuestionQualityTimeline snapshot={snapshot} /><QuestionQualityRisks snapshot={snapshot} /></>}
    </AdminCollapsibleSection>
  );
}