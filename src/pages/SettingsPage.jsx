import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, AlertTriangle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function SettingsPage() {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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