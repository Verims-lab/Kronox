import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, AlertTriangle, Loader2, ChevronRight, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import TopScores from '@/components/game/TopScores';
import StandardTopBar from '@/components/layout/StandardTopBar';
import { getLeaderboardDiamondValue } from '@/lib/leaderboard';
import { ACCOUNT_DELETION_ERROR_COPY, requestAccountDeletion } from '@/lib/accountDeletion';
import CategoryPreferencesSection from '@/components/settings/CategoryPreferencesSection';
import { useAuth } from '@/lib/AuthContext';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const diamondValue = getLeaderboardDiamondValue(user);

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
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

      <div className="px-4 pb-1">
        <h1 className="font-cinzel text-2xl font-black tracking-wide text-foreground">Ayarlar</h1>
      </div>

      <div className="px-4 space-y-5">
        {/* Top 5 — giriş yapmış tüm kullanıcılar */}
        {user && (
          <Section label="En İyi 5 Rekorun">
            <div className="p-4 rounded-2xl border border-border/40 bg-secondary/20">
              <TopScores user={user} />
            </div>
          </Section>
        )}

        {user && (
          <Section label="İlgi Alanlarım">
            <CategoryPreferencesSection user={user} />
          </Section>
        )}

        {/* Yardım */}
        <Section label="Yardım">
          <ToolCard
            icon={<FileText className="w-4 h-4" />}
            title="Gizlilik Politikası"
            desc="Veri kullanımı ve kullanıcı hakları"
            onClick={() => navigate('/privacy')}
          />
        </Section>

        {/* Hesap — tüm kullanıcılar */}
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
