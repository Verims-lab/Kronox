import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle, Loader2, ChevronRight, FileText, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import StandardTopBar from '@/components/layout/StandardTopBar';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';
import { ACCOUNT_DELETION_ERROR_COPY, requestAccountDeletion } from '@/lib/accountDeletion';
import { useAuth } from '@/lib/AuthContext';

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoadingAuth } = useAuth();
  const accountSectionRef = useRef(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const effectiveUser = user;
  const diamondValue = getLeaderboardDiamondValue(effectiveUser);
  const shouldFocusDeleteAccount = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('focus') === 'delete' || location.state?.focusDeleteAccount === true;
  }, [location.search, location.state?.focusDeleteAccount]);

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (isLoadingAuth || !shouldFocusDeleteAccount) return;
    const frameId = window.requestAnimationFrame(() => {
      accountSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isLoadingAuth, shouldFocusDeleteAccount]);

  const handleDeleteAccount = async () => {
    setDeleteError('');
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      await requestAccountDeletion(base44, user);
      base44.auth.logout('/');
    } catch (error) {
      setDeleting(false);
      setDeleteError(error?.message || ACCOUNT_DELETION_ERROR_COPY);
    }
  };

  if (isLoadingAuth) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="Ayarlar yükleniyor"
      >
        <Loader2 className="w-6 h-6 text-primary animate-spin" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{
        minHeight: '100dvh',
        boxSizing: 'border-box',
        paddingTop: 'calc(4.5rem + env(safe-area-inset-top))',
        paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',
        userSelect: 'none',
      }}
    >
      <StandardTopBar diamonds={diamondValue} user={user} showBack />

      <div className="mx-auto w-full max-w-md px-4 pb-1">
        <h1 className="font-cinzel text-2xl font-black tracking-wide text-foreground">Ayarlar</h1>
      </div>

      <div className="mx-auto w-full max-w-md px-4 space-y-5">
        <Section label="Ayarlar ve Güvenlik">
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              background: 'linear-gradient(180deg, rgba(30,41,75,0.9), rgba(10,16,36,0.95))',
              boxShadow:
                'inset 0 0 0 1.5px rgba(120,170,255,0.32), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 16px rgba(59,130,246,0.18), 0 8px 16px rgba(2,6,23,0.45)',
            }}
          >
            <SettingsListRow
              icon={<FileText className="h-4 w-4" />}
              title="Gizlilik Politikası"
              desc="Veri kullanımı ve hakların"
              onClick={() => navigate('/privacy')}
            />
            <SettingsListRow
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Hesap Silme"
              desc={effectiveUser ? 'Kalıcı silme işlemini başlat' : 'Bilgi ve destek kanalı'}
              onClick={() => (effectiveUser ? scrollToSection(accountSectionRef) : navigate('/account-deletion'))}
              danger={Boolean(effectiveUser)}
              isLast
            />
          </div>
        </Section>

        {/* Hesap — oturum açmış kullanıcılar */}
        {effectiveUser && (
          <div ref={accountSectionRef}>
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
                    {deleteError && (
                      <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 font-inter text-xs font-semibold text-destructive">
                        {deleteError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline" size="sm" className="flex-1"
                        onClick={() => { setConfirmDelete(false); setDeleteError(''); }} disabled={deleting}
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
        )}
      </div>

    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="space-y-2">
      <p className="font-inter text-[10px] text-blue-100/60 font-black uppercase tracking-[0.18em] px-1">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SettingsListRow({ icon, title, desc, onClick, danger = false, isLast = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.05] active:bg-white/[0.07] ${!isLast ? 'border-b border-white/[0.06]' : ''}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${danger ? 'text-destructive' : 'text-amber-200'}`}
        style={{
          background: danger
            ? 'linear-gradient(180deg, rgba(239,68,68,0.16), rgba(127,29,29,0.10))'
            : 'linear-gradient(180deg, rgba(250,204,21,0.16), rgba(185,122,6,0.10))',
          boxShadow: danger
            ? 'inset 0 0 0 1px rgba(248,113,113,0.40)'
            : 'inset 0 0 0 1px rgba(250,204,21,0.45)',
        }}
      >
        {icon || <SlidersHorizontal className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-inter text-sm font-bold ${danger ? 'text-destructive' : 'text-white'}`}>{title}</p>
        {desc && <p className="truncate font-inter text-[11px] text-blue-100/70">{desc}</p>}
      </div>
      <ChevronRight className={`h-4 w-4 ${danger ? 'text-destructive/50' : 'text-white/40'}`} />
    </button>
  );
}