import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle, Settings, FileDown, Loader2, Lock, FlaskConical } from 'lucide-react';
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
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await base44.auth.deleteAccount();
      base44.auth.logout('/');
    } catch (e) {
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
      a.href = url;
      a.download = 'kronos-teknik-dokuman.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingDoc(false);
    }
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        <div className="w-14 h-14 rounded-full bg-secondary/50 border border-border/50 flex items-center justify-center">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-cinzel text-lg text-foreground">Erişim Kısıtlı</p>
          <p className="font-inter text-sm text-muted-foreground">Bu sayfa yalnızca admin kullanıcılara açıktır.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/')}>Ana Sayfaya Dön</Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
      className="min-h-screen bg-background flex flex-col"
      style={{
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
        paddingLeft: '1.5rem',
        paddingRight: '1.5rem',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <h1 className="font-cinzel text-2xl text-foreground tracking-wider">Ayarlar</h1>
      </div>

      {/* Admin Araçları */}
      <div className="space-y-3 mb-6">
        <p className="text-xs text-muted-foreground font-inter uppercase tracking-widest">Admin Araçları</p>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleDownloadDoc}
          disabled={downloadingDoc}
        >
          {downloadingDoc ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Teknik Dökümanı İndir (PDF)
        </Button>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={async () => {
            setDownloadingWorkflow(true);
            try {
              const res = await base44.functions.fetch('/generateWorkflowDoc', { method: 'POST' });
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'kronos-is-akisi.pdf';
              a.click();
              URL.revokeObjectURL(url);
            } finally {
              setDownloadingWorkflow(false);
            }
          }}
          disabled={downloadingWorkflow}
        >
          {downloadingWorkflow ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          Is Akisi Dokumanini Indir (PDF)
        </Button>
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setShowSim(true)}
        >
          <FlaskConical className="w-4 h-4" />
          Online Oyun Simülasyonları
        </Button>
      </div>

      <AnimatePresence>
        {showSim && <SimulationPanel onClose={() => setShowSim(false)} />}
      </AnimatePresence>

      {/* Account section */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground font-inter uppercase tracking-widest">Hesap</p>

        {!confirmDelete ? (
          <Button
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 gap-2"
            onClick={handleDeleteAccount}
          >
            <Trash2 className="w-4 h-4" />
            Hesabı Sil
          </Button>
        ) : (
          <div className="space-y-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30">
            <div className="flex items-center gap-2 text-destructive text-sm font-inter">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Bu işlem geri alınamaz. Tüm verileriniz silinecek.</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
              >
                İptal
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Siliniyor…' : 'Evet, Sil'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}