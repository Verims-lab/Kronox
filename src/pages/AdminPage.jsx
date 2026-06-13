import React, { useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChevronRight, FileDown, FlaskConical, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import SimulationPanel from '@/components/game/SimulationPanel';
import SimulationPanelErrorBoundary from '@/components/game/SimulationPanelErrorBoundary';
import ResetUserProgressTool from '@/components/admin/ResetUserProgressTool';
import QuestionAnalyticsReportTool from '@/components/admin/QuestionAnalyticsReportTool';
import DailyQuestDefinitionManager from '@/components/admin/DailyQuestDefinitionManager';
import StandardTopBar from '@/components/layout/StandardTopBar';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import { AdminRefreshContext } from '@/lib/AdminRefreshContext';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';
import { useAuth } from '@/lib/AuthContext';

export default function AdminPage() {
  const { user, isLoadingAuth, adminStatus } = useAuth();
  const [downloadingDoc, setDownloadingDoc] = useState(false);
  const [downloadingWorkflow, setDownloadingWorkflow] = useState(false);
  const [docError, setDocError] = useState('');
  const [showSim, setShowSim] = useState(false);
  const adminRefreshersRef = useRef(new Set());

  const parsedAdminStatus = adminStatus?.parsedIsAdmin === true || user?.admin_status_debug?.parsedIsAdmin === true;
  const isAdmin = parsedAdminStatus;
  const diamondValue = getLeaderboardDiamondValue(user);

  const handleDownloadDoc = async () => {
    setDownloadingDoc(true);
    setDocError('');
    try {
      const res = await base44.functions.fetch('/generateTechDoc', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDocError(body?.error || 'Teknik doküman indirilemedi.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'kronox-teknik-dokuman.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDocError('Teknik doküman indirilemedi.');
    } finally { setDownloadingDoc(false); }
  };

  const handleDownloadWorkflow = async () => {
    setDownloadingWorkflow(true);
    try {
      const res = await base44.functions.fetch('/generateWorkflowDoc', { method: 'POST' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'kronox-is-akisi.pdf'; a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloadingWorkflow(false); }
  };

  const registerAdminRefresh = useCallback((refreshFn) => {
    if (typeof refreshFn !== 'function') return undefined;
    adminRefreshersRef.current.add(refreshFn);
    return () => {
      adminRefreshersRef.current.delete(refreshFn);
    };
  }, []);

  const refreshAdminMaintenanceLists = useCallback(async () => {
    const refreshers = Array.from(adminRefreshersRef.current);
    await Promise.all(refreshers.map((refreshFn) => refreshFn()));
  }, []);

  if (isLoadingAuth || adminStatus?.loading || adminStatus?.statusCall === 'pending') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        className="min-h-screen bg-background text-white"
        style={{
          minHeight: '100dvh',
          paddingTop: 'calc(4.5rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
        }}
      >
        <StandardTopBar diamonds={diamondValue} user={user} showBack />
        <div className="mx-auto flex min-h-[60dvh] w-full max-w-sm items-center justify-center px-5">
          <div className="rounded-3xl border border-primary/20 bg-secondary/20 p-6 text-center">
            <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h1 className="font-cinzel text-xl font-black tracking-widest text-primary">Admin Ekranı</h1>
            <p className="mt-3 font-inter text-sm text-muted-foreground">
              Bu alan yalnızca aktif admin/owner kullanıcılar içindir.
            </p>
            {!user && (
              <Button className="mt-5 w-full" onClick={() => base44.auth.redirectToLogin('/admin')}>
                Giriş Yap
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background text-white"
      style={{
        minHeight: '100dvh',
        boxSizing: 'border-box',
        paddingTop: 'calc(4.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
        userSelect: 'none',
      }}
    >
      <StandardTopBar diamonds={diamondValue} user={user} showBack />

      <div className="px-4 pb-1">
        <h1 className="font-cinzel text-2xl font-black tracking-wide text-foreground">Admin Ekranı</h1>
        <p className="mt-1 font-inter text-xs font-semibold text-muted-foreground">
          Yalnızca aktif AdminUser owner/admin araçları.
        </p>
      </div>

      <PullToRefresh onRefresh={refreshAdminMaintenanceLists}>
        <div className="px-4 space-y-5">
          <Section label="Araçlar">
            <AdminRefreshContext.Provider value={registerAdminRefresh}>
              <ToolCard
                icon={<FileDown className="w-4 h-4" />}
                title="Teknik Döküman"
                desc="Sistem mimarisi ve veri modeli"
                loading={downloadingDoc}
                onClick={handleDownloadDoc}
              />
              {docError && (
                <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100">
                  {docError}
                </p>
              )}
              <ToolCard
                icon={<FileDown className="w-4 h-4" />}
                title="İş Akışı Dökümanı"
                desc="Use case'ler ve süreç adımları"
                loading={downloadingWorkflow}
                onClick={handleDownloadWorkflow}
              />
              <ToolCard
                icon={<FlaskConical className="w-4 h-4" />}
                title="Kronox Health Simulator"
                desc="Brutally honest mobile, gameplay, sync, and release-risk checks"
                onClick={() => setShowSim(true)}
              />
              <QuestionAnalyticsReportTool />
              <DailyQuestDefinitionManager />
              <ResetUserProgressTool />
            </AdminRefreshContext.Provider>
          </Section>
        </div>
      </PullToRefresh>

      <AnimatePresence>
        {showSim && (
          <SimulationPanelErrorBoundary onClose={() => setShowSim(false)}>
            <SimulationPanel onClose={() => setShowSim(false)} />
          </SimulationPanelErrorBoundary>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="space-y-2">
      <p className="font-inter text-[10px] text-muted-foreground font-semibold uppercase tracking-widest px-1">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ToolCard({ icon, title, desc, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center gap-3 p-4 rounded-2xl border border-border/40 bg-secondary/20 hover:bg-secondary/40 hover:border-border/70 transition-all text-left disabled:opacity-60"
    >
      <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-primary">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      </div>
      <div className="flex-1">
        <p className="font-inter text-sm font-semibold text-foreground">{title}</p>
        <p className="font-inter text-xs text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
    </button>
  );
}
