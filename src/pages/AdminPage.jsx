import React, { Suspense, useCallback, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChevronRight, FileDown, FlaskConical, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import ResetUserProgressTool from '@/components/admin/ResetUserProgressTool';
import QuestionAnalyticsReportTool from '@/components/admin/QuestionAnalyticsReportTool';
import UserReportTool from '@/components/admin/UserReportTool';
import InactiveGuestCleanupTool from '@/components/admin/InactiveGuestCleanupTool';
import AdminDiamondGrantTool from '@/components/admin/AdminDiamondGrantTool';
import AdminDailyWheelResetTool from '@/components/admin/AdminDailyWheelResetTool';
import StandardTopBar from '@/components/layout/StandardTopBar';
import PullToRefresh from '@/components/mobile/PullToRefresh';
import { AdminRefreshContext } from '@/lib/AdminRefreshContext';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';
import { useAuth } from '@/lib/AuthContext';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import {
  ADMIN_PAGE_SUBTITLE_CLASS,
  ADMIN_PAGE_TITLE_CLASS,
  ADMIN_SECTION_LABEL_CLASS,
  ADMIN_TOOL_CARD_CLASS,
  ADMIN_TOOL_CHEVRON_CLASS,
  ADMIN_TOOL_DESCRIPTION_CLASS,
  ADMIN_TOOL_HEADER_BUTTON_CLASS,
  ADMIN_TOOL_ICON_CLASS,
  ADMIN_TOOL_TITLE_CLASS,
} from '@/components/admin/adminVisualStyles';

const SimulationPanel = lazyWithRetry(() => import('@/components/game/SimulationPanel'), 'SimulationPanel');
const SimulationPanelErrorBoundary = lazyWithRetry(
  () => import('@/components/game/SimulationPanelErrorBoundary'),
  'SimulationPanelErrorBoundary',
);
const ADMIN_PAGE_TITLE = 'Admin Ekranı';

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
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="Admin yetkisi kontrol ediliyor"
      >
        <Loader2 className="w-6 h-6 text-primary animate-spin" aria-hidden="true" />
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
            <h1 className={ADMIN_PAGE_TITLE_CLASS}>{ADMIN_PAGE_TITLE}</h1>
            <p className={ADMIN_PAGE_SUBTITLE_CLASS}>
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
        <h1 className={ADMIN_PAGE_TITLE_CLASS}>{ADMIN_PAGE_TITLE}</h1>
        <p className={ADMIN_PAGE_SUBTITLE_CLASS}>
          Yalnızca aktif AdminUser owner/admin araçları.
        </p>
      </div>

      <PullToRefresh onRefresh={refreshAdminMaintenanceLists}>
        <div className="px-4 space-y-5">
          <Section label="ARAÇLAR">
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
              <UserReportTool />
              <AdminDiamondGrantTool />
              <AdminDailyWheelResetTool />
              <InactiveGuestCleanupTool />
              <ResetUserProgressTool />
            </AdminRefreshContext.Provider>
          </Section>
        </div>
      </PullToRefresh>

      <AnimatePresence>
        {showSim && (
          <Suspense fallback={<AdminToolLoading />}>
            <SimulationPanelErrorBoundary onClose={() => setShowSim(false)}>
              <SimulationPanel onClose={() => setShowSim(false)} />
            </SimulationPanelErrorBoundary>
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminToolLoading() {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/80"
      role="status"
      aria-live="polite"
      aria-label="Admin aracı yükleniyor"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="space-y-2">
      <p className={ADMIN_SECTION_LABEL_CLASS}>{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ToolCard({ icon, title, desc, loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-full ${ADMIN_TOOL_CARD_CLASS} ${ADMIN_TOOL_HEADER_BUTTON_CLASS}`}
      data-admin-standard-card
    >
      <div className={ADMIN_TOOL_ICON_CLASS}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className={ADMIN_TOOL_TITLE_CLASS}>{title}</p>
        <p className={ADMIN_TOOL_DESCRIPTION_CLASS}>{desc}</p>
      </div>
      <ChevronRight className={ADMIN_TOOL_CHEVRON_CLASS} />
    </button>
  );
}
