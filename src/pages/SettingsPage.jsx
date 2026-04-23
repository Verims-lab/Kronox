import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle, FileDown, Loader2, Lock, FlaskConical, ChevronRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import SimulationPanel from '@/components/game/SimulationPanel';

const ADMIN_EMAIL = 'sariverim@gmail.com';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState(false);
  const [downloadingWorkflow, setDownloadingWorkflow] = useState(false);
  const [showSim, setShowSim] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoadingUser(false);
    }).catch(() => setLoadingUser(false));
  }, []);

  const isAdmin = user?.email === ADMIN_EMAIL || user?.role === 'admin';

  const handleDeleteAccount = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await base44.auth.deleteAccount();
      base44.auth.logout('/');
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleDownloadDoc = async () => {
    setDownloadingDoc(true);
    try {
      const res = await base44.functions.fetch('/generateTechDoc', { method: 'POST' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'kronos-teknik-dokuman.pdf'; a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloadingDoc(false); }
  };

  const handleDownloadWorkflow = async () => {
    setDownloadingWorkflow(true);
    try {
      const res = await base44.functions.fetch('/generateWorkflowDoc', { method: 'POST' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'kronos-is-akisi.pdf'; a.click();
      URL.revokeObjectURL(url);
    } finally { setDownloadingWorkflow(false); }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 border border-border/50 flex items-center justify-center">
          <Lock className="w-7 h-7 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <p className="font-cinzel text-xl text-foreground tracking-wide">Erişim Kısıtlı</p>
          <p className="font-inter text-sm text-muted-foreground">Bu sayfa yalnızca admin kullanıcılara açıktır.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/')}>Ana Sayfaya Dön</Button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{
        paddingTop: 'calc(4rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
      }}
    >
      {/* Hero bar */}
      <div className="px-5 pb-6 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-cinzel text-lg text-foreground tracking-wider leading-tight">Admin Paneli</p>
            <p className="font-inter text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-5">

        {/* Admin Araçları */}
        <Section label="Araçlar">
          <ToolCard
            icon={<FileDown className="w-4 h-4" />}
            title="Teknik Döküman"
            desc="Sistem mimarisi ve veri modeli"
            loading={downloadingDoc}
            onClick={handleDownloadDoc}
          />
          <ToolCard
            icon={<FileDown className="w-4 h-4" />}
            title="İş Akışı Dökümanı"
            desc="Use case'ler ve süreç adımları"
            loading={downloadingWorkflow}
            onClick={handleDownloadWorkflow}
          />
          <ToolCard
            icon={<FlaskConical className="w-4 h-4" />}
            title="Online Simülasyonlar"
            desc="22 test senaryosunu çalıştır"
            onClick={() => setShowSim(true)}
          />
        </Section>

        {/* Hesap */}
        <Section label="Hesap">
          <AnimatePresence mode="wait">
            {!confirmDelete ? (
              <motion.button
                key="delete-btn"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={handleDeleteAccount}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-4 h-4 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="font-inter text-sm font-semibold text-destructive">Hesabı Sil</p>
                  <p className="font-inter text-xs text-muted-foreground">Tüm veriler kalıcı olarak silinir</p>
                </div>
                <ChevronRight className="w-4 h-4 text-destructive/50" />
              </motion.button>
            ) : (
              <motion.div
                key="delete-confirm"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="font-inter text-sm text-destructive leading-relaxed">
                    Bu işlem geri alınamaz. Tüm verileriniz silinecek.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm" className="flex-1"
                    onClick={() => setConfirmDelete(false)} disabled={deleting}
                  >İptal</Button>
                  <Button
                    size="sm" disabled={deleting}
                    className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={handleDeleteAccount}
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Evet, Sil'}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Section>
      </div>

      <AnimatePresence>
        {showSim && <SimulationPanel onClose={() => setShowSim(false)} />}
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